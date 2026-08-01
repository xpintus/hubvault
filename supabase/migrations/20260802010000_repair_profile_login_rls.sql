/* Forward-only repair for the profile-login RLS regression. */

create or replace function public.user_role()
returns public.user_role language sql stable security definer
set search_path = public, pg_temp as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.user_hub_id()
returns uuid language sql stable security definer
set search_path = public, pg_temp as $$
  select p.hub_id from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.user_hub_ids()
returns uuid[] language sql stable security definer
set search_path = public, pg_temp as $$
  select coalesce(array_agg(distinct accessible.hub_id), array[]::uuid[])
  from (
    select uha.hub_id from public.user_hub_access uha where uha.user_id = auth.uid()
    union
    select p.hub_id from public.profiles p
      where p.id = auth.uid() and p.hub_id is not null
  ) accessible;
$$;

create or replace function public.user_can_access_hub(p_hub_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select public.user_role() = 'super_admin'
    or p_hub_id = any(public.user_hub_ids());
$$;

create or replace function public.user_can_manage_hub_users(p_hub_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select public.user_role() = 'super_admin'
    or (public.user_role() = 'hub_admin' and public.user_can_access_hub(p_hub_id));
$$;

revoke all on function public.user_role() from public, anon;
revoke all on function public.user_hub_id() from public, anon;
revoke all on function public.user_hub_ids() from public, anon;
revoke all on function public.user_can_access_hub(uuid) from public, anon;
revoke all on function public.user_can_manage_hub_users(uuid) from public, anon;
grant execute on function public.user_role() to authenticated;
grant execute on function public.user_hub_id() to authenticated;
grant execute on function public.user_hub_ids() to authenticated;
grant execute on function public.user_can_access_hub(uuid) to authenticated;
grant execute on function public.user_can_manage_hub_users(uuid) to authenticated;

drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_select_self" on public.profiles;
drop policy if exists "profiles_select_super_admin" on public.profiles;
drop policy if exists "profiles_select_hub_admin" on public.profiles;
drop policy if exists "profiles_select_supervisor" on public.profiles;

-- No profile-reading helper: authenticated users can always load themselves.
create policy "profiles_select_self" on public.profiles for select to authenticated
  using (id = auth.uid());
create policy "profiles_select_super_admin" on public.profiles for select to authenticated
  using (public.user_role() = 'super_admin');
create policy "profiles_select_hub_admin" on public.profiles for select to authenticated
  using (public.user_role() = 'hub_admin' and hub_id is not null
    and public.user_can_access_hub(hub_id) and role in ('collector', 'supervisor'));
create policy "profiles_select_supervisor" on public.profiles for select to authenticated
  using (public.user_role() = 'supervisor' and hub_id is not null
    and public.user_can_access_hub(hub_id) and role = 'collector');

-- Supervisors remain unable to write profiles. Hub admins can manage only
-- collector/supervisor accounts in an accessible hub, never themselves.
drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert" on public.profiles for insert to authenticated
  with check (public.user_role() = 'super_admin' or
    (public.user_role() = 'hub_admin' and hub_id is not null
      and public.user_can_access_hub(hub_id) and role in ('collector', 'supervisor')));

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles for update to authenticated
  using (public.user_role() = 'super_admin' or
    (public.user_role() = 'hub_admin' and hub_id is not null
      and public.user_can_access_hub(hub_id) and role in ('collector', 'supervisor')
      and id <> auth.uid()))
  with check (public.user_role() = 'super_admin' or
    (public.user_role() = 'hub_admin' and hub_id is not null
      and public.user_can_access_hub(hub_id) and role in ('collector', 'supervisor')
      and id <> auth.uid()));

drop policy if exists "profiles_delete" on public.profiles;
create policy "profiles_delete" on public.profiles for delete to authenticated
  using (public.user_role() = 'super_admin' or
    (public.user_role() = 'hub_admin' and hub_id is not null
      and public.user_can_access_hub(hub_id) and role in ('collector', 'supervisor')));

drop policy if exists "uha_select" on public.user_hub_access;
create policy "uha_select" on public.user_hub_access for select to authenticated
  using (public.user_role() = 'super_admin' or user_id = auth.uid()
    or public.user_can_manage_hub_users(hub_id));
drop policy if exists "uha_insert" on public.user_hub_access;
create policy "uha_insert" on public.user_hub_access for insert to authenticated
  with check (public.user_can_manage_hub_users(hub_id));
drop policy if exists "uha_delete" on public.user_hub_access;
create policy "uha_delete" on public.user_hub_access for delete to authenticated
  using (public.user_can_manage_hub_users(hub_id));
