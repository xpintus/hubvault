import { DRSReportRow, NormalizedShipmentStatus } from '@/types/drs';
import * as XLSX from 'xlsx';

// Header Normalization: Remove BOM, whitespace, underscores, hyphens, linebreaks, convert to lowercase
export function normalizeHeaderKey(key: string): string {
  return String(key ?? '')
    .replace(/^\uFEFF/, '') // Remove BOM
    .trim()
    .toLowerCase()
    .replace(/[\s_\-\r\n]+/g, '') // Remove spaces, underscores, hyphens, linebreaks
    .replace(/[^a-z0-9]/g, '');
}

// Find header key from aliases
export function findHeaderKey(rowKeys: string[], aliases: string[]): string | undefined {
  const normalizedAliases = aliases.map(normalizeHeaderKey);
  return rowKeys.find((k) => normalizedAliases.includes(normalizeHeaderKey(k)));
}

// Normalize shipment status according to Excel Pivot rules
export function normalizeStatus(rawStatus: unknown): NormalizedShipmentStatus {
  const s = String(rawStatus ?? '').trim().toUpperCase().replace(/[\s_\-]+/g, ' ');
  if (['DEL', 'DELIVERED'].includes(s)) return 'Delivered';
  if (['UNDEL', 'UNDELIVERED', 'UN DELIVERED', 'UNDELIVERED ATTEMPT', 'NOT DELIVERED', 'ATTEMPTED', 'FAILED'].includes(s) || s.includes('UNDEL')) return 'Undelivered';
  if (['CANCEL', 'CANCELLED', 'CANCELED'].includes(s)) return 'Cancelled';
  if (['RTO', 'RETURN TO ORIGIN', 'RETURNED'].includes(s)) return 'RTO';
  return 'Unknown';
}

// Normalize attempt count: integer conversion, defaulting to 1 for valid rows with missing attempt string
export function normalizeAttempts(rawAttempts: unknown): number {
  if (rawAttempts === null || rawAttempts === undefined || String(rawAttempts).trim() === '') {
    return 1;
  }
  const str = String(rawAttempts).replace(/[^\d]/g, '');
  const num = parseInt(str, 10);
  return isNaN(num) || num <= 0 ? 1 : num;
}

