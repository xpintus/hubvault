-- Add 'guest' to the user_role enum so self-registered users get a guest role.
-- They see a dummy hub-admin dashboard but cannot access real app data.
DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'guest';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
