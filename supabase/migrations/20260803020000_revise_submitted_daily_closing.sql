/* Allow corrections while a daily closing is awaiting supervisor review. */

create or replace function public.revise_submitted_daily_closing_amounts(
  p_closing_id uuid,
  p_closing_date date,
  p_collector_id uuid,
  p_hub_id uuid,
  p_actual_cash numeric,
  p_actual_online numeric,
  p_notes text default null
) returns public.daily_closings
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_expected_cash numeric;
  v_expected_online numeric;
  v_cms_cash numeric;
  v_cms_online numeric;
  v_existing public.daily_closings%rowtype;
  v_result public.daily_closings%rowtype;
begin
  if auth.uid() is null or not public.daily_closing_can_submit(p_collector_id, p_hub_id) then
    raise exception 'Not authorized to revise this daily closing';
  end if;
  if p_actual_cash is null or p_actual_cash < 0 or p_actual_online is null or p_actual_online < 0 then
    raise exception 'Cash and online amounts cannot be negative';
  end if;

  select * into v_existing
  from public.daily_closings
  where id = p_closing_id
    and closing_date = p_closing_date
    and collector_id = p_collector_id
    and hub_id = p_hub_id
  for update;

  if not found or v_existing.status <> 'submitted' then
    raise exception 'Only a submitted closing can be revised';
  end if;
  if v_existing.submitted_by <> auth.uid() and not public.daily_closing_is_manager(v_existing.hub_id) then
    raise exception 'Not authorized';
  end if;

  select coalesce(sum(greatest(expected_cod-online_amount,0)),0), coalesce(sum(online_amount),0)
  into v_expected_cash, v_expected_online
  from public.collection_entries
  where collection_date=p_closing_date and collector_id=p_collector_id and hub_id=p_hub_id;

  if (p_actual_cash <> v_expected_cash or p_actual_online <> v_expected_online)
    and nullif(trim(p_notes),'') is null then
    raise exception 'Cash or online mismatch requires notes';
  end if;

  select coalesce(sum(coalesce(cash_submitted,cash_deposited,0)),0),
    coalesce(sum(coalesce(online_submitted,online_amount,0)),0)
  into v_cms_cash,v_cms_online
  from public.cms_deposits
  where coalesce(collection_date,deposit_date)=p_closing_date and collector_id=p_collector_id and hub_id=p_hub_id;

  update public.daily_closings set
    expected_cash=v_expected_cash, expected_online_amount=v_expected_online,
    actual_cash=p_actual_cash, online_amount=p_actual_online,
    shortage_excess=(p_actual_cash+p_actual_online)-(v_expected_cash+v_expected_online),
    source_snapshot=jsonb_build_object('expected_cash',v_expected_cash,'online_amount',v_expected_online,
      'cms_cash_submitted',v_cms_cash,'cms_online_submitted',v_cms_online,'captured_at',now()),
    notes=nullif(trim(p_notes),''),submitted_at=now(),updated_at=now()
  where id=p_closing_id
  returning * into v_result;

  insert into public.daily_closing_history(
    daily_closing_id,action,from_status,to_status,reason,snapshot,performed_by
  ) values(
    v_result.id,'resubmitted','submitted','submitted',null,to_jsonb(v_result),auth.uid()
  );

  return v_result;
end;
$$;

revoke all on function public.revise_submitted_daily_closing_amounts(uuid,date,uuid,uuid,numeric,numeric,text) from public,anon;
grant execute on function public.revise_submitted_daily_closing_amounts(uuid,date,uuid,uuid,numeric,numeric,text) to authenticated;
