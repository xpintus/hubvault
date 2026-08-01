/*
# Fix Profile RLS Recursion & Restore Self-Profile Read

## Purpose
The previous monolithic profiles_select policy caused infinite recursion (SQLSTATE 42P17: infinite recursion detected in policy for relation "profiles") because combining self-read and role checks inside a single policy invoked user_role() during RLS evaluation of profiles.

## Fixes
1. Audit helper functions with SECURITY DEFINER and SET search_path = public, pg_temp so internal selects on profiles bypass RLS without recursion:
   - public.user_role()
   - public.user_hub_id()
   - public.user_hub_ids()
   - public.user_can_access_hub()
   - public.user_can_manage_hub_users()

2. Drop monolithic profiles_select policy and split into separate, non-recursive policies:
   - profiles_select_self: using (id = auth.uid()) -- Guaranteed self-read without calling any helper functions
   - profiles_select_super_admin: for super_admin reading all profiles
   - profiles_select_hub_admin: for hub_admin reading collectors/supervisors in accessible hubs
   - profiles_select_supervisor: for supervisors reading collectors in accessible hubs

3. Preserves:
   - Guaranteed self-profile read for every authenticated user
   - Supervisor cannot read hub_admin / super_admin profiles
   - Hub admin can read permitted collector/supervisor profiles
   - Super admin can read all profiles
   - Safe self-update via update_my_profile RPC (direct update of protected fields remains blocked)
*/

-- ---------- 1. AUDIT SECURITY DEFINER HELPER FUNCTIONS ----------

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

-- ---------- 2. SEPARATE PROFILES SELECT POLICIES ----------

-- Drop existing select policies
drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_select_self" on public.profiles;
drop policy if exists "profiles_select_super_admin" on public.profiles;
drop policy if exists "profiles_select_hub_admin" on public.profiles;
drop policy if exists "profiles_select_supervisor" on public.profiles;

-- 1. Guaranteed self-profile read (Zero helper functions, no recursion possible)
create policy "profiles_select_self" on public.profiles for select
  to authenticated
  using (id = auth.uid());

-- 2. Super admin reads all profiles
create policy "profiles_select_super_admin" on public.profiles for select
  to authenticated
  using (public.user_role() = 'super_admin');

-- 3. Hub admin reads collector & supervisor profiles in accessible hubs
create policy "profiles_select_hub_admin" on public.profiles for select
  to authenticated
  using (
    public.user_role() = 'hub_admin'
    and hub_id is not null
    and public.user_can_access_hub(hub_id)
    and role in ('collector', 'supervisor')
  );

-- 4. Supervisor reads collector profiles in accessible hubs (CANNOT read hub_admin / super_admin profiles)
create policy "profiles_select_supervisor" on public.profiles for select
  to authenticated
  using (
    public.user_role() = 'supervisor'
    and hub_id is not null
    and public.user_can_access_hub(hub_id)
    and role = 'collector'
  );
