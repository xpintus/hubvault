/*
# Create contact_messages table

1. New Tables
- `contact_messages`
  - `id` (uuid, primary key)
  - `name` (text, not null) — name of the person submitting the form
  - `email` (text, not null) — email of the person submitting the form
  - `phone` (text, nullable) — optional phone number
  - `company` (text, nullable) — optional company name
  - `subject` (text, not null) — subject line of the message
  - `message` (text, not null) — the full message body
  - `is_read` (boolean, default false) — tracks whether an admin has read the message
  - `created_at` (timestamptz, default now()) — when the message was submitted

2. Security — RLS
- Enable RLS on `contact_messages`.
- INSERT: allow `anon, authenticated` — anyone (including anonymous visitors) can submit a contact message through the public form.
- SELECT/UPDATE/DELETE: allow `authenticated` only — only signed-in admin users can view, mark-as-read, or delete messages. This protects visitor messages from public access.

3. Important Notes
- The public Contact form uses the anon-key Supabase client, so INSERT must be open to `anon`.
- Admin users view messages through the authenticated app, so SELECT/UPDATE/DELETE are `authenticated` only.
- No `user_id` column — contact messages come from website visitors, not app users.
*/

CREATE TABLE IF NOT EXISTS contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  company text,
  subject text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Allow anyone (anon + authenticated) to INSERT a contact message
DROP POLICY IF EXISTS "insert_contact_messages" ON contact_messages;
CREATE POLICY "insert_contact_messages"
ON contact_messages FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Only authenticated admins can SELECT (read) messages
DROP POLICY IF EXISTS "select_contact_messages" ON contact_messages;
CREATE POLICY "select_contact_messages"
ON contact_messages FOR SELECT
TO authenticated
USING (true);

-- Only authenticated admins can UPDATE (mark as read) messages
DROP POLICY IF EXISTS "update_contact_messages" ON contact_messages;
CREATE POLICY "update_contact_messages"
ON contact_messages FOR UPDATE
TO authenticated
USING (true) WITH CHECK (true);

-- Only authenticated admins can DELETE messages
DROP POLICY IF EXISTS "delete_contact_messages" ON contact_messages;
CREATE POLICY "delete_contact_messages"
ON contact_messages FOR DELETE
TO authenticated
USING (true);

-- Index for sorting by most recent
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages (created_at DESC);
