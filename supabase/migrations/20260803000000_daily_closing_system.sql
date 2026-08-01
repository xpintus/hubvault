/* Collector-wise Daily Closing workflow with immutable approvals and audit history. */

do $$ begin
  create type public.daily_closing_status as enum ('submitted', 'approved', 'rejected', 'reopened');
exception when duplicate_object then null; end $$;

alter table public.collectors
  add column if not exists profile_id uuid references public.profiles(id) on delete set null;
create unique index if not exists collectors_profile_id_unique
  on public.collectors(profile_id) where profile_id is not null;

-- Best-effort mapping for existing collector logins; ambiguous rows remain unmapped.
update public.collectors c set profile_id = p.id
from public.profiles p
where c.profile_id is null and p.role = 'collector' and p.hub_id = c.hub_id
  and p.phone is not null and c.phone is not null and regexp_replace(p.phone, '\D', '', 'g') = regexp_replace(c.phone, '\D', '', 'g')
  and not exists (select 1 from public.collectors x where x.profile_id = p.id);

create table if not exists public.daily_closings (
  id uuid primary key default gen_random_uuid(),
  closing_date date not null,
  collector_id uuid not null references public.collectors(id) on delete restrict,
  hub_id uuid not null references public.hubs(id) on delete restrict,
  expected_cash numeric(14,2) not null default 0 check (expected_cash >= 0),
  actual_cash numeric(14,2) not null default 0 check (actual_cash >= 0),
  online_amount numeric(14,2) not null default 0 check (online_amount >= 0),
  denomination_total numeric(14,2) not null default 0 check (denomination_total >= 0),
  shortage_excess numeric(14,2) not null default 0,
  note_500 integer not null default 0 check (note_500 >= 0),
  note_200 integer not null default 0 check (note_200 >= 0),
  note_100 integer not null default 0 check (note_100 >= 0),
  note_50 integer not null default 0 check (note_50 >= 0),
  note_20 integer not null default 0 check (note_20 >= 0),
  note_10 integer not null default 0 check (note_10 >= 0),
  note_5 integer not null default 0 check (note_5 >= 0),
  note_2 integer not null default 0 check (note_2 >= 0),
  note_1 integer not null default 0 check (note_1 >= 0),
  denomination_verified boolean not null default false,
  source_snapshot jsonb not null default '{}'::jsonb,
  notes text,
  rejection_reason text,
  status public.daily_closing_status not null default 'submitted',
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  reopened_by uuid references public.profiles(id) on delete set null,
  reopened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (closing_date, collector_id, hub_id)
);

