import { supabase } from '@/lib/supabase';
import { exportDRSPerformanceWorkbook } from './drsExcelExporter';
import { clearActiveReportId, fetchDRSHistoryFromDB } from './drsHistoryManager';
import { DRSReportHistoryItem } from '@/types/drs';

export interface ResetAuditLogItem {
  id: string;
  hub_id: string | null;
  user_id: string | null;
  user_name: string;
  report_id: string;
  report_file_name: string;
  report_date: string;
  delete_level: 'LEVEL 1' | 'LEVEL 2' | 'LEVEL 3';
  ndr_cases_deleted_count: number;
  snapshots_deleted_count: number;
  reason: string;
  created_at: string;
}

export interface SoftDeletedReportItem extends DRSReportHistoryItem {
  deleted_at: string;
  deleted_by_name: string;
  deleted_reason: string;
}

// ----------------------------------------------------
// LEVEL 1: RESET CURRENT REPORT
// ----------------------------------------------------
export async function resetCurrentDRSReport(
  reportItem: DRSReportHistoryItem,
  profile: any,
  hubId?: string | null,
  options?: { reason?: string; exportBeforeDelete?: boolean }
): Promise<{ success: boolean; ndrCasesDeleted: number }> {
  const targetHubId = hubId || profile?.hub_id || null;
  const nowIso = new Date().toISOString();
  const userName = profile?.name || 'Logistics Manager';
  const reasonText = options?.reason || 'User requested Level 1 Report Reset';

  // 1. Auto Backup / Export before delete if requested
  if (options?.exportBeforeDelete && reportItem.summary && reportItem.rows) {
    try {
      const backupKey = `hubvault_backup_${reportItem.id}_${Date.now()}`;
      localStorage.setItem(backupKey, JSON.stringify(reportItem));
    } catch (e) {
      console.warn('LocalStorage backup quota full, skipping local JSON backup');
    }
  }

  let ndrCasesDeleted = 0;

  try {
    // 2. Find linked NDR shipments by date or drs_code or filename
    const { data: linkedNdr } = await supabase
      .from('ndr_shipments')
      .select('id')
      .is('deleted_at', null)
      .or(`drs_code.eq.${reportItem.summary?.fileName || reportItem.fileName},drs_date.eq.${reportItem.reportDate}`);

    const linkedIds = (linkedNdr || []).map((n) => n.id);
    ndrCasesDeleted = linkedIds.length;

    if (linkedIds.length > 0) {
      // Soft-delete linked call logs and timeline logs
      await supabase.from('ndr_timeline_logs').update({ remarks: `Soft-deleted via Level 1 Report Reset: ${reportItem.fileName}` }).in('shipment_id', linkedIds);
      await supabase
        .from('ndr_shipments')
        .update({
          deleted_at: nowIso,
          deleted_by: profile?.id || null,
          deleted_by_name: userName,
          deleted_reason: reasonText,
        })
        .in('id', linkedIds);
    }

    // 3. Soft-delete target DRS report history entry
    await supabase
      .from('drs_report_history')
      .update({
        deleted_at: nowIso,
        deleted_by: profile?.id || null,
        deleted_by_name: userName,
        deleted_reason: reasonText,
      })
      .eq('id', reportItem.id);

    // 4. Clear active report state if this was active
    clearActiveReportId();

    // 5. Insert Reset Audit Log
    await supabase.from('drs_reset_audit_logs').insert({
      hub_id: targetHubId,
      user_id: profile?.id || null,
      user_name: userName,
      report_id: reportItem.id,
      report_file_name: reportItem.fileName,
      report_date: reportItem.reportDate,
      delete_level: 'LEVEL 1',
      ndr_cases_deleted_count: ndrCasesDeleted,
      snapshots_deleted_count: 1,
      reason: reasonText,
      created_at: nowIso,
    });
  } catch (err) {
    console.error('Error during Level 1 Reset:', err);
    // Fallback: clear local storage active state
    clearActiveReportId();
  }

  return { success: true, ndrCasesDeleted };
}

