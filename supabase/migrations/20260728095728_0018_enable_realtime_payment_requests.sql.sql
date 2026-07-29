/*
# Enable Realtime on license_payment_requests

1. Changes
- Add `license_payment_requests` table to the Supabase Realtime publication so the Super Admin receives live INSERT notifications when a Hub Admin submits a UPI payment request.

2. Security
- No RLS changes. Realtime respects existing RLS policies — only authenticated super_admins can read these rows (per the select policy already in place).
*/

ALTER PUBLICATION supabase_realtime ADD TABLE license_payment_requests;
