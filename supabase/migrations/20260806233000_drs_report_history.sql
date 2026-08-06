-- Migration: Create drs_report_history table for permanent DRS report snapshot storage in Power BI Edition
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
  cod_amount numeric(12,2) default 0,
  prepaid_ofd integer default 0,
  prepaid_del integer default 0,
  prepaid_amount numeric(12,2) default 0,
  average_attempt numeric(4,2) default 0,
  json_snapshot jsonb not null,
  created_at timestamptz default now()
);

-- Index for date & hub lookups
create index if not exists idx_drs_report_history_date on drs_report_history(report_date);
create index if not exists idx_drs_report_history_hub on drs_report_history(hub_id);

-- Enable RLS
alter table drs_report_history enable row level security;

-- RLS Policies
create policy "Authenticated users can select drs_report_history"
  on drs_report_history for select
  to authenticated
  using (true);

create policy "Authenticated users can insert drs_report_history"
  on drs_report_history for insert
  to authenticated
  with check (true);

create policy "Authenticated users can delete drs_report_history"
  on drs_report_history for delete
  to authenticated
  using (true);
