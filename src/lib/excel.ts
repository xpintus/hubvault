import { CollectionEntry, EntryStatus, OnlinePaymentMode, STATUS_LABELS } from '@/types';

export interface ExportRow {
  Date: string;
  Hub: string;
  'Employee Name': string;
  'Employee ID': string;
  'Expected COD': number;
  Cash: number;
  Online: number;
  'Total Collection': number;
  Gap: number;
  Status: string;
  Remarks: string;
}

export async function exportEntriesToExcel(entries: CollectionEntry[], filename: string) {
  const XLSX = await import('xlsx');
  const rows: ExportRow[] = entries.map((e) => ({
    Date: e.collection_date,
    Hub: e.hub?.name ?? '',
    'Employee Name': e.collector?.name ?? '',
    'Employee ID': e.collector?.employee_id ?? '',
    'Expected COD': Number(e.expected_cod),
    Cash: Number(e.cash_amount),
    Online: Number(e.online_amount),
    'Total Collection': Number(e.total_collection),
    Gap: Number(e.gap),
    Status: STATUS_LABELS[e.status],
    Remarks: e.remarks ?? '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Collections');
  XLSX.writeFile(wb, filename);
}

export async function downloadImportTemplate() {
  const XLSX = await import('xlsx');
  const sample = [
    {
      Date: '2025-01-15',
      'Employee Name': 'Rahul Sharma',
      'Employee ID': 'EMP1001',
      'Expected COD': 45000,
      Cash: 30000,
      Online: 15000,
      'Online Payment Mode': 'upi',
      Remarks: 'All accounted for',
    },
  ];
  const ws = XLSX.utils.json_to_sheet(sample);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  XLSX.writeFile(wb, 'collection-import-template.xlsx');
}

export interface ParsedImportRow {
  rowIndex: number;
  collection_date: string;
  collectorName: string;
  employeeId: string;
  expected_cod: number;
  cash_amount: number;
  online_amount: number;
  online_payment_mode: OnlinePaymentMode | null;
  remarks: string;
  errors: string[];
}

export interface ImportPreview {
  valid: ParsedImportRow[];
  failed: ParsedImportRow[];
  totalRows: number;
}

const validModes = ['upi', 'bank_transfer', 'other'];
const validModeAliases: Record<string, OnlinePaymentMode> = {
  upi: 'upi',
  'bank transfer': 'bank_transfer',
  'bank_transfer': 'bank_transfer',
  banktransfer: 'bank_transfer',
  other: 'other',
};

function parseDateField(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    const d = String(raw.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    const d = m[1].padStart(2, '0');
    const mo = m[2].padStart(2, '0');
    return `${m[3]}-${mo}-${d}`;
  }
  return null;
}

function parseNum(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(String(raw).replace(/[^0-9.\-]/g, ''));
  return isFinite(n) ? n : null;
}

export async function parseImportFile(file: File): Promise<ImportPreview> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return { valid: [], failed: [], totalRows: 0 };
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
  const valid: ParsedImportRow[] = [];
  const failed: ParsedImportRow[] = [];

  json.forEach((row, i) => {
    const errors: string[] = [];
    const date = parseDateField(row['Date']);
    const collectorName = String(row['Employee Name'] ?? row['Collector Name'] ?? '').trim();
    const employeeId = String(row['Employee ID'] ?? '').trim();
    const expectedCod = parseNum(row['Expected COD']);
    const cash = parseNum(row['Cash']) ?? 0;
    const online = parseNum(row['Online']) ?? 0;
    const modeRaw = String(row['Online Payment Mode'] ?? '').trim().toLowerCase();
    const remarks = String(row['Remarks'] ?? '').trim();

    if (!date) errors.push('Invalid or missing Date');
    if (!collectorName) errors.push('Missing Employee Name');
    if (!employeeId) errors.push('Missing Employee ID');
    if (expectedCod == null) errors.push('Invalid Expected COD');
    else if (expectedCod < 0) errors.push('Expected COD cannot be negative');

    let mode: OnlinePaymentMode | null = null;
    if (modeRaw) {
      mode = validModeAliases[modeRaw] ?? null;
      if (!mode && !validModes.includes(modeRaw)) errors.push(`Invalid Online Payment Mode "${modeRaw}"`);
    }
    if (online > 0 && !mode) {
      if (!modeRaw) errors.push('Online Payment Mode required when Online > 0');
    }

    const parsed: ParsedImportRow = {
      rowIndex: i + 2,
      collection_date: date ?? '',
      collectorName,
      employeeId,
      expected_cod: expectedCod ?? 0,
      cash_amount: cash,
      online_amount: online,
      online_payment_mode: mode,
      remarks,
      errors,
    };
    if (errors.length) failed.push(parsed);
    else valid.push(parsed);
  });

  return { valid, failed, totalRows: json.length };
}

export function statusFromGap(gap: number, hasCollection: boolean): EntryStatus {
  if (!hasCollection) return 'pending';
  if (gap === 0) return 'reconciled';
  if (gap < 0) return 'shortage';
  return 'excess';
}
