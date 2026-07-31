/*
# Update CMS Deposits for Separate Cash and Online Submissions & Employee Tracking

## Purpose
Add preferred transaction fields to `cms_deposits` table to support:
  - employee-level CMS submissions (`collector_id`)
  - explicit collection date (`collection_date`)
  - separate cash and online submitted amounts (`cash_submitted`, `online_submitted`)
  - separate cash and online reference numbers (`cash_reference`, `online_reference`)
  - bank name (`bank_name`)
  - submission status (`status`)

## Backward Compatibility
Existing columns (`total_cash_collected`, `cash_deposited`, `online_amount`, `total_expected_cms`, `total_deposited`, `short_amount`, `reference_number`) are preserved. Existing records are backfilled safely.
*/

alter table public.cms_deposits
  add column if not exists collector_id uuid references public.collectors(id) on delete set null,
  add column if not exists collection_date date,
  add column if not exists cash_submitted numeric(14,2) default 0,
  add column if not exists online_submitted numeric(14,2) default 0,
  add column if not exists cash_reference text,
  add column if not exists online_reference text,
  add column if not exists bank_name text,
  add column if not exists status text default 'submitted';

-- Backfill collection_date from deposit_date if null
update public.cms_deposits
set collection_date = deposit_date
where collection_date is null;

-- Backfill cash_submitted and online_submitted from existing columns if 0
update public.cms_deposits
set cash_submitted = coalesce(cash_deposited, 0),
    online_submitted = coalesce(online_amount, 0)
where cash_submitted = 0 and online_submitted = 0 and (cash_deposited > 0 or online_amount > 0);
