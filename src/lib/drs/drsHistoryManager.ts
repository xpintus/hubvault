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

    const trimmed = updated.slice(0, 50);
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
      .limit(50);

    if (error) {
      console.warn('Supabase fetch history warning (using local fallback):', error.message);
      return getLocalDRSHistory();
    }

    if (!data || data.length === 0) {
      return getLocalDRSHistory();
    }

    const mapped: DRSReportHistoryItem[] = data.map((d: any) => ({
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

      codOfd: d.cod_ofd || 0,
      codDel: d.cod_del || 0,
      codFirstAttemptOfd: d.cod_first_attempt_ofd || 0,
      codFirstAttemptDel: d.cod_first_attempt_del || 0,
      codFadPercent: Number(d.cod_fad_percent || 0),

      prepaidOfd: d.prepaid_ofd || 0,
      prepaidDel: d.prepaid_del || 0,
      prepaidFirstAttemptOfd: d.prepaid_first_attempt_ofd || 0,
      prepaidFirstAttemptDel: d.prepaid_first_attempt_del || 0,
      prepaidFadPercent: Number(d.prepaid_fad_percent || 0),

      codAmount: Number(d.cod_amount || 0),
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
  // Always update local storage first so history is immediately populated
  const localUpdated = saveLocalDRSHistoryItem(item, false);

  try {
    const s = item.summary;
    const payload = {
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

    const { error } = await supabase.from('drs_report_history').insert(payload);
    if (error) {
      console.warn('Supabase DRS Insert Warning (falling back to LocalStorage):', error.message);
    }
  } catch (err) {
    console.error('Failed to insert DRS history snapshot to Supabase:', err);
  }

  const dbHistory = await fetchDRSHistoryFromDB();
  if (dbHistory && dbHistory.length > 0) return dbHistory;
  return localUpdated;
}

export async function deleteDRSHistoryItem(id: string): Promise<DRSReportHistoryItem[]> {
  const localHistory = getLocalDRSHistory().filter((h) => h.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(localHistory));

  try {
    const { error } = await supabase.from('drs_report_history').delete().eq('id', id);
    if (error) {
      console.warn('Supabase DRS Delete Warning:', error.message);
    }
  } catch (err) {
    console.error('Failed to delete DRS history snapshot from Supabase:', err);
  }

  const dbHistory = await fetchDRSHistoryFromDB();
  if (dbHistory && dbHistory.length > 0) return dbHistory;
  return localHistory;
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
