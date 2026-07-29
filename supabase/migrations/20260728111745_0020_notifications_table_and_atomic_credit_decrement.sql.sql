/*
# Notifications table + atomic hub credit decrement

## Purpose
1. Creates a `notifications` table so the superadmin gets notified when a hub_admin creates a new hub.
2. Adds an atomic `decrement_hub_credit` stored function so hub credits are decremented safely (no race conditions, no stale reads).

## Changes

### 1. New table: `notifications`
- `id` (uuid, PK)
- `user_id` (uuid, nullable) — the recipient. NULL = broadcast to all super_admins
- `type` (text, not null) — e.g. 'hub_created', 'payment_request'
- `title` (text, not null)
- `message` (text, not null)
- `link` (text, nullable) — optional route to navigate to
- `is_read` (boolean, default false)
- `metadata` (jsonb, nullable) — extra context (hub_id, user_id, etc.)
- `created_at` (timestamptz, default now())

### 2. RLS on `notifications`
- super_admin can read all, update read status, delete.
- authenticated users can read notifications targeted to them (by user_id).
- Inserts happen via the service-role key (edge function), so no anon insert policy needed.

### 3. Stored function: `decrement_hub_credit(p_user_id uuid)`
- Atomically decrements `hub_add_credits` by 1 if the user has > 0 credits.
- Returns true if decremented, false if no credits available.
- SECURITY DEFINER so it runs with elevated privileges (called from edge function via service role).

### 4. Realtime
- Adds `notifications` table to the Supabase realtime publication so the frontend can subscribe to INSERT events.
*/

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  link text,
  is_read boolean NOT NULL DEFAULT false,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Super admins can read all notifications
DROP POLICY IF EXISTS "super_admin_read_notifications" ON notifications;
CREATE POLICY "super_admin_read_notifications" ON notifications
  FOR SELECT TO authenticated
  USING (
    user_id IS NULL AND EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  );

-- Super admins can mark notifications as read
DROP POLICY IF EXISTS "super_admin_update_notifications" ON notifications;
CREATE POLICY "super_admin_update_notifications" ON notifications
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  );

-- Super admins can delete notifications
DROP POLICY IF EXISTS "super_admin_delete_notifications" ON notifications;
CREATE POLICY "super_admin_delete_notifications" ON notifications
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
  );

-- Authenticated users can read notifications targeted specifically to them
DROP POLICY IF EXISTS "user_read_own_notifications" ON notifications;
CREATE POLICY "user_read_own_notifications" ON notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Authenticated users can mark their own notifications as read
DROP POLICY IF EXISTS "user_update_own_notifications" ON notifications;
CREATE POLICY "user_update_own_notifications" ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Atomic credit decrement function
CREATE OR REPLACE FUNCTION decrement_hub_credit(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_credits integer;
BEGIN
  SELECT hub_add_credits INTO current_credits FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF current_credits IS NULL OR current_credits <= 0 THEN
    RETURN false;
  END IF;
  UPDATE profiles SET hub_add_credits = current_credits - 1 WHERE id = p_user_id;
  RETURN true;
END;
$$;

-- Add notifications table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
