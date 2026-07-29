/*
# License Activation Feature for Hub Admins

## Purpose
When a new Hub Admin is created (by Super Admin or via Buy Now), a unique license key is generated.
The Hub Admin must activate this license within 24 hours of account creation. Until activated:
- After 24 hours, the account is locked out (cannot use the dashboard).
- Before 24 hours, the Hub Admin can use the dashboard but sees a persistent activation banner.

## New Tables
- `license_keys` — stores all generated license keys
  - `id` (uuid, primary key)
  - `user_id` (uuid, FK to profiles.id, unique — one license per user)
  - `license_code` (text, unique — the activation code the user enters)
  - `status` (enum: pending, activated, expired)
  - `generated_at` (timestamptz — when the license was created)
  - `activated_at` (timestamptz, nullable — when the user activated it)
  - `expires_at` (timestamptz — 24h after generation, deadline for activation)
  - `created_at` (timestamptz)

## Modified Tables
- `profiles` — adds three new columns:
  - `license_status` (enum: none, pending, activated, expired — default 'none')
  - `license_activated_at` (timestamptz, nullable)
  - `license_expires_at` (timestamptz, nullable — 24h deadline from account creation)

## New Enums
- `license_status_type`: 'none', 'pending', 'activated', 'expired'
- `license_key_status`: 'pending', 'activated', 'expired'

## Security (RLS)
- `license_keys`: enabled with RLS
  - SELECT: super_admin can see all; authenticated users can see their own license
  - INSERT/UPDATE: only service role (edge function) — no direct user writes via anon/authenticated
  - DELETE: super_admin only
- `profiles` existing RLS policies remain unchanged; new columns are readable by existing SELECT policies

## How it works
1. When a hub_admin is created (via edge function `create` or `create-buyer`):
   - A random 16-char alphanumeric license code is generated
   - `license_keys` row is inserted with status=pending, expires_at = now() + 24h
   - `profiles.license_status` = 'pending', `license_expires_at` = now() + 24h
2. The license code is returned to the Super Admin (or shown in Users page)
3. The Hub Admin logs in and must enter the code on an activation page
4. On activation: license_keys.status = 'activated', profiles.license_status = 'activated'
5. If 24h pass without activation: license_status becomes 'expired', account is locked

## Important Notes
1. Only hub_admin role requires license activation. Other roles (super_admin, supervisor, collector, trial_user, guest) are exempt.
2. The license code is a human-readable format: XXXX-XXXX-XXXX-XXXX (16 alphanumeric chars)
3. Existing hub_admins before this migration get license_status = 'activated' (grandfathered)
4. The edge function handles all license operations using the service role key (bypasses RLS)
*/

-- Create enums
DO $$ BEGIN
  CREATE TYPE license_status_type AS ENUM ('none', 'pending', 'activated', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE license_key_status AS ENUM ('pending', 'activated', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add license columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS license_status license_status_type NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS license_activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS license_expires_at timestamptz;

-- Grandfather existing hub_admins as activated
UPDATE profiles SET 
  license_status = 'activated',
  license_activated_at = created_at
WHERE role = 'hub_admin' AND license_status = 'none';

-- Create license_keys table
CREATE TABLE IF NOT EXISTS license_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  license_code text NOT NULL UNIQUE,
  status license_key_status NOT NULL DEFAULT 'pending',
  generated_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_license_keys_user_id ON license_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_license_keys_code ON license_keys(license_code);
CREATE INDEX IF NOT EXISTS idx_license_keys_status ON license_keys(status);

-- Enable RLS
ALTER TABLE license_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies for license_keys
DROP POLICY IF EXISTS "license_select_own_or_admin" ON license_keys;
CREATE POLICY "license_select_own_or_admin" ON license_keys FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
  ));

DROP POLICY IF EXISTS "license_insert_service_only" ON license_keys;
CREATE POLICY "license_insert_service_only" ON license_keys FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
  ));

DROP POLICY IF EXISTS "license_update_own" ON license_keys;
CREATE POLICY "license_update_own" ON license_keys FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "license_delete_admin" ON license_keys;
CREATE POLICY "license_delete_admin" ON license_keys FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
  ));
