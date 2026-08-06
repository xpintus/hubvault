-- Migration: NDR (Non-Delivery Report) Management System
-- Description: Creates tables, RLS policies, indexes, and schema for NDR management, calling queue, supervisor actions, timeline, and import history.

-- 1. NDR Import Batches
CREATE TABLE IF NOT EXISTS public.ndr_import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    uploaded_by_name TEXT,
    upload_time TIMESTAMPTZ DEFAULT now(),
    total_rows INTEGER NOT NULL DEFAULT 0,
    valid_rows INTEGER NOT NULL DEFAULT 0,
    duplicate_rows INTEGER NOT NULL DEFAULT 0,
    invalid_rows INTEGER NOT NULL DEFAULT 0,
    ready_to_import INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'completed', -- processing, completed, failed
    error_message TEXT,
    hub_id UUID REFERENCES public.hubs(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on ndr_import_batches
ALTER TABLE public.ndr_import_batches ENABLE ROW LEVEL SECURITY;

-- 2. NDR Shipments Table
CREATE TABLE IF NOT EXISTS public.ndr_shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    awb_number TEXT NOT NULL,
    drs_code TEXT,
    client_name TEXT,
    consignee_name TEXT,
    delivery_executive TEXT,
    partner_name TEXT,
    hub_location TEXT,
    city TEXT,
    state TEXT,
    payment_type TEXT DEFAULT 'COD',
    amount_payable NUMERIC(12, 2) DEFAULT 0.00,
    
    -- Original Preserved Data
    shipment_status_original TEXT NOT NULL,
    original_ndr_reason TEXT,
    otp_status TEXT,
    drs_status TEXT,
    drs_date TIMESTAMPTZ,
    first_attempt_date TIMESTAMPTZ,
    last_attempt_date TIMESTAMPTZ,
    total_attempts INTEGER DEFAULT 1,
    delivery_pincode TEXT,
    is_mobility TEXT,
    
    -- Operational & Workflow Data
    shipment_status_current TEXT NOT NULL DEFAULT 'UNDEL',
    ndr_workflow_status TEXT NOT NULL DEFAULT 'UNDEL',
    
    -- Assignment
    assigned_caller_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_supervisor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    hub_id UUID REFERENCES public.hubs(id) ON DELETE CASCADE,
    import_batch_id UUID REFERENCES public.ndr_import_batches(id) ON DELETE SET NULL,
    
    -- Delivery After NDR Details
    delivered_date TIMESTAMPTZ,
    delivered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    delivered_user TEXT,
    pod_reference TEXT,
    cod_collected_amount NUMERIC(12, 2),
    cod_exception_remark TEXT,
    
    -- RTO Details
    rto_date TIMESTAMPTZ,
    rto_reason TEXT,
    rto_remarks TEXT,
    expected_rto_date DATE,
    
    -- Cycle tracking for re-opened UNDEL shipments
    ndr_cycle INTEGER NOT NULL DEFAULT 1,
    
    -- Raw JSON snapshot
    raw_data JSONB DEFAULT '{}'::jsonb,
    
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on ndr_shipments
ALTER TABLE public.ndr_shipments ENABLE ROW LEVEL SECURITY;

-- Indexing for fast search and aggregation
CREATE INDEX IF NOT EXISTS idx_ndr_shipments_awb ON public.ndr_shipments(awb_number);
CREATE INDEX IF NOT EXISTS idx_ndr_shipments_hub ON public.ndr_shipments(hub_id);
CREATE INDEX IF NOT EXISTS idx_ndr_shipments_workflow ON public.ndr_shipments(ndr_workflow_status);
CREATE INDEX IF NOT EXISTS idx_ndr_shipments_caller ON public.ndr_shipments(assigned_caller_id);
CREATE INDEX IF NOT EXISTS idx_ndr_shipments_supervisor ON public.ndr_shipments(assigned_supervisor_id);
CREATE INDEX IF NOT EXISTS idx_ndr_shipments_executive ON public.ndr_shipments(delivery_executive);
CREATE INDEX IF NOT EXISTS idx_ndr_shipments_partner ON public.ndr_shipments(partner_name);

-- 3. NDR Call Logs
CREATE TABLE IF NOT EXISTS public.ndr_call_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID NOT NULL REFERENCES public.ndr_shipments(id) ON DELETE CASCADE,
    caller_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    caller_name TEXT,
    call_date DATE NOT NULL DEFAULT CURRENT_DATE,
    call_time TEXT,
    call_connected BOOLEAN DEFAULT true,
    attempt_number INTEGER DEFAULT 1,
    customer_response TEXT,
    caller_result TEXT NOT NULL,
    customer_verified_reason TEXT,
    customer_complaint TEXT,
    customer_wants_delivery BOOLEAN DEFAULT true,
    preferred_delivery_date DATE,
    alternate_number TEXT,
    next_followup_date DATE,
    caller_remarks TEXT,
    call_duration TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ndr_call_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ndr_call_logs_shipment ON public.ndr_call_logs(shipment_id);

-- 4. NDR Supervisor Actions
CREATE TABLE IF NOT EXISTS public.ndr_supervisor_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID NOT NULL REFERENCES public.ndr_shipments(id) ON DELETE CASCADE,
    supervisor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    supervisor_name TEXT,
    supervisor_called_customer BOOLEAN DEFAULT false,
    delivery_executive_reason_correct BOOLEAN DEFAULT true,
    fake_attempt_suspected BOOLEAN DEFAULT false,
    otp_misuse_suspected BOOLEAN DEFAULT false,
    escalate_delivery_executive BOOLEAN DEFAULT false,
    escalate_vendor BOOLEAN DEFAULT false,
    action_taken TEXT NOT NULL,
    supervisor_remarks TEXT,
    next_action_date DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ndr_supervisor_actions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ndr_supervisor_actions_shipment ON public.ndr_supervisor_actions(shipment_id);

-- 5. NDR Timeline Audit Logs
CREATE TABLE IF NOT EXISTS public.ndr_timeline_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID NOT NULL REFERENCES public.ndr_shipments(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- import, caller_update, supervisor_update, reattempt_approval, delivered, rto, closure, assignment
    action_title TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_name TEXT,
    user_role TEXT,
    previous_status TEXT,
    new_status TEXT,
    remarks TEXT,
    meta_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ndr_timeline_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ndr_timeline_logs_shipment ON public.ndr_timeline_logs(shipment_id);

-- RLS Policies for Authenticated Operations Users

-- ndr_import_batches
DROP POLICY IF EXISTS "select_ndr_import_batches" ON public.ndr_import_batches;
CREATE POLICY "select_ndr_import_batches" ON public.ndr_import_batches FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_ndr_import_batches" ON public.ndr_import_batches;
CREATE POLICY "insert_ndr_import_batches" ON public.ndr_import_batches FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_ndr_import_batches" ON public.ndr_import_batches;
CREATE POLICY "update_ndr_import_batches" ON public.ndr_import_batches FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_ndr_import_batches" ON public.ndr_import_batches;
CREATE POLICY "delete_ndr_import_batches" ON public.ndr_import_batches FOR DELETE TO authenticated USING (true);

-- ndr_shipments
DROP POLICY IF EXISTS "select_ndr_shipments" ON public.ndr_shipments;
CREATE POLICY "select_ndr_shipments" ON public.ndr_shipments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_ndr_shipments" ON public.ndr_shipments;
CREATE POLICY "insert_ndr_shipments" ON public.ndr_shipments FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_ndr_shipments" ON public.ndr_shipments;
CREATE POLICY "update_ndr_shipments" ON public.ndr_shipments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_ndr_shipments" ON public.ndr_shipments;
CREATE POLICY "delete_ndr_shipments" ON public.ndr_shipments FOR DELETE TO authenticated USING (true);

-- ndr_call_logs
DROP POLICY IF EXISTS "select_ndr_call_logs" ON public.ndr_call_logs;
CREATE POLICY "select_ndr_call_logs" ON public.ndr_call_logs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_ndr_call_logs" ON public.ndr_call_logs;
CREATE POLICY "insert_ndr_call_logs" ON public.ndr_call_logs FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_ndr_call_logs" ON public.ndr_call_logs;
CREATE POLICY "update_ndr_call_logs" ON public.ndr_call_logs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ndr_supervisor_actions
DROP POLICY IF EXISTS "select_ndr_supervisor_actions" ON public.ndr_supervisor_actions;
CREATE POLICY "select_ndr_supervisor_actions" ON public.ndr_supervisor_actions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_ndr_supervisor_actions" ON public.ndr_supervisor_actions;
CREATE POLICY "insert_ndr_supervisor_actions" ON public.ndr_supervisor_actions FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_ndr_supervisor_actions" ON public.ndr_supervisor_actions;
CREATE POLICY "update_ndr_supervisor_actions" ON public.ndr_supervisor_actions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ndr_timeline_logs
DROP POLICY IF EXISTS "select_ndr_timeline_logs" ON public.ndr_timeline_logs;
CREATE POLICY "select_ndr_timeline_logs" ON public.ndr_timeline_logs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_ndr_timeline_logs" ON public.ndr_timeline_logs;
CREATE POLICY "insert_ndr_timeline_logs" ON public.ndr_timeline_logs FOR INSERT TO authenticated WITH CHECK (true);
