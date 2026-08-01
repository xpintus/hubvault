/*
# Supervisor Privacy Security Migration

## Purpose
Enforces Supervisor Data Privacy across profiles and user_hub_access tables:
1. Restricts `profiles` SELECT so supervisors can ONLY see their own profile and `collector` profiles in their assigned hubs. Supervisors cannot view `hub_admin` or `super_admin` profiles.
2. Restricts `profiles` INSERT, UPDATE, and DELETE policies so supervisors cannot create, modify, or delete any profiles.
3. Restricts `user_hub_access` policies so supervisors cannot view or modify hub access assignments of other users.
4. Uses SECURITY DEFINER helper functions and separate SELECT policies to avoid RLS recursion while preserving self-profile loading (`id = auth.uid()`).
*/

-- ---------- 1. SECURITY DEFINER HELPER FUNCTIONS (Prevent RLS Recursion) ----------

create or replace function public.user_role()
returns user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.user_hub_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select hub_id from public.profiles where id = auth.uid();
$$;

create or replace function public.user_hub_ids()
returns uuid[]
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  result uuid[];
  legacy uuid;
begin
  select array_agg(hub_id) into result
  from public.user_hub_access
  where user_id = auth.uid();

  select p.hub_id into legacy
  from public.profiles p
  where p.id = auth.uid();

  if legacy is not null then
    if result is null then
      result := array[legacy];
    elsif not (legacy = any(result)) then
      result := result || array[legacy];
    end if;
  end if;

  return coalesce(result, array[]::uuid[]);
end;
$$;

create or replace function public.user_can_access_hub(p_hub_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.user_role() = 'super_admin'
    or p_hub_id = any(public.user_hub_ids());
$$;

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

-- ---------- 2. PROFILES SELECT POLICIES (Supervisor Privacy & Self Load) ----------

drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_select_self" on public.profiles;
drop policy if exists "profiles_select_super_admin" on public.profiles;
drop policy if exists "profiles_select_hub_admin" on public.profiles;
drop policy if exists "profiles_select_supervisor" on public.profiles;

-- Self profile read (Guaranteed for profile loading without helper calls)
create policy "profiles_select_self" on public.profiles for select
  to authenticated
  using (id = auth.uid());

-- Super admin reads all profiles
create policy "profiles_select_super_admin" on public.profiles for select
  to authenticated
  using (public.user_role() = 'super_admin');

-- Hub admin reads collector & supervisor profiles in accessible hubs
create policy "profiles_select_hub_admin" on public.profiles for select
  to authenticated
  using (
    public.user_role() = 'hub_admin'
    and hub_id is not null
    and public.user_can_access_hub(hub_id)
    and role in ('collector', 'supervisor')
  );

-- Supervisor reads collector profiles in accessible hubs (CANNOT read hub_admin / super_admin profiles)
create policy "profiles_select_supervisor" on public.profiles for select
  to authenticated
  using (
    public.user_role() = 'supervisor'
    and hub_id is not null
    and public.user_can_access_hub(hub_id)
    and role = 'collector'
  );

-- ---------- 3. PROFILES INSERT, UPDATE, DELETE POLICIES ----------

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

-- ---------- 4. USER_HUB_ACCESS POLICIES ----------

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
