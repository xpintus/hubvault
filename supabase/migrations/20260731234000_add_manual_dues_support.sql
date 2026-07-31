/*
# Add Manual / Old Dues Support Schema Migration

1. Add `source`, `due_reason`, and `reference_number` columns to `public.dues`.
2. Update `status` check constraint on `public.dues` to include `'cancelled'`.
*/

ALTER TABLE public.dues
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'collection_shortage',
  ADD COLUMN IF NOT EXISTS due_reason text,
  ADD COLUMN IF NOT EXISTS reference_number text;

-- Re-create status check constraint to include 'cancelled'
ALTER TABLE public.dues DROP CONSTRAINT IF EXISTS dues_status_check;
ALTER TABLE public.dues ADD CONSTRAINT dues_status_check CHECK (status IN ('outstanding', 'partially_recovered', 'fully_recovered', 'cancelled'));
