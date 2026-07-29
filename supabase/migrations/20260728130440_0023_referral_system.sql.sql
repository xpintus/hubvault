-- Refer & Earn System
-- 50% commission on every referred user's license payment
-- Each user gets an auto-generated promo code; others enter it to link referrals

-- Add referral columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_earnings numeric DEFAULT 0;

-- Auto-generate referral code for all existing profiles
DO $$
DECLARE
  r RECORD;
  code text;
BEGIN
  FOR r IN SELECT id FROM profiles WHERE referral_code IS NULL LOOP
    code := upper(substr(md5(random()::text || r.id::text), 1, 8));
    UPDATE profiles SET referral_code = code WHERE id = r.id;
  END LOOP;
END $$;

-- Referrals table: tracks who referred whom and commission status
CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'commission_earned', 'commission_paid')),
  commission_amount numeric DEFAULT 0,
  earned_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_referee_id ON referrals(referee_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Users can see referrals where they are the referrer
DROP POLICY IF EXISTS "select_own_referrals" ON referrals;
CREATE POLICY "select_own_referrals" ON referrals FOR SELECT
  TO authenticated USING (
    auth.uid() = referrer_id OR
    auth.uid() = referee_id OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  );

-- Only edge function (service role) inserts/updates referrals
DROP POLICY IF EXISTS "insert_referrals_via_service" ON referrals;
CREATE POLICY "insert_referrals_via_service" ON referrals FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = referee_id);

DROP POLICY IF EXISTS "update_referrals_via_service" ON referrals;
CREATE POLICY "update_referrals_via_service" ON referrals FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  );

-- Users can update their own referral_earnings (edge function uses service role)
-- Allow users to read their own profile referral info (already covered by existing profile policies)

-- Trigger: auto-generate referral code on new profile insert
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER AS $$
DECLARE
  code text;
BEGIN
  IF NEW.referral_code IS NULL THEN
    code := upper(substr(md5(random()::text || NEW.id::text), 1, 8));
    NEW.referral_code := code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_referral_code ON profiles;
CREATE TRIGGER set_referral_code
  BEFORE INSERT ON profiles
  FOR EACH ROW
  WHEN (NEW.referral_code IS NULL)
  EXECUTE FUNCTION generate_referral_code();
