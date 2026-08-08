import { supabase } from '@/lib/supabase';
import { DRSReportComparison, DRSReportHistoryItem } from '@/types/drs';

const STORAGE_KEY = 'hubvault_drs_report_history_v5';

export function getLocalDRSHistory(): DRSReportHistoryItem[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DRSReportHistoryItem[];
  } catch (err) {
    console.error('Failed to load local DRS report history:', err);
    return [];
  }
}

export function saveLocalDRSHistoryItem(
  newItem: DRSReportHistoryItem,
  replaceExisting: boolean = false
): DRSReportHistoryItem[] {
  try {
    const history = getLocalDRSHistory();
    const existingIndex = history.findIndex(
      (h) => h.fileName === newItem.fileName && h.reportDate === newItem.reportDate
    );

    let updated: DRSReportHistoryItem[];
    if (existingIndex >= 0 && replaceExisting) {
      updated = [...history];
      updated[existingIndex] = newItem;
    } else {
      updated = [newItem, ...history];
    }

    const trimmed = updated.slice(0, 50);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    }
    return trimmed;
  } catch (err) {
    console.error('Failed to save local DRS report history item:', err);
    return getLocalDRSHistory();
  }
}

export function removeLocalDRSHistoryItem(id: string): DRSReportHistoryItem[] {
  try {
    const history = getLocalDRSHistory().filter((h) => h.id !== id);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    }
    return history;
  } catch (err) {
    console.error('Failed to remove local DRS report history item:', err);
    return getLocalDRSHistory();
  }
}

export function clearLocalDRSHistory(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (err) {
    console.error('Failed to clear local DRS report history:', err);
  }
}

export async function fetchDRSHistoryFromDB(): Promise<DRSReportHistoryItem[]> {
  const localHistory = getLocalDRSHistory();
  try {
    const { data, error } = await supabase
      .from('drs_report_history')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !data) {
      console.warn('Supabase fetch history warning (using local fallback):', error?.message);
      return localHistory;
    }

    const mapped: DRSReportHistoryItem[] = data.map((d: any) => {
      const snapSummary = d.json_snapshot?.summary;
      return {
        id: d.id,
        fileName: d.file_name || 'DRS_Report.xlsx',
        reportDate: d.report_date,
        uploadTimestamp: new Date(d.uploaded_at || d.created_at).toLocaleString(),
        uploadedBy: d.uploaded_by || 'Logistics Admin',
        hubId: d.hub_id,
        hubName: d.hub_name || 'Main Hub',
        clientName: d.client || 'All Clients',
        totalOfd: d.total_ofd || 0,
        totalDelivered: d.delivered || 0,
        totalUndel: d.undel || 0,
        totalRto: d.rto || 0,
        totalCancel: d.cancel || 0,
        firstAttemptOfd: d.first_attempt_ofd || 0,
        firstAttemptDel: d.first_attempt_del || 0,
        reattemptOfd: d.reattempt_ofd || 0,
        reattemptDel: d.reattempt_del || 0,
        overallDeliveryPct: Number(d.overall_percent || 0),

        codOfd: d.cod_ofd || snapSummary?.codOfd || 0,
        codDel: d.cod_del || snapSummary?.codDelivered || 0,
        codFirstAttemptOfd: d.cod_first_attempt_ofd || snapSummary?.codFirstAttemptOfd || 0,
        codFirstAttemptDel: d.cod_first_attempt_del || snapSummary?.codFirstAttemptDel || 0,
        codFadPercent: Number(d.cod_fad_percent ?? snapSummary?.codFadPercent ?? 0),

        prepaidOfd: d.prepaid_ofd || snapSummary?.prepaidOfd || 0,
        prepaidDel: d.prepaid_del || snapSummary?.prepaidDelivered || 0,
        prepaidFirstAttemptOfd: d.prepaid_first_attempt_ofd || snapSummary?.prepaidFirstAttemptOfd || 0,
        prepaidFirstAttemptDel: d.prepaid_first_attempt_del || snapSummary?.prepaidFirstAttemptDel || 0,
        prepaidFadPercent: Number(d.prepaid_fad_percent ?? snapSummary?.prepaidFadPercent ?? 0),

        codAmount: Number(d.cod_amount || snapSummary?.totalCodValue || 0),
        prepaidAmount: Number(d.prepaid_amount || snapSummary?.deliveredCodValue || 0),
        averageAttempt: Number(d.average_attempt || snapSummary?.averageAttempts || 1),
        rows: d.json_snapshot?.rows || [],
        summary: snapSummary || null,
      };
    });

    // Update LocalStorage cache with current active DB history
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
    }

    return mapped;
  } catch (err) {
    console.error('Failed to fetch DRS history from DB:', err);
    return localHistory;
  }
}

