-- Migration: Fix monthly subscription system schema, audit logging, auto-renewal fields, and backfill

-- 1. Add subscription columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_started_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS subscription_status text CHECK (subscription_status IN ('active', 'expired', 'cancelled', 'none')),
  ADD COLUMN IF NOT EXISTS last_payment_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS next_billing_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS renewal_count integer NOT NULL DEFAULT 0;

-- 2. Add subscription_grace_days to app_settings
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS subscription_grace_days integer NOT NULL DEFAULT 0 CHECK (subscription_grace_days >= 0);

-- 3. Create subscription_history audit table
CREATE TABLE IF NOT EXISTS subscription_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  old_plan text NULL,
  new_plan text NULL,
  old_expiry timestamptz NULL,
  new_expiry timestamptz NULL,
  changed_by uuid NULL,
  reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on subscription_history
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;

-- Allow super_admin to read subscription_history
CREATE POLICY "Super admins can view subscription history"
  ON subscription_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
  );

-- Allow users to view their own subscription history
CREATE POLICY "Users can view their own subscription history"
  ON subscription_history FOR SELECT
  USING (user_id = auth.uid());

-- 4. SQL function to auto-process expired subscriptions
CREATE OR REPLACE FUNCTION process_expired_subscriptions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_grace_days integer := 0;
  v_count integer := 0;
  r RECORD;
BEGIN
  -- Fetch grace period days from app_settings
  SELECT COALESCE(subscription_grace_days, 0) INTO v_grace_days
  FROM app_settings
  LIMIT 1;

  -- Process monthly profiles whose expiration + grace period is past
  FOR r IN
    SELECT id, plan_type, subscription_expires_at
    FROM profiles
    WHERE plan_type = 'monthly'
      AND subscription_status = 'active'
      AND subscription_expires_at IS NOT NULL
      AND NOW() > (subscription_expires_at + (v_grace_days * interval '1 day'))
  LOOP
    UPDATE profiles
    SET
      subscription_status = 'expired',
      license_status = 'expired'
    WHERE id = r.id;

    UPDATE license_keys
    SET status = 'expired'
    WHERE user_id = r.id AND status = 'activated';

    INSERT INTO subscription_history (
      user_id,
      old_plan,
      new_plan,
      old_expiry,
      new_expiry,
      changed_by,
      reason
    ) VALUES (
      r.id,
      'monthly',
      'monthly',
      r.subscription_expires_at,
      r.subscription_expires_at,
      NULL,
      'Auto-expired by database cleanup process'
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 5. Backfill existing records safely
-- Lifetime users are active with null expiration
UPDATE profiles
SET
  subscription_status = 'active',
  subscription_started_at = COALESCE(license_activated_at, created_at),
  subscription_expires_at = NULL
WHERE (plan_type = 'lifetime' OR plan_type IS NULL)
  AND (license_status = 'activated' OR role = 'super_admin');

-- For monthly users who are currently activated:
UPDATE profiles
SET
  subscription_started_at = COALESCE(license_activated_at, created_at),
  subscription_expires_at = license_expires_at,
  next_billing_at = license_expires_at,
  subscription_status = CASE
    WHEN license_expires_at IS NOT NULL AND license_expires_at > NOW() THEN 'active'
    ELSE 'expired'
  END
WHERE plan_type = 'monthly'
  AND license_status = 'activated';

-- For monthly users who are pending or missing valid expiry:
UPDATE profiles
SET
  subscription_status = CASE
    WHEN license_status = 'pending' THEN 'none'
    ELSE 'expired'
  END,
  subscription_expires_at = license_expires_at
WHERE plan_type = 'monthly'
  AND (license_status != 'activated' OR license_expires_at IS NULL);
