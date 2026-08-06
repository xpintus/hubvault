import { DRSReportHistoryItem } from '@/types/drs';

const STORAGE_KEY = 'hubvault_drs_report_history_v4';

export function getDRSHistory(): DRSReportHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DRSReportHistoryItem[];
  } catch (err) {
    console.error('Failed to load DRS report history:', err);
    return [];
  }
}

export function saveDRSHistoryItem(
  newItem: DRSReportHistoryItem,
  replaceExisting: boolean = true
): DRSReportHistoryItem[] {
  try {
    const history = getDRSHistory();
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

    // Limit history to 20 most recent reports to save localstorage memory
    const trimmed = updated.slice(0, 20);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    return trimmed;
  } catch (err) {
    console.error('Failed to save DRS report history item:', err);
    return getDRSHistory();
  }
}

export function deleteDRSHistoryItem(id: string): DRSReportHistoryItem[] {
  try {
    const history = getDRSHistory();
    const filtered = history.filter((h) => h.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return filtered;
  } catch (err) {
    console.error('Failed to delete DRS report history item:', err);
    return getDRSHistory();
  }
}
