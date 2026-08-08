-- Forward-only repair for tenant-safe, idempotent DRS -> NDR synchronization.

alter table public.ndr_shipments add column if not exists awb_normalized text;
alter table public.drs_report_history add column if not exists uploaded_by_user_id uuid references auth.users(id) on delete set null;

update public.ndr_shipments
set awb_number = btrim(awb_number), awb_normalized = upper(btrim(awb_number))
where awb_normalized is distinct from upper(btrim(awb_number));

create or replace function public.normalize_ndr_awb()
returns trigger language plpgsql set search_path = public as $$
begin
  new.awb_number := btrim(new.awb_number);
  new.awb_normalized := upper(new.awb_number);
  return new;
end;
$$;

drop trigger if exists trg_normalize_ndr_awb on public.ndr_shipments;
create trigger trg_normalize_ndr_awb before insert or update of awb_number
on public.ndr_shipments for each row execute function public.normalize_ndr_awb();

-- Preserve all child history while collapsing pre-existing duplicate active cases.
do $$
declare duplicate_row record;
begin
  for duplicate_row in
    with ranked as (
      select id,
             first_value(id) over (
               partition by hub_id, awb_normalized
               order by updated_at desc nulls last, created_at desc nulls last, id
             ) as keeper_id,
             row_number() over (
               partition by hub_id, awb_normalized
               order by updated_at desc nulls last, created_at desc nulls last, id
             ) as position
      from public.ndr_shipments
      where deleted_at is null
        and ndr_workflow_status not in ('Closed', 'Delivered', 'RTO')
    )
    select id, keeper_id from ranked where position > 1
  loop
    update public.ndr_call_logs set shipment_id = duplicate_row.keeper_id where shipment_id = duplicate_row.id;
    update public.ndr_supervisor_actions set shipment_id = duplicate_row.keeper_id where shipment_id = duplicate_row.id;
    update public.ndr_timeline_logs set shipment_id = duplicate_row.keeper_id where shipment_id = duplicate_row.id;
    update public.ndr_shipments
      set deleted_at = coalesce(deleted_at, now()), deleted_reason = 'Merged duplicate active NDR case'
      where id = duplicate_row.id;
  end loop;
end $$;

create unique index if not exists uq_ndr_active_hub_awb
  on public.ndr_shipments (hub_id, awb_normalized)
  where deleted_at is null and ndr_workflow_status not in ('Closed', 'Delivered', 'RTO');
create index if not exists idx_ndr_hub_awb_normalized on public.ndr_shipments(hub_id, awb_normalized);

-- One persisted snapshot per report identity. Re-imports update instead of duplicating.
with ranked as (
  select id, row_number() over (
    partition by hub_id, report_date, file_name order by created_at desc nulls last, id
  ) as position
  from public.drs_report_history where deleted_at is null
)
update public.drs_report_history h
set deleted_at = now(), deleted_reason = 'Superseded duplicate DRS import'
from ranked r where h.id = r.id and r.position > 1;

create unique index if not exists uq_drs_report_identity
  on public.drs_report_history(hub_id, report_date, file_name)
  where deleted_at is null;

-- Remove the public/anonymous policies introduced by the initial feature migrations.
drop policy if exists "anon_select_ndr_import_batches" on public.ndr_import_batches;
drop policy if exists "anon_insert_ndr_import_batches" on public.ndr_import_batches;
drop policy if exists "anon_update_ndr_import_batches" on public.ndr_import_batches;
drop policy if exists "anon_select_ndr_shipments" on public.ndr_shipments;
drop policy if exists "anon_insert_ndr_shipments" on public.ndr_shipments;
drop policy if exists "anon_update_ndr_shipments" on public.ndr_shipments;
drop policy if exists "anon_select_ndr_call_logs" on public.ndr_call_logs;
drop policy if exists "anon_insert_ndr_call_logs" on public.ndr_call_logs;
drop policy if exists "anon_select_ndr_supervisor_actions" on public.ndr_supervisor_actions;
drop policy if exists "anon_insert_ndr_supervisor_actions" on public.ndr_supervisor_actions;
drop policy if exists "anon_select_ndr_timeline_logs" on public.ndr_timeline_logs;
drop policy if exists "anon_insert_ndr_timeline_logs" on public.ndr_timeline_logs;
drop policy if exists "Allow public select on drs_report_history" on public.drs_report_history;
drop policy if exists "Allow public insert on drs_report_history" on public.drs_report_history;
drop policy if exists "Allow public update on drs_report_history" on public.drs_report_history;
drop policy if exists "Allow public delete on drs_report_history" on public.drs_report_history;

