-- Support ₹999 lifetime and ₹99/month purchasing plans.
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS monthly_price integer NOT NULL DEFAULT 99 CHECK (monthly_price > 0);

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS plan_type text NOT NULL DEFAULT 'lifetime'
  CHECK (plan_type IN ('lifetime', 'monthly'));

ALTER TABLE license_keys
  ADD COLUMN IF NOT EXISTS plan_type text NOT NULL DEFAULT 'lifetime'
  CHECK (plan_type IN ('lifetime', 'monthly'));

ALTER TABLE license_payment_requests
  ADD COLUMN IF NOT EXISTS plan_type text NOT NULL DEFAULT 'lifetime'
  CHECK (plan_type IN ('lifetime', 'monthly'));

ALTER TABLE purchase_requests
  ADD COLUMN IF NOT EXISTS plan_type text NOT NULL DEFAULT 'lifetime'
  CHECK (plan_type IN ('lifetime', 'monthly'));
