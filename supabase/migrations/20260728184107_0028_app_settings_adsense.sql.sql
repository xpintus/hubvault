/*
# Add AdSense configuration to app_settings

## Purpose
Makes Google AdSense credentials configurable from the admin Settings page
so the publisher ID (ca-pub-XXXX) can be updated without touching code or
redeploying to Vercel / cPanel.

## Changes to existing table: app_settings
- `adsense_client` (text, nullable) — the Google AdSense publisher ID, e.g. "ca-pub-1234567890123456". Null means AdSense is not configured.
- `adsense_enabled` (boolean, default false) — master toggle to show/hide all ad slots site-wide.

## Security
- No new tables. Existing RLS policies on app_settings still apply:
  SELECT for all authenticated, INSERT/UPDATE/DELETE for super_admin only.

## Notes
- The AdSense script tag is removed from index.html and injected at runtime
  from the SettingsProvider once the client ID is known from the database.
- AdSlot components read the client ID from the settings context and skip
  rendering when adsense_enabled is false or adsense_client is empty.
*/

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS adsense_client text,
  ADD COLUMN IF NOT EXISTS adsense_enabled boolean NOT NULL DEFAULT false;