create table if not exists public.daily_closing_history (
  id uuid primary key default gen_random_uuid(),
  daily_closing_id uuid not null references public.daily_closings(id) on delete cascade,
  action text not null check (action in ('submitted','approved','rejected','reopened','resubmitted')),
  from_status public.daily_closing_status,
  to_status public.daily_closing_status not null,
  reason text,
  snapshot jsonb not null,
  performed_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists daily_closings_date_hub_idx on public.daily_closings(closing_date desc, hub_id);
create index if not exists daily_closings_collector_idx on public.daily_closings(collector_id, closing_date desc);
create index if not exists daily_closings_status_idx on public.daily_closings(status);
create index if not exists daily_closing_history_parent_idx on public.daily_closing_history(daily_closing_id, created_at desc);

alter table public.daily_closings enable row level security;
alter table public.daily_closing_history enable row level security;

create or replace function public.daily_closing_is_manager(p_hub_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.user_role() = 'super_admin' or
    (public.user_role() in ('hub_admin','supervisor') and public.user_can_access_hub(p_hub_id));
$$;

create or replace function public.daily_closing_can_submit(p_collector_id uuid, p_hub_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select public.daily_closing_is_manager(p_hub_id) or exists (
    select 1 from public.collectors c where c.id = p_collector_id
      and c.hub_id = p_hub_id and c.profile_id = auth.uid()
  );
$$;

revoke all on function public.daily_closing_is_manager(uuid) from public, anon;
revoke all on function public.daily_closing_can_submit(uuid, uuid) from public, anon;
grant execute on function public.daily_closing_is_manager(uuid) to authenticated;
grant execute on function public.daily_closing_can_submit(uuid, uuid) to authenticated;

drop policy if exists daily_closings_select on public.daily_closings;
create policy daily_closings_select on public.daily_closings for select to authenticated using (
  public.daily_closing_is_manager(hub_id) or submitted_by = auth.uid()
);
drop policy if exists daily_closings_insert on public.daily_closings;
create policy daily_closings_insert on public.daily_closings for insert to authenticated with check (
  submitted_by = auth.uid() and status = 'submitted'
  and public.daily_closing_can_submit(collector_id, hub_id)
);
drop policy if exists daily_closings_update on public.daily_closings;
create policy daily_closings_update on public.daily_closings for update to authenticated
  using (submitted_by = auth.uid() and status in ('rejected','reopened'))
  with check (submitted_by = auth.uid() and status = 'submitted' and public.daily_closing_can_submit(collector_id, hub_id));

drop policy if exists daily_closing_history_select on public.daily_closing_history;
create policy daily_closing_history_select on public.daily_closing_history for select to authenticated using (
  exists (select 1 from public.daily_closings dc where dc.id = daily_closing_id
    and (public.daily_closing_is_manager(dc.hub_id) or dc.submitted_by = auth.uid()))
);

create or replace function public.daily_closing_guard()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.status = 'approved' and new.status <> 'reopened' then
    raise exception 'Approved daily closings are locked';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists daily_closing_guard_trigger on public.daily_closings;
create trigger daily_closing_guard_trigger before update on public.daily_closings
for each row execute function public.daily_closing_guard();

create or replace function public.daily_closing_insert_audit()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.daily_closing_history(daily_closing_id,action,from_status,to_status,reason,snapshot,performed_by)
    values(new.id,'submitted',null,'submitted',null,to_jsonb(new),auth.uid());
  return new;
end;
$$;
drop trigger if exists daily_closing_insert_audit_trigger on public.daily_closings;
create trigger daily_closing_insert_audit_trigger after insert on public.daily_closings
for each row execute function public.daily_closing_insert_audit();

create or replace function public.submit_daily_closing(
  p_closing_id uuid,
  p_closing_date date,
  p_collector_id uuid,
  p_hub_id uuid,
  p_denominations jsonb,
  p_notes text default null
) returns public.daily_closings
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_expected_cash numeric;
  v_online numeric;
  v_cms_cash numeric;
  v_cms_online numeric;
  v_actual numeric;
  v_existing public.daily_closings%rowtype;
  v_result public.daily_closings%rowtype;
  v_action text := 'submitted';
begin
  if auth.uid() is null or not public.daily_closing_can_submit(p_collector_id, p_hub_id) then
    raise exception 'Not authorized to submit this daily closing';
  end if;
  if not exists (select 1 from public.collectors where id = p_collector_id and hub_id = p_hub_id) then
    raise exception 'Collector does not belong to the selected hub';
  end if;
  select coalesce(sum(greatest(expected_cod-online_amount,0)),0), coalesce(sum(online_amount),0)
    into v_expected_cash, v_online from public.collection_entries
    where collection_date = p_closing_date and collector_id = p_collector_id and hub_id = p_hub_id;
  select coalesce(sum(coalesce(cash_submitted,cash_deposited,0)),0),
    coalesce(sum(coalesce(online_submitted,online_amount,0)),0)
    into v_cms_cash, v_cms_online from public.cms_deposits
    where coalesce(collection_date,deposit_date)=p_closing_date and collector_id=p_collector_id and hub_id=p_hub_id;
  v_actual := coalesce((p_denominations->>'note_500')::int,0)*500 + coalesce((p_denominations->>'note_200')::int,0)*200
    + coalesce((p_denominations->>'note_100')::int,0)*100 + coalesce((p_denominations->>'note_50')::int,0)*50
    + coalesce((p_denominations->>'note_20')::int,0)*20 + coalesce((p_denominations->>'note_10')::int,0)*10
    + coalesce((p_denominations->>'note_5')::int,0)*5 + coalesce((p_denominations->>'note_2')::int,0)*2
    + coalesce((p_denominations->>'note_1')::int,0);

  if p_closing_id is not null then
    select * into v_existing from public.daily_closings where id = p_closing_id for update;
    if not found or v_existing.status not in ('rejected','reopened') then raise exception 'Closing cannot be resubmitted'; end if;
    if v_existing.submitted_by <> auth.uid() and not public.daily_closing_is_manager(v_existing.hub_id) then raise exception 'Not authorized'; end if;
    v_action := 'resubmitted';
    update public.daily_closings set expected_cash=v_expected_cash, actual_cash=v_actual, online_amount=v_online,
      denomination_total=v_actual, shortage_excess=v_actual-v_expected_cash,
      note_500=coalesce((p_denominations->>'note_500')::int,0), note_200=coalesce((p_denominations->>'note_200')::int,0),
      note_100=coalesce((p_denominations->>'note_100')::int,0), note_50=coalesce((p_denominations->>'note_50')::int,0),
      note_20=coalesce((p_denominations->>'note_20')::int,0), note_10=coalesce((p_denominations->>'note_10')::int,0),
      note_5=coalesce((p_denominations->>'note_5')::int,0), note_2=coalesce((p_denominations->>'note_2')::int,0),
      note_1=coalesce((p_denominations->>'note_1')::int,0), denomination_verified=true,
      source_snapshot=jsonb_build_object('expected_cash',v_expected_cash,'online_amount',v_online,'cms_cash_submitted',v_cms_cash,'cms_online_submitted',v_cms_online,'captured_at',now()),
      notes=nullif(p_notes,''), rejection_reason=null, status='submitted', submitted_at=now(), reviewed_by=null, reviewed_at=null
      where id=p_closing_id returning * into v_result;
  else
    insert into public.daily_closings(id,closing_date,collector_id,hub_id,expected_cash,actual_cash,online_amount,
      denomination_total,shortage_excess,note_500,note_200,note_100,note_50,note_20,note_10,note_5,note_2,note_1,
      denomination_verified,source_snapshot,notes,status,submitted_by)
    values(coalesce(p_closing_id,gen_random_uuid()),p_closing_date,p_collector_id,p_hub_id,v_expected_cash,v_actual,v_online,
      v_actual,v_actual-v_expected_cash,coalesce((p_denominations->>'note_500')::int,0),coalesce((p_denominations->>'note_200')::int,0),
      coalesce((p_denominations->>'note_100')::int,0),coalesce((p_denominations->>'note_50')::int,0),
      coalesce((p_denominations->>'note_20')::int,0),coalesce((p_denominations->>'note_10')::int,0),
      coalesce((p_denominations->>'note_5')::int,0),coalesce((p_denominations->>'note_2')::int,0),
      coalesce((p_denominations->>'note_1')::int,0),true,
      jsonb_build_object('expected_cash',v_expected_cash,'online_amount',v_online,'cms_cash_submitted',v_cms_cash,'cms_online_submitted',v_cms_online,'captured_at',now()),nullif(p_notes,''),'submitted',auth.uid())
    returning * into v_result;
  end if;
  if v_action = 'resubmitted' then
    insert into public.daily_closing_history(daily_closing_id,action,from_status,to_status,reason,snapshot,performed_by)
      values(v_result.id,v_action,v_existing.status,'submitted',null,to_jsonb(v_result),auth.uid());
  end if;
  return v_result;
end;
$$;

create or replace function public.review_daily_closing(p_closing_id uuid, p_decision text, p_reason text default null)
returns public.daily_closings language plpgsql security definer set search_path = public, pg_temp as $$
declare v_old public.daily_closings%rowtype; v_result public.daily_closings%rowtype; v_status public.daily_closing_status;
begin
  select * into v_old from public.daily_closings where id=p_closing_id for update;
  if not found or v_old.status <> 'submitted' then raise exception 'Only submitted closings can be reviewed'; end if;
  if public.user_role() not in ('super_admin','hub_admin','supervisor') or not public.user_can_access_hub(v_old.hub_id) then raise exception 'Not authorized'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'Decision must be approved or rejected'; end if;
  if p_decision='rejected' and nullif(trim(p_reason),'') is null then raise exception 'Rejection reason is required'; end if;
  v_status := p_decision::public.daily_closing_status;
  update public.daily_closings set status=v_status,rejection_reason=case when v_status='rejected' then trim(p_reason) end,
    reviewed_by=auth.uid(),reviewed_at=now() where id=p_closing_id returning * into v_result;
  insert into public.daily_closing_history(daily_closing_id,action,from_status,to_status,reason,snapshot,performed_by)
    values(v_result.id,p_decision,v_old.status,v_status,nullif(trim(p_reason),''),to_jsonb(v_result),auth.uid());
  return v_result;
end; $$;

create or replace function public.reopen_daily_closing(p_closing_id uuid, p_reason text)
returns public.daily_closings language plpgsql security definer set search_path = public, pg_temp as $$
declare v_old public.daily_closings%rowtype; v_result public.daily_closings%rowtype;
begin
  if public.user_role() <> 'super_admin' then raise exception 'Only a Super Admin can reopen an approved closing'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'Reopening reason is required'; end if;
  select * into v_old from public.daily_closings where id=p_closing_id for update;
  if not found or v_old.status <> 'approved' then raise exception 'Only approved closings can be reopened'; end if;
  update public.daily_closings set status='reopened',reopened_by=auth.uid(),reopened_at=now(),notes=concat_ws(' | ',notes,'Reopened: '||trim(p_reason))
    where id=p_closing_id returning * into v_result;
  insert into public.daily_closing_history(daily_closing_id,action,from_status,to_status,reason,snapshot,performed_by)
    values(v_result.id,'reopened',v_old.status,'reopened',trim(p_reason),to_jsonb(v_result),auth.uid());
  return v_result;
end; $$;

revoke all on function public.submit_daily_closing(uuid,date,uuid,uuid,jsonb,text) from public, anon;
revoke all on function public.review_daily_closing(uuid,text,text) from public, anon;
revoke all on function public.reopen_daily_closing(uuid,text) from public, anon;
grant execute on function public.submit_daily_closing(uuid,date,uuid,uuid,jsonb,text) to authenticated;
grant execute on function public.review_daily_closing(uuid,text,text) to authenticated;
grant execute on function public.reopen_daily_closing(uuid,text) to authenticated;
