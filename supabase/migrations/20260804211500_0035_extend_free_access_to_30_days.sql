-- Extend every still-pending Hub Admin activation window to 30 days.
UPDATE license_keys
SET expires_at = generated_at + interval '30 days'
WHERE status = 'pending';

UPDATE profiles AS p
SET license_expires_at = COALESCE(k.generated_at, p.created_at) + interval '30 days'
FROM license_keys AS k
WHERE k.user_id = p.id
  AND p.role = 'hub_admin'
  AND p.license_status = 'pending'
  AND k.status = 'pending';
