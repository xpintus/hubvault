/*
# Atomic Employee FIFO Recovery RPC

## Purpose
Executes atomic FIFO recovery allocation across an employee's active dues.
Sorts active dues by due_date ASC, created_at ASC, id ASC.
Locks target dues with FOR UPDATE within a single database transaction.
Creates itemized recovery records per affected due and updates due balances and statuses.
*/

CREATE OR REPLACE FUNCTION record_employee_recovery_fifo(
  p_collector_id uuid,
  p_hub_id uuid,
  p_recovery_date date,
  p_amount numeric,
  p_payment_mode text,
  p_reference_number text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
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
  v_affected_dues jsonb := '[]'::jsonb;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Recovery amount must be greater than zero';
  END IF;

  -- Lock active dues for the employee and calculate total outstanding
  SELECT COALESCE(SUM(remaining_amount), 0) INTO v_total_outstanding
  FROM dues
  WHERE collector_id = p_collector_id
    AND status NOT IN ('cancelled', 'fully_recovered')
    AND remaining_amount > 0;

  IF v_total_outstanding <= 0 THEN
    RAISE EXCEPTION 'Employee has no active outstanding dues';
  END IF;

  IF p_amount > v_total_outstanding THEN
    RAISE EXCEPTION 'Recovery amount (%) exceeds total employee outstanding (%)', p_amount, v_total_outstanding;
  END IF;

  v_rem_to_allocate := p_amount;

  -- Loop through active dues in FIFO order (due_date ASC, created_at ASC, id ASC)
  FOR v_due_record IN
    SELECT id, hub_id, original_amount, recovered_amount, remaining_amount, due_date
    FROM dues
    WHERE collector_id = p_collector_id
      AND status NOT IN ('cancelled', 'fully_recovered')
      AND remaining_amount > 0
    ORDER BY due_date ASC, created_at ASC, id ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_rem_to_allocate <= 0;

    v_alloc := LEAST(v_due_record.remaining_amount, v_rem_to_allocate);
    v_new_recovered := v_due_record.recovered_amount + v_alloc;
    v_new_remaining := GREATEST(0, v_due_record.original_amount - v_new_recovered);
    v_new_status := CASE WHEN v_new_remaining <= 0 THEN 'fully_recovered' ELSE 'partially_recovered' END;

    -- Insert itemized recovery record for this due
    INSERT INTO recoveries (
      collector_id,
      hub_id,
      due_id,
      recovery_date,
      amount,
      payment_mode,
      reference_number,
      notes,
      created_by
    ) VALUES (
      p_collector_id,
      v_due_record.hub_id,
      v_due_record.id,
      p_recovery_date,
      v_alloc,
      p_payment_mode,
      p_reference_number,
      p_notes,
      p_created_by
    ) RETURNING id INTO v_rec_id;

    -- Update due row
    UPDATE dues
    SET recovered_amount = v_new_recovered,
        remaining_amount = v_new_remaining,
        status = v_new_status,
        updated_at = now()
    WHERE id = v_due_record.id;

    v_allocated_count := v_allocated_count + 1;
    v_rem_to_allocate := v_rem_to_allocate - v_alloc;

    v_affected_dues := v_affected_dues || jsonb_build_object(
      'due_id', v_due_record.id,
      'recovery_id', v_rec_id,
      'allocated', v_alloc,
      'new_remaining', v_new_remaining,
      'status', v_new_status
    );
  END LOOP;

  IF v_rem_to_allocate > 0 THEN
    RAISE EXCEPTION 'Could not fully allocate recovery amount. Unallocated: %', v_rem_to_allocate;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'total_recovered', p_amount,
    'dues_affected_count', v_allocated_count,
    'affected_dues', v_affected_dues
  );
END;
$$;
