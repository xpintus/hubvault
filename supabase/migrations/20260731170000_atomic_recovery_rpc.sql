/*
# Atomic Recovery Recording RPC

## Purpose
Ensures atomic execution when recording a recovery payment against a due.
Prevents race conditions and partial failures by combining the insert into `recoveries`
and update of `dues` within a single database transaction.
*/

CREATE OR REPLACE FUNCTION record_recovery_atomic(
  p_collector_id uuid,
  p_hub_id uuid,
  p_due_id uuid,
  p_recovery_date date,
  p_amount numeric,
  p_payment_mode text,
  p_reference_number text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rec_id uuid;
  v_original numeric;
  v_curr_recovered numeric;
  v_new_recovered numeric;
  v_new_remaining numeric;
  v_new_status text;
BEGIN
  -- Lock and fetch parent due balance
  SELECT original_amount, recovered_amount INTO v_original, v_curr_recovered
  FROM dues WHERE id = p_due_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Due record not found';
  END IF;

  v_new_recovered := v_curr_recovered + p_amount;
  v_new_remaining := GREATEST(0, v_original - v_new_recovered);
  v_new_status := CASE WHEN v_new_remaining <= 0 THEN 'fully_recovered' ELSE 'partially_recovered' END;

  -- Insert recovery entry
  INSERT INTO recoveries (
    collector_id, hub_id, due_id, recovery_date, amount, payment_mode, reference_number, notes, created_by
  ) VALUES (
    p_collector_id, p_hub_id, p_due_id, p_recovery_date, p_amount, p_payment_mode, p_reference_number, p_notes, p_created_by
  ) RETURNING id INTO v_rec_id;

  -- Update parent due
  UPDATE dues
  SET recovered_amount = v_new_recovered,
      remaining_amount = v_new_remaining,
      status = v_new_status,
      updated_at = now()
  WHERE id = p_due_id;

  RETURN jsonb_build_object(
    'recovery_id', v_rec_id,
    'due_id', p_due_id,
    'recovered_amount', v_new_recovered,
    'remaining_amount', v_new_remaining,
    'status', v_new_status
  );
END;
$$;
