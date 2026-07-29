/*
# Hub Add License Credits + Payment Request Types

## Purpose
When a hub admin wants to create more than one hub, they must purchase a "hub add license" (₹499 each).
The first hub is free with the initial license purchase (₹999). Each additional hub costs ₹499.
This migration adds the tracking mechanism for hub-add credits and categorizes payment requests.

## Changes

### 1. New column on `profiles`: `hub_add_credits`
- `hub_add_credits integer NOT NULL DEFAULT 0`
- Tracks how many additional hubs a hub_admin can create beyond their first free hub.
- Starts at 0. Each verified ₹499 payment increments this by 1. Each new hub creation (beyond the first) decrements by 1.

### 2. New column on `license_payment_requests`: `request_type`
- `request_type text NOT NULL DEFAULT 'license' CHECK (request_type IN ('license', 'hub_add'))`
- 'license' = first-time license purchase (₹999)
- 'hub_add' = additional hub purchase (₹499)
- Existing rows default to 'license'.

### 3. Security
- No new RLS policies needed — existing policies on both tables already cover the new columns.
- `profiles.hub_add_credits` is read/written by the same callers that already access profiles.
- `license_payment_requests.request_type` follows the same RLS as the rest of the row.

## Notes
- The edge function enforces the business logic: hub_admins with 0 credits cannot create additional hubs.
- First hub is always free (created during account setup or first hub creation).
- `hub_add_credits` is decremented only when creating a hub BEYOND the first one.
*/