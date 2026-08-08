import { supabase } from '@/lib/supabase';
import { normalizeNDRReason } from '@/lib/ndr/ndrReasonNormalizer';
import { DRSReportRow } from '@/types/drs';

export type DRSShipmentOutcome = 'undelivered' | 'delivered' | 'rto' | 'cancelled' | 'unknown';

export interface NDRAutoSyncResult {
  undelSentToNdr: number;
  newNdrCreated: number;
  existingNdrUpdated: number;
  duplicatesSkipped: number;
  resolvedDelivered: number;
  resolvedTerminal: number;
  reasonCounts: Record<string, number>;
  errorMessage?: string;
}

const cleanStatus = (value: unknown) => String(value ?? '').trim().toUpperCase().replace(/[\s_-]+/g, ' ');

/** Determine the shipment result from shipment status first, with POD and DRS status as corroborating signals. */
export function classifyDRSShipment(row: DRSReportRow): DRSShipmentOutcome {
  const shipment = cleanStatus(row.shipment_status_raw);
  const drs = cleanStatus(row.drs_status);
  const reason = cleanStatus(row.reason);
  const hasPod = Boolean(String(row.pod_date || '').trim());

  if (row.shipment_status_normalized === 'RTO' || /\bRTO\b|RETURN TO ORIGIN|RETURNED/.test(shipment)) return 'rto';
  if (row.shipment_status_normalized === 'Cancelled' || /CANCEL|LOST|DAMAGED/.test(shipment)) return 'cancelled';
  if (row.shipment_status_normalized === 'Delivered' || /^(DEL|DELIVERED|COMPLETED DELIVERY)$/.test(shipment)) return 'delivered';
  if (hasPod && (drs === 'COMPLETED' || drs === 'CLOSED') && !/UNDEL|FAILED|ATTEMPT|NDR|NOT DELIVERED/.test(shipment)) return 'delivered';

  if (
    row.shipment_status_normalized === 'Undelivered' ||
    /UNDEL|FAILED|DELIVERY FAILED|ATTEMPT|NDR|NOT DELIVERED/.test(shipment) ||
    ((drs === 'CLOSED' || drs === 'COMPLETED') && !hasPod && /REFUS|UNREACH|ADDRESS|OTP|FAILED|NOT DELIVERED|NO RESPONSE/.test(reason))
  ) return 'undelivered';

  return 'unknown';
}

const isActiveCase = (item: any) =>
  !['Closed', 'Delivered', 'RTO'].includes(item.ndr_workflow_status) &&
  !['DEL', 'RTO', 'CANCELLED'].includes(cleanStatus(item.shipment_status_current));

