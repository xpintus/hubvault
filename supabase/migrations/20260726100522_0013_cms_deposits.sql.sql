/*
# CMS Depositions

## Purpose
Record the physical deposition of collected cash to a bank / CMS (Cash
Management System). For each deposit, the hub records:
  - total_cash_collected — total cash collected on that date (auto-summed
    from collection_entries, editable)
  - cash_deposited — actual cash handed over at the CMS / bank counter
  - online_amount — total online payments collected that date
  - short_amount — shortage = total_cash_collected - cash_deposited
    (positive value means cash not yet deposited / missing)
  - reference_number — bank/CMS receipt number
  - remarks — free-text notes

## Tables Created
1. `cms_deposits`
   - id (uuid pk)
   - deposit_date (date, not null)
   - hub_id (uuid fk -> hubs, not null)
   - total_cash_collected numeric(14,2)
   - cash_deposited numeric(14,2)
   - online_amount numeric(14,2)
   - short_amount numeric(14,2)
   - reference_number text
   - remarks text
   - created_by uuid fk -> profiles
   - created_at, updated_at timestamptz

## Security (RLS)
- SELECT: super_admin reads all; others read deposits in their own hub.
- INSERT/UPDATE/DELETE: super_admin + hub_admin/supervisor of that hub.

## Notes
- Authorization reuses existing `user_role()` and `user_hub_id()` helpers.
- `created_by` defaults to auth.uid() via the frontend insert.
- updated_at trigger reused.
*/

create table if not exists public.cms_deposits (
  id uuid primary key default gen_random_uuid(),
  deposit_date date not null,
  hub_id uuid not null references public.hubs(id) on delete cascade,
  total_cash_collected numeric(14,2) not null default 0,
  cash_deposited numeric(14,2) not null default 0,
  online_amount numeric(14,2) not null default 0,
  short_amount numeric(14,2) not null default 0,
  reference_number text,
  remarks text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cms_deposits_date on public.cms_deposits(deposit_date);
create index if not exists idx_cms_deposits_hub on public.cms_deposits(hub_id);

-- updated_at trigger
drop trigger if exists trg_cms_deposits_updated on public.cms_deposits;
create trigger trg_cms_deposits_updated
before update on public.cms_deposits
for each row execute function public.touch_updated_at();

-- ---------- RLS ----------
alter table public.cms_deposits enable row level security;

drop policy if exists "cms_deposits_select" on public.cms_deposits;
create policy "cms_deposits_select" on public.cms_deposits for select
  to authenticated
  using (
    public.user_role() = 'super_admin'
    or hub_id = public.user_hub_id()
  );

drop policy if exists "cms_deposits_insert" on public.cms_deposits;
create policy "cms_deposits_insert" on public.cms_deposits for insert
  to authenticated
  with check (
    public.user_role() = 'super_admin'
    or (
      public.user_role() in ('hub_admin','supervisor')
      and hub_id = public.user_hub_id()
    )
  );

drop policy if exists "cms_deposits_update" on public.cms_deposits;
create policy "cms_deposits_update" on public.cms_deposits for update
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

drop policy if exists "cms_deposits_delete" on public.cms_deposits;
create policy "cms_deposits_delete" on public.cms_deposits for delete
  to authenticated
  using (
    public.user_role() = 'super_admin'
    or (
      public.user_role() in ('hub_admin','supervisor')
      and hub_id = public.user_hub_id()
    )
  );
