/* Immutable hub/date final close with verifier identity and report snapshot. */

create table if not exists public.daily_closing_finalizations (
  id uuid primary key default gen_random_uuid(),
  closing_date date not null,
  hub_id uuid not null references public.hubs(id) on delete restrict,
  finalized_by uuid not null references public.profiles(id) on delete restrict,
  finalized_at timestamptz not null default now(),
  closing_count integer not null check (closing_count > 0),
  report_snapshot jsonb not null,
  unique(closing_date,hub_id)
);

alter table public.daily_closing_finalizations enable row level security;

drop policy if exists daily_closing_finalizations_select on public.daily_closing_finalizations;
create policy daily_closing_finalizations_select
on public.daily_closing_finalizations for select to authenticated
using (public.user_role()='super_admin' or public.user_can_access_hub(hub_id));

create or replace function public.finalize_daily_closing_day(
  p_closing_date date,
  p_hub_id uuid
) returns public.daily_closing_finalizations
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_required integer;
  v_approved integer;
  v_snapshot jsonb;
  v_result public.daily_closing_finalizations%rowtype;
begin
  if auth.uid() is null or not public.daily_closing_is_manager(p_hub_id) then
    raise exception 'Only a supervisor or hub administrator can finalize Daily Closing';
  end if;
  if exists(select 1 from public.daily_closing_finalizations where closing_date=p_closing_date and hub_id=p_hub_id) then
    raise exception 'Daily Closing is already finalized for this hub and date';
  end if;

  select count(distinct collector_id) into v_required
  from public.collection_entries
  where collection_date=p_closing_date and hub_id=p_hub_id;
  if v_required=0 then
    raise exception 'No collection entries exist for this hub and date';
  end if;

  select count(distinct dc.collector_id) into v_approved
  from public.daily_closings dc
  where dc.closing_date=p_closing_date and dc.hub_id=p_hub_id and dc.status='approved'
    and exists(
      select 1 from public.collection_entries ce
      where ce.collection_date=p_closing_date and ce.hub_id=p_hub_id and ce.collector_id=dc.collector_id
    );
  if v_approved<>v_required then
    raise exception 'All employee Daily Closings must be approved before final submission (% of % approved)',v_approved,v_required;
  end if;

  select jsonb_build_object(
    'closing_date',p_closing_date,'hub_id',p_hub_id,'verified_by',auth.uid(),
    'verified_at',now(),'closings',jsonb_agg(to_jsonb(dc) order by dc.collector_id)
  ) into v_snapshot
  from public.daily_closings dc
  where dc.closing_date=p_closing_date and dc.hub_id=p_hub_id and dc.status='approved';

  insert into public.daily_closing_finalizations(
    closing_date,hub_id,finalized_by,closing_count,report_snapshot
  ) values(p_closing_date,p_hub_id,auth.uid(),v_approved,v_snapshot)
  returning * into v_result;
  return v_result;
end;
$$;

revoke all on function public.finalize_daily_closing_day(date,uuid) from public,anon;
grant execute on function public.finalize_daily_closing_day(date,uuid) to authenticated;

create or replace function public.guard_finalized_daily_closing()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if exists(
    select 1 from public.daily_closing_finalizations
    where closing_date=old.closing_date and hub_id=old.hub_id
  ) then
    raise exception 'Finalized Daily Closing records are locked';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_finalized_daily_closing_trigger on public.daily_closings;
create trigger guard_finalized_daily_closing_trigger
before update or delete on public.daily_closings
for each row execute function public.guard_finalized_daily_closing();
