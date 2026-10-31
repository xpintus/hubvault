import * as XLSX from 'xlsx';
import type { NDRExcelImportPreview, NDRShipment, ParsedNDRExcelRow } from '@/types/ndr';

export function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s\r\n]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

export const HEADER_ALIASES: Record<string, string> = {
  waybill_no: 'waybill_no',
  waybill: 'waybill_no',
  waybill_number: 'waybill_no',
  awb: 'waybill_no',
  awb_number: 'waybill_no',
  awb_no: 'waybill_no',

  drs_code: 'drs_code',
  drs: 'drs_code',
  drs_no: 'drs_code',
  drs_number: 'drs_code',

  employee_name: 'employee_name',
  employee: 'employee_name',
  delivery_executive: 'employee_name',
  executive_name: 'employee_name',
  de_name: 'employee_name',

  partner_name: 'partner_name',
  partner: 'partner_name',
  vendor: 'partner_name',
  vendor_name: 'partner_name',

  location: 'location',
  hub_location: 'location',
  hub: 'location',

  city: 'city',
  customer_name: 'customer_name',
  client_name: 'customer_name',
  client: 'customer_name',

  state: 'state',
  shipment_status: 'shipment_status',
  status: 'shipment_status',

  amount_payable: 'amount_payable',
  amount: 'amount_payable',
  cod_amount: 'amount_payable',
  payable_amount: 'amount_payable',

  payment_type: 'payment_type',
  pay_type: 'payment_type',
  mode: 'payment_type',
  payment_mode: 'payment_type',

  pod_date: 'pod_date',
  '1st_attempt_date': 'first_attempt_date',
  first_attempt_date: 'first_attempt_date',

  last_attempt_date: 'last_attempt_date',

  total_attemps: 'total_attempts',
  total_attempts: 'total_attempts',
  attempts: 'total_attempts',

  consignee: 'consignee',
  consignee_name: 'consignee',
  customer: 'consignee',

  delivery_pincode: 'delivery_pincode',
  pincode: 'delivery_pincode',
  pin_code: 'delivery_pincode',
  pin: 'delivery_pincode',

  is_mobility: 'is_mobility',
  mobility: 'is_mobility',

  reason: 'reason',
  original_ndr_reason: 'reason',
  ndr_reason: 'reason',

  otp_details: 'otp_details',
  otp_status: 'otp_details',
  otp: 'otp_details',

  drs_date: 'drs_date',
  drs_status: 'drs_status',
  ndr_instruction_received: 'ndr_instruction_received',
};

export function normalizeAwb(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '');
}

export function normalizeAmount(value: unknown): number {
  const cleaned = String(value ?? '')
    .replace(/[₹,\s]/g, '')
    .trim();
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : 0;
}

export function normalizePincode(value: unknown): string {
  return String(value ?? '')
    .replace(/[^\d]/g, '')
    .trim();
}

