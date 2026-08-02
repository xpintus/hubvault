/* Irreversible, transactional hub deletion available only to super_admin. */

-- The original BEFORE DELETE guard returned NEW. NEW is NULL during DELETE,
-- which silently cancelled even an otherwise permitted delete. Keep finalized
-- records locked, but return OLD for a legitimate non-finalized deletion.
create or replace function public.guard_finalized_daily_closing()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if exists(
    select 1 from public.daily_closing_finalizations
    where closing_date=old.closing_date and hub_id=old.hub_id
  ) then
    raise exception 'Finalized Daily Closing records are locked';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.permanently_delete_hub(p_hub_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hub_name text;
  v_collection_count bigint;
  v_closing_count bigint;
  v_audit_count bigint;
begin
  if auth.uid() is null or public.user_role() <> 'super_admin' then
    raise exception 'Only Super Admin can permanently delete a hub';
  end if;

  select name into v_hub_name
  from public.hubs
  where id = p_hub_id
  for update;

  if v_hub_name is null then
    raise exception 'Hub not found';
  end if;

  select count(*) into v_collection_count from public.collection_entries where hub_id = p_hub_id;
  select count(*) into v_closing_count from public.daily_closings where hub_id = p_hub_id;
  select count(*) into v_audit_count from public.audit_logs where target_hub_id = p_hub_id;

  -- These two tables deliberately RESTRICT normal hub deletion.
  delete from public.daily_closing_finalizations where hub_id = p_hub_id;
  delete from public.daily_closings where hub_id = p_hub_id;

  -- Remove audit history explicitly; its FK otherwise keeps rows with NULL hub.
  delete from public.audit_logs where target_hub_id = p_hub_id;

  -- Remaining hub-owned operational tables use ON DELETE CASCADE. Profile
  -- primary hub references use SET NULL, so login accounts themselves remain.
  delete from public.hubs where id = p_hub_id;

  -- Keep one global accountability event without linking it to the deleted hub.
  insert into public.audit_logs(action, performed_by, target_hub_id, details)
  values (
    'hub_permanently_deleted', auth.uid(), null,
    format('Permanently deleted hub %s (%s): %s collections, %s closings and %s hub audit records removed',
      v_hub_name, p_hub_id, v_collection_count, v_closing_count, v_audit_count)
  );

  return jsonb_build_object(
    'hub_id', p_hub_id,
    'hub_name', v_hub_name,
    'collections_deleted', v_collection_count,
    'closings_deleted', v_closing_count,
    'audit_records_deleted', v_audit_count
  );
end;
$$;

revoke all on function public.permanently_delete_hub(uuid) from public, anon;
grant execute on function public.permanently_delete_hub(uuid) to authenticated;
