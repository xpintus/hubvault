/*
# Security Patches Migration

## Summary of Changes
1. Supervisor Data Privacy:
   - Restricts `profiles_select` RLS policy so supervisors can ONLY see their own profile and collector profiles in their accessible hubs. Supervisors cannot view hub_admin or super_admin profiles.
   - Restricts `profiles_insert`, `profiles_update`, and `profiles_delete` policies so supervisors cannot create, edit, or delete any profiles.
   - Restricts `user_hub_access` policies (`uha_select`, `uha_insert`, `uha_delete`) to super_admin and hub_admin (and self-select). Supervisors cannot view or modify hub access records.

2. Self-Role Escalation Prevention:
   - Restricts direct `UPDATE` on `public.profiles` for non-super_admin users.
   - Creates a safe `public.update_my_profile` RPC that derives user identity from `auth.uid()`, accepts ONLY safe fields (`name`, `phone`, `company`, `location`), uses explicit `search_path = public, pg_temp` and `SECURITY DEFINER`, and never accepts protected fields (`role`, `is_approved`, `license_status`, `license_key`, `license_expires_at`, `hub_id`, `hub_credits`, `can_create_hub`, `referral_earnings`, etc.).
*/

-- ---------- 1. PROFILES & USER_HUB_ACCESS POLICIES (Supervisor Privacy & Role Protection) ----------

-- Update helper to check if current user is super_admin or hub_admin for user management
create or replace function public.user_can_manage_hub_users(p_hub_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.user_role() = 'super_admin'
    or (
      public.user_role() = 'hub_admin'
      and public.user_can_access_hub(p_hub_id)
    )
$$;

-- PROFILES SELECT:
-- - User can select own profile (id = auth.uid())
-- - super_admin can select all profiles
-- - hub_admin can select profiles in accessible hubs if target profile role is 'collector' or 'supervisor'
-- - supervisor can select profiles in accessible hubs ONLY if target profile role is 'collector'
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select
  to authenticated
  using (
    id = auth.uid()
    or public.user_role() = 'super_admin'
    or (
      public.user_role() = 'hub_admin'
      and hub_id is not null
      and public.user_can_access_hub(hub_id)
      and role in ('collector', 'supervisor')
    )
    or (
      public.user_role() = 'supervisor'
      and hub_id is not null
      and public.user_can_access_hub(hub_id)
      and role = 'collector'
    )
  );

-- PROFILES INSERT:
-- - super_admin can insert any profile
-- - hub_admin can insert profiles in accessible hubs where role in ('collector', 'supervisor')
-- - supervisor cannot insert profiles
drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert" on public.profiles for insert
  to authenticated
  with check (
    public.user_role() = 'super_admin'
    or (
      public.user_role() = 'hub_admin'
      and hub_id is not null
      and public.user_can_access_hub(hub_id)
      and role in ('collector', 'supervisor')
    )
  );

-- PROFILES UPDATE:
-- - super_admin can update any profile directly
-- - hub_admin can update profiles in accessible hubs where role in ('collector', 'supervisor') and id <> auth.uid()
-- - direct UPDATE by non-super_admin to own profile is disabled (users must call update_my_profile RPC)
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles for update
  to authenticated
  using (
    public.user_role() = 'super_admin'
    or (
      public.user_role() = 'hub_admin'
      and hub_id is not null
      and public.user_can_access_hub(hub_id)
      and role in ('collector', 'supervisor')
      and id <> auth.uid()
    )
  )
  with check (
    public.user_role() = 'super_admin'
    or (
      public.user_role() = 'hub_admin'
      and hub_id is not null
      and public.user_can_access_hub(hub_id)
      and role in ('collector', 'supervisor')
      and id <> auth.uid()
    )
  );

-- PROFILES DELETE:
-- - super_admin can delete any profile
-- - hub_admin can delete profiles in accessible hubs where role in ('collector', 'supervisor')
-- - supervisor cannot delete profiles
drop policy if exists "profiles_delete" on public.profiles;
create policy "profiles_delete" on public.profiles for delete
  to authenticated
  using (
    public.user_role() = 'super_admin'
    or (
      public.user_role() = 'hub_admin'
      and hub_id is not null
      and public.user_can_access_hub(hub_id)
      and role in ('collector', 'supervisor')
    )
  );

-- USER_HUB_ACCESS POLICIES:
-- Restricted to super_admin and hub_admin (plus self-select for user_id = auth.uid())
drop policy if exists "uha_select" on public.user_hub_access;
create policy "uha_select" on public.user_hub_access for select
  to authenticated
  using (
    public.user_role() = 'super_admin'
    or user_id = auth.uid()
    or public.user_can_manage_hub_users(hub_id)
  );

drop policy if exists "uha_insert" on public.user_hub_access;
create policy "uha_insert" on public.user_hub_access for insert
  to authenticated
  with check (
    public.user_role() = 'super_admin'
    or (
      public.user_role() = 'hub_admin'
      and public.user_can_manage_hub_users(hub_id)
    )
  );

drop policy if exists "uha_delete" on public.user_hub_access;
create policy "uha_delete" on public.user_hub_access for delete
  to authenticated
  using (
    public.user_role() = 'super_admin'
    or (
      public.user_role() = 'hub_admin'
      and public.user_can_manage_hub_users(hub_id)
    )
  );

-- ---------- 2. SAFE SELF-PROFILE UPDATE RPC (Prevents Self-Role Escalation) ----------

create or replace function public.update_my_profile(
  p_name text default null,
  p_phone text default null,
  p_company text default null,
  p_location text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid;
  v_updated record;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Unauthenticated caller';
  end if;

  update public.profiles
  set
    name = coalesce(nullif(trim(p_name), ''), name),
    phone = coalesce(trim(p_phone), phone),
    company = coalesce(trim(p_company), company),
    location = coalesce(trim(p_location), location)
  where id = v_uid
  returning * into v_updated;

  if not found then
    raise exception 'Profile not found';
  end if;

  return to_jsonb(v_updated);
end;
$$;

revoke execute on function public.update_my_profile(text, text, text, text) from public, anon;
grant execute on function public.update_my_profile(text, text, text, text) to authenticated;
