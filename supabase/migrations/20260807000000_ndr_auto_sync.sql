-- Migration: Add NDR Auto-Sync Columns and Open RLS Policies for Dev/Production
ALTER TABLE public.ndr_shipments ADD COLUMN IF NOT EXISTS normalized_ndr_reason TEXT;
ALTER TABLE public.ndr_shipments ADD COLUMN IF NOT EXISTS final_action TEXT;
ALTER TABLE public.ndr_shipments ADD COLUMN IF NOT EXISTS delivered_after_ndr BOOLEAN DEFAULT false;

-- Indexes for fast searching and filtering
CREATE INDEX IF NOT EXISTS idx_ndr_shipments_normalized_reason ON public.ndr_shipments(normalized_ndr_reason);
CREATE INDEX IF NOT EXISTS idx_ndr_shipments_status_current ON public.ndr_shipments(shipment_status_current);
CREATE INDEX IF NOT EXISTS idx_ndr_shipments_total_attempts ON public.ndr_shipments(total_attempts);
CREATE INDEX IF NOT EXISTS idx_ndr_shipments_delivered_after_ndr ON public.ndr_shipments(delivered_after_ndr);

-- RLS Policies for both anon and authenticated roles
DROP POLICY IF EXISTS "anon_select_ndr_import_batches" ON public.ndr_import_batches;
CREATE POLICY "anon_select_ndr_import_batches" ON public.ndr_import_batches FOR SELECT USING (true);

DROP POLICY IF EXISTS "anon_insert_ndr_import_batches" ON public.ndr_import_batches;
CREATE POLICY "anon_insert_ndr_import_batches" ON public.ndr_import_batches FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_ndr_import_batches" ON public.ndr_import_batches;
CREATE POLICY "anon_update_ndr_import_batches" ON public.ndr_import_batches FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_ndr_shipments" ON public.ndr_shipments;
CREATE POLICY "anon_select_ndr_shipments" ON public.ndr_shipments FOR SELECT USING (true);

DROP POLICY IF EXISTS "anon_insert_ndr_shipments" ON public.ndr_shipments;
CREATE POLICY "anon_insert_ndr_shipments" ON public.ndr_shipments FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_ndr_shipments" ON public.ndr_shipments;
CREATE POLICY "anon_update_ndr_shipments" ON public.ndr_shipments FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_ndr_call_logs" ON public.ndr_call_logs;
CREATE POLICY "anon_select_ndr_call_logs" ON public.ndr_call_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "anon_insert_ndr_call_logs" ON public.ndr_call_logs;
CREATE POLICY "anon_insert_ndr_call_logs" ON public.ndr_call_logs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_ndr_supervisor_actions" ON public.ndr_supervisor_actions;
CREATE POLICY "anon_select_ndr_supervisor_actions" ON public.ndr_supervisor_actions FOR SELECT USING (true);

DROP POLICY IF EXISTS "anon_insert_ndr_supervisor_actions" ON public.ndr_supervisor_actions;
CREATE POLICY "anon_insert_ndr_supervisor_actions" ON public.ndr_supervisor_actions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_ndr_timeline_logs" ON public.ndr_timeline_logs;
CREATE POLICY "anon_select_ndr_timeline_logs" ON public.ndr_timeline_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "anon_insert_ndr_timeline_logs" ON public.ndr_timeline_logs;
CREATE POLICY "anon_insert_ndr_timeline_logs" ON public.ndr_timeline_logs FOR INSERT WITH CHECK (true);
