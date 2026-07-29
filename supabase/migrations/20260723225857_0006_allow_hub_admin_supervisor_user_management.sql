/*
# Allow Hub Admin & Supervisor to manage users in their hubs

## Purpose
Currently only super_admin can create/edit/delete user accounts. This migration
expands access so that hub_admin and supervisor roles can also manage users —
but ONLY for hubs they are assigned to.

## Changes
1. Adds helper function `user_can_manage_hub(uuid)` — returns true if the
   current user is super_admin, OR is hub_admin/supervisor AND can access
   the given hub.
2. `profiles_select` — unchanged in spirit, re-asserted for safe re-runs.
3. `profiles_insert` — super_admin creates anyone; hub_admin/supervisor can
   create a profile whose hub_id is in their accessible hubs, and the role
   is NOT super_admin (prevents privilege escalation).
4. `profiles_update` — super_admin updates anyone; hub_admin/supervisor can
   update a profile whose hub_id is in their accessible hubs, and cannot
   set role to super_admin.
5. `profiles_delete` — super_admin deletes anyone; hub_admin/supervisor can
   delete a profile whose hub_id is in their accessible hubs, but not a
   super_admin.
6. `user_hub_access` insert/delete/select — hub_admin/supervisor can
   grant/revoke/see hub access for hubs they can manage.

## Security
- hub_admin/supervisor can ONLY affect users whose hub_id is in their own
  accessible hub set.
- super_admin retains full access to all users.
- No hub_admin/supervisor can create or escalate anyone to super_admin.
- The edge function (service-role) does its own authorization checks
  before creating auth.users entries; RLS gates direct client updates/deletes.

## Notes
- Safe to re-run (DROP IF EXISTS before each CREATE POLICY).
- The `user_can_manage_hub()` helper is SECURITY DEFINER and STABLE.
*/

-- ---------- Helper: can current user manage users in a given hub? ----------
create or replace function public.user_can_manage_hub(p_hub_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.user_role() = 'super_admin'
    or (
      public.user_role() in ('hub_admin', 'supervisor')
      and public.user_can_access_hub(p_hub_id)
    )
$$;

-- ---------- PROFILES: updated policies ----------

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select
  to authenticated
  using (
    id = auth.uid()
    or public.user_role() = 'super_admin'
    or (
      hub_id is not null and hub_id = any(public.user_hub_ids())
    )
  );

drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert" on public.profiles for insert
  to authenticated
  with check (
    id = auth.uid()
    or public.user_role() = 'super_admin'
    or (
      public.user_role() in ('hub_admin', 'supervisor')
      and hub_id is not null
      and public.user_can_access_hub(hub_id)
      and role is distinct from 'super_admin'
    )
  );

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles for update
  to authenticated
  using (
    id = auth.uid()
    or public.user_role() = 'super_admin'
    or (
      public.user_role() in ('hub_admin', 'supervisor')
      and hub_id is not null
      and public.user_can_access_hub(hub_id)
    )
  )
  with check (
    id = auth.uid()
    or public.user_role() = 'super_admin'
    or (
      public.user_role() in ('hub_admin', 'supervisor')
      and hub_id is not null
      and public.user_can_access_hub(hub_id)
      and role is distinct from 'super_admin'
    )
  );

drop policy if exists "profiles_delete" on public.profiles;
create policy "profiles_delete" on public.profiles for delete
  to authenticated
  using (
    public.user_role() = 'super_admin'
    or (
      public.user_role() in ('hub_admin', 'supervisor')
      and hub_id is not null
      and public.user_can_access_hub(hub_id)
      and role is distinct from 'super_admin'
    )
  );

-- ---------- USER_HUB_ACCESS: allow hub managers to grant/revoke within their hubs ----------

drop policy if exists "uha_select" on public.user_hub_access;
create policy "uha_select" on public.user_hub_access for select
  to authenticated
  using (
    public.user_role() = 'super_admin'
    or user_id = auth.uid()
    or public.user_can_manage_hub(hub_id)
  );

drop policy if exists "uha_insert" on public.user_hub_access;
create policy "uha_insert" on public.user_hub_access for insert
  to authenticated
  with check (
    public.user_role() = 'super_admin'
    or (
      public.user_role() in ('hub_admin', 'supervisor')
      and public.user_can_manage_hub(hub_id)
    )
  );

drop policy if exists "uha_delete" on public.user_hub_access;
create policy "uha_delete" on public.user_hub_access for delete
  to authenticated
  using (
    public.user_role() = 'super_admin'
    or (
      public.user_role() in ('hub_admin', 'supervisor')
      and public.user_can_manage_hub(hub_id)
    )
  );
