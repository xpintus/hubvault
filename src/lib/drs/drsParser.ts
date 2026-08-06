import { DRSReportRow, NormalizedShipmentStatus } from '@/types/drs';
import * as XLSX from 'xlsx';

// Header Normalization Helper: strip BOM, trim, lowercase, remove non-alphanumeric chars
export function normalizeHeaderKey(key: string): string {
  return String(key ?? '')
    .replace(/^\uFEFF/, '') // Remove BOM
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// Map column aliases to standard keys
export function findHeaderKey(rowKeys: string[], aliases: string[]): string | undefined {
  const normalizedAliases = aliases.map(normalizeHeaderKey);
  return rowKeys.find((k) => normalizedAliases.includes(normalizeHeaderKey(k)));
}

// Normalize shipment status safely
export function normalizeStatus(rawStatus: unknown): NormalizedShipmentStatus {
  const s = String(rawStatus ?? '').trim().toUpperCase();
  if (['DEL', 'DELIVERED'].includes(s)) return 'Delivered';
  if (['UNDEL', 'UNDELIVERED'].includes(s)) return 'Undelivered';
  if (['CANCEL', 'CANCELLED', 'CANCELED'].includes(s)) return 'Cancelled';
  if (['RTO', 'RETURN TO ORIGIN'].includes(s)) return 'RTO';
  return 'Unknown';
}

// Normalize attempt count safely
export function normalizeAttempts(rawAttempts: unknown): number {
  const str = String(rawAttempts ?? '0').replace(/[^\d]/g, '');
  const num = parseInt(str, 10);
  return isNaN(num) || num < 0 ? 0 : num;
}

// Parse Excel or CSV File ArrayBuffer / File object
export async function parseDRSFile(file: File): Promise<{
  rows: DRSReportRow[];
  uniqueRows: DRSReportRow[];
  duplicateRows: DRSReportRow[];
  invalidRows: DRSReportRow[];
  detectedColumns: string[];
  rawRowCount: number;
}> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array', cellDates: true, cellStyles: true });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  const rawJson = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });

  if (!rawJson || rawJson.length === 0) {
    return {
      rows: [],
      uniqueRows: [],
      duplicateRows: [],
      invalidRows: [],
      detectedColumns: [],
      rawRowCount: 0,
    };
  }

  const sampleRow = rawJson[0];
  const rowKeys = Object.keys(sampleRow);

  // Column Key Resolution Helper
  const getKey = (aliases: string[]) => findHeaderKey(rowKeys, aliases);

  const keyDrsCode = getKey(['drs_code', 'drs_no', 'drs_number', 'drs']);
  const keyWaybill = getKey(['waybill_no', 'waybill', 'awb_number', 'awb_no', 'awb', 'tracking_no', 'waybillno']);
  const keyEmployee = getKey(['Employee_name', 'employee_name', 'employee', 'delivery_executive', 'de_name', 'fe_name', 'field_executive', 'rider_name', 'employeename']);
  const keyPartner = getKey(['partner_name', 'partner', 'courier', 'vendor', 'vendor_name', 'partnername']);
  const keyLocation = getKey(['LOCATION', 'location', 'hub_location', 'hub', 'branch']);
  const keyCity = getKey(['city', 'destination_city']);
  const keyState = getKey(['state', 'destination_state']);
  const keyCustomer = getKey(['customer_name', 'client_name', 'client', 'customername']);
  const keyConsignee = getKey(['consignee', 'consignee_name', 'customer', 'receiver_name', 'consigneename']);
  const keyStatus = getKey(['shipment_status', 'shipmentstatus', 'status', 'delivery_status', 'drs_status']);
  const keyAmount = getKey(['amount_payable', 'amount', 'cod_amount', 'collectable_amount', 'amountpayable']);
  const keyPayment = getKey(['payment_type', 'paymenttype', 'pay_mode', 'payment_mode', 'cod_prepaid']);
  const keyPodDate = getKey(['POD_date', 'pod_date', 'poddate', 'delivery_date']);
  const keyFirstAttempt = getKey(['1st_attempt_date', 'first_attempt_date', 'first_ofd_date']);
  const keyLastAttempt = getKey(['last_attempt_date', 'last_ofd_date', 'attempt_date']);
  const keyAttempts = getKey(['total_attemps', 'total_attempts', 'totalattempts', 'attempt_count', 'attempts']);
  const keyPincode = getKey(['delivery_pincode', 'pincode', 'zipcode', 'pin']);
  const keyMobility = getKey(['is_mobility', 'mobility']);
  const keyReason = getKey(['reason', 'ndr_reason', 'undelivered_reason', 'fail_reason', 'original_ndr_reason']);
  const keyOtp = getKey(['otp_details', 'otp_status', 'otp']);
  const keyDrsDate = getKey(['drs_date', 'drsdate', 'dispatch_date']);
  const keyDrsStatus = getKey(['drs_status', 'drsstatus']);
  const keyInstruction = getKey(['ndr_instruction_received', 'instruction']);

  const parsedRows: DRSReportRow[] = [];
  const invalidRows: DRSReportRow[] = [];

  rawJson.forEach((r, idx) => {
    const waybill = String(keyWaybill ? r[keyWaybill] : '').trim();
    const employee = String(keyEmployee ? r[keyEmployee] : '').trim() || 'Unassigned Executive';
    const rawStat = String(keyStatus ? r[keyStatus] : '').trim();
    const attempts = normalizeAttempts(keyAttempts ? r[keyAttempts] : 0);

    const isInvalid = !waybill || waybill === '0' || waybill === 'null';

    const rowObj: DRSReportRow = {
      rowIndex: idx + 1,
      drs_code: String(keyDrsCode ? r[keyDrsCode] : '').trim(),
      waybill_no: waybill,
      employee_name: employee,
      partner_name: String(keyPartner ? r[keyPartner] : '').trim() || 'Direct',
      location: String(keyLocation ? r[keyLocation] : '').trim() || 'Main Hub',
      city: String(keyCity ? r[keyCity] : '').trim(),
      state: String(keyState ? r[keyState] : '').trim(),
      customer_name: String(keyCustomer ? r[keyCustomer] : '').trim() || 'Client',
      consignee: String(keyConsignee ? r[keyConsignee] : '').trim(),
      shipment_status_raw: rawStat,
      shipment_status_normalized: normalizeStatus(rawStat),
      amount_payable: parseFloat(String(keyAmount ? r[keyAmount] : '0')) || 0,
      payment_type: String(keyPayment ? r[keyPayment] : '').trim() || 'COD',
      pod_date: String(keyPodDate ? r[keyPodDate] : '').trim(),
      first_attempt_date: String(keyFirstAttempt ? r[keyFirstAttempt] : '').trim(),
      last_attempt_date: String(keyLastAttempt ? r[keyLastAttempt] : '').trim(),
      total_attempts: attempts,
      delivery_pincode: String(keyPincode ? r[keyPincode] : '').trim(),
      is_mobility: String(keyMobility ? r[keyMobility] : '').trim(),
      reason: String(keyReason ? r[keyReason] : '').trim(),
      otp_details: String(keyOtp ? r[keyOtp] : '').trim(),
      drs_date: String(keyDrsDate ? r[keyDrsDate] : '').trim(),
      drs_status: String(keyDrsStatus ? r[keyDrsStatus] : '').trim(),
      ndr_instruction_received: String(keyInstruction ? r[keyInstruction] : '').trim(),
      is_duplicate: false,
      duplicate_count: 1,
      is_invalid: isInvalid,
      invalid_reason: isInvalid ? 'Missing or Invalid AWB (waybill_no)' : undefined,
    };

    if (isInvalid) {
      invalidRows.push(rowObj);
    } else {
      parsedRows.push(rowObj);
    }
  });

  // Duplicate Consolidation: Group by waybill_no and pick latest operational record
  const awbGroupMap = new Map<string, DRSReportRow[]>();
  parsedRows.forEach((row) => {
    const list = awbGroupMap.get(row.waybill_no) || [];
    list.push(row);
    awbGroupMap.set(row.waybill_no, list);
  });

  const uniqueRows: DRSReportRow[] = [];
  const duplicateRows: DRSReportRow[] = [];

  awbGroupMap.forEach((group) => {
    if (group.length === 1) {
      uniqueRows.push(group[0]);
    } else {
      // Sort group to find the latest operational row (DEL > highest attempts > latest attempt date > highest index)
      group.sort((a, b) => {
        // DEL status takes precedence if present
        if (a.shipment_status_normalized === 'Delivered' && b.shipment_status_normalized !== 'Delivered') return -1;
        if (b.shipment_status_normalized === 'Delivered' && a.shipment_status_normalized !== 'Delivered') return 1;

        // Higher total_attempts takes precedence
        if (b.total_attempts !== a.total_attempts) return b.total_attempts - a.total_attempts;

        // Later attempt date
        const dateA = a.last_attempt_date || a.pod_date || a.drs_date || '';
        const dateB = b.last_attempt_date || b.pod_date || b.drs_date || '';
        if (dateA && dateB && dateA !== dateB) return dateB.localeCompare(dateA);

        // Fallback to row index order (latest row first)
        return b.rowIndex - a.rowIndex;
      });

      const primary = { ...group[0], is_duplicate: true, duplicate_count: group.length };
      uniqueRows.push(primary);

      // Remaining rows are tagged as exact duplicates
      for (let i = 1; i < group.length; i++) {
        duplicateRows.push({ ...group[i], is_duplicate: true, duplicate_count: group.length });
      }
    }
  });

  return {
    rows: parsedRows,
    uniqueRows,
    duplicateRows,
    invalidRows,
    detectedColumns: rowKeys,
    rawRowCount: rawJson.length,
  };
}
