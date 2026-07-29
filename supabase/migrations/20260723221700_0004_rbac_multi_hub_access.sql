/*
# RBAC & Multi-Hub Access Management

## Purpose
Adds multi-hub access control so a Hub Admin can be assigned to multiple hubs,
a Hub Supervisor to exactly one hub, and a Super User sees everything.
Introduces the CAN_CREATE_HUB permission and a full audit log.

## Changes
1. `user_hub_access` table — many-to-many mapping of users to hubs they can access.
2. `profiles.can_create_hub` boolean — permission flag for Hub Admins.
3. `hubs.created_by` uuid — who created the hub (for ownership tracking).
4. `audit_logs` table — tracks all access/role/permission changes.
5. Helper SQL functions for RLS: `user_hub_ids()` returns the set of hub ids
   the current user can access (from user_hub_access + their own hub_id for
   backwards compat). `user_can_access_hub(uuid)` checks a specific hub.
6. Updated RLS policies on hubs, profiles, collectors, collection_entries,
   dues, recoveries to enforce multi-hub access at the database level.
7. Backfill: every existing profile's hub_id is inserted into user_hub_access
   so no access is lost.
*/

-- ---------- user_hub_access ----------
create table if not exists public.user_hub_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  hub_id uuid not null references public.hubs(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, hub_id)
);

create index if not exists idx_uha_user on public.user_hub_access(user_id);
create index if not exists idx_uha_hub on public.user_hub_access(hub_id);

-- ---------- profiles: add can_create_hub ----------
alter table public.profiles add column if not exists can_create_hub boolean not null default false;

-- ---------- hubs: add created_by ----------
alter table public.hubs add column if not exists created_by uuid references public.profiles(id) on delete set null;

-- ---------- audit_logs ----------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  performed_by uuid references public.profiles(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  target_hub_id uuid references public.hubs(id) on delete set null,
  details text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_performed_by on public.audit_logs(performed_by);
create index if not exists idx_audit_created_at on public.audit_logs(created_at desc);
create index if not exists idx_audit_action on public.audit_logs(action);

-- ---------- Backfill user_hub_access from existing profiles.hub_id ----------
insert into public.user_hub_access (user_id, hub_id)
  select p.id, p.hub_id from public.profiles p
  where p.hub_id is not null
  on conflict (user_id, hub_id) do nothing;

-- ---------- Helper functions ----------
create or replace function public.user_hub_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    array_agg(uha.hub_id) filter (where uha.hub_id is not null),
    array[]::uuid[]
  )
  from public.user_hub_access uha
  where uha.user_id = auth.uid()
  -- also include the legacy single hub_id from profiles for backwards compat
  union
  select case when p.hub_id is not null then array[p.hub_id] else array[]::uuid[] end
  from public.profiles p
  where p.id = auth.uid();
$$;

-- Simpler, more reliable version using a PL/pgSQL aggregate
create or replace function public.user_hub_ids()
returns uuid[]
language plpgsql
stable
security definer
set search_path = public
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
set search_path = public
as $$
  select
    public.user_role() = 'super_admin'
    or p_hub_id = any(public.user_hub_ids());
$$;

-- ---------- Enable RLS on new tables ----------
alter table public.user_hub_access enable row level security;
alter table public.audit_logs enable row level security;

-- user_hub_access policies: super_admin full, users read own access rows
drop policy if exists "uha_select" on public.user_hub_access;
create policy "uha_select" on public.user_hub_access for select
  to authenticated
  using (
    public.user_role() = 'super_admin'
    or user_id = auth.uid()
  );

drop policy if exists "uha_insert" on public.user_hub_access;
create policy "uha_insert" on public.user_hub_access for insert
  to authenticated
  with check (public.user_role() = 'super_admin');

drop policy if exists "uha_delete" on public.user_hub_access;
create policy "uha_delete" on public.user_hub_access for delete
  to authenticated
  using (public.user_role() = 'super_admin');

-- audit_logs policies: super_admin full, others read-only own/visible
drop policy if exists "audit_select" on public.audit_logs;
create policy "audit_select" on public.audit_logs for select
  to authenticated
  using (
    public.user_role() = 'super_admin'
    or performed_by = auth.uid()
  );

drop policy if exists "audit_insert" on public.audit_logs;
create policy "audit_insert" on public.audit_logs for insert
  to authenticated
  with check (true);

