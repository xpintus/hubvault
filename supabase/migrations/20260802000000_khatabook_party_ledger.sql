/*
# KhataBook (Party Ledger) Migration

## Summary of Changes
1. Creates `parties` table to store Party Master records (name, company, mobile, address, gstin, opening balance, type, notes).
2. Creates `party_transactions` table to store entries (date, amount_received, cash_paid, online_paid, reference, remarks, attachment).
3. Creates `party_adjustments` table to track FIFO settlement records between due transactions and payment transactions.
4. Enables Row Level Security (RLS) and sets policies based on multi-hub access (`user_can_access_hub` or `super_admin`).
5. Adds performance indexes on `hub_id`, `party_id`, and `transaction_date`.
*/

-- ---------- 1. PARTIES TABLE ----------

create table if not exists public.parties (
  id uuid default gen_random_uuid() primary key,
  hub_id uuid references public.hubs(id) on delete cascade,
  name text not null,
  company_name text,
  mobile text,
  address text,
  gstin text,
  opening_balance numeric(12, 2) not null default 0.00,
  opening_balance_type text not null default 'receivable' check (opening_balance_type in ('receivable', 'payable')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 2. PARTY TRANSACTIONS TABLE ----------

create table if not exists public.party_transactions (
  id uuid default gen_random_uuid() primary key,
  party_id uuid not null references public.parties(id) on delete cascade,
  hub_id uuid references public.hubs(id) on delete cascade,
  transaction_date date not null default current_date,
  amount_received numeric(12, 2) not null default 0.00 check (amount_received >= 0),
  cash_paid numeric(12, 2) not null default 0.00 check (cash_paid >= 0),
  online_paid numeric(12, 2) not null default 0.00 check (online_paid >= 0),
  payment_reference text,
  remarks text,
  attachment_url text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 3. PARTY ADJUSTMENTS TABLE (FIFO TRACKING) ----------

create table if not exists public.party_adjustments (
  id uuid default gen_random_uuid() primary key,
  party_id uuid not null references public.parties(id) on delete cascade,
  due_transaction_id uuid references public.party_transactions(id) on delete cascade,
  payment_transaction_id uuid references public.party_transactions(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

-- ---------- 4. INDEXES ----------

create index if not exists idx_parties_hub_id on public.parties(hub_id);
create index if not exists idx_parties_name on public.parties(name);
create index if not exists idx_party_transactions_party_id on public.party_transactions(party_id);
create index if not exists idx_party_transactions_hub_id on public.party_transactions(hub_id);
create index if not exists idx_party_transactions_date on public.party_transactions(transaction_date);
create index if not exists idx_party_adjustments_party_id on public.party_adjustments(party_id);

-- ---------- 5. ROW LEVEL SECURITY (RLS) ----------

alter table public.parties enable row level security;
alter table public.party_transactions enable row level security;
alter table public.party_adjustments enable row level security;

-- PARTIES POLICIES
drop policy if exists "parties_select" on public.parties;
create policy "parties_select" on public.parties for select
  to authenticated
  using (
    public.user_role() = 'super_admin'
    or (hub_id is not null and public.user_can_access_hub(hub_id))
  );

drop policy if exists "parties_insert" on public.parties;
create policy "parties_insert" on public.parties for insert
  to authenticated
  with check (
    public.user_role() = 'super_admin'
    or (hub_id is not null and public.user_can_access_hub(hub_id))
  );

drop policy if exists "parties_update" on public.parties;
create policy "parties_update" on public.parties for update
  to authenticated
  using (
    public.user_role() = 'super_admin'
    or (hub_id is not null and public.user_can_access_hub(hub_id))
  )
  with check (
    public.user_role() = 'super_admin'
    or (hub_id is not null and public.user_can_access_hub(hub_id))
  );

drop policy if exists "parties_delete" on public.parties;
create policy "parties_delete" on public.parties for delete
  to authenticated
  using (
    public.user_role() = 'super_admin'
    or (hub_id is not null and public.user_can_access_hub(hub_id))
  );

-- PARTY TRANSACTIONS POLICIES
drop policy if exists "party_tx_select" on public.party_transactions;
create policy "party_tx_select" on public.party_transactions for select
  to authenticated
  using (
    public.user_role() = 'super_admin'
    or (hub_id is not null and public.user_can_access_hub(hub_id))
  );

drop policy if exists "party_tx_insert" on public.party_transactions;
create policy "party_tx_insert" on public.party_transactions for insert
  to authenticated
  with check (
    public.user_role() = 'super_admin'
    or (hub_id is not null and public.user_can_access_hub(hub_id))
  );

drop policy if exists "party_tx_update" on public.party_transactions;
create policy "party_tx_update" on public.party_transactions for update
  to authenticated
  using (
    public.user_role() = 'super_admin'
    or (hub_id is not null and public.user_can_access_hub(hub_id))
  )
  with check (
    public.user_role() = 'super_admin'
    or (hub_id is not null and public.user_can_access_hub(hub_id))
  );

drop policy if exists "party_tx_delete" on public.party_transactions;
create policy "party_tx_delete" on public.party_transactions for delete
  to authenticated
  using (
    public.user_role() = 'super_admin'
    or (hub_id is not null and public.user_can_access_hub(hub_id))
  );

-- PARTY ADJUSTMENTS POLICIES
drop policy if exists "party_adj_select" on public.party_adjustments;
create policy "party_adj_select" on public.party_adjustments for select
  to authenticated
  using (
    exists (
      select 1 from public.parties p
      where p.id = party_adjustments.party_id
      and (
        public.user_role() = 'super_admin'
        or (p.hub_id is not null and public.user_can_access_hub(p.hub_id))
      )
    )
  );

drop policy if exists "party_adj_insert" on public.party_adjustments;
create policy "party_adj_insert" on public.party_adjustments for insert
  to authenticated
  with check (
    exists (
      select 1 from public.parties p
      where p.id = party_adjustments.party_id
      and (
        public.user_role() = 'super_admin'
        or (p.hub_id is not null and public.user_can_access_hub(p.hub_id))
      )
    )
  );

drop policy if exists "party_adj_delete" on public.party_adjustments;
create policy "party_adj_delete" on public.party_adjustments for delete
  to authenticated
  using (
    exists (
      select 1 from public.parties p
      where p.id = party_adjustments.party_id
      and (
        public.user_role() = 'super_admin'
        or (p.hub_id is not null and public.user_can_access_hub(p.hub_id))
      )
    )
  );

-- ---------- 6. UPDATED_AT TRIGGERS ----------

create or replace function public.update_khatabook_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_parties_updated_at on public.parties;
create trigger set_parties_updated_at
  before update on public.parties
  for each row execute function public.update_khatabook_timestamp();

drop trigger if exists set_party_tx_updated_at on public.party_transactions;
create trigger set_party_tx_updated_at
  before update on public.party_transactions
  for each row execute function public.update_khatabook_timestamp();
