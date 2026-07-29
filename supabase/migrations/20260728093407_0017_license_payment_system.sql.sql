/*
# License Payment System — Gift Cards + Manual UPI Payments

1. New Tables
- `gift_cards` — Pre-generated license codes that can be purchased/redeemed
  - id (uuid PK)
  - card_code (text, unique) — the gift card code (XXXX-XXXX-XXXX-XXXX format)
  - license_code (text) — the license activation code tied to this gift card
  - price (numeric, default 0) — price of the gift card
  - status (text: 'available' | 'sold' | 'redeemed' | 'disabled') — current state
  - purchased_by (uuid, nullable) — user who bought/redeemed it
  - purchased_at (timestamptz, nullable)
  - redeemed_at (timestamptz, nullable)
  - created_at (timestamptz, default now())
  - created_by (uuid, nullable) — super admin who generated it
  - notes (text, nullable)

- `license_payment_requests` — UPI/manual payment requests from hub admins
  - id (uuid PK)
  - user_id (uuid, not null) — the hub admin requesting license
  - amount (numeric, default 0)
  - payment_method (text: 'upi' | 'bank_transfer' | 'other')
  - transaction_id (text) — UTR/transaction reference entered by user
  - payer_name (text, nullable)
  - payer_upi (text, nullable)
  - status (text: 'pending' | 'verified' | 'rejected') — admin verifies
  - license_code (text, nullable) — set when admin verifies & issues license
  - submitted_at (timestamptz, default now())
  - verified_at (timestamptz, nullable)
  - verified_by (uuid, nullable) — super admin who verified
  - rejection_reason (text, nullable)
  - notes (text, nullable)

2. Security
- Enable RLS on both tables.
- gift_cards: super_admin full CRUD; authenticated users can only SELECT available cards (to check a code). Actually for security, only super_admin can read gift_cards. Authenticated hub_admins interact via edge function only.
- license_payment_requests: authenticated users can INSERT (create their own request) and SELECT their own rows. Super admin can see all. Updates only via edge function (service role).

3. Important Notes
- Gift card codes and license codes are separate: a gift card has its own code (card_code) that when redeemed reveals the license_code.
- The edge function handles all redemption logic — the frontend never directly reads gift_cards.
- UPI payment verification is manual: user submits transaction ID, super admin reviews and either approves (generates license) or rejects.
*/

CREATE TABLE IF NOT EXISTS gift_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_code text UNIQUE NOT NULL,
  license_code text NOT NULL,
  price numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'sold', 'redeemed', 'disabled')),
  purchased_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  purchased_at timestamptz,
  redeemed_at timestamptz,
  created_by uuid,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;

-- Only super_admin can manage gift cards; others cannot read them directly
DROP POLICY IF EXISTS "super_admin_gift_cards_select" ON gift_cards;
CREATE POLICY "super_admin_gift_cards_select" ON gift_cards FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  );

DROP POLICY IF EXISTS "super_admin_gift_cards_insert" ON gift_cards;
CREATE POLICY "super_admin_gift_cards_insert" ON gift_cards FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  );

DROP POLICY IF EXISTS "super_admin_gift_cards_update" ON gift_cards;
CREATE POLICY "super_admin_gift_cards_update" ON gift_cards FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  );

DROP POLICY IF EXISTS "super_admin_gift_cards_delete" ON gift_cards;
CREATE POLICY "super_admin_gift_cards_delete" ON gift_cards FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  );

CREATE TABLE IF NOT EXISTS license_payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'upi' CHECK (payment_method IN ('upi', 'bank_transfer', 'other')),
  transaction_id text NOT NULL,
  payer_name text,
  payer_upi text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  license_code text,
  submitted_at timestamptz DEFAULT now(),
  verified_at timestamptz,
  verified_by uuid,
  rejection_reason text,
  notes text
);

ALTER TABLE license_payment_requests ENABLE ROW LEVEL SECURITY;

-- Users can see their own requests
DROP POLICY IF EXISTS "select_own_payment_requests" ON license_payment_requests;
CREATE POLICY "select_own_payment_requests" ON license_payment_requests FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  );

-- Users can insert their own requests
DROP POLICY IF EXISTS "insert_own_payment_requests" ON license_payment_requests;
CREATE POLICY "insert_own_payment_requests" ON license_payment_requests FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- Only super_admin can update (via client); edge function uses service role
DROP POLICY IF EXISTS "super_admin_update_payment_requests" ON license_payment_requests;
CREATE POLICY "super_admin_update_payment_requests" ON license_payment_requests FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gift_cards_status ON gift_cards(status);
CREATE INDEX IF NOT EXISTS idx_gift_cards_card_code ON gift_cards(card_code);
CREATE INDEX IF NOT EXISTS idx_license_payment_requests_user_id ON license_payment_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_license_payment_requests_status ON license_payment_requests(status);
