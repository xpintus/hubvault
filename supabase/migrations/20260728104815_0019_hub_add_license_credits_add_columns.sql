ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hub_add_credits integer NOT NULL DEFAULT 0;

ALTER TABLE license_payment_requests ADD COLUMN IF NOT EXISTS request_type text NOT NULL DEFAULT 'license' CHECK (request_type IN ('license', 'hub_add'));