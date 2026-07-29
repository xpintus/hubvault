/*
# Fix Withdrawal Duplicate Prevention & Balance Tracking

## Problem
The withdrawal system had two bugs:
1. `referral_earnings` was NEVER decremented when a withdrawal was requested —
   so the "Available to Withdraw" balance always showed the full lifetime earnings,
   allowing users to request the same money multiple times.
2. There was no database-level constraint to prevent a user from having
   multiple pending withdrawal requests simultaneously (only app-level checks,
   which are bypassable in race conditions).

## Changes

### 1. Partial unique index on withdrawal_requests
- Adds `UNIQUE (user_id) WHERE status = 'pending'` so the database itself
  rejects a second pending withdrawal for the same user, regardless of what
  the application code does.

### 2. Backfill referral_earnings
- Subtracts the total of ALL existing withdrawal amounts (pending, processed,
  and rejected) from each user's `referral_earnings`.
  - Pending + processed: these should have been decremented but weren't.
  - Rejected: the old reject logic ADDED the amount back (a refund), but since
    it was never subtracted in the first place, this double-counted. Subtracting
    here undoes that wrong addition, giving the correct net-zero for rejections.
- Clamped to a minimum of 0 so balances never go negative.

### 3. Going forward
- The edge function will decrement `referral_earnings` atomically when a
  withdrawal is requested.
- The existing reject logic (which refunds by incrementing) remains correct
  because the amount will have been decremented at request time.
- The process logic (which doesn't touch earnings) remains correct for the
  same reason.

## Security
- No RLS policy changes.
- No new tables or columns.
*/

-- 1. Prevent duplicate pending withdrawals at the database level
CREATE UNIQUE INDEX IF NOT EXISTS idx_withdrawal_one_pending_per_user
  ON withdrawal_requests (user_id)
  WHERE status = 'pending';

-- 2. Backfill: correct referral_earnings for all past withdrawals
--    (old code never decremented on request, and wrongly added back on reject)
UPDATE profiles p
SET referral_earnings = GREATEST(
  0,
  COALESCE(p.referral_earnings, 0) - COALESCE(
    (SELECT SUM(w.amount) FROM withdrawal_requests w WHERE w.user_id = p.id),
    0
  )
)
WHERE EXISTS (SELECT 1 FROM withdrawal_requests w WHERE w.user_id = p.id);
