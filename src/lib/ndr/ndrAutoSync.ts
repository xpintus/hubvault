import { supabase } from '@/lib/supabase';
import { normalizeNDRReason } from '@/lib/ndr/ndrReasonNormalizer';
import { DRSReportRow } from '@/types/drs';

export interface NDRAutoSyncResult {
  undelSentToNdr: number;
  newNdrCreated: number;
  existingNdrUpdated: number;
  duplicatesSkipped: number;
  reasonCounts: Record<string, number>;
  errorMessage?: string;
}

export async function syncDRSUndelToNDR(
  uniqueRows: DRSReportRow[],
  hubId?: string | null,
  profile?: any,
  fileMeta?: { fileName: string; reportDate: string }
): Promise<NDRAutoSyncResult> {
  const targetHubId = hubId || profile?.hub_id || null;

  // Filter only eligible UNDEL rows (ignore DEL, RTO, CANCEL)
  const undelRows = uniqueRows.filter(
    (r) =>
      r.shipment_status_normalized === 'Undelivered' ||
      String(r.shipment_status_raw || '')
        .trim()
        .toUpperCase()
        .includes('UNDEL')
  );

  if (undelRows.length === 0) {
    return {
      undelSentToNdr: 0,
      newNdrCreated: 0,
      existingNdrUpdated: 0,
      duplicatesSkipped: 0,
      reasonCounts: {},
    };
  }

  let newNdrCreated = 0;
  let existingNdrUpdated = 0;
  let duplicatesSkipped = 0;
  const reasonCounts: Record<string, number> = {};

  try {
    // 1. Fetch existing NDR shipments for this hub
    let existingQuery = supabase.from('ndr_shipments').select('*');
    if (targetHubId) {
      existingQuery = existingQuery.eq('hub_id', targetHubId);
    }
    const { data: existingData, error: fetchErr } = await existingQuery;

    if (fetchErr) {
      console.warn('Supabase NDR fetch warning (continuing with sync):', fetchErr.message);
    }

    const existingMap = new Map<string, any[]>();
    (existingData || []).forEach((item: any) => {
      const awb = item.awb_number?.trim().toUpperCase();
      if (awb) {
        const list = existingMap.get(awb) || [];
        list.push(item);
        existingMap.set(awb, list);
      }
    });

    const newInserts: any[] = [];
    const updates: any[] = [];
    const timelineLogs: any[] = [];

    const nowIso = new Date().toISOString();

    undelRows.forEach((r) => {
      const awbKey = r.waybill_no.trim().toUpperCase();
      const normReason = normalizeNDRReason(r.reason);
      reasonCounts[normReason] = (reasonCounts[normReason] || 0) + 1;

      const existingList = existingMap.get(awbKey) || [];
      const activeCase = existingList.find(
        (c) => c.shipment_status_current === 'UNDEL' && c.ndr_workflow_status !== 'Closed' && c.ndr_workflow_status !== 'Delivered'
      );

      if (activeCase) {
        // Update existing active NDR case
        existingNdrUpdated++;
        updates.push({
          id: activeCase.id,
          total_attempts: Math.max(activeCase.total_attempts || 1, r.total_attempts || 1),
          last_attempt_date: r.last_attempt_date || r.first_attempt_date || nowIso,
          otp_status: r.otp_details || activeCase.otp_status,
          drs_code: r.drs_code || activeCase.drs_code,
          original_ndr_reason: r.reason || activeCase.original_ndr_reason,
          normalized_ndr_reason: normReason,
          updated_at: nowIso,
        });

        timelineLogs.push({
          shipment_id: activeCase.id,
          event_type: 'import',
          action_title: 'DRS Status Updated',
          user_name: profile?.name || 'System Auto-Sync',
          previous_status: activeCase.ndr_workflow_status,
          new_status: activeCase.ndr_workflow_status,
          remarks: `Updated DRS attempt to ${r.total_attempts || 1}. Reason: ${r.reason || 'N/A'}`,
        });
      } else {
        // Create new NDR case or next cycle
        const lastCycle = existingList.reduce((max, c) => Math.max(max, c.ndr_cycle || 1), 0);
        const nextCycle = lastCycle + 1;
        newNdrCreated++;

        const newId = crypto.randomUUID ? crypto.randomUUID() : `ndr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        newInserts.push({
          id: newId,
          awb_number: r.waybill_no,
          drs_code: r.drs_code,
          client_name: r.customer_name || 'Direct Client',
          consignee_name: r.consignee || 'Customer',
          delivery_executive: r.employee_name || 'Unassigned',
          partner_name: r.partner_name || 'Logistics Partner',
          hub_location: r.location || 'Main Hub',
          city: r.city,
          state: r.state,
          payment_type: r.payment_type?.toUpperCase().includes('COD') ? 'COD' : 'PREPAID',
          amount_payable: r.amount_payable || 0,
          shipment_status_original: 'UNDEL',
          shipment_status_current: 'UNDEL',
          ndr_workflow_status: 'Calling Pending',
          original_ndr_reason: r.reason || 'Undelivered Attempt',
          normalized_ndr_reason: normReason,
          otp_status: r.otp_details || null,
          drs_status: r.drs_status || 'CLOSED',
          drs_date: r.drs_date || fileMeta?.reportDate || nowIso,
          first_attempt_date: r.first_attempt_date || nowIso,
          last_attempt_date: r.last_attempt_date || nowIso,
          total_attempts: r.total_attempts || 1,
          delivery_pincode: r.delivery_pincode,
          is_mobility: r.is_mobility,
          ndr_cycle: nextCycle,
          hub_id: targetHubId,
          created_at: nowIso,
          updated_at: nowIso,
        });

        timelineLogs.push({
          shipment_id: newId,
          event_type: 'import',
          action_title: 'Imported from DRS',
          user_name: profile?.name || 'System Auto-Sync',
          previous_status: null,
          new_status: 'Calling Pending',
          remarks: `Auto-created NDR case from DRS (${fileMeta?.fileName || 'DRS Report'}). Original Reason: ${r.reason || 'N/A'}`,
        });
      }
    });

    // 2. Perform chunked inserts & updates into Supabase
    if (newInserts.length > 0) {
      const CHUNK_SIZE = 250;
      for (let i = 0; i < newInserts.length; i += CHUNK_SIZE) {
        const chunk = newInserts.slice(i, i + CHUNK_SIZE);
        const { error: insErr } = await supabase.from('ndr_shipments').insert(chunk);
        if (insErr) {
          console.warn('Supabase NDR chunk insert warning:', insErr.message);
        }
      }
    }

    if (updates.length > 0) {
      for (const u of updates) {
        const { error: updErr } = await supabase
          .from('ndr_shipments')
          .update({
            total_attempts: u.total_attempts,
            last_attempt_date: u.last_attempt_date,
            otp_status: u.otp_status,
            drs_code: u.drs_code,
            original_ndr_reason: u.original_ndr_reason,
            normalized_ndr_reason: u.normalized_ndr_reason,
            updated_at: u.updated_at,
          })
          .eq('id', u.id);

        if (updErr) {
          console.warn('Supabase NDR update warning:', updErr.message);
        }
      }
    }

    if (timelineLogs.length > 0) {
      const CHUNK_SIZE = 250;
      for (let i = 0; i < timelineLogs.length; i += CHUNK_SIZE) {
        const chunk = timelineLogs.slice(i, i + CHUNK_SIZE);
        await supabase.from('ndr_timeline_logs').insert(chunk);
      }
    }

    // 3. Record import batch metadata
    await supabase.from('ndr_import_batches').insert({
      filename: fileMeta?.fileName || 'DRS_Auto_Sync.xlsx',
      uploaded_by_name: profile?.name || 'Logistics Admin',
      total_rows: uniqueRows.length,
      valid_rows: undelRows.length,
      ready_to_import: undelRows.length,
      status: 'completed',
      hub_id: targetHubId,
    });
  } catch (err: any) {
    console.error('Failed to auto-sync UNDEL shipments to NDR:', err);
    return {
      undelSentToNdr: undelRows.length,
      newNdrCreated,
      existingNdrUpdated,
      duplicatesSkipped,
      reasonCounts,
      errorMessage: err.message || 'Auto-sync completed with partial local storage resilience',
    };
  }

  return {
    undelSentToNdr: undelRows.length,
    newNdrCreated,
    existingNdrUpdated,
    duplicatesSkipped,
    reasonCounts,
  };
}