export async function saveDRSHistorySnapshot(
  item: DRSReportHistoryItem
): Promise<DRSReportHistoryItem[]> {
  // Ensure valid UUID format for PostgreSQL uuid primary key
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!item.id || !uuidRegex.test(item.id)) {
    item.id = crypto.randomUUID ? crypto.randomUUID() : `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, '0')}`;
  }

  // Always update local storage first so history is immediately populated
  const localUpdated = saveLocalDRSHistoryItem(item, true);

  try {
    const s = item.summary;
    const fullPayload = {
      id: item.id,
      report_date: item.reportDate,
      file_name: item.fileName,
      hub_id: item.hubId || null,
      hub_name: item.hubName || 'Main Hub',
      client: item.clientName || 'All Clients',
      uploaded_by: item.uploadedBy || 'Logistics Admin',
      total_ofd: item.totalOfd,
      delivered: item.totalDelivered,
      undel: item.totalUndel,
      rto: s?.totalRto || 0,
      cancel: s?.totalCancelled || 0,
      first_attempt_ofd: s?.firstAttemptOfd || 0,
      first_attempt_del: s?.firstAttemptDelivered || 0,
      reattempt_ofd: s?.reattemptOfd || 0,
      reattempt_del: s?.reattemptDelivered || 0,
      overall_percent: item.overallDeliveryPct,

      cod_ofd: s?.codOfd || 0,
      cod_del: s?.codDelivered || 0,
      cod_first_attempt_ofd: s?.codFirstAttemptOfd || 0,
      cod_first_attempt_del: s?.codFirstAttemptDel || 0,
      cod_fad_percent: s?.codFadPercent || 0,

      prepaid_ofd: s?.prepaidOfd || 0,
      prepaid_del: s?.prepaidDelivered || 0,
      prepaid_first_attempt_ofd: s?.prepaidFirstAttemptOfd || 0,
      prepaid_first_attempt_del: s?.prepaidFirstAttemptDel || 0,
      prepaid_fad_percent: s?.prepaidFadPercent || 0,

      cod_amount: s?.totalCodValue || 0,
      prepaid_amount: s?.deliveredCodValue || 0,
      average_attempt: s?.averageAttempts || 1,
      json_snapshot: {
        rows: item.rows,
        summary: item.summary,
      },
    };

    let existingQuery = supabase
      .from('drs_report_history')
      .select('id')
      .eq('report_date', item.reportDate)
      .eq('file_name', item.fileName)
      .is('deleted_at', null);
    existingQuery = item.hubId ? existingQuery.eq('hub_id', item.hubId) : existingQuery.is('hub_id', null);
    const { data: existing } = await existingQuery.maybeSingle();

    const writeQuery = existing?.id
      ? supabase.from('drs_report_history').update(fullPayload).eq('id', existing.id)
      : supabase.from('drs_report_history').insert(fullPayload);
    const { data: insertedData, error: fullError } = await writeQuery
      .select('id')
      .single();

    if (insertedData?.id) {
      item.id = insertedData.id;
      setActiveReportId(insertedData.id);
    } else if (fullError) {
      console.warn('Supabase full payload insert failed (trying legacy fallback):', fullError.message);
      // Fallback payload without columns if PostgREST schema cache hasn't refreshed yet
      const legacyPayload = {
        report_date: item.reportDate,
        file_name: item.fileName,
        hub_id: item.hubId || null,
        hub_name: item.hubName || 'Main Hub',
        client: item.clientName || 'All Clients',
        uploaded_by: item.uploadedBy || 'Logistics Admin',
        total_ofd: item.totalOfd,
        delivered: item.totalDelivered,
        undel: item.totalUndel,
        rto: s?.totalRto || 0,
        cancel: s?.totalCancelled || 0,
        first_attempt_ofd: s?.firstAttemptOfd || 0,
        first_attempt_del: s?.firstAttemptDelivered || 0,
        reattempt_ofd: s?.reattemptOfd || 0,
        reattempt_del: s?.reattemptDelivered || 0,
        overall_percent: item.overallDeliveryPct,
        cod_ofd: s?.codOfd || 0,
        cod_del: s?.codDelivered || 0,
        cod_amount: s?.totalCodValue || 0,
        prepaid_ofd: s?.prepaidOfd || 0,
        prepaid_del: s?.prepaidDelivered || 0,
        prepaid_amount: s?.deliveredCodValue || 0,
        average_attempt: s?.averageAttempts || 1,
        json_snapshot: {
          rows: item.rows,
          summary: item.summary,
        },
      };
      const { error: legacyError } = await supabase.from('drs_report_history').insert(legacyPayload);
      if (legacyError) {
        console.error('Supabase legacy DRS Insert Error:', legacyError.message);
      }
    }
  } catch (err) {
    console.error('Failed to insert DRS history snapshot to Supabase:', err);
  }

  const dbHistory = await fetchDRSHistoryFromDB();
  if (dbHistory && dbHistory.length > 0) return dbHistory;
  return localUpdated;
}