drop policy if exists "audit_delete" on public.audit_logs;
create policy "audit_delete" on public.audit_logs for delete
  to authenticated
  using (public.user_role() = 'super_admin');

-- ---------- Update existing RLS policies for multi-hub ----------

-- HUBS: select only hubs the user can access (super_admin sees all)
drop policy if exists "hubs_select" on public.hubs;
create policy "hubs_select" on public.hubs for select
  to authenticated
  using (
    public.user_role() = 'super_admin'
    or id = any(public.user_hub_ids())
  );

drop policy if exists "hubs_insert" on public.hubs;
create policy "hubs_insert" on public.hubs for insert
  to authenticated
  with check (
    public.user_role() = 'super_admin'
    or (public.user_role() = 'hub_admin' and (select can_create_hub from public.profiles where id = auth.uid()) = true)
  );

drop policy if exists "hubs_update" on public.hubs;
create policy "hubs_update" on public.hubs for update
  to authenticated
  using (
    public.user_role() = 'super_admin'
    or (public.user_role() = 'hub_admin' and id = any(public.user_hub_ids()))
  )
  with check (
    public.user_role() = 'super_admin'
    or (public.user_role() = 'hub_admin' and id = any(public.user_hub_ids()))
  );

drop policy if exists "hubs_delete" on public.hubs;
create policy "hubs_delete" on public.hubs for delete
  to authenticated
  using (public.user_role() = 'super_admin');

-- PROFILES: super_admin sees all; others see users who share at least one hub
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
  );

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles for update
  to authenticated
  using (id = auth.uid() or public.user_role() = 'super_admin')
  with check (id = auth.uid() or public.user_role() = 'super_admin');

drop policy if exists "profiles_delete" on public.profiles;
create policy "profiles_delete" on public.profiles for delete
  to authenticated
  using (public.user_role() = 'super_admin');

-- COLLECTORS: must be within accessible hubs
drop policy if exists "collectors_select" on public.collectors;
create policy "collectors_select" on public.collectors for select
  to authenticated
  using (public.user_can_access_hub(hub_id));

drop policy if exists "collectors_insert" on public.collectors;
create policy "collectors_insert" on public.collectors for insert
  to authenticated
  with check (
    public.user_role() = 'super_admin'
    or (public.user_role() in ('hub_admin','supervisor') and public.user_can_access_hub(hub_id))
  );

drop policy if exists "collectors_update" on public.collectors;
create policy "collectors_update" on public.collectors for update
  to authenticated
  using (
    public.user_role() = 'super_admin'
    or (public.user_role() in ('hub_admin','supervisor') and public.user_can_access_hub(hub_id))
  )
  with check (
    public.user_role() = 'super_admin'
    or (public.user_role() in ('hub_admin','supervisor') and public.user_can_access_hub(hub_id))
  );

drop policy if exists "collectors_delete" on public.collectors;
create policy "collectors_delete" on public.collectors for delete
  to authenticated
  using (
    public.user_role() = 'super_admin'
    or (public.user_role() in ('hub_admin','supervisor') and public.user_can_access_hub(hub_id))
  );

-- COLLECTION ENTRIES
drop policy if exists "entries_select" on public.collection_entries;
create policy "entries_select" on public.collection_entries for select
  to authenticated
  using (public.user_can_access_hub(hub_id));

drop policy if exists "entries_insert" on public.collection_entries;
create policy "entries_insert" on public.collection_entries for insert
  to authenticated
  with check (
    public.user_role() = 'super_admin'
    or (
      public.user_role() in ('hub_admin','supervisor')
      and public.user_can_access_hub(hub_id)
    )
  );

drop policy if exists "entries_update" on public.collection_entries;
create policy "entries_update" on public.collection_entries for update
  to authenticated
  using (
    public.user_role() = 'super_admin'
    or (
      public.user_role() in ('hub_admin','supervisor')
      and public.user_can_access_hub(hub_id)
    )
  )
  with check (
    public.user_role() = 'super_admin'
    or (
      public.user_role() in ('hub_admin','supervisor')
      and public.user_can_access_hub(hub_id)
    )
  );

drop policy if exists "entries_delete" on public.collection_entries;
create policy "entries_delete" on public.collection_entries for delete
  to authenticated
  using (
    public.user_role() = 'super_admin'
    or (
      public.user_role() in ('hub_admin','supervisor')
      and public.user_can_access_hub(hub_id)
    )
  );