export function parseReportDate(value: unknown): string | null {
  if (value == null || value === '') return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    try {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (!parsed) return null;
      const y = parsed.y;
      const m = parsed.m;
      const d = parsed.d;
      const h = parsed.H ?? 0;
      const min = parsed.M ?? 0;
      const s = Math.floor(parsed.S ?? 0);
      if (m < 1 || m > 12 || d < 1 || d > 31) return null;
      const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
      if (d > daysInMonth) return null;
      const date = new Date(Date.UTC(y, m - 1, d, h, min, s));
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    } catch {
      return null;
    }
  }

  const text = String(value).trim();
  if (!text) return null;

  // 1. DD-MM-YYYY or DD/MM/YYYY with optional time, seconds, and AM/PM
  const dmyMatch = text.match(
    /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:(?:\s*,\s*|\s+)(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([AaPp][Mm]))?)?$/
  );

  if (dmyMatch) {
    const [, day, month, year, hour = '0', minute = '0', second = '0', meridiem] = dmyMatch;
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);
    let h = Number(hour);
    const min = Number(minute);
    const s = Number(second);

    if (meridiem) {
      const mUpper = meridiem.toUpperCase();
      if (mUpper === 'PM' && h < 12) h += 12;
      else if (mUpper === 'AM' && h === 12) h = 0;
    }

    if (
      y < 1000 ||
      y > 9999 ||
      m < 1 ||
      m > 12 ||
      d < 1 ||
      d > 31 ||
      h < 0 ||
      h > 23 ||
      min < 0 ||
      min > 59 ||
      s < 0 ||
      s > 59
    ) {
      return null;
    }

    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    if (d > daysInMonth) {
      return null;
    }

    const date = new Date(Date.UTC(y, m - 1, d, h, min, s));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  // 2. ISO format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss... or YYYY-MM-DD HH:mm:ss
  const isoMatch = text.match(
    /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|([+-]\d{2}(?::?\d{2})?))?)?$/
  );

  if (isoMatch) {
    const [, year, month, day, hour = '0', minute = '0', second = '0', tz] = isoMatch;
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);
    const h = Number(hour);
    const min = Number(minute);
    const s = Math.floor(Number(second));

    if (
      y < 1000 ||
      y > 9999 ||
      m < 1 ||
      m > 12 ||
      d < 1 ||
      d > 31 ||
      h < 0 ||
      h > 23 ||
      min < 0 ||
      min > 59 ||
      s < 0 ||
      s > 59
    ) {
      return null;
    }

    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    if (d > daysInMonth) {
      return null;
    }

    if (tz || text.endsWith('Z')) {
      const dObj = new Date(text);
      return Number.isNaN(dObj.getTime()) ? null : dObj.toISOString();
    }

    const date = new Date(Date.UTC(y, m - 1, d, h, min, s));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Parses XLSX / XLS / CSV file for NDR Shipments
 */
