/*
# Collection Reconciliation — Initial Schema

## Purpose
Multi-hub logistics finance system to reconcile daily COD (cash-on-delivery)
collections. Each hub has collectors who hand in cash + online payments;
supervisors/hub-admins reconcile expected COD vs actual collection and
track shortages/excesses.

## Tables Created
1. `hubs` — logistics branches/warehouses (id, name, code, location, status, created_at)
2. `profiles` — app users linked to Supabase auth, with role + hub assignment
   (id, name, email, role, hub_id, created_at)
3. `collectors` — field staff who collect payments
   (id, name, employee_id, phone, hub_id, status, created_at)
4. `collection_entries` — one daily collection record per collector
   (id, collection_date, collector_id, hub_id, expected_cod, cash_amount,
    online_amount, online_payment_mode, total_collection, gap, status, remarks,
    created_by, created_at, updated_at)
5. `denominations` — note breakdown for a collection entry (cash count proof)
   (id, collection_entry_id, note_500..note_1)

## Enums
- `user_role`: 'super_admin', 'hub_admin', 'supervisor', 'collector'
- `hub_status`: 'active', 'inactive'
- `collector_status`: 'active', 'inactive'
- `entry_status`: 'reconciled', 'pending', 'shortage', 'excess'
- `online_payment_mode`: 'upi', 'bank_transfer', 'other'

## Security (RLS)
- `profiles`: authenticated users read self; super_admin reads all; others read
  users in their hub. Self can update own profile; super_admin can manage all.
- `hubs`: authenticated read all hubs (needed for dropdowns/reports);
  create/update/delete restricted to super_admin.
- `collectors`: authenticated read within their hub (super_admin reads all);
  create/update/delete restricted to hub_admin/super_admin of that hub.
- `collection_entries`: read scoped by role (super_admin = all, others = own hub).
  create/update/delete scoped to hub_admin/supervisor/super_admin of that hub.
- `denominations`: access follows its parent collection_entry via EXISTS check.

## Notes
- Authorization uses `auth.uid()` + helper functions `user_role()` and
  `user_hub_id()` reading from `profiles` for clean policy predicates.
- `created_by` on entries defaults to auth.uid().
- Email confirmation stays OFF (default).
*/

-- Extension for gen_random_uuid
create extension if not exists "pgcrypto";

-- ---------- Enums ----------
do $$ begin
  create type user_role as enum ('super_admin', 'hub_admin', 'supervisor', 'collector');
exception when duplicate_object then null; end $$;

do $$ begin
  create type hub_status as enum ('active', 'inactive');
exception when duplicate_object then null; end $$;

do $$ begin
  create type collector_status as enum ('active', 'inactive');
exception when duplicate_object then null; end $$;

do $$ begin
  create type entry_status as enum ('reconciled', 'pending', 'shortage', 'excess');
exception when duplicate_object then null; end $$;

do $$ begin
  create type online_payment_mode as enum ('upi', 'bank_transfer', 'other');
exception when duplicate_object then null; end $$;

-- ---------- Tables ----------
create table if not exists public.hubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  location text,
  status hub_status not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role user_role not null default 'collector',
  hub_id uuid references public.hubs(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.collectors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  employee_id text not null,
  phone text,
  hub_id uuid not null references public.hubs(id) on delete cascade,
  status collector_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (employee_id, hub_id)
);

