export interface RTOSortCenter { id: string; name: string; toEmail: string; ccEmail: string }

const STORAGE_KEY = 'hubvault:rto-sort-centers';

export function loadRTOSortCenters(): RTOSortCenter[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as RTOSortCenter[]; }
  catch { return []; }
}

export function saveRTOSortCenters(centers: RTOSortCenter[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(centers));
}
