/*
# App Settings table for UPI payment configuration

## Purpose
Stores configurable app-wide settings (UPI ID, payee name, QR code image URL,
license prices) so the super admin can update payment details from the admin
panel without redeploying to Vercel or cPanel.

## New Tables
- `app_settings` (singleton — always exactly one row, keyed by id=1)
  - `id` (int, primary key, always 1)
  - `upi_id` (text, not null) — the UPI VPA that receives license payments
  - `payee_name` (text, not null) — display name shown on the UPI pay screen
  - `qr_image_url` (text) — URL of the QR code image shown to users
  - `license_price` (integer, not null, default 999) — price in INR for a single license
  - `hub_add_price` (integer, not null, default 499) — price in INR to add one extra hub
  - `updated_at` (timestamptz, default now())
  - `updated_by` (uuid, references auth.users) — who last changed the settings

## Security
- RLS enabled.
- SELECT: any authenticated user can read settings (they need to see UPI details to pay).
- INSERT/UPDATE/DELETE: super_admin only. Role is checked via the profiles table
  where role = 'super_admin'. This avoids relying on raw_app_meta_data which may
  not always carry the role for this project.

## Seed
- Inserts a default row (id=1) with the currently hardcoded UPI ID and QR image
  so the app continues working unchanged until the admin edits the settings.
*/

CREATE TABLE IF NOT EXISTS app_settings (
  id integer PRIMARY KEY DEFAULT 1,
  upi_id text NOT NULL DEFAULT 'BHARATPE09899107906@yesbankltd',
  payee_name text NOT NULL DEFAULT 'HubVault License',
  qr_image_url text,
  license_price integer NOT NULL DEFAULT 999,
  hub_add_price integer NOT NULL DEFAULT 499,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT single_row CHECK (id = 1)
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Any signed-in user can read settings (needed to display UPI details for payment)
DROP POLICY IF EXISTS "read_app_settings" ON app_settings;
CREATE POLICY "read_app_settings"
ON app_settings FOR SELECT
TO authenticated USING (true);

-- Only super_admin can modify settings
DROP POLICY IF EXISTS "insert_app_settings" ON app_settings;
CREATE POLICY "insert_app_settings"
ON app_settings FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
);

DROP POLICY IF EXISTS "update_app_settings" ON app_settings;
CREATE POLICY "update_app_settings"
ON app_settings FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
);

DROP POLICY IF EXISTS "delete_app_settings" ON app_settings;
CREATE POLICY "delete_app_settings"
ON app_settings FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
);

-- Seed the default row (idempotent)
INSERT INTO app_settings (id, upi_id, payee_name, qr_image_url, license_price, hub_add_price)
VALUES (1, 'BHARATPE09899107906@yesbankltd', 'HubVault License', '/ChatGPT_Image_Jul_28,_2026,_11_30_59_PM.png', 999, 499)
ON CONFLICT (id) DO NOTHING;