create table if not exists public.collection_entries (
  id uuid primary key default gen_random_uuid(),
  collection_date date not null,
  collector_id uuid not null references public.collectors(id) on delete cascade,
  hub_id uuid not null references public.hubs(id) on delete cascade,
  expected_cod numeric(14,2) not null default 0,
  cash_amount numeric(14,2) not null default 0,
  online_amount numeric(14,2) not null default 0,
  online_payment_mode online_payment_mode,
  total_collection numeric(14,2) not null default 0,
  gap numeric(14,2) not null default 0,
  status entry_status not null default 'pending',
  remarks text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_collection_entries_date on public.collection_entries(collection_date);
create index if not exists idx_collection_entries_hub on public.collection_entries(hub_id);
create index if not exists idx_collection_entries_collector on public.collection_entries(collector_id);
create index if not exists idx_collection_entries_status on public.collection_entries(status);

create table if not exists public.denominations (
  id uuid primary key default gen_random_uuid(),
  collection_entry_id uuid not null references public.collection_entries(id) on delete cascade,
  note_500 integer not null default 0,
  note_200 integer not null default 0,
  note_100 integer not null default 0,
  note_50 integer not null default 0,
  note_20 integer not null default 0,
  note_10 integer not null default 0,
  note_5 integer not null default 0,
  note_2 integer not null default 0,
  note_1 integer not null default 0
);

create index if not exists idx_denominations_entry on public.denominations(collection_entry_id);

-- ---------- Helper functions for policies (after profiles exists) ----------
create or replace function public.user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.user_hub_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select hub_id from public.profiles where id = auth.uid();
$$;

-- ---------- updated_at trigger ----------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_collection_entries_updated on public.collection_entries;
create trigger trg_collection_entries_updated
before update on public.collection_entries
for each row execute function public.touch_updated_at();

-- ---------- RLS ----------
alter table public.hubs enable row level security;
alter table public.profiles enable row level security;
alter table public.collectors enable row level security;
alter table public.collection_entries enable row level security;
alter table public.denominations enable row level security;

-- HUBS
drop policy if exists "hubs_select" on public.hubs;
create policy "hubs_select" on public.hubs for select
  to authenticated using (true);

drop policy if exists "hubs_insert" on public.hubs;
create policy "hubs_insert" on public.hubs for insert
  to authenticated with check (public.user_role() = 'super_admin');

drop policy if exists "hubs_update" on public.hubs;
create policy "hubs_update" on public.hubs for update
  to authenticated using (public.user_role() = 'super_admin')
  with check (public.user_role() = 'super_admin');

drop policy if exists "hubs_delete" on public.hubs;
create policy "hubs_delete" on public.hubs for delete
  to authenticated using (public.user_role() = 'super_admin');

-- PROFILES
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select
  to authenticated
  using (
    id = auth.uid()
    or public.user_role() = 'super_admin'
    or (public.user_role() in ('hub_admin','supervisor','collector') and hub_id = public.user_hub_id())
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
  to authenticated using (public.user_role() = 'super_admin');

-- COLLECTORS
drop policy if exists "collectors_select" on public.collectors;
create policy "collectors_select" on public.collectors for select
  to authenticated
  using (
    public.user_role() = 'super_admin'
    or hub_id = public.user_hub_id()
  );

drop policy if exists "collectors_insert" on public.collectors;
create policy "collectors_insert" on public.collectors for insert
  to authenticated
  with check (
    public.user_role() = 'super_admin'
    or (public.user_role() = 'hub_admin' and hub_id = public.user_hub_id())
  );

drop policy if exists "collectors_update" on public.collectors;
create policy "collectors_update" on public.collectors for update
  to authenticated
  using (
    public.user_role() = 'super_admin'
    or (public.user_role() = 'hub_admin' and hub_id = public.user_hub_id())
  )
  with check (
    public.user_role() = 'super_admin'
    or (public.user_role() = 'hub_admin' and hub_id = public.user_hub_id())
  );

drop policy if exists "collectors_delete" on public.collectors;
create policy "collectors_delete" on public.collectors for delete
  to authenticated
  using (
    public.user_role() = 'super_admin'
    or (public.user_role() = 'hub_admin' and hub_id = public.user_hub_id())
  );

-- COLLECTION ENTRIES
drop policy if exists "entries_select" on public.collection_entries;
create policy "entries_select" on public.collection_entries for select
  to authenticated
  using (
    public.user_role() = 'super_admin'
    or hub_id = public.user_hub_id()
  );

drop policy if exists "entries_insert" on public.collection_entries;
create policy "entries_insert" on public.collection_entries for insert
  to authenticated
  with check (
    public.user_role() = 'super_admin'
    or (
      public.user_role() in ('hub_admin','supervisor')
      and hub_id = public.user_hub_id()
    )
  );

drop policy if exists "entries_update" on public.collection_entries;
create policy "entries_update" on public.collection_entries for update
  to authenticated
  using (
    public.user_role() = 'super_admin'
    or (
      public.user_role() in ('hub_admin','supervisor')
      and hub_id = public.user_hub_id()
    )
  )
  with check (
    public.user_role() = 'super_admin'
    or (
      public.user_role() in ('hub_admin','supervisor')
      and hub_id = public.user_hub_id()
    )
  );

drop policy if exists "entries_delete" on public.collection_entries;
create policy "entries_delete" on public.collection_entries for delete
  to authenticated
  using (
    public.user_role() = 'super_admin'
    or (
      public.user_role() in ('hub_admin','supervisor')
      and hub_id = public.user_hub_id()
    )
  );

-- DENOMINATIONS (follow parent entry)
drop policy if exists "denom_select" on public.denominations;
create policy "denom_select" on public.denominations for select
  to authenticated
  using (
    exists (
      select 1 from public.collection_entries ce
      where ce.id = public.denominations.collection_entry_id
      and (
        public.user_role() = 'super_admin'
        or ce.hub_id = public.user_hub_id()
      )
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
        or (public.user_role() in ('hub_admin','supervisor') and ce.hub_id = public.user_hub_id())
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
        or (public.user_role() in ('hub_admin','supervisor') and ce.hub_id = public.user_hub_id())
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
        or (public.user_role() in ('hub_admin','supervisor') and ce.hub_id = public.user_hub_id())
      )
    )
  );
