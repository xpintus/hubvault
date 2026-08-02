/* Guest/trial KhataBook rows are private and have no hub assignment. */

drop policy if exists "parties_select" on public.parties;
create policy "parties_select" on public.parties for select to authenticated using (
  public.user_role()='super_admin' or (hub_id is not null and public.user_can_access_hub(hub_id))
  or (public.user_role() in ('guest','trial_user') and hub_id is null and created_by=auth.uid())
);
drop policy if exists "parties_insert" on public.parties;
create policy "parties_insert" on public.parties for insert to authenticated with check (
  public.user_role()='super_admin' or (hub_id is not null and public.user_can_access_hub(hub_id))
  or (public.user_role() in ('guest','trial_user') and hub_id is null and created_by=auth.uid())
);
drop policy if exists "parties_update" on public.parties;
create policy "parties_update" on public.parties for update to authenticated
using (public.user_role()='super_admin' or (hub_id is not null and public.user_can_access_hub(hub_id)) or (public.user_role() in ('guest','trial_user') and hub_id is null and created_by=auth.uid()))
with check (public.user_role()='super_admin' or (hub_id is not null and public.user_can_access_hub(hub_id)) or (public.user_role() in ('guest','trial_user') and hub_id is null and created_by=auth.uid()));
drop policy if exists "parties_delete" on public.parties;
create policy "parties_delete" on public.parties for delete to authenticated using (
  public.user_role()='super_admin' or (hub_id is not null and public.user_can_access_hub(hub_id))
  or (public.user_role() in ('guest','trial_user') and hub_id is null and created_by=auth.uid())
);

drop policy if exists "party_tx_select" on public.party_transactions;
create policy "party_tx_select" on public.party_transactions for select to authenticated using (
  public.user_role()='super_admin' or (hub_id is not null and public.user_can_access_hub(hub_id))
  or (public.user_role() in ('guest','trial_user') and hub_id is null and created_by=auth.uid())
);
drop policy if exists "party_tx_insert" on public.party_transactions;
create policy "party_tx_insert" on public.party_transactions for insert to authenticated with check (
  public.user_role()='super_admin' or (hub_id is not null and public.user_can_access_hub(hub_id))
  or (public.user_role() in ('guest','trial_user') and hub_id is null and created_by=auth.uid())
);
drop policy if exists "party_tx_update" on public.party_transactions;
create policy "party_tx_update" on public.party_transactions for update to authenticated
using (public.user_role()='super_admin' or (hub_id is not null and public.user_can_access_hub(hub_id)) or (public.user_role() in ('guest','trial_user') and hub_id is null and created_by=auth.uid()))
with check (public.user_role()='super_admin' or (hub_id is not null and public.user_can_access_hub(hub_id)) or (public.user_role() in ('guest','trial_user') and hub_id is null and created_by=auth.uid()));
drop policy if exists "party_tx_delete" on public.party_transactions;
create policy "party_tx_delete" on public.party_transactions for delete to authenticated using (
  public.user_role()='super_admin' or (hub_id is not null and public.user_can_access_hub(hub_id))
  or (public.user_role() in ('guest','trial_user') and hub_id is null and created_by=auth.uid())
);

drop policy if exists "party_adj_select" on public.party_adjustments;
create policy "party_adj_select" on public.party_adjustments for select to authenticated using (
  exists(select 1 from public.parties p where p.id=party_adjustments.party_id and (
    public.user_role()='super_admin' or (p.hub_id is not null and public.user_can_access_hub(p.hub_id))
    or (public.user_role() in ('guest','trial_user') and p.hub_id is null and p.created_by=auth.uid())
  ))
);
drop policy if exists "party_adj_insert" on public.party_adjustments;
create policy "party_adj_insert" on public.party_adjustments for insert to authenticated with check (
  exists(select 1 from public.parties p where p.id=party_adjustments.party_id and (
    public.user_role()='super_admin' or (p.hub_id is not null and public.user_can_access_hub(p.hub_id))
    or (public.user_role() in ('guest','trial_user') and p.hub_id is null and p.created_by=auth.uid())
  ))
);
drop policy if exists "party_adj_delete" on public.party_adjustments;
create policy "party_adj_delete" on public.party_adjustments for delete to authenticated using (
  exists(select 1 from public.parties p where p.id=party_adjustments.party_id and (
    public.user_role()='super_admin' or (p.hub_id is not null and public.user_can_access_hub(p.hub_id))
    or (public.user_role() in ('guest','trial_user') and p.hub_id is null and p.created_by=auth.uid())
  ))
);
