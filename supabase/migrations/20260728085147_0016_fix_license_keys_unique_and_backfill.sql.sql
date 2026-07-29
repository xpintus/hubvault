-- Add unique constraint on user_id so upserts work correctly
DO $$ BEGIN
  ALTER TABLE license_keys ADD CONSTRAINT license_keys_user_id_key UNIQUE (user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill license keys for existing hub_admins who don't have one
-- For already-activated users, create an activated license with a placeholder code
-- For pending users, create a pending license with a fresh code and 24h deadline
DO $$
DECLARE
  r RECORD;
  code text;
  expires_at timestamptz;
BEGIN
  FOR r IN
    SELECT p.id, p.license_status, p.license_activated_at, p.license_expires_at, p.created_at
    FROM profiles p
    WHERE p.role = 'hub_admin'
      AND NOT EXISTS (SELECT 1 FROM license_keys lk WHERE lk.user_id = p.id)
  LOOP
    -- Generate a random 16-char code
    code := upper(substr(encode(gen_random_bytes(12), 'hex'), 1, 16));
    code := substr(code, 1, 4) || '-' || substr(code, 5, 4) || '-' || substr(code, 9, 4) || '-' || substr(code, 13, 4);

    IF r.license_status = 'activated' THEN
      -- Already activated: create an activated record with their existing activation date
      INSERT INTO license_keys (user_id, license_code, status, generated_at, activated_at, expires_at)
      VALUES (r.id, code, 'activated', r.created_at, COALESCE(r.license_activated_at, r.created_at), r.created_at + interval '24 hours');
    ELSIF r.license_status = 'pending' THEN
      -- Pending: use their existing expiry or create fresh 24h window
      expires_at := COALESCE(r.license_expires_at, now() + interval '24 hours');
      INSERT INTO license_keys (user_id, license_code, status, generated_at, expires_at)
      VALUES (r.id, code, 'pending', r.created_at, expires_at);
    ELSE
      -- expired or none: create a pending record with fresh 24h
      INSERT INTO license_keys (user_id, license_code, status, generated_at, expires_at)
      VALUES (r.id, code, 'pending', now(), now() + interval '24 hours');
      -- Reset profile to pending with new deadline
      UPDATE profiles SET license_status = 'pending', license_expires_at = now() + interval '24 hours'
      WHERE id = r.id;
    END IF;
  END LOOP;
END $$;
