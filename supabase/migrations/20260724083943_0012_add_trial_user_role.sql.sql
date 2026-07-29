/*
# Add trial_user role and trial profile fields

## Purpose
Support a "Create Trial User" workflow restricted to the Super Admin.
Trial users are prospective customers who get a limited dashboard preview
— they are NOT registered as employees or collectors.

## Changes
1. Add `trial_user` to the `user_role` enum (alongside existing guest).
2. Add three nullable columns to `profiles`:
   - `phone` (text) — 10-digit Indian mobile number
   - `company` (text) — company name (Valmo, Amazon, etc.)
   - `hub_code` (text) — free-text hub identifier provided during trial signup

## Security
- No RLS policy changes needed: existing profiles policies already allow
  super_admin to read/insert/update all profiles. The new columns inherit
  those same policies.
- The edge function (manage-user) enforces that only super_admin can
  create trial_user accounts.

## Notes
- Columns are nullable so existing profiles are unaffected.
- `trial_user` role will be handled by the same GuestAppLayout used for
  guest users (limited dashboard, locked features).
*/
DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'trial_user';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hub_code text;
