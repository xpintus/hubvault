create or replace function public.reopen_daily_closing(p_closing_id uuid, p_reason text)
returns public.daily_closings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old public.daily_closings%rowtype;
  v_result public.daily_closings%rowtype;
begin
  if nullif(trim(p_reason), '') is null then
    raise exception 'Reopening reason is required';
  end if;

  select * into v_old
  from public.daily_closings
  where id = p_closing_id
  for update;

  if not found or v_old.status <> 'approved' then
    raise exception 'Only approved closings can be reopened';
  end if;

  if public.user_role() not in ('super_admin', 'hub_admin', 'supervisor')
     or (public.user_role() <> 'super_admin' and not public.user_can_access_hub(v_old.hub_id)) then
    raise exception 'Not authorized to reopen this closing';
  end if;

  update public.daily_closings
  set status = 'reopened',
      reopened_by = auth.uid(),
      reopened_at = now(),
      notes = concat_ws(' | ', notes, 'Reopened: ' || trim(p_reason))
  where id = p_closing_id
  returning * into v_result;

  insert into public.daily_closing_history(
    daily_closing_id, action, from_status, to_status, reason, snapshot, performed_by
  ) values (
    v_result.id, 'reopened', v_old.status, 'reopened', trim(p_reason), to_jsonb(v_result), auth.uid()
  );

  return v_result;
end;
$$;

revoke all on function public.reopen_daily_closing(uuid, text) from public, anon;
grant execute on function public.reopen_daily_closing(uuid, text) to authenticated;
