import { NDRExcelImportPreview, NDRShipment, ParsedNDRExcelRow } from '@/types/ndr';

export function normalizePincode(raw: unknown): string {
  if (raw == null || raw === '') return '';
  const str = String(raw).trim();
  // Remove commas, spaces, trailing zeroes if parsed as float
  const cleaned = str.replace(/[,. \s]/g, '');
  return cleaned;
}

export function parseNDRNumber(raw: unknown): number {
  if (raw == null || raw === '') return 0;
  const cleaned = String(raw).replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export function parseNDRDate(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    return raw.toISOString();
  }
  const s = String(raw).trim();
  if (!s) return null;
  
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  // DD/MM/YYYY or DD-MM-YYYY
  const dmY = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (dmY) {
    const day = parseInt(dmY[1], 10);
    const month = parseInt(dmY[2], 10) - 1;
    const year = parseInt(dmY[3], 10);
    const d = new Date(Date.UTC(year, month, day));
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Parses XLSX / XLS / CSV file for NDR Shipments
 */
export async function parseNDRExcelFile(
  file: File,
  existingAWBsInDB: Set<string> = new Set()
): Promise<NDRExcelImportPreview> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return {
      validRows: [],
      invalidRows: [],
      duplicateRows: [],
      existingRows: [],
      totalRows: 0,
      readyToImportCount: 0,
    };
  }

  const worksheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });

  const validRows: ParsedNDRExcelRow[] = [];
  const invalidRows: ParsedNDRExcelRow[] = [];
  const duplicateRows: ParsedNDRExcelRow[] = [];
  const existingRows: ParsedNDRExcelRow[] = [];

  const seenAWBsInFile = new Set<string>();

  rawRows.forEach((row, idx) => {
    const errors: string[] = [];

    // Map exact Excel columns with fallback key matching
    const waybill_no = String(
      row['waybill_no'] ?? row['Waybill No'] ?? row['waybill'] ?? row['AWB'] ?? row['awb_number'] ?? ''
    ).trim();

    const drs_code = String(row['drs_code'] ?? row['DRS Code'] ?? '').trim();
    const Employee_name = String(row['Employee_name'] ?? row['Employee Name'] ?? row['Delivery Executive'] ?? '').trim();
    const partner_name = String(row['partner_name'] ?? row['Partner Name'] ?? row['Vendor'] ?? '').trim();
    const LOCATION = String(row['LOCATION'] ?? row['Location'] ?? row['Hub Location'] ?? '').trim();
    const city = String(row['city'] ?? row['City'] ?? '').trim();
    const customer_name = String(row['customer_name'] ?? row['Customer Name'] ?? row['Client Name'] ?? '').trim();
    const state = String(row['state'] ?? row['State'] ?? '').trim();
    const shipment_status = String(row['shipment_status'] ?? row['Shipment Status'] ?? 'UNDEL').trim();
    const amount_payable = parseNDRNumber(row['amount_payable'] ?? row['Amount Payable'] ?? row['COD Amount']);
    const payment_type = String(row['payment_type'] ?? row['Payment Type'] ?? 'COD').trim();
    const POD_date = parseNDRDate(row['POD_date'] ?? row['POD Date']) ?? '';
    const first_attempt_date = parseNDRDate(row['1st_attempt_date'] ?? row['First Attempt Date']) ?? '';
    const last_attempt_date = parseNDRDate(row['last_attempt_date'] ?? row['Last Attempt Date']) ?? '';
    const total_attemps = parseNDRNumber(row['total_attemps'] ?? row['total_attempts'] ?? row['Total Attempts']) || 1;
    const consignee = String(row['consignee'] ?? row['Consignee'] ?? row['Customer'] ?? '').trim();
    const delivery_pincode = normalizePincode(row['delivery_pincode'] ?? row['Pincode'] ?? row['delivery_pincode_text']);
    const is_mobility = String(row['is_mobility'] ?? row['Is Mobility'] ?? '').trim();
    const reason = String(row['reason'] ?? row['Original NDR Reason'] ?? row['Reason'] ?? '').trim();
    const otp_details = String(row['otp_details'] ?? row['OTP Status'] ?? '').trim();
    const drs_date = parseNDRDate(row['drs_date'] ?? row['DRS Date']) ?? '';
    const drs_status = String(row['drs_status'] ?? row['DRS Status'] ?? '').trim();
    const ndr_instruction_received = String(row['ndr_instruction_received'] ?? '').trim();

    // Validations
    if (!waybill_no) {
      errors.push('Missing AWB / Waybill Number');
    }
    if (!consignee && !customer_name) {
      errors.push('Missing Consignee / Customer Name');
    }
    if (amount_payable < 0) {
      errors.push('Invalid negative amount payable');
    }

    const isDuplicateInFile = waybill_no ? seenAWBsInFile.has(waybill_no) : false;
    if (waybill_no) seenAWBsInFile.add(waybill_no);

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
      consignee: consignee || customer_name,
      delivery_pincode,
      is_mobility,
      reason,
      otp_details,
      drs_date,
      drs_status,
      ndr_instruction_received,
      errors,
      isDuplicateInFile,
      isExistingInDB,
    };

    if (errors.length > 0) {
      invalidRows.push(parsedRow);
    } else if (isDuplicateInFile) {
      duplicateRows.push(parsedRow);
    } else if (isExistingInDB) {
      existingRows.push(parsedRow);
      validRows.push(parsedRow);
    } else {
      validRows.push(parsedRow);
    }
  });

  return {
    validRows,
    invalidRows,
    duplicateRows,
    existingRows,
    totalRows: rawRows.length,
    readyToImportCount: validRows.length,
  };
}

/**
 * Export shipment dataset to Excel (.xlsx)
 */
export async function exportNDRShipmentsToExcel(shipments: NDRShipment[], filename = 'ndr_shipments.xlsx') {
  const XLSX = await import('xlsx');
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
    'Delivered Date': s.delivered_date ? new Date(s.delivered_date).toLocaleDateString() : '',
    'POD Reference': s.pod_reference || '',
    'COD Collected': s.cod_collected_amount ?? '',
    'RTO Date': s.rto_date ? new Date(s.rto_date).toLocaleDateString() : '',
    'RTO Reason': s.rto_reason || '',
    'Created At': new Date(s.created_at).toLocaleDateString(),
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
  const XLSX = await import('xlsx');
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
  const XLSX = await import('xlsx');
  const sampleData = [
    {
      drs_code: 'DRS-90812',
      waybill_no: 'AWB9988112233',
      Employee_name: 'Rahul Sharma',
      partner_name: 'Delhivery',
      LOCATION: 'Mumbai Central Hub',
      city: 'Mumbai',
      customer_name: 'MEESHO',
      state: 'Maharashtra',
      shipment_status: 'UNDEL',
      amount_payable: 1450,
      payment_type: 'COD',
      POD_date: '',
      '1st_attempt_date': '2026-08-01',
      last_attempt_date: '2026-08-05',
      total_attemps: 2,
      consignee: 'Anjali Verma',
      delivery_pincode: '400001',
      is_mobility: 'Yes',
      reason: 'Customer Refused Order - Price High',
      otp_details: 'OTP Failed',
      drs_date: '2026-08-05',
      drs_status: 'Completed',
      ndr_instruction_received: '',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'NDR_Template');
  XLSX.writeFile(workbook, 'hubvault_ndr_import_template.xlsx');
}
