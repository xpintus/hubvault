ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT true;

-- Trial users created so far should require approval
UPDATE profiles SET is_approved = false WHERE role = 'trial_user';
