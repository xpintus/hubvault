-- Migration: Enterprise Reset & Recycle Bin System
-- Description: Adds soft-delete columns (deleted_at, deleted_by, deleted_reason) to drs_report_history and ndr_shipments, and creates drs_reset_audit_logs table.

ALTER TABLE public.drs_report_history ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.drs_report_history ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.drs_report_history ADD COLUMN IF NOT EXISTS deleted_by_name TEXT;
ALTER TABLE public.drs_report_history ADD COLUMN IF NOT EXISTS deleted_reason TEXT;

ALTER TABLE public.ndr_shipments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.ndr_shipments ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.ndr_shipments ADD COLUMN IF NOT EXISTS deleted_by_name TEXT;
ALTER TABLE public.ndr_shipments ADD COLUMN IF NOT EXISTS deleted_reason TEXT;

-- Create Reset Audit Logs table
CREATE TABLE IF NOT EXISTS public.drs_reset_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hub_id UUID REFERENCES public.hubs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_name TEXT,
    report_id TEXT,
    report_file_name TEXT,
    report_date TEXT,
    delete_level TEXT NOT NULL, -- LEVEL 1, LEVEL 2, LEVEL 3
    ndr_cases_deleted_count INTEGER DEFAULT 0,
    snapshots_deleted_count INTEGER DEFAULT 0,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.drs_reset_audit_logs ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_drs_report_history_deleted ON public.drs_report_history(deleted_at);
CREATE INDEX IF NOT EXISTS idx_ndr_shipments_deleted ON public.ndr_shipments(deleted_at);
CREATE INDEX IF NOT EXISTS idx_drs_reset_audit_hub ON public.drs_reset_audit_logs(hub_id);

-- RLS policies
DROP POLICY IF EXISTS "select_drs_reset_audit_logs" ON public.drs_reset_audit_logs;
CREATE POLICY "select_drs_reset_audit_logs" ON public.drs_reset_audit_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "insert_drs_reset_audit_logs" ON public.drs_reset_audit_logs;
CREATE POLICY "insert_drs_reset_audit_logs" ON public.drs_reset_audit_logs FOR INSERT WITH CHECK (true);