// ----------------------------------------------------
// LEVEL 2: DELETE SELECTED REPORTS
// ----------------------------------------------------
export async function deleteSelectedDRSReports(
  reportItems: DRSReportHistoryItem[],
  profile: any,
  hubId?: string | null,
  reason?: string
): Promise<{ success: boolean; reportsDeletedCount: number; ndrCasesDeletedCount: number }> {
  const targetHubId = hubId || profile?.hub_id || null;
  const nowIso = new Date().toISOString();
  const userName = profile?.name || 'Logistics Manager';
  const reasonText = reason || 'User requested Level 2 Multi-Report Delete';

  let ndrCasesDeletedCount = 0;
  const reportIds = reportItems.map((r) => r.id);

  try {
    for (const rItem of reportItems) {
      const { data: linkedNdr } = await supabase
        .from('ndr_shipments')
        .select('id')
        .is('deleted_at', null)
        .or(`drs_code.eq.${rItem.summary?.fileName || rItem.fileName},drs_date.eq.${rItem.reportDate}`);

      const linkedIds = (linkedNdr || []).map((n) => n.id);
      ndrCasesDeletedCount += linkedIds.length;

      if (linkedIds.length > 0) {
        await supabase
          .from('ndr_shipments')
          .update({
            deleted_at: nowIso,
            deleted_by: profile?.id || null,
            deleted_by_name: userName,
            deleted_reason: reasonText,
          })
          .in('id', linkedIds);
      }
    }

    // Soft-delete report history records
    await supabase
      .from('drs_report_history')
      .update({
        deleted_at: nowIso,
        deleted_by: profile?.id || null,
        deleted_by_name: userName,
        deleted_reason: reasonText,
      })
      .in('id', reportIds);

    clearActiveReportId();

    // Insert Audit Log
    await supabase.from('drs_reset_audit_logs').insert({
      hub_id: targetHubId,
      user_id: profile?.id || null,
      user_name: userName,
      report_id: reportIds.join(','),
      report_file_name: `${reportItems.length} Selected Reports`,
      report_date: nowIso.split('T')[0],
      delete_level: 'LEVEL 2',
      ndr_cases_deleted_count: ndrCasesDeletedCount,
      snapshots_deleted_count: reportItems.length,
      reason: reasonText,
      created_at: nowIso,
    });
  } catch (err) {
    console.error('Error during Level 2 Delete:', err);
    clearActiveReportId();
  }

  return { success: true, reportsDeletedCount: reportItems.length, ndrCasesDeletedCount };
}

// ----------------------------------------------------
// LEVEL 3: DELETE ALL REPORTS (ADMIN ONLY)
// ----------------------------------------------------
export async function deleteAllDRSReports(
  profile: any,
  hubId?: string | null,
  reason?: string
): Promise<{ success: boolean; totalReportsDeleted: number; totalNdrDeleted: number }> {
  const targetHubId = hubId || profile?.hub_id || null;
  const nowIso = new Date().toISOString();
  const userName = profile?.name || 'Logistics Admin';
  const reasonText = reason || 'Admin requested Level 3 Reset All Reports';

  let totalReportsDeleted = 0;
  let totalNdrDeleted = 0;

  try {
    // Soft delete all NDR shipments for this hub
    let ndrQuery = supabase.from('ndr_shipments').update({
      deleted_at: nowIso,
      deleted_by: profile?.id || null,
      deleted_by_name: userName,
      deleted_reason: reasonText,
    }).is('deleted_at', null);

    if (targetHubId) ndrQuery = ndrQuery.eq('hub_id', targetHubId);
    const { count: ndrCount } = await ndrQuery;
    totalNdrDeleted = ndrCount || 0;

    // Soft delete all DRS report history entries for this hub
    let historyQuery = supabase.from('drs_report_history').update({
      deleted_at: nowIso,
      deleted_by: profile?.id || null,
      deleted_by_name: userName,
      deleted_reason: reasonText,
    }).is('deleted_at', null);

    if (targetHubId) historyQuery = historyQuery.eq('hub_id', targetHubId);
    const { count: histCount } = await historyQuery;
    totalReportsDeleted = histCount || 0;

    clearActiveReportId();

    // Audit Log
    await supabase.from('drs_reset_audit_logs').insert({
      hub_id: targetHubId,
      user_id: profile?.id || null,
      user_name: userName,
      report_id: 'ALL_REPORTS',
      report_file_name: 'ALL_DRS_REPORTS',
      report_date: nowIso.split('T')[0],
      delete_level: 'LEVEL 3',
      ndr_cases_deleted_count: totalNdrDeleted,
      snapshots_deleted_count: totalReportsDeleted,
      reason: reasonText,
      created_at: nowIso,
    });
  } catch (err) {
    console.error('Error during Level 3 Reset All:', err);
    clearActiveReportId();
  }

  return { success: true, totalReportsDeleted, totalNdrDeleted };
}