export async function syncDRSUndelToNDR(
  uniqueRows: DRSReportRow[],
  hubId?: string | null,
  profile?: any,
  fileMeta?: { fileName: string; reportDate: string }
): Promise<NDRAutoSyncResult> {
  const targetHubId = hubId || profile?.hub_id || null;
  if (!targetHubId) throw new Error('Please select a hub before importing a DRS report.');

  const result: NDRAutoSyncResult = {
    undelSentToNdr: 0,
    newNdrCreated: 0,
    existingNdrUpdated: 0,
    duplicatesSkipped: 0,
    resolvedDelivered: 0,
    resolvedTerminal: 0,
    reasonCounts: {},
  };

  const relevantRows = uniqueRows.filter((row) => classifyDRSShipment(row) !== 'unknown');
  const { data: existingData, error: fetchError } = await supabase
    .from('ndr_shipments')
    .select('*')
    .eq('hub_id', targetHubId)
    .is('deleted_at', null);
  if (fetchError) throw new Error(`Failed to query existing NDR shipments: ${fetchError.message}`);

  const byAwb = new Map<string, any[]>();
  for (const item of existingData || []) {
    const key = cleanStatus(item.awb_number);
    if (key) byAwb.set(key, [...(byAwb.get(key) || []), item]);
  }

  const now = new Date().toISOString();
  const inserts: any[] = [];
  const updates: Array<{ id: string; payload: Record<string, unknown> }> = [];
  const timeline: any[] = [];

  for (const row of relevantRows) {
    const awb = row.waybill_no.trim();
    const key = cleanStatus(awb);
    const outcome = classifyDRSShipment(row);
    const cases = byAwb.get(key) || [];
    const active = cases.find(isActiveCase);

    if (outcome !== 'undelivered') {
      if (!active) continue;
      const delivered = outcome === 'delivered';
      updates.push({ id: active.id, payload: {
        shipment_status_current: delivered ? 'DEL' : outcome === 'rto' ? 'RTO' : 'CANCELLED',
        ndr_workflow_status: 'Closed',
        final_action: delivered ? 'Delivered' : outcome === 'rto' ? 'RTO' : 'Cancelled',
        delivered_after_ndr: delivered,
        delivered_date: delivered ? (row.pod_date || now) : active.delivered_date,
        rto_date: outcome === 'rto' ? (row.last_attempt_date || now) : active.rto_date,
        drs_code: row.drs_code || active.drs_code,
        drs_date: row.drs_date || fileMeta?.reportDate || active.drs_date,
        last_attempt_date: row.last_attempt_date || active.last_attempt_date,
        total_attempts: Math.max(active.total_attempts || 1, row.total_attempts || 1),
        updated_at: now,
      }});
      timeline.push({
        shipment_id: active.id, event_type: delivered ? 'delivered' : 'closure',
        action_title: delivered ? 'Resolved by DRS delivery update' : `Resolved by DRS ${outcome.toUpperCase()} update`,
        user_id: profile?.id || null, user_name: profile?.name || 'System Auto-Sync', user_role: profile?.role || 'system',
        previous_status: active.ndr_workflow_status, new_status: 'Closed',
        remarks: `Status updated from ${fileMeta?.fileName || 'DRS report'}; history preserved.`,
      });
      if (delivered) result.resolvedDelivered++; else result.resolvedTerminal++;
      continue;
    }

    result.undelSentToNdr++;
    const reason = normalizeNDRReason(row.reason);
    result.reasonCounts[reason] = (result.reasonCounts[reason] || 0) + 1;

    if (active) {
      const attemptDate = row.last_attempt_date || row.first_attempt_date || row.drs_date || fileMeta?.reportDate || now;
      const unchanged =
        (active.total_attempts || 1) === (row.total_attempts || 1) &&
        String(active.last_attempt_date || '').slice(0, 10) === String(attemptDate).slice(0, 10) &&
        (active.original_ndr_reason || '') === (row.reason || '');
      if (unchanged) {
        result.duplicatesSkipped++;
        continue;
      }
      updates.push({ id: active.id, payload: {
        total_attempts: Math.max(active.total_attempts || 1, row.total_attempts || 1),
        last_attempt_date: attemptDate,
        otp_status: row.otp_details || active.otp_status,
        drs_code: row.drs_code || active.drs_code,
        drs_date: row.drs_date || fileMeta?.reportDate || active.drs_date,
        delivery_executive: row.employee_name || active.delivery_executive,
        consignee_name: row.consignee || active.consignee_name,
        consignee_phone: row.consignee_phone || active.consignee_phone,
        delivery_address: row.delivery_address || active.delivery_address,
        payment_type: row.payment_type?.toUpperCase().includes('COD') ? 'COD' : 'PREPAID',
        amount_payable: row.amount_payable ?? active.amount_payable,
        original_ndr_reason: row.reason || active.original_ndr_reason,
        normalized_ndr_reason: reason,
        updated_at: now,
      }});
      timeline.push({ shipment_id: active.id, event_type: 'import', action_title: 'DRS attempt updated',
        user_id: profile?.id || null, user_name: profile?.name || 'System Auto-Sync', user_role: profile?.role || 'system',
        previous_status: active.ndr_workflow_status, new_status: active.ndr_workflow_status,
        remarks: `Attempt ${row.total_attempts || 1}; ${row.reason || 'undelivered'}. Existing remarks and calls preserved.` });
      result.existingNdrUpdated++;
      continue;
    }

    const id = crypto.randomUUID();
    const lastCycle = cases.reduce((max, item) => Math.max(max, item.ndr_cycle || 1), 0);
    inserts.push({
      id, awb_number: awb, awb_normalized: key, drs_code: row.drs_code,
      client_name: row.customer_name || 'Direct Client', consignee_name: row.consignee || 'Customer',
      consignee_phone: row.consignee_phone || null, delivery_address: row.delivery_address || null,
      delivery_executive: row.employee_name || 'Unassigned', partner_name: row.partner_name || 'Logistics Partner',
      hub_location: row.location || 'Main Hub', city: row.city, state: row.state,
      payment_type: row.payment_type?.toUpperCase().includes('COD') ? 'COD' : 'PREPAID', amount_payable: row.amount_payable || 0,
      shipment_status_original: 'UNDEL', shipment_status_current: 'UNDEL', ndr_workflow_status: 'Calling Pending',
      original_ndr_reason: row.reason || 'Undelivered Attempt', normalized_ndr_reason: reason,
      otp_status: row.otp_details || null, drs_status: row.drs_status || null,
      drs_date: row.drs_date || fileMeta?.reportDate || now, first_attempt_date: row.first_attempt_date || now,
      last_attempt_date: row.last_attempt_date || row.first_attempt_date || now, total_attempts: row.total_attempts || 1,
      delivery_pincode: row.delivery_pincode, is_mobility: row.is_mobility, ndr_cycle: lastCycle + 1,
      hub_id: targetHubId, created_by: profile?.id || null, created_at: now, updated_at: now,
    });
    byAwb.set(key, [...cases, inserts[inserts.length - 1]]);
    timeline.push({ shipment_id: id, event_type: 'import', action_title: 'Imported from DRS',
      user_id: profile?.id || null, user_name: profile?.name || 'System Auto-Sync', user_role: profile?.role || 'system',
      previous_status: null, new_status: 'Calling Pending', remarks: `Auto-created from ${fileMeta?.fileName || 'DRS report'}.` });
    result.newNdrCreated++;
  }

  for (let index = 0; index < inserts.length; index += 200) {
    const { error } = await supabase.from('ndr_shipments').insert(inserts.slice(index, index + 200));
    if (error) throw new Error(`NDR auto-sync insert failed: ${error.message}`);
  }
  for (const update of updates) {
    const { error } = await supabase.from('ndr_shipments').update(update.payload).eq('id', update.id).eq('hub_id', targetHubId);
    if (error) throw new Error(`NDR auto-sync update failed: ${error.message}`);
  }
  for (let index = 0; index < timeline.length; index += 200) {
    const { error } = await supabase.from('ndr_timeline_logs').insert(timeline.slice(index, index + 200));
    if (error) throw new Error(`NDR timeline insert failed: ${error.message}`);
  }

  const { error: batchError } = await supabase.from('ndr_import_batches').insert({
    filename: fileMeta?.fileName || 'DRS_Auto_Sync.xlsx', uploaded_by: profile?.id || null,
    uploaded_by_name: profile?.name || 'Logistics Admin', total_rows: uniqueRows.length,
    valid_rows: relevantRows.length, duplicate_rows: result.duplicatesSkipped,
    ready_to_import: result.undelSentToNdr, status: 'completed', hub_id: targetHubId,
  });
  if (batchError) throw new Error(`NDR import audit failed: ${batchError.message}`);

  if (typeof window !== 'undefined') window.dispatchEvent(new Event('ndr-data-updated'));
  return result;
}
