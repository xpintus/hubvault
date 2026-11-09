/*
# HubVault — Rider Dues Book & Recovery Management Module
Schema Migration: rider_dues, rider_dues_recoveries, rider_dues_messages
*/

-- 1. Create rider_dues table
CREATE TABLE IF NOT EXISTS public.rider_dues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL REFERENCES public.collectors(id) ON DELETE CASCADE,
  hub_id uuid NOT NULL REFERENCES public.hubs(id) ON DELETE CASCADE,
  dues_date date NOT NULL DEFAULT CURRENT_DATE,
  category text NOT NULL DEFAULT 'COD Short',
  amount numeric(14,2) NOT NULL DEFAULT 0,
  recovered_amount numeric(14,2) NOT NULL DEFAULT 0,
  remaining_amount numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partially_recovered', 'fully_recovered', 'cancelled', 'overdue')),
  description text,
  reference_id text,
  remarks text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create rider_dues_recoveries table
CREATE TABLE IF NOT EXISTS public.rider_dues_recoveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL REFERENCES public.collectors(id) ON DELETE CASCADE,
  hub_id uuid NOT NULL REFERENCES public.hubs(id) ON DELETE CASCADE,
  due_id uuid REFERENCES public.rider_dues(id) ON DELETE SET NULL,
  recovery_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  payment_mode text NOT NULL DEFAULT 'Cash',
  transaction_id text,
  remarks text,
  collected_by text,
  is_reversed boolean NOT NULL DEFAULT false,
  reversal_reason text,
  reversal_date timestamptz,
  reversed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Create rider_dues_messages table
CREATE TABLE IF NOT EXISTS public.rider_dues_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL REFERENCES public.collectors(id) ON DELETE CASCADE,
  hub_id uuid NOT NULL REFERENCES public.hubs(id) ON DELETE CASCADE,
  message_type text NOT NULL,
  recipient_phone text NOT NULL,
  message_body text NOT NULL,
  channel text NOT NULL DEFAULT 'WhatsApp',
  status text NOT NULL DEFAULT 'drafted',
  snapshot_dues numeric(14,2) DEFAULT 0,
  snapshot_recovered numeric(14,2) DEFAULT 0,
  snapshot_balance numeric(14,2) DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for lightning performance
CREATE INDEX IF NOT EXISTS idx_rider_dues_rider_id ON public.rider_dues(rider_id);
CREATE INDEX IF NOT EXISTS idx_rider_dues_hub_id ON public.rider_dues(hub_id);
CREATE INDEX IF NOT EXISTS idx_rider_dues_status ON public.rider_dues(status);
CREATE INDEX IF NOT EXISTS idx_rider_dues_date ON public.rider_dues(dues_date);
CREATE INDEX IF NOT EXISTS idx_rider_dues_category ON public.rider_dues(category);

CREATE INDEX IF NOT EXISTS idx_rider_dues_recoveries_rider_id ON public.rider_dues_recoveries(rider_id);
CREATE INDEX IF NOT EXISTS idx_rider_dues_recoveries_hub_id ON public.rider_dues_recoveries(hub_id);
CREATE INDEX IF NOT EXISTS idx_rider_dues_recoveries_due_id ON public.rider_dues_recoveries(due_id);
CREATE INDEX IF NOT EXISTS idx_rider_dues_recoveries_date ON public.rider_dues_recoveries(recovery_date);
CREATE INDEX IF NOT EXISTS idx_rider_dues_recoveries_is_reversed ON public.rider_dues_recoveries(is_reversed);

CREATE INDEX IF NOT EXISTS idx_rider_dues_messages_rider_id ON public.rider_dues_messages(rider_id);
CREATE INDEX IF NOT EXISTS idx_rider_dues_messages_hub_id ON public.rider_dues_messages(hub_id);
CREATE INDEX IF NOT EXISTS idx_rider_dues_messages_date ON public.rider_dues_messages(created_at);

-- Enable RLS
ALTER TABLE public.rider_dues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_dues_recoveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_dues_messages ENABLE ROW LEVEL SECURITY;