export async function parseNDRExcelFile(
  file: File,
  existingAWBsInDB: Set<string> = new Set()
): Promise<NDRExcelImportPreview> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: false,
    raw: false,
  });

  const firstSheetName = workbook.SheetNames.find((name) => {
    const sheet = workbook.Sheets[name];
    if (!sheet) return false;
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    return Array.isArray(rows) && rows.length > 1;
  });

  if (!firstSheetName) {
    throw new Error('No readable worksheet or shipment rows were found in this file.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: '',
    raw: false,
  });

  if (!rawRows || rawRows.length === 0) {
    throw new Error('No readable shipment rows were found in this file.');
  }

  // Header normalization and mapping verification
  const sampleRawRow = rawRows[0] || {};
  const rawKeys = Object.keys(sampleRawRow);
  const normalizedKeyMap = new Map<string, string>(); // rawKey -> canonicalKey

  let hasWaybillHeader = false;

  rawKeys.forEach((key) => {
    const norm = normalizeHeader(key);
    const canonical = HEADER_ALIASES[norm] || norm;
    normalizedKeyMap.set(key, canonical);
    if (canonical === 'waybill_no') {
      hasWaybillHeader = true;
    }
  });

  if (!hasWaybillHeader) {
    throw new Error('Required AWB / waybill_no header missing in file.');
  }

  const validRows: ParsedNDRExcelRow[] = [];
  const invalidRows: ParsedNDRExcelRow[] = [];
  const duplicateRows: ParsedNDRExcelRow[] = [];
  const existingRows: ParsedNDRExcelRow[] = [];
  const delSkippedRows: ParsedNDRExcelRow[] = [];
  const undelEligibleRows: ParsedNDRExcelRow[] = [];
  const warningRows: ParsedNDRExcelRow[] = [];
  const missingAwbRows: ParsedNDRExcelRow[] = [];

  const seenAWBsInFile = new Set<string>();

  rawRows.forEach((row, idx) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const mapped: Record<string, unknown> = {};

    // Map row values using normalized keys
    Object.entries(row).forEach(([rawKey, val]) => {
      const canonical = normalizedKeyMap.get(rawKey) || normalizeHeader(rawKey);
      mapped[canonical] = val;
    });

    const waybill_no = normalizeAwb(mapped['waybill_no']);
    const drs_code = String(mapped['drs_code'] ?? '').trim();
    const Employee_name = String(mapped['employee_name'] ?? '').trim();
    const partner_name = String(mapped['partner_name'] ?? '').trim();
    const LOCATION = String(mapped['location'] ?? '').trim();
    const city = String(mapped['city'] ?? '').trim();
    const customer_name = String(mapped['customer_name'] ?? '').trim();
    const state = String(mapped['state'] ?? '').trim();
    const shipment_status = String(mapped['shipment_status'] ?? 'UNDEL').trim();
    const amount_payable = normalizeAmount(mapped['amount_payable']);
    const payment_type = String(mapped['payment_type'] ?? 'COD').trim();
    const POD_date = parseReportDate(mapped['pod_date']) ?? '';
    const first_attempt_date = parseReportDate(mapped['first_attempt_date']) ?? '';
    const last_attempt_date = parseReportDate(mapped['last_attempt_date']) ?? '';
    const total_attemps = normalizeAmount(mapped['total_attempts']) || 1;
    const consignee = String(mapped['consignee'] ?? '').trim();
    const delivery_pincode = normalizePincode(mapped['delivery_pincode']);
    const is_mobility = String(mapped['is_mobility'] ?? '').trim();
    const reason = String(mapped['reason'] ?? '').trim();
    const otp_details = String(mapped['otp_details'] ?? '').trim();
    const drs_date = parseReportDate(mapped['drs_date']) ?? '';
    const drs_status = String(mapped['drs_status'] ?? '').trim();
    const ndr_instruction_received = String(mapped['ndr_instruction_received'] ?? '').trim();

    // Mandatory AWB check
    if (!waybill_no) {
      errors.push('Missing AWB / Waybill Number');
    }
    if (amount_payable < 0) {
      errors.push('Invalid negative amount payable');
    }

    // Warnings (non-fatal)
    if (!delivery_pincode || delivery_pincode.length < 6) {
      warnings.push('Missing or non-standard 6-digit pincode');
    }
    if (!consignee && !customer_name) {
      warnings.push('Consignee / Client name is empty');
    }

    const isDuplicateInFile = waybill_no ? seenAWBsInFile.has(waybill_no) : false;
    const isExistingInDB = waybill_no ? existingAWBsInDB.has(waybill_no) : false;

    const parsedRow: ParsedNDRExcelRow = {
      rowIndex: idx + 2,
      drs_code,
      waybill_no,
      Employee_name,
      partner_name,
      LOCATION,
      city,
      customer_name,
      state,
      shipment_status: shipment_status || 'UNDEL',
      amount_payable,
      payment_type: payment_type || 'COD',
      POD_date,
      first_attempt_date,
      last_attempt_date,
      total_attemps,
      consignee: consignee || customer_name || 'Customer',
      delivery_pincode,
      is_mobility,
      reason,
      otp_details,
      drs_date,
      drs_status,
      ndr_instruction_received,
      errors,
      warnings,
      isDuplicateInFile,
      isExistingInDB,
    };

    // Only UNDEL shipments are eligible for NDR import
    const isUndel = String(shipment_status).trim().toUpperCase() === 'UNDEL';
    if (!isUndel) {
      delSkippedRows.push(parsedRow);
      return; // Skip DEL shipments from NDR import
    }

    undelEligibleRows.push(parsedRow);
    if (waybill_no) seenAWBsInFile.add(waybill_no);

    if (errors.length > 0) {
      invalidRows.push(parsedRow);
      if (!waybill_no) missingAwbRows.push(parsedRow);
    } else if (isDuplicateInFile) {
      duplicateRows.push(parsedRow);
    } else if (isExistingInDB) {
      existingRows.push(parsedRow);
    } else {
      validRows.push(parsedRow);
    }

    if (warnings.length > 0) {
      warningRows.push(parsedRow);
    }
  });

  return {
    validRows,
    invalidRows,
    duplicateRows,
    existingRows,
    delSkippedRows,
    undelEligibleRows,
    warningRows,
    missingAwbRows,
    totalRows: rawRows.length,
    undelEligibleCount: undelEligibleRows.length,
    delSkippedCount: delSkippedRows.length,
    readyToImportCount: validRows.length,
  };

}

/**
 * Export shipment dataset to Excel (.xlsx)
 */
