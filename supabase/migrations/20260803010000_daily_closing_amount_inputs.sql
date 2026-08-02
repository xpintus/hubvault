/* Replace denomination-driven daily closing entry with direct cash/online amounts. */

alter table public.daily_closings
  add column if not exists expected_online_amount numeric(14,2) not null default 0
  check (expected_online_amount >= 0);

update public.daily_closings
set expected_online_amount = coalesce((source_snapshot->>'online_amount')::numeric, online_amount, 0)
where expected_online_amount = 0;

create or replace function public.submit_daily_closing_amounts(
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
  v_action text := 'submitted';
begin
  if auth.uid() is null or not public.daily_closing_can_submit(p_collector_id, p_hub_id) then
    raise exception 'Not authorized to submit this daily closing';
  end if;
  if p_actual_cash is null or p_actual_cash < 0 or p_actual_online is null or p_actual_online < 0 then
    raise exception 'Cash and online amounts cannot be negative';
  end if;
  if not exists (select 1 from public.collectors where id=p_collector_id and hub_id=p_hub_id) then
    raise exception 'Collector does not belong to the selected hub';
  end if;

  select coalesce(sum(greatest(expected_cod-online_amount,0)),0), coalesce(sum(online_amount),0)
    into v_expected_cash, v_expected_online from public.collection_entries
    where collection_date=p_closing_date and collector_id=p_collector_id and hub_id=p_hub_id;
  select coalesce(sum(coalesce(cash_submitted,cash_deposited,0)),0),
    coalesce(sum(coalesce(online_submitted,online_amount,0)),0)
    into v_cms_cash,v_cms_online from public.cms_deposits
    where coalesce(collection_date,deposit_date)=p_closing_date and collector_id=p_collector_id and hub_id=p_hub_id;

  -- Cash and online are linked by the closing, but each channel must reconcile
  -- independently. Opposite variances must not silently cancel each other.
  if (p_actual_cash <> v_expected_cash or p_actual_online <> v_expected_online)
    and nullif(trim(p_notes),'') is null then
    raise exception 'Cash or online mismatch requires notes';
  end if;

  if p_closing_id is not null then
    select * into v_existing from public.daily_closings where id=p_closing_id for update;
    if not found or v_existing.status not in ('rejected','reopened') then
      raise exception 'Closing cannot be resubmitted';
    end if;
    if v_existing.submitted_by<>auth.uid() and not public.daily_closing_is_manager(v_existing.hub_id) then
      raise exception 'Not authorized';
    end if;
    v_action := 'resubmitted';
    update public.daily_closings set
      expected_cash=v_expected_cash, expected_online_amount=v_expected_online,
      actual_cash=p_actual_cash, online_amount=p_actual_online,
      denomination_total=0, shortage_excess=(p_actual_cash+p_actual_online)-(v_expected_cash+v_expected_online),
      note_500=0,note_200=0,note_100=0,note_50=0,note_20=0,note_10=0,note_5=0,note_2=0,note_1=0,
      denomination_verified=false,
      source_snapshot=jsonb_build_object('expected_cash',v_expected_cash,'online_amount',v_expected_online,
        'cms_cash_submitted',v_cms_cash,'cms_online_submitted',v_cms_online,'captured_at',now()),
      notes=nullif(trim(p_notes),''),rejection_reason=null,status='submitted',submitted_at=now(),reviewed_by=null,reviewed_at=null
      where id=p_closing_id returning * into v_result;
  else
    insert into public.daily_closings(
      closing_date,collector_id,hub_id,expected_cash,expected_online_amount,actual_cash,online_amount,
      denomination_total,shortage_excess,denomination_verified,source_snapshot,notes,status,submitted_by
    ) values(
      p_closing_date,p_collector_id,p_hub_id,v_expected_cash,v_expected_online,p_actual_cash,p_actual_online,
      0,(p_actual_cash+p_actual_online)-(v_expected_cash+v_expected_online),false,
      jsonb_build_object('expected_cash',v_expected_cash,'online_amount',v_expected_online,
        'cms_cash_submitted',v_cms_cash,'cms_online_submitted',v_cms_online,'captured_at',now()),
      nullif(trim(p_notes),''),'submitted',auth.uid()
    ) returning * into v_result;
  end if;

  if v_action='resubmitted' then
    insert into public.daily_closing_history(daily_closing_id,action,from_status,to_status,reason,snapshot,performed_by)
      values(v_result.id,'resubmitted',v_existing.status,'submitted',null,to_jsonb(v_result),auth.uid());
  end if;
  return v_result;
end;
$$;

revoke all on function public.submit_daily_closing_amounts(uuid,date,uuid,uuid,numeric,numeric,text) from public,anon;
grant execute on function public.submit_daily_closing_amounts(uuid,date,uuid,uuid,numeric,numeric,text) to authenticated;