export async function deleteDRSHistoryItem(id: string): Promise<DRSReportHistoryItem[]> {
  removeLocalDRSHistoryItem(id);
  if (getActiveReportId() === id) {
    clearActiveReportId();
  }

  try {
    const nowIso = new Date().toISOString();
    const { data: updateRes } = await supabase
      .from('drs_report_history')
      .update({ deleted_at: nowIso })
      .eq('id', id)
      .select('id');

    if (!updateRes || updateRes.length === 0) {
      await supabase.from('drs_report_history').delete().eq('id', id);
    }

    // Soft delete linked NDR shipments
    const { data: target } = await supabase.from('drs_report_history').select('file_name, report_date').eq('id', id).single();
    if (target) {
      await supabase
        .from('ndr_shipments')
        .update({ deleted_at: nowIso })
        .or(`drs_code.eq.${target.file_name},drs_date.eq.${target.report_date}`);
    }
  } catch (err) {
    console.error('Failed to delete DRS history snapshot from Supabase:', err);
  }

  return await fetchDRSHistoryFromDB();
}

export const ACTIVE_REPORT_ID_KEY = 'hubvault_active_drs_report_id_v5';

export function getActiveReportId(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(ACTIVE_REPORT_ID_KEY);
  } catch {
    return null;
  }
}

export function setActiveReportId(id: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ACTIVE_REPORT_ID_KEY, id);
    }
  } catch (err) {
    console.error('Failed to set active DRS report ID:', err);
  }
}

export function clearActiveReportId(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(ACTIVE_REPORT_ID_KEY);
    }
  } catch (err) {
    console.error('Failed to clear active DRS report ID:', err);
  }
}

export async function loadActiveDRSReport(
  preferredId?: string | null
): Promise<{ activeReport: DRSReportHistoryItem | null; historyList: DRSReportHistoryItem[] }> {
  const historyList = await fetchDRSHistoryFromDB();
  if (historyList.length === 0) {
    clearActiveReportId();
    return { activeReport: null, historyList: [] };
  }

  const targetId = preferredId || getActiveReportId();
  let activeReport: DRSReportHistoryItem | null = null;

  if (targetId) {
    const found = historyList.find((h) => h.id === targetId);
    if (found) {
      activeReport = found;
    } else {
      clearActiveReportId();
      if (!preferredId && historyList.length > 0) {
        activeReport = historyList[0];
      }
    }
  } else {
    activeReport = historyList[0];
  }

  if (activeReport && activeReport.id) {
    setActiveReportId(activeReport.id);
  } else {
    clearActiveReportId();
  }

  return { activeReport, historyList };
}

export function compareDRSReportItems(
  reportA: DRSReportHistoryItem,
  reportB: DRSReportHistoryItem
): DRSReportComparison {
  const ofdChange = reportB.totalOfd - reportA.totalOfd;
  const ofdChangePct = reportA.totalOfd > 0 ? (ofdChange / reportA.totalOfd) * 100 : 0;

  const delChange = reportB.totalDelivered - reportA.totalDelivered;
  const delChangePct = reportA.totalDelivered > 0 ? (delChange / reportA.totalDelivered) * 100 : 0;

  const undelChange = reportB.totalUndel - reportA.totalUndel;
  const deliveryRateChange = reportB.overallDeliveryPct - reportA.overallDeliveryPct;

  const codA = reportA.summary?.totalCodValue || 0;
  const codB = reportB.summary?.totalCodValue || 0;
  const codAmountChange = codB - codA;

  return {
    reportA,
    reportB,
    ofdChange,
    ofdChangePct: Number(ofdChangePct.toFixed(2)),
    delChange,
    delChangePct: Number(delChangePct.toFixed(2)),
    undelChange,
    deliveryRateChange: Number(deliveryRateChange.toFixed(2)),
    codAmountChange,
  };
}