-- Replace broad authenticated policies with existing HubVault hub-access checks.
drop policy if exists "select_ndr_import_batches" on public.ndr_import_batches;
drop policy if exists "insert_ndr_import_batches" on public.ndr_import_batches;
drop policy if exists "update_ndr_import_batches" on public.ndr_import_batches;
drop policy if exists "delete_ndr_import_batches" on public.ndr_import_batches;
drop policy if exists "tenant_ndr_import_batches" on public.ndr_import_batches;
create policy "tenant_ndr_import_batches" on public.ndr_import_batches for all to authenticated
  using (public.user_role() = 'super_admin' or public.user_can_access_hub(hub_id))
  with check (public.user_role() = 'super_admin' or public.user_can_access_hub(hub_id));

drop policy if exists "select_ndr_shipments" on public.ndr_shipments;
drop policy if exists "insert_ndr_shipments" on public.ndr_shipments;
drop policy if exists "update_ndr_shipments" on public.ndr_shipments;
drop policy if exists "tenant_ndr_shipments" on public.ndr_shipments;
drop policy if exists "delete_ndr_shipments" on public.ndr_shipments;
drop policy if exists "update_ndr_shipments" on public.ndr_shipments;
create policy "tenant_ndr_shipments" on public.ndr_shipments for all to authenticated
  using (public.user_role() = 'super_admin' or public.user_can_access_hub(hub_id))
  with check (public.user_role() = 'super_admin' or public.user_can_access_hub(hub_id));

drop policy if exists "select_ndr_call_logs" on public.ndr_call_logs;
drop policy if exists "insert_ndr_call_logs" on public.ndr_call_logs;
drop policy if exists "update_ndr_call_logs" on public.ndr_call_logs;
drop policy if exists "tenant_ndr_call_logs" on public.ndr_call_logs;
create policy "tenant_ndr_call_logs" on public.ndr_call_logs for all to authenticated
  using (exists (select 1 from public.ndr_shipments s where s.id = shipment_id and (public.user_role() = 'super_admin' or public.user_can_access_hub(s.hub_id))))
  with check (exists (select 1 from public.ndr_shipments s where s.id = shipment_id and (public.user_role() = 'super_admin' or public.user_can_access_hub(s.hub_id))));

drop policy if exists "select_ndr_supervisor_actions" on public.ndr_supervisor_actions;
drop policy if exists "insert_ndr_supervisor_actions" on public.ndr_supervisor_actions;
drop policy if exists "update_ndr_supervisor_actions" on public.ndr_supervisor_actions;
drop policy if exists "tenant_ndr_supervisor_actions" on public.ndr_supervisor_actions;
create policy "tenant_ndr_supervisor_actions" on public.ndr_supervisor_actions for all to authenticated
  using (exists (select 1 from public.ndr_shipments s where s.id = shipment_id and (public.user_role() = 'super_admin' or public.user_can_access_hub(s.hub_id))))
  with check (exists (select 1 from public.ndr_shipments s where s.id = shipment_id and (public.user_role() = 'super_admin' or public.user_can_access_hub(s.hub_id))));

drop policy if exists "select_ndr_timeline_logs" on public.ndr_timeline_logs;
drop policy if exists "insert_ndr_timeline_logs" on public.ndr_timeline_logs;
drop policy if exists "tenant_ndr_timeline_logs" on public.ndr_timeline_logs;
create policy "tenant_ndr_timeline_logs" on public.ndr_timeline_logs for all to authenticated
  using (exists (select 1 from public.ndr_shipments s where s.id = shipment_id and (public.user_role() = 'super_admin' or public.user_can_access_hub(s.hub_id))))
  with check (exists (select 1 from public.ndr_shipments s where s.id = shipment_id and (public.user_role() = 'super_admin' or public.user_can_access_hub(s.hub_id))));

drop policy if exists "tenant_drs_report_history" on public.drs_report_history;
create policy "tenant_drs_report_history" on public.drs_report_history for all to authenticated
  using (public.user_role() = 'super_admin' or (hub_id ~* '^[0-9a-f-]{36}$' and public.user_can_access_hub(hub_id::uuid)))
  with check (public.user_role() = 'super_admin' or (hub_id ~* '^[0-9a-f-]{36}$' and public.user_can_access_hub(hub_id::uuid)));
