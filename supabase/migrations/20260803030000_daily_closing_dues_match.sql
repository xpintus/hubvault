/* Match Daily Closing shortages with existing dues and create only residual dues. */

alter table public.dues
  add column if not exists daily_closing_id uuid references public.daily_closings(id) on delete set null,
  add column if not exists variance_channel text check (variance_channel in ('cash','online'));

create unique index if not exists uq_dues_daily_closing_channel
  on public.dues(daily_closing_id, variance_channel)
  where daily_closing_id is not null;

create index if not exists idx_dues_daily_closing
  on public.dues(daily_closing_id);

create or replace function public.sync_daily_closing_dues()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_cash_shortage numeric := greatest(new.expected_cash - new.actual_cash, 0);
  v_online_shortage numeric := greatest(new.expected_online_amount - new.online_amount, 0);
  v_existing_collection_due numeric := 0;
  v_cash_residual numeric := 0;
  v_due public.dues%rowtype;
  v_status text;
  v_summary text;
begin
  if new.status = 'rejected' then
    update public.dues set status='cancelled',remaining_amount=0,updated_at=now()
    where daily_closing_id=new.id and coalesce(recovered_amount,0)=0;
    return new;
  end if;

  if new.status not in ('submitted','reopened') then
    return new;
  end if;

  /* Entry-level collection shortages already represent cash owed. Match them
     first so Daily Closing never creates a duplicate recoverable balance. */
  select coalesce(sum(original_amount),0)
  into v_existing_collection_due
  from public.dues
  where collector_id = new.collector_id
    and hub_id = new.hub_id
    and due_date = new.closing_date
    and source = 'collection_shortage'
    and daily_closing_id is null
    and status <> 'cancelled';

  v_cash_residual := greatest(v_cash_shortage - v_existing_collection_due, 0);

  select * into v_due from public.dues
  where daily_closing_id=new.id and variance_channel='cash'
  for update;
  if not found and v_cash_residual > 0 then
    insert into public.dues(
      collector_id,hub_id,collection_entry_id,daily_closing_id,variance_channel,
      original_amount,recovered_amount,remaining_amount,due_date,status,source,
      due_reason,notes,created_by
    ) values(
      new.collector_id,new.hub_id,null,new.id,'cash',v_cash_residual,0,v_cash_residual,
      new.closing_date,'outstanding','daily_closing_shortage','Daily Closing cash shortage',
      'Auto-created from unmatched Daily Closing cash variance',new.submitted_by
    );
  elsif found then
    v_status := case
      when v_cash_residual = 0 and coalesce(v_due.recovered_amount,0) = 0 then 'cancelled'
      when v_cash_residual <= coalesce(v_due.recovered_amount,0) then 'fully_recovered'
      when coalesce(v_due.recovered_amount,0) > 0 then 'partially_recovered'
      else 'outstanding' end;
    update public.dues set
      original_amount=greatest(v_cash_residual,coalesce(recovered_amount,0)),
      remaining_amount=greatest(v_cash_residual-coalesce(recovered_amount,0),0),
      status=v_status,updated_at=now()
    where id=v_due.id;
  end if;

  select * into v_due from public.dues
  where daily_closing_id=new.id and variance_channel='online'
  for update;
  if not found and v_online_shortage > 0 then
    insert into public.dues(
      collector_id,hub_id,collection_entry_id,daily_closing_id,variance_channel,
      original_amount,recovered_amount,remaining_amount,due_date,status,source,
      due_reason,notes,created_by
    ) values(
      new.collector_id,new.hub_id,null,new.id,'online',v_online_shortage,0,v_online_shortage,
      new.closing_date,'outstanding','daily_closing_shortage','Daily Closing online shortage',
      'Auto-verified: recorded online collection was not received at closing',new.submitted_by
    );
  elsif found then
    v_status := case
      when v_online_shortage = 0 and coalesce(v_due.recovered_amount,0) = 0 then 'cancelled'
      when v_online_shortage <= coalesce(v_due.recovered_amount,0) then 'fully_recovered'
      when coalesce(v_due.recovered_amount,0) > 0 then 'partially_recovered'
      else 'outstanding' end;
    update public.dues set
      original_amount=greatest(v_online_shortage,coalesce(recovered_amount,0)),
      remaining_amount=greatest(v_online_shortage-coalesce(recovered_amount,0),0),
      status=v_status,updated_at=now()
    where id=v_due.id;
  end if;

  v_summary := format(
    'Auto dues reconciliation: cash shortage ₹%s; matched existing dues ₹%s; new cash due ₹%s; online shortage due ₹%s.',
    v_cash_shortage,least(v_cash_shortage,v_existing_collection_due),v_cash_residual,v_online_shortage
  );

  update public.daily_closings set
    notes = trim(both from concat_ws(E'\n',
      nullif(regexp_replace(coalesce(new.notes,''), E'\n?Auto dues reconciliation:.*$', ''),''),
      v_summary
    )),
    source_snapshot = coalesce(new.source_snapshot,'{}'::jsonb) || jsonb_build_object(
      'existing_due_matched',least(v_cash_shortage,v_existing_collection_due),
      'new_cash_due',v_cash_residual,
      'new_online_due',v_online_shortage,
      'dues_synced_at',now()
    )
  where id=new.id;

  return new;
end;
$$;

drop trigger if exists sync_daily_closing_dues_trigger on public.daily_closings;
create trigger sync_daily_closing_dues_trigger
after insert or update of expected_cash,expected_online_amount,actual_cash,online_amount,status
on public.daily_closings
for each row execute function public.sync_daily_closing_dues();

/* Backfill submitted/reopened closings created before this migration. */
update public.daily_closings
set actual_cash=actual_cash
where status in ('submitted','reopened');
