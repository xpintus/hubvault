-- Migration: Create drs_report_history table with full COD/Prepaid FAD% columns and open RLS policies
create table if not exists drs_report_history (
  id uuid primary key default gen_random_uuid(),
  report_date text not null,
  uploaded_at timestamptz default now(),
  file_name text not null,
  hub_id text,
  hub_name text,
  client text default 'All Clients',
  uploaded_by text,
  total_ofd integer default 0,
  delivered integer default 0,
  undel integer default 0,
  rto integer default 0,
  cancel integer default 0,
  first_attempt_ofd integer default 0,
  first_attempt_del integer default 0,
  reattempt_ofd integer default 0,
  reattempt_del integer default 0,
  overall_percent numeric(5,2) default 0,
  cod_ofd integer default 0,
  cod_del integer default 0,
  cod_first_attempt_ofd integer default 0,
  cod_first_attempt_del integer default 0,
  cod_fad_percent numeric(5,2) default 0,
  prepaid_ofd integer default 0,
  prepaid_del integer default 0,
  prepaid_first_attempt_ofd integer default 0,
  prepaid_first_attempt_del integer default 0,
  prepaid_fad_percent numeric(5,2) default 0,
  cod_amount numeric(12,2) default 0,
  prepaid_amount numeric(12,2) default 0,
  average_attempt numeric(4,2) default 0,
  json_snapshot jsonb not null,
  created_at timestamptz default now()
);

-- Ensure all columns exist (in case table was partially created in earlier migration)
alter table drs_report_history add column if not exists cod_first_attempt_ofd integer default 0;
alter table drs_report_history add column if not exists cod_first_attempt_del integer default 0;
alter table drs_report_history add column if not exists cod_fad_percent numeric(5,2) default 0;
alter table drs_report_history add column if not exists prepaid_first_attempt_ofd integer default 0;
alter table drs_report_history add column if not exists prepaid_first_attempt_del integer default 0;
alter table drs_report_history add column if not exists prepaid_fad_percent numeric(5,2) default 0;

-- Index for date & hub lookups
create index if not exists idx_drs_report_history_date on drs_report_history(report_date);
create index if not exists idx_drs_report_history_hub on drs_report_history(hub_id);

-- Enable RLS
alter table drs_report_history enable row level security;

-- Drop old policies to avoid duplicate errors
drop policy if exists "Authenticated users can select drs_report_history" on drs_report_history;
drop policy if exists "Authenticated users can insert drs_report_history" on drs_report_history;
drop policy if exists "Authenticated users can delete drs_report_history" on drs_report_history;
drop policy if exists "Allow public select on drs_report_history" on drs_report_history;
drop policy if exists "Allow public insert on drs_report_history" on drs_report_history;
drop policy if exists "Allow public delete on drs_report_history" on drs_report_history;

-- RLS Policies for both anon and authenticated users
create policy "Allow public select on drs_report_history"
  on drs_report_history for select
  using (true);

create policy "Allow public insert on drs_report_history"
  on drs_report_history for insert
  with check (true);

create policy "Allow public delete on drs_report_history"
  on drs_report_history for delete
  using (true);
