import { supabase } from '@/lib/supabase';
import { DRSReportComparison, DRSReportHistoryItem } from '@/types/drs';

const STORAGE_KEY = 'hubvault_drs_report_history_v5';

export function getLocalDRSHistory(): DRSReportHistoryItem[] {
  try {
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

    const trimmed = updated.slice(0, 30);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    return trimmed;
  } catch (err) {
    console.error('Failed to save local DRS report history item:', err);
    return getLocalDRSHistory();
  }
}

export async function fetchDRSHistoryFromDB(): Promise<DRSReportHistoryItem[]> {
  try {
    const { data, error } = await supabase
      .from('drs_report_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error || !data || data.length === 0) {
      return getLocalDRSHistory();
    }

    const mapped: DRSReportHistoryItem[] = data.map((d: any) => ({
      id: d.id,
      fileName: d.file_name,
      reportDate: d.report_date,
      uploadTimestamp: new Date(d.uploaded_at || d.created_at).toLocaleString(),
      uploadedBy: d.uploaded_by || 'Logistics Admin',
      hubId: d.hub_id,
      hubName: d.hub_name || 'Main Hub',
      clientName: d.client || 'All Clients',
      totalOfd: d.total_ofd,
      totalDelivered: d.delivered,
      totalUndel: d.undel,
      totalRto: d.rto,
      totalCancel: d.cancel,
      firstAttemptOfd: d.first_attempt_ofd,
      firstAttemptDel: d.first_attempt_del,
      reattemptOfd: d.reattempt_ofd,
      reattemptDel: d.reattempt_del,
      overallDeliveryPct: Number(d.overall_percent || 0),
      codOfd: d.cod_ofd,
      codDel: d.cod_del,
      codAmount: Number(d.cod_amount || 0),
      prepaidOfd: d.prepaid_ofd,
      prepaidDel: d.prepaid_del,
      prepaidAmount: Number(d.prepaid_amount || 0),
      averageAttempt: Number(d.average_attempt || 0),
      rows: d.json_snapshot?.rows || [],
      summary: d.json_snapshot?.summary || null,
    }));

    return mapped;
  } catch (err) {
    console.error('Failed to fetch DRS history from DB:', err);
    return getLocalDRSHistory();
  }
}

export async function saveDRSHistorySnapshot(
  item: DRSReportHistoryItem
): Promise<DRSReportHistoryItem[]> {
  // Always save local first
  const localUpdated = saveLocalDRSHistoryItem(item, false);

  try {
    const payload = {
      report_date: item.reportDate,
      file_name: item.fileName,
      hub_id: item.hubId || null,
      hub_name: item.hubName,
      client: item.clientName,
      uploaded_by: item.uploadedBy,
      total_ofd: item.totalOfd,
      delivered: item.totalDelivered,
      undel: item.totalUndel,
      rto: item.summary?.totalRto || 0,
      cancel: item.summary?.totalCancelled || 0,
      first_attempt_ofd: item.summary?.firstAttemptOfd || 0,
      first_attempt_del: item.summary?.firstAttemptDelivered || 0,
      reattempt_ofd: item.summary?.reattemptOfd || 0,
      reattempt_del: item.summary?.reattemptDelivered || 0,
      overall_percent: item.overallDeliveryPct,
      cod_ofd: item.summary?.totalCodValue ? item.totalOfd : 0,
      cod_del: item.summary?.deliveredCodValue ? item.totalDelivered : 0,
      cod_amount: item.summary?.totalCodValue || 0,
      prepaid_ofd: 0,
      prepaid_del: 0,
      prepaid_amount: 0,
      average_attempt: item.summary?.averageAttempts || 1,
      json_snapshot: {
        rows: item.rows,
        summary: item.summary,
      },
    };

    await supabase.from('drs_report_history').insert(payload);
  } catch (err) {
    console.error('Failed to insert DRS history snapshot to Supabase:', err);
  }

  return fetchDRSHistoryFromDB();
}

export async function deleteDRSHistoryItem(id: string): Promise<DRSReportHistoryItem[]> {
  // Delete local
  const localHistory = getLocalDRSHistory().filter((h) => h.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(localHistory));

  try {
    await supabase.from('drs_report_history').delete().eq('id', id);
  } catch (err) {
    console.error('Failed to delete DRS history snapshot from Supabase:', err);
  }

  return fetchDRSHistoryFromDB();
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