// ----------------------------------------------------
// RECYCLE BIN OPERATIONS
// ----------------------------------------------------
export async function fetchRecycleBinReports(hubId?: string | null): Promise<SoftDeletedReportItem[]> {
  try {
    let query = supabase.from('drs_report_history').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
    if (hubId && hubId !== 'ALL') query = query.eq('hub_id', hubId);

    const { data, error } = await query;
    if (error) {
      console.warn('Recycle bin query warning:', error.message);
      return [];
    }

    return (data || []).map((item: any) => ({
      id: item.id,
      fileName: item.file_name,
      reportDate: item.report_date,
      uploadTimestamp: new Date(item.created_at).toLocaleString(),
      uploadedBy: item.uploaded_by_name || 'Staff',
      hubId: item.hub_id,
      hubName: item.hub_name || 'Main Hub',
      clientName: item.client_name || 'All Clients',
      totalOfd: item.total_ofd || 0,
      totalDelivered: item.total_delivered || 0,
      totalUndel: item.total_undel || 0,
      overallDeliveryPct: item.overall_delivery_pct || 0,
      rows: item.json_snapshot?.rows || [],
      summary: item.json_snapshot?.summary || null,
      deleted_at: item.deleted_at,
      deleted_by_name: item.deleted_by_name || 'Admin',
      deleted_reason: item.deleted_reason || 'Manual Delete',
    }));
  } catch (err) {
    console.error('Failed to fetch Recycle Bin items:', err);
    return [];
  }
}

export async function restoreReportFromRecycleBin(
  reportId: string,
  profile: any
): Promise<boolean> {
  try {
    const { data: target } = await supabase.from('drs_report_history').select('*').eq('id', reportId).single();
    if (!target) return false;

    // Restore DRS report history entry
    await supabase.from('drs_report_history').update({
      deleted_at: null,
      deleted_by: null,
      deleted_reason: null,
    }).eq('id', reportId);

    // Restore linked NDR shipments
    await supabase
      .from('ndr_shipments')
      .update({
        deleted_at: null,
        deleted_by: null,
        deleted_reason: null,
      })
      .or(`drs_code.eq.${target.file_name},drs_date.eq.${target.report_date}`);

    return true;
  } catch (err) {
    console.error('Failed to restore report from Recycle Bin:', err);
    return false;
  }
}

export async function purgeReportPermanently(reportId: string): Promise<boolean> {
  try {
    const { data: target } = await supabase.from('drs_report_history').select('file_name, report_date').eq('id', reportId).single();
    if (target) {
      await supabase.from('ndr_shipments').delete().or(`drs_code.eq.${target.file_name},drs_date.eq.${target.report_date}`);
    }
    await supabase.from('drs_report_history').delete().eq('id', reportId);
    return true;
  } catch (err) {
    console.error('Failed to purge report permanently:', err);
    return false;
  }
}