export async function exportNDRShipmentsToExcel(shipments: NDRShipment[], filename = 'ndr_shipments.xlsx') {
  if (!shipments || shipments.length === 0) return;

  const rows = shipments.map((s) => ({
    'AWB Number': s.awb_number,
    'DRS Code': s.drs_code || '',
    'Client Name': s.client_name || '',
    'Consignee Name': s.consignee_name || '',
    'Delivery Executive': s.delivery_executive || '',
    'Vendor Name': s.partner_name || '',
    'Hub Location': s.hub_location || s.hub?.name || '',
    City: s.city || '',
    State: s.state || '',
    'Payment Type': s.payment_type,
    'Amount Payable': s.amount_payable,
    'Original Status': s.shipment_status_original,
    'Current Status': s.shipment_status_current,
    'NDR Workflow Status': s.ndr_workflow_status,
    'Original Reason': s.original_ndr_reason || '',
    'OTP Status': s.otp_status || '',
    Pincode: s.delivery_pincode || '',
    'Total Attempts': s.total_attempts,
    'NDR Cycle': s.ndr_cycle,
    'Assigned Caller': s.assigned_caller?.name || '',
    'Assigned Supervisor': s.assigned_supervisor?.name || '',
    'Latest Caller Remark': s.last_caller_remark || '',
    'Latest Supervisor Remark': s.last_supervisor_remark || '',
    'Delivered Date': s.delivered_date ? new Date(s.delivered_date).toLocaleDateString() : '',
    'POD Reference': s.pod_reference || '',
    'COD Collected': s.cod_collected_amount ?? '',
    'RTO Date': s.rto_date ? new Date(s.rto_date).toLocaleDateString() : '',
    'RTO Reason': s.rto_reason || '',
    'Created At': s.created_at ? new Date(s.created_at).toLocaleDateString() : '',
    'Updated At': s.updated_at ? new Date(s.updated_at).toLocaleDateString() : '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'NDR Shipments');
  XLSX.writeFile(workbook, filename);
}

/**
 * Export shipment dataset to CSV
 */
export async function exportNDRShipmentsToCSV(shipments: NDRShipment[], filename = 'ndr_shipments.csv') {
  if (!shipments || shipments.length === 0) return;
  const rows = shipments.map((s) => ({
    AWB: s.awb_number,
    Client: s.client_name || '',
    Consignee: s.consignee_name || '',
    Executive: s.delivery_executive || '',
    Vendor: s.partner_name || '',
    City: s.city || '',
    Pincode: s.delivery_pincode || '',
    Amount: s.amount_payable,
    Workflow_Status: s.ndr_workflow_status,
    Original_Reason: s.original_ndr_reason || '',
    Latest_Caller_Remark: s.last_caller_remark || '',
    Latest_Supervisor_Remark: s.last_supervisor_remark || '',
    Attempts: s.total_attempts,
    Cycle: s.ndr_cycle,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
  const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Download sample NDR Excel import template
 */
export async function downloadNDRImportTemplate() {
  const sampleData = [
    {
      drs_code: 'DRS-90812',
      waybill_no: 'VL0084988429007',
      Employee_name: 'shambhunath das',
      partner_name: 'Pradeep Kumar Sahani',
      LOCATION: 'E1/BGUS/8/JDG',
      city: 'Begusarai',
      customer_name: 'MEESHO',
      state: 'Bihar',
      shipment_status: 'UNDEL',
      amount_payable: 248,
      payment_type: 'COD',
      POD_date: '',
      '1st_attempt_date': '6-8-2026, 11:00',
      last_attempt_date: '6-8-2026, 13:17',
      total_attemps: 1,
      consignee: 'sweety Kumari gupta',
      delivery_pincode: '8,51,218',
      is_mobility: 'Yes',
      reason: 'Customer refused to give the OTP',
      otp_details: 'Not OTP Verified',
      drs_date: '6-8-2026',
      drs_status: 'COMPLETED',
      ndr_instruction_received: '',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'NDR_Template');
  XLSX.writeFile(workbook, 'hubvault_ndr_import_template.xlsx');
}
