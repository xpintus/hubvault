/*
# CMS Depositions — Add Total Expected & Total Deposited Columns

## Purpose
The user wants "Total Expected CMS" = cash + online combined (dono mila ke).
The amount to deposit is this combined total, and short = expected - deposited.

## Changes
1. Add `total_expected_cms` numeric(14,2) — cash + online combined (the total
   that should be deposited at CMS).
2. Add `total_deposited` numeric(14,2) — the actual total amount deposited
   (cash + online combined) at the CMS / bank counter.
3. `short_amount` is now computed as total_expected_cms - total_deposited.

The existing columns (total_cash_collected, cash_deposited, online_amount) are
kept for backward compatibility and to store the cash/online breakdown for
reference. The new columns are the primary fields used by the UI.

## Security
No policy changes — existing RLS on cms_deposits still applies.
*/

alter table public.cms_deposits
  add column if not exists total_expected_cms numeric(14,2) not null default 0;

alter table public.cms_deposits
  add column if not exists total_deposited numeric(14,2) not null default 0;
