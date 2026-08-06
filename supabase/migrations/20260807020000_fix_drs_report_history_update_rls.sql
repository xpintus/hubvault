-- Migration: Fix RLS UPDATE policies on drs_report_history and ndr_shipments for Enterprise Reset & Soft Delete
-- Description: Explicitly adds FOR UPDATE policies to allow soft-delete updates (setting deleted_at, deleted_by, deleted_reason) without silent RLS rejection.

-- 1. drs_report_history UPDATE policies
DROP POLICY IF EXISTS "Allow public update on drs_report_history" ON public.drs_report_history;
CREATE POLICY "Allow public update on drs_report_history"
  ON public.drs_report_history FOR UPDATE
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "update_drs_report_history" ON public.drs_report_history;
CREATE POLICY "update_drs_report_history"
  ON public.drs_report_history FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 2. ndr_shipments UPDATE policies
DROP POLICY IF EXISTS "anon_update_ndr_shipments" ON public.ndr_shipments;
CREATE POLICY "anon_update_ndr_shipments"
  ON public.ndr_shipments FOR UPDATE
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "update_ndr_shipments" ON public.ndr_shipments;
CREATE POLICY "update_ndr_shipments"
  ON public.ndr_shipments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