-- Permissive authenticated policies consistent with existing HubVault setup
DROP POLICY IF EXISTS "rider_dues_select" ON public.rider_dues;
CREATE POLICY "rider_dues_select" ON public.rider_dues FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "rider_dues_insert" ON public.rider_dues;
CREATE POLICY "rider_dues_insert" ON public.rider_dues FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "rider_dues_update" ON public.rider_dues;
CREATE POLICY "rider_dues_update" ON public.rider_dues FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "rider_dues_delete" ON public.rider_dues;
CREATE POLICY "rider_dues_delete" ON public.rider_dues FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "rider_dues_recoveries_select" ON public.rider_dues_recoveries;
CREATE POLICY "rider_dues_recoveries_select" ON public.rider_dues_recoveries FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "rider_dues_recoveries_insert" ON public.rider_dues_recoveries;
CREATE POLICY "rider_dues_recoveries_insert" ON public.rider_dues_recoveries FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "rider_dues_recoveries_update" ON public.rider_dues_recoveries;
CREATE POLICY "rider_dues_recoveries_update" ON public.rider_dues_recoveries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "rider_dues_messages_select" ON public.rider_dues_messages;
CREATE POLICY "rider_dues_messages_select" ON public.rider_dues_messages FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "rider_dues_messages_insert" ON public.rider_dues_messages;
CREATE POLICY "rider_dues_messages_insert" ON public.rider_dues_messages FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "rider_dues_messages_update" ON public.rider_dues_messages;
CREATE POLICY "rider_dues_messages_update" ON public.rider_dues_messages FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 4. Atomic FIFO recovery stored procedure
CREATE OR REPLACE FUNCTION record_rider_recovery_fifo(
  p_rider_id uuid,
  p_hub_id uuid,
  p_recovery_date date,
  p_amount numeric,
  p_payment_mode text,
  p_transaction_id text DEFAULT NULL,
  p_remarks text DEFAULT NULL,
  p_collected_by text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL,
  p_allow_over_recovery boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rem_to_allocate numeric;
  v_total_outstanding numeric;
  v_due_record RECORD;
  v_alloc numeric;
  v_new_recovered numeric;
  v_new_remaining numeric;
  v_new_status text;
  v_rec_id uuid;
  v_allocated_count integer := 0;
  v_created_recoveries jsonb := '[]'::jsonb;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Recovery amount must be greater than zero';
  END IF;

  -- Lock active dues for the rider and calculate total outstanding
  SELECT COALESCE(SUM(remaining_amount), 0) INTO v_total_outstanding
  FROM public.rider_dues
  WHERE rider_id = p_rider_id
    AND status NOT IN ('cancelled', 'fully_recovered')
    AND remaining_amount > 0;

  IF v_total_outstanding <= 0 AND NOT p_allow_over_recovery THEN
    RAISE EXCEPTION 'Rider has no active outstanding dues';
  END IF;

  IF p_amount > v_total_outstanding AND NOT p_allow_over_recovery THEN
    RAISE EXCEPTION 'Recovery amount (₹%) exceeds total rider outstanding (₹%)', p_amount, v_total_outstanding;
  END IF;

  v_rem_to_allocate := p_amount;

  -- Loop through active dues in FIFO order (dues_date ASC, created_at ASC, id ASC)
  FOR v_due_record IN
    SELECT id, hub_id, amount, recovered_amount, remaining_amount, dues_date
    FROM public.rider_dues
    WHERE rider_id = p_rider_id
      AND status NOT IN ('cancelled', 'fully_recovered')
      AND remaining_amount > 0
    ORDER BY dues_date ASC, created_at ASC, id ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_rem_to_allocate <= 0;

    v_alloc := LEAST(v_due_record.remaining_amount, v_rem_to_allocate);
    v_new_recovered := v_due_record.recovered_amount + v_alloc;
    v_new_remaining := GREATEST(0, v_due_record.amount - v_new_recovered);
    v_new_status := CASE WHEN v_new_remaining <= 0 THEN 'fully_recovered' ELSE 'partially_recovered' END;

    INSERT INTO public.rider_dues_recoveries (
      rider_id,
      hub_id,
      due_id,
      recovery_date,
      amount,
      payment_mode,
      transaction_id,
      remarks,
      collected_by,
      created_by
    ) VALUES (
      p_rider_id,
      v_due_record.hub_id,
      v_due_record.id,
      p_recovery_date,
      v_alloc,
      p_payment_mode,
      p_transaction_id,
      p_remarks,
      p_collected_by,
      p_created_by
    ) RETURNING id INTO v_rec_id;

    UPDATE public.rider_dues
    SET recovered_amount = v_new_recovered,
        remaining_amount = v_new_remaining,
        status = v_new_status,
        updated_at = now()
    WHERE id = v_due_record.id;

    v_allocated_count := v_allocated_count + 1;
    v_rem_to_allocate := v_rem_to_allocate - v_alloc;
    v_created_recoveries := v_created_recoveries || jsonb_build_object(
      'recovery_id', v_rec_id,
      'due_id', v_due_record.id,
      'amount', v_alloc,
      'new_remaining', v_new_remaining,
      'new_status', v_new_status
    );
  END LOOP;

  -- If excess amount was allowed by admin and remaining
  IF v_rem_to_allocate > 0 AND p_allow_over_recovery THEN
    INSERT INTO public.rider_dues_recoveries (
      rider_id,
      hub_id,
      due_id,
      recovery_date,
      amount,
      payment_mode,
      transaction_id,
      remarks,
      collected_by,
      created_by
    ) VALUES (
      p_rider_id,
      p_hub_id,
      NULL,
      p_recovery_date,
      v_rem_to_allocate,
      p_payment_mode,
      p_transaction_id,
      COALESCE(p_remarks, 'Advance / Unallocated Recovery'),
      p_collected_by,
      p_created_by
    ) RETURNING id INTO v_rec_id;

    v_created_recoveries := v_created_recoveries || jsonb_build_object(
      'recovery_id', v_rec_id,
      'due_id', null,
      'amount', v_rem_to_allocate,
      'new_remaining', 0,
      'new_status', 'unallocated_advance'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'allocated_count', v_allocated_count,
    'total_recovered', p_amount,
    'allocations', v_created_recoveries
  );
END;
$$;

-- 5. Stored procedure to reverse a recovery safely
CREATE OR REPLACE FUNCTION reverse_rider_recovery(
  p_recovery_id uuid,
  p_reversal_reason text,
  p_reversed_by uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rec RECORD;
  v_due RECORD;
  v_new_recovered numeric;
  v_new_remaining numeric;
  v_new_status text;
BEGIN
  SELECT * INTO v_rec
  FROM public.rider_dues_recoveries
  WHERE id = p_recovery_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recovery transaction not found';
  END IF;

  IF v_rec.is_reversed THEN
    RAISE EXCEPTION 'This recovery has already been reversed';
  END IF;

  -- Mark recovery as reversed
  UPDATE public.rider_dues_recoveries
  SET is_reversed = true,
      reversal_reason = p_reversal_reason,
      reversal_date = now(),
      reversed_by = p_reversed_by,
      updated_at = now()
  WHERE id = p_recovery_id;

  -- If linked to a due, reverse the balance allocation
  IF v_rec.due_id IS NOT NULL THEN
    SELECT * INTO v_due
    FROM public.rider_dues
    WHERE id = v_rec.due_id
    FOR UPDATE;

    IF FOUND THEN
      v_new_recovered := GREATEST(0, v_due.recovered_amount - v_rec.amount);
      v_new_remaining := GREATEST(0, v_due.amount - v_new_recovered);
      v_new_status := CASE
        WHEN v_new_recovered <= 0 THEN 'pending'
        WHEN v_new_remaining <= 0 THEN 'fully_recovered'
        ELSE 'partially_recovered'
      END;

      UPDATE public.rider_dues
      SET recovered_amount = v_new_recovered,
          remaining_amount = v_new_remaining,
          status = v_new_status,
          updated_at = now()
      WHERE id = v_due.id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'recovery_id', p_recovery_id,
    'reversed_amount', v_rec.amount
  );
END;
$$;

-- 6. Backfill existing legacy dues if tables exist
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'dues') THEN
    INSERT INTO public.rider_dues (
      id, rider_id, hub_id, dues_date, category, amount, recovered_amount,
      remaining_amount, status, description, reference_id, remarks, created_by, created_at, updated_at
    )
    SELECT
      d.id,
      d.collector_id,
      d.hub_id,
      d.due_date,
      COALESCE(d.due_reason, 'COD Short'),
      d.original_amount,
      d.recovered_amount,
      d.remaining_amount,
      CASE
        WHEN d.status = 'outstanding' THEN 'pending'
        WHEN d.status = 'partially_recovered' THEN 'partially_recovered'
        WHEN d.status = 'fully_recovered' THEN 'fully_recovered'
        ELSE 'cancelled'
      END,
      d.notes,
      d.reference_number,
      d.source,
      d.created_by,
      d.created_at,
      d.updated_at
    FROM public.dues d
    ON CONFLICT (id) DO NOTHING;
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'recoveries') THEN
    INSERT INTO public.rider_dues_recoveries (
      id, rider_id, hub_id, due_id, recovery_date, amount, payment_mode,
      transaction_id, remarks, created_by, created_at, updated_at
    )
    SELECT
      r.id,
      r.collector_id,
      r.hub_id,
      r.due_id,
      r.recovery_date,
      r.amount,
      CASE
        WHEN lower(r.payment_mode) = 'online' THEN 'UPI'
        WHEN lower(r.payment_mode) = 'cash' THEN 'Cash'
        ELSE 'Other'
      END,
      r.reference_number,
      r.notes,
      r.created_by,
      r.created_at,
      r.created_at
    FROM public.recoveries r
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
