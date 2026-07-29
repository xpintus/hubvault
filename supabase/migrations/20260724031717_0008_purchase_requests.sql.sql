/*
# Create purchase_requests table

1. New Tables
- `purchase_requests`
  - `id` (uuid, primary key)
  - `name` (text, not null) — full name of the buyer
  - `email` (text, not null) — email of the buyer
  - `phone` (text, not null) — phone number of the buyer
  - `company` (text, nullable) — optional company/hub name
  - `message` (text, nullable) — optional note from the buyer
  - `status` (text, not null, default 'pending') — lifecycle: pending | contacted | completed | rejected
  - `is_read` (boolean, default false) — tracks whether an admin has opened the request
  - `created_at` (timestamptz, default now()) — when the request was submitted

2. Security — RLS
- Enable RLS on `purchase_requests`.
- INSERT: allow `anon, authenticated` — anyone (including anonymous visitors) can submit a buy request from the public website.
- SELECT/UPDATE/DELETE: allow `authenticated` only — only signed-in admin users can view, manage, or delete requests.

3. Important Notes
- The public Buy form on the home page uses the anon-key Supabase client, so INSERT must be open to `anon`.
- Admin users view and manage requests through the authenticated app, so SELECT/UPDATE/DELETE are `authenticated` only.
- No `user_id` column — purchase requests come from website visitors, not app users.
*/

CREATE TABLE IF NOT EXISTS purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  company text,
  message text,
  status text NOT NULL DEFAULT 'pending',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE purchase_requests ENABLE ROW LEVEL SECURITY;

-- Allow anyone (anon + authenticated) to INSERT a purchase request
DROP POLICY IF EXISTS "insert_purchase_requests" ON purchase_requests;
CREATE POLICY "insert_purchase_requests"
ON purchase_requests FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only authenticated admins can SELECT (read) requests
DROP POLICY IF EXISTS "select_purchase_requests" ON purchase_requests;
CREATE POLICY "select_purchase_requests"
ON purchase_requests FOR SELECT
TO authenticated
USING (true);

-- Only authenticated admins can UPDATE (manage status) requests
DROP POLICY IF EXISTS "update_purchase_requests" ON purchase_requests;
CREATE POLICY "update_purchase_requests"
ON purchase_requests FOR UPDATE
TO authenticated
USING (true) WITH CHECK (true);

-- Only authenticated admins can DELETE requests
DROP POLICY IF EXISTS "delete_purchase_requests" ON purchase_requests;
CREATE POLICY "delete_purchase_requests"
ON purchase_requests FOR DELETE
TO authenticated
USING (true);

-- Index for sorting by most recent
CREATE INDEX IF NOT EXISTS idx_purchase_requests_created_at ON purchase_requests (created_at DESC);
