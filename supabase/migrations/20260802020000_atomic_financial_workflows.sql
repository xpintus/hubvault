-- Keep related financial rows consistent: every function runs in one PostgreSQL transaction.

CREATE OR REPLACE FUNCTION public.save_collection_entry_atomic(
  p_entry jsonb,
  p_denominations jsonb,
  p_pending_amount numeric,
  p_entry_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_entry_id uuid;
  v_due dues%ROWTYPE;
  v_pending numeric := GREATEST(COALESCE(p_pending_amount, 0), 0);
  v_remaining numeric;
  v_status text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  IF p_entry_id IS NULL THEN
    INSERT INTO collection_entries (
      collection_date, collector_id, hub_id, expected_cod, cash_amount,
      online_amount, online_payment_mode, total_collection, gap, status,
      remarks, created_by
    ) VALUES (
      (p_entry->>'collection_date')::date, (p_entry->>'collector_id')::uuid,
      (p_entry->>'hub_id')::uuid, COALESCE((p_entry->>'expected_cod')::numeric, 0),
      COALESCE((p_entry->>'cash_amount')::numeric, 0),
      COALESCE((p_entry->>'online_amount')::numeric, 0),
      NULLIF(p_entry->>'online_payment_mode', '')::online_payment_mode,
      COALESCE((p_entry->>'total_collection')::numeric, 0),
      COALESCE((p_entry->>'gap')::numeric, 0),
      (p_entry->>'status')::entry_status, NULLIF(p_entry->>'remarks', ''), auth.uid()
    ) RETURNING id INTO v_entry_id;
  ELSE
    UPDATE collection_entries SET
      collection_date = (p_entry->>'collection_date')::date,
      collector_id = (p_entry->>'collector_id')::uuid,
      hub_id = (p_entry->>'hub_id')::uuid,
      expected_cod = COALESCE((p_entry->>'expected_cod')::numeric, 0),
      cash_amount = COALESCE((p_entry->>'cash_amount')::numeric, 0),
      online_amount = COALESCE((p_entry->>'online_amount')::numeric, 0),
      online_payment_mode = NULLIF(p_entry->>'online_payment_mode', '')::online_payment_mode,
      total_collection = COALESCE((p_entry->>'total_collection')::numeric, 0),
      gap = COALESCE((p_entry->>'gap')::numeric, 0),
      status = (p_entry->>'status')::entry_status,
      remarks = NULLIF(p_entry->>'remarks', ''), updated_at = now()
    WHERE id = p_entry_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Collection entry not found'; END IF;
    v_entry_id := p_entry_id;
  END IF;

  IF p_denominations IS NOT NULL THEN
    UPDATE denominations SET
      note_500 = COALESCE((p_denominations->>'note_500')::integer, 0),
      note_200 = COALESCE((p_denominations->>'note_200')::integer, 0),
      note_100 = COALESCE((p_denominations->>'note_100')::integer, 0),
      note_50 = COALESCE((p_denominations->>'note_50')::integer, 0),
      note_20 = COALESCE((p_denominations->>'note_20')::integer, 0),
      note_10 = COALESCE((p_denominations->>'note_10')::integer, 0),
      note_5 = COALESCE((p_denominations->>'note_5')::integer, 0),
      note_2 = COALESCE((p_denominations->>'note_2')::integer, 0),
      note_1 = COALESCE((p_denominations->>'note_1')::integer, 0)
    WHERE collection_entry_id = v_entry_id;
    IF NOT FOUND THEN
      INSERT INTO denominations (
        collection_entry_id, note_500, note_200, note_100, note_50,
        note_20, note_10, note_5, note_2, note_1
      ) VALUES (
        v_entry_id, COALESCE((p_denominations->>'note_500')::integer, 0),
        COALESCE((p_denominations->>'note_200')::integer, 0),
        COALESCE((p_denominations->>'note_100')::integer, 0),
        COALESCE((p_denominations->>'note_50')::integer, 0),
        COALESCE((p_denominations->>'note_20')::integer, 0),
        COALESCE((p_denominations->>'note_10')::integer, 0),
        COALESCE((p_denominations->>'note_5')::integer, 0),
        COALESCE((p_denominations->>'note_2')::integer, 0),
        COALESCE((p_denominations->>'note_1')::integer, 0)
      );
    END IF;
  END IF;

  SELECT * INTO v_due FROM dues WHERE collection_entry_id = v_entry_id FOR UPDATE;
  IF NOT FOUND AND v_pending > 0 THEN
    INSERT INTO dues (
      collector_id, hub_id, collection_entry_id, original_amount,
      recovered_amount, remaining_amount, due_date, status, created_by
    ) VALUES (
      (p_entry->>'collector_id')::uuid, (p_entry->>'hub_id')::uuid, v_entry_id,
      v_pending, 0, v_pending, (p_entry->>'collection_date')::date, 'outstanding', auth.uid()
    );
  ELSIF FOUND THEN
    v_remaining := GREATEST(0, v_pending - COALESCE(v_due.recovered_amount, 0));
    v_status := CASE WHEN v_remaining = 0 THEN 'fully_recovered'
      WHEN COALESCE(v_due.recovered_amount, 0) > 0 THEN 'partially_recovered'
      ELSE 'outstanding' END;
    UPDATE dues SET
      collector_id = (p_entry->>'collector_id')::uuid,
      hub_id = (p_entry->>'hub_id')::uuid,
      original_amount = GREATEST(v_pending, COALESCE(v_due.recovered_amount, 0)),
      remaining_amount = v_remaining, due_date = (p_entry->>'collection_date')::date,
      status = v_status, updated_at = now()
    WHERE id = v_due.id;
  END IF;

  RETURN jsonb_build_object('entry_id', v_entry_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_shortage_atomic(
  p_entry jsonb,
  p_notes text,
  p_entry_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_entry_id uuid;
BEGIN
  v_result := public.save_collection_entry_atomic(
    p_entry, NULL, GREATEST(-COALESCE((p_entry->>'gap')::numeric, 0), 0), p_entry_id
  );
  v_entry_id := (v_result->>'entry_id')::uuid;
  UPDATE dues SET notes = NULLIF(p_notes, ''), updated_at = now()
  WHERE collection_entry_id = v_entry_id;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_recovery_atomic(p_recovery_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_recovery recoveries%ROWTYPE;
  v_due dues%ROWTYPE;
  v_recovered numeric;
  v_remaining numeric;
  v_status text;
BEGIN
  SELECT * INTO v_recovery FROM recoveries WHERE id = p_recovery_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Recovery transaction not found'; END IF;
  SELECT * INTO v_due FROM dues WHERE id = v_recovery.due_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Parent due not found'; END IF;

  DELETE FROM recoveries WHERE id = p_recovery_id;
  v_recovered := GREATEST(0, COALESCE(v_due.recovered_amount, 0) - v_recovery.amount);
  v_remaining := GREATEST(0, v_due.original_amount - v_recovered);
  v_status := CASE WHEN v_remaining = 0 THEN 'fully_recovered'
    WHEN v_recovered > 0 THEN 'partially_recovered' ELSE 'outstanding' END;
  UPDATE dues SET recovered_amount = v_recovered, remaining_amount = v_remaining,
    status = v_status, updated_at = now() WHERE id = v_due.id;
  RETURN jsonb_build_object('due_id', v_due.id, 'recovered_amount', v_recovered,
    'remaining_amount', v_remaining, 'status', v_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_recovery_atomic(
  p_collector_id uuid,
  p_hub_id uuid,
  p_due_id uuid,
  p_recovery_date date,
  p_amount numeric,
  p_payment_mode text,
  p_reference_number text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_due dues%ROWTYPE;
  v_recovery_id uuid;
  v_recovered numeric;
  v_remaining numeric;
  v_status text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Recovery amount must be greater than zero';
  END IF;

  SELECT * INTO v_due FROM dues WHERE id = p_due_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Due record not found'; END IF;
  IF v_due.collector_id <> p_collector_id OR v_due.hub_id <> p_hub_id THEN
    RAISE EXCEPTION 'Recovery does not match the selected due';
  END IF;
  IF p_amount > v_due.remaining_amount THEN
    RAISE EXCEPTION 'Recovery amount exceeds outstanding balance';
  END IF;

  INSERT INTO recoveries (
    collector_id, hub_id, due_id, recovery_date, amount, payment_mode,
    reference_number, notes, created_by
  ) VALUES (
    p_collector_id, p_hub_id, p_due_id, p_recovery_date, p_amount,
    p_payment_mode, NULLIF(p_reference_number, ''), NULLIF(p_notes, ''), auth.uid()
  ) RETURNING id INTO v_recovery_id;

  v_recovered := COALESCE(v_due.recovered_amount, 0) + p_amount;
  v_remaining := GREATEST(0, v_due.original_amount - v_recovered);
  v_status := CASE WHEN v_remaining = 0 THEN 'fully_recovered' ELSE 'partially_recovered' END;
  UPDATE dues SET recovered_amount = v_recovered, remaining_amount = v_remaining,
    status = v_status, updated_at = now() WHERE id = p_due_id;

  RETURN jsonb_build_object('recovery_id', v_recovery_id, 'due_id', p_due_id,
    'recovered_amount', v_recovered, 'remaining_amount', v_remaining, 'status', v_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_collection_entry_atomic(jsonb, jsonb, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_shortage_atomic(jsonb, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_recovery_atomic(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_recovery_atomic(uuid, uuid, uuid, date, numeric, text, text, text, uuid) TO authenticated;