// Parse Excel or CSV File
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

  const getKey = (aliases: string[]) => findHeaderKey(rowKeys, aliases);

  const keyDrsCode = getKey(['drs_code', 'drs_no', 'drs_number', 'drs', 'drsnumber', 'drscode']);
  const keyWaybill = getKey(['waybill_no', 'waybill', 'awb_number', 'awb_no', 'awb', 'tracking_no', 'waybillno', 'awbno', 'awbnumber', 'trackingno']);
  const keyEmployee = getKey(['Employee_name', 'employee_name', 'employee', 'delivery_executive', 'de_name', 'fe_name', 'field_executive', 'rider_name', 'employeename', 'dename', 'fename', 'ridername', 'drivername']);
  const keyPartner = getKey(['partner_name', 'partner', 'courier', 'vendor', 'vendor_name', 'partnername', 'vendorname']);
  const keyLocation = getKey(['LOCATION', 'location', 'hub_location', 'hub', 'branch', 'hublocation']);
  const keyCity = getKey(['city', 'destination_city', 'destinationcity']);
  const keyState = getKey(['state', 'destination_state', 'destinationstate']);
  const keyCustomer = getKey(['customer_name', 'client_name', 'client', 'customername', 'clientname']);
  const keyConsignee = getKey(['consignee', 'consignee_name', 'customer', 'receiver_name', 'consigneename', 'receivername']);
  const keyPhone = getKey(['consignee_phone', 'phone', 'mobile', 'contact_number', 'customer_phone', 'phone_no', 'phone_number', 'consignee_mobile', 'customer_mobile', 'consigneephone', 'customerphone']);
  const keyAddress = getKey(['delivery_address', 'address', 'consignee_address', 'shipping_address', 'destination_address', 'address_line', 'customer_address', 'deliveryaddress', 'consigneeaddress']);
  
  // CRITICAL: Shipment delivery status MUST use 'status' / 'shipment_status' and NEVER 'drs_status'
  const keyStatus = getKey(['status', 'shipment_status', 'shipmentstatus', 'delivery_status', 'deliverystatus']);
  
  const keyAmount = getKey(['amount_payable', 'amount', 'cod_amount', 'collectable_amount', 'amountpayable', 'codamount']);
  const keyPayment = getKey(['payment_type', 'paymenttype', 'pay_mode', 'payment_mode', 'cod_prepaid', 'paymentmode', 'paymode']);
  const keyPodDate = getKey(['POD_date', 'pod_date', 'poddate', 'delivery_date', 'deliverydate']);
  const keyFirstAttempt = getKey(['1st_attempt_date', 'first_attempt_date', 'first_ofd_date', '1stattemptdate', 'firstattemptdate']);
  const keyLastAttempt = getKey(['last_attempt_date', 'last_ofd_date', 'attempt_date', 'lastattemptdate', 'attemptdate']);
  const keyAttempts = getKey(['total_attemps', 'total_attempts', 'totalattempts', 'attempt_count', 'attempts', 'attemptcount', 'totalattemps']);
  const keyPincode = getKey(['delivery_pincode', 'pincode', 'zipcode', 'pin', 'deliverypincode']);
  const keyMobility = getKey(['is_mobility', 'mobility', 'ismobility']);
  const keyReason = getKey(['reason', 'ndr_reason', 'sub_status', 'substatus', 'undelivered_reason', 'fail_reason', 'original_ndr_reason', 'ndrreason', 'failreason']);
  const keyOtp = getKey(['otp_details', 'otp_status', 'otp', 'otpdetails', 'otpstatus']);
  const keyDrsDate = getKey(['drs_date', 'drsdate', 'dispatch_date', 'dispatchdate']);
  const keyDrsStatus = getKey(['drs_status', 'drsstatus']);
  const keyInstruction = getKey(['ndr_instruction_received', 'instruction', 'ndrinstructionreceived']);


  const parsedRows: DRSReportRow[] = [];
  const invalidRows: DRSReportRow[] = [];

  rawJson.forEach((r, idx) => {
    const waybill = String(keyWaybill ? r[keyWaybill] : '').trim();
    const employee = String(keyEmployee ? r[keyEmployee] : '').trim() || 'Unassigned Executive';
    const rawStat = String(keyStatus ? r[keyStatus] : '').trim();
    const attempts = normalizeAttempts(keyAttempts ? r[keyAttempts] : undefined);

    const isInvalid = !waybill || waybill === '0' || waybill.toLowerCase() === 'null' || waybill.toLowerCase() === 'undefined';

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
      consignee_phone: String(keyPhone ? r[keyPhone] : '').trim(),
      delivery_address: String(keyAddress ? r[keyAddress] : '').trim(),
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

  // Duplicate Consolidation: One AWB = One Shipment (keep latest valid record)
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
      group.sort((a, b) => {
        // Delivered status takes highest priority
        if (a.shipment_status_normalized === 'Delivered' && b.shipment_status_normalized !== 'Delivered') return -1;
        if (b.shipment_status_normalized === 'Delivered' && a.shipment_status_normalized !== 'Delivered') return 1;

        // Higher attempt count precedence
        if (b.total_attempts !== a.total_attempts) return b.total_attempts - a.total_attempts;

        // Later attempt date precedence
        const dateA = a.last_attempt_date || a.pod_date || a.drs_date || '';
        const dateB = b.last_attempt_date || b.pod_date || b.drs_date || '';
        if (dateA && dateB && dateA !== dateB) return dateB.localeCompare(dateA);

        // Fallback to row index order (latest row first)
        return b.rowIndex - a.rowIndex;
      });

      const primary = { ...group[0], is_duplicate: true, duplicate_count: group.length };
      uniqueRows.push(primary);

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
