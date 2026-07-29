/*
# Atomic Earnings Decrement RPC (fix typo)

## Purpose
Provides a safe, atomic way to decrement a user's referral_earnings when they
request a withdrawal. The function only decrements if the balance is sufficient,
preventing negative balances even under concurrent requests.
*/

CREATE OR REPLACE FUNCTION decrement_referral_earnings(p_user_id uuid, p_amount numeric)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_balance numeric;
BEGIN
  SELECT referral_earnings INTO current_balance
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF current_balance >= p_amount THEN
    UPDATE profiles
    SET referral_earnings = current_balance - p_amount
    WHERE id = p_user_id;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION decrement_referral_earnings(uuid, numeric) TO authenticated;
