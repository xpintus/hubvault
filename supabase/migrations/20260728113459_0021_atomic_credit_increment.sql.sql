/*
# Atomic hub credit increment function

## Purpose
Adds an atomic `increment_hub_credit` stored function to safely increment hub credits
when a superadmin verifies a hub-add payment or a gift card is redeemed for hub credit.
The previous read-then-write approach (SELECT then UPDATE) was prone to race conditions
where concurrent verifications could overwrite each other, losing credits.

## Changes
### 1. Stored function: `increment_hub_credit(p_user_id uuid, p_amount int default 1)`
- Atomically increments `hub_add_credits` by the given amount (default 1).
- Returns the new credit balance.
- SECURITY DEFINER so it runs with elevated privileges (called from edge function via service role).
*/

CREATE OR REPLACE FUNCTION increment_hub_credit(p_user_id uuid, p_amount int DEFAULT 1)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_balance integer;
BEGIN
  UPDATE profiles
    SET hub_add_credits = hub_add_credits + p_amount
    WHERE id = p_user_id
    RETURNING hub_add_credits INTO new_balance;
  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'Profile not found for user %', p_user_id;
  END IF;
  RETURN new_balance;
END;
$$;