-- DENOMINATIONS (follow parent entry — reuse user_can_access_hub)
drop policy if exists "denom_select" on public.denominations;
create policy "denom_select" on public.denominations for select
  to authenticated
  using (
    exists (
      select 1 from public.collection_entries ce
      where ce.id = public.denominations.collection_entry_id
      and public.user_can_access_hub(ce.hub_id)
    )
  );

drop policy if exists "denom_insert" on public.denominations;
create policy "denom_insert" on public.denominations for insert
  to authenticated
  with check (
    exists (
      select 1 from public.collection_entries ce
      where ce.id = public.denominations.collection_entry_id
      and (
        public.user_role() = 'super_admin'
        or (public.user_role() in ('hub_admin','supervisor') and public.user_can_access_hub(ce.hub_id))
      )
    )
  );

drop policy if exists "denom_update" on public.denominations;
create policy "denom_update" on public.denominations for update
  to authenticated
  using (
    exists (
      select 1 from public.collection_entries ce
      where ce.id = public.denominations.collection_entry_id
      and (
        public.user_role() = 'super_admin'
        or (public.user_role() in ('hub_admin','supervisor') and public.user_can_access_hub(ce.hub_id))
      )
    )
  );

drop policy if exists "denom_delete" on public.denominations;
create policy "denom_delete" on public.denominations for delete
  to authenticated
  using (
    exists (
      select 1 from public.collection_entries ce
      where ce.id = public.denominations.collection_entry_id
      and (
        public.user_role() = 'super_admin'
        or (public.user_role() in ('hub_admin','supervisor') and public.user_can_access_hub(ce.hub_id))
      )
    )
  );

-- DUES
drop policy if exists "dues_select_own_dues" on public.dues;
create policy "dues_select" on public.dues for select
  to authenticated
  using (public.user_can_access_hub(hub_id));

drop policy if exists "dues_insert_own_dues" on public.dues;
create policy "dues_insert" on public.dues for insert
  to authenticated
  with check (
    public.user_role() = 'super_admin'
    or (
      public.user_role() in ('hub_admin','supervisor')
      and public.user_can_access_hub(hub_id)
    )
  );

drop policy if exists "dues_update_own_dues" on public.dues;
create policy "dues_update" on public.dues for update
  to authenticated
  using (
    public.user_role() = 'super_admin'
    or (
      public.user_role() in ('hub_admin','supervisor')
      and public.user_can_access_hub(hub_id)
    )
  )
  with check (
    public.user_role() = 'super_admin'
    or (
      public.user_role() in ('hub_admin','supervisor')
      and public.user_can_access_hub(hub_id)
    )
  );

drop policy if exists "dues_delete_own_dues" on public.dues;
create policy "dues_delete" on public.dues for delete
  to authenticated
  using (
    public.user_role() = 'super_admin'
    or (
      public.user_role() in ('hub_admin','supervisor')
      and public.user_can_access_hub(hub_id)
    )
  );

-- RECOVERIES
drop policy if exists "recoveries_select_own_recoveries" on public.recoveries;
create policy "recoveries_select" on public.recoveries for select
  to authenticated
  using (public.user_can_access_hub(hub_id));

drop policy if exists "recoveries_insert_own_recoveries" on public.recoveries;
create policy "recoveries_insert" on public.recoveries for insert
  to authenticated
  with check (
    public.user_role() = 'super_admin'
    or (
      public.user_role() in ('hub_admin','supervisor')
      and public.user_can_access_hub(hub_id)
    )
  );

drop policy if exists "recoveries_update_own_recoveries" on public.recoveries;
create policy "recoveries_update" on public.recoveries for update
  to authenticated
  using (
    public.user_role() = 'super_admin'
    or (
      public.user_role() in ('hub_admin','supervisor')
      and public.user_can_access_hub(hub_id)
    )
  )
  with check (
    public.user_role() = 'super_admin'
    or (
      public.user_role() in ('hub_admin','supervisor')
      and public.user_can_access_hub(hub_id)
    )
  );

drop policy if exists "recoveries_delete_own_recoveries" on public.recoveries;
create policy "recoveries_delete" on public.recoveries for delete
  to authenticated
  using (
    public.user_role() = 'super_admin'
    or (
      public.user_role() in ('hub_admin','supervisor')
      and public.user_can_access_hub(hub_id)
    )
  );
