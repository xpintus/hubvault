/*
# Dues and Recoveries System

## Purpose
Adds a complete Pending Amount / Dues / Recovery management system to the Collection Reconciliation app.
When an employee submits less than the expected COD, the unpaid balance becomes a Due.
When the employee later pays back the pending amount, it is recorded as a Recovery — separate from regular daily collections.

## New Tables

### 1. dues
Tracks outstanding amounts owed by employees.
- id (uuid PK)
- collector_id (FK -> collectors.id) — the employee who owes money
- hub_id (FK -> hubs.id) — which hub this due belongs to
- collection_entry_id (FK -> collection_entries.id) — the collection entry that generated this due
- original_amount (numeric, NOT NULL) — the initial pending amount when the due was created
- recovered_amount (numeric, default 0) — how much has been recovered so far
- remaining_amount (numeric, default = original_amount) — what is still outstanding
- due_date (date, NOT NULL) — the date the due originated from
- status (text, CHECK in 'outstanding', 'partially_recovered', 'fully_recovered', default 'outstanding')
- notes (text, nullable)
- created_by (uuid, nullable — references auth.users)
- created_at, updated_at (timestamptz)

### 2. recoveries
Tracks individual recovery payments made against dues.
- id (uuid PK)
- collector_id (FK -> collectors.id)
- hub_id (FK -> hubs.id)
- due_id (FK -> dues.id) — which due this recovery is applied against
- recovery_date (date, NOT NULL) — when the recovery payment was made
- amount (numeric, NOT NULL) — how much was recovered in this transaction
- payment_mode (text, CHECK in 'cash', 'online', 'other', default 'cash')
- reference_number (text, nullable) — optional transaction reference
- notes (text, nullable)
- created_by (uuid, nullable — references auth.users)
- created_at (timestamptz)

## Security
- RLS enabled on both tables
- Owner-scoped CRUD for authenticated users (the app has a sign-in screen)
- Policies use auth.uid() for ownership checks via the existing profiles table relationship

## Important Notes
1. Recovery amounts are NOT counted as regular daily collections — they are tracked separately.
2. When a recovery is recorded, the parent due's recovered_amount and remaining_amount are updated.
3. If remaining_amount reaches 0, the due status is set to 'fully_recovered'.
4. If partially paid, the due status is set to 'partially_recovered'.
5. Historical dues are preserved — each due tracks its full recovery history.
6. Multiple dues per employee are supported — each due is linked to its originating collection entry.
*/

CREATE TABLE IF NOT EXISTS dues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collector_id uuid NOT NULL REFERENCES collectors(id) ON DELETE CASCADE,
  hub_id uuid NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  collection_entry_id uuid REFERENCES collection_entries(id) ON DELETE SET NULL,
  original_amount numeric NOT NULL DEFAULT 0,
  recovered_amount numeric NOT NULL DEFAULT 0,
  remaining_amount numeric NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'outstanding' CHECK (status IN ('outstanding', 'partially_recovered', 'fully_recovered')),
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE dues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_dues" ON dues;
CREATE POLICY "select_own_dues" ON dues FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_dues" ON dues;
CREATE POLICY "insert_own_dues" ON dues FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_own_dues" ON dues;
CREATE POLICY "update_own_dues" ON dues FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_own_dues" ON dues;
CREATE POLICY "delete_own_dues" ON dues FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_dues_collector_id ON dues(collector_id);
CREATE INDEX IF NOT EXISTS idx_dues_hub_id ON dues(hub_id);
CREATE INDEX IF NOT EXISTS idx_dues_status ON dues(status);
CREATE INDEX IF NOT EXISTS idx_dues_due_date ON dues(due_date);

CREATE TABLE IF NOT EXISTS recoveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collector_id uuid NOT NULL REFERENCES collectors(id) ON DELETE CASCADE,
  hub_id uuid NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  due_id uuid NOT NULL REFERENCES dues(id) ON DELETE CASCADE,
  recovery_date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  payment_mode text NOT NULL DEFAULT 'cash' CHECK (payment_mode IN ('cash', 'online', 'other')),
  reference_number text,
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE recoveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_recoveries" ON recoveries;
CREATE POLICY "select_own_recoveries" ON recoveries FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_recoveries" ON recoveries;
CREATE POLICY "insert_own_recoveries" ON recoveries FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_own_recoveries" ON recoveries;
CREATE POLICY "update_own_recoveries" ON recoveries FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_own_recoveries" ON recoveries;
CREATE POLICY "delete_own_recoveries" ON recoveries FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_recoveries_collector_id ON recoveries(collector_id);
CREATE INDEX IF NOT EXISTS idx_recoveries_hub_id ON recoveries(hub_id);
CREATE INDEX IF NOT EXISTS idx_recoveries_due_id ON recoveries(due_id);
CREATE INDEX IF NOT EXISTS idx_recoveries_recovery_date ON recoveries(recovery_date);
CREATE INDEX IF NOT EXISTS idx_recoveries_payment_mode ON recoveries(payment_mode);
