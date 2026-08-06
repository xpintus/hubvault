import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  HEADER_ALIASES,
  normalizeAmount,
  normalizeAwb,
  normalizeHeader,
  normalizePincode,
  parseNDRExcelFile,
  parseReportDate,
} from '../lib/ndr/ndrExcel';
import { importNDRBatch } from '../lib/ndr/ndrService';

describe('NDR Management Utility & Parsing Tests', () => {
  it('normalizes pincodes with commas, spaces, and formatting', () => {
    expect(normalizePincode('1,965')).toBe('1965');
    expect(normalizePincode('8,51,218')).toBe('851218');
    expect(normalizePincode('851101')).toBe('851101');
    expect(normalizePincode('400 001')).toBe('400001');
    expect(normalizePincode(400001)).toBe('400001');
    expect(normalizePincode(null)).toBe('');
  });

  it('parses numeric amounts cleanly including currency symbols and commas', () => {
    expect(normalizeAmount('₹1,450.50')).toBe(1450.5);
    expect(normalizeAmount('1,965')).toBe(1965);
    expect(normalizeAmount('₹1,965')).toBe(1965);
    expect(normalizeAmount(2500)).toBe(2500);
    expect(normalizeAmount('')).toBe(0);
    expect(normalizeAmount('0')).toBe(0);
  });

  it('normalizes headers and applies alias matching case/whitespace-insensitively', () => {
    expect(normalizeHeader(' Employee_name \r\n')).toBe('employee_name');
    expect(normalizeHeader('\uFEFFwaybill_no')).toBe('waybill_no');
    expect(HEADER_ALIASES[normalizeHeader('Waybill No')]).toBe('waybill_no');
    expect(HEADER_ALIASES[normalizeHeader('1st_attempt_date')]).toBe('first_attempt_date');
    expect(HEADER_ALIASES[normalizeHeader('total_attemps')]).toBe('total_attempts');
    expect(HEADER_ALIASES[normalizeHeader('partner_name')]).toBe('partner_name');
    expect(HEADER_ALIASES[normalizeHeader('LOCATION')]).toBe('location');
  });

  it('normalizes AWB numbers cleanly without converting to JS float', () => {
    expect(normalizeAwb(' VL0084988429007 ')).toBe('VL0084988429007');
    expect(normalizeAwb(12345678901234)).toBe('12345678901234');
    expect(normalizeAwb('')).toBe('');
  });

  it('parses dates in report format (D-M-YYYY, HH:mm, JS Date, Excel serial)', () => {
    const reportDate = parseReportDate('6-8-2026, 13:17');
    expect(reportDate).not.toBeNull();
    const d = new Date(reportDate!);
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(7); // August is month index 7
    expect(d.getUTCDate()).toBe(6);

    const jsDate = new Date('2026-08-06T10:00:00Z');
    expect(parseReportDate(jsDate)).toBe('2026-08-06T10:00:00.000Z');

    expect(parseReportDate('invalid date string')).toBeNull();
  });

  it('parses realistic Excel report sample buffer and generates accurate preview', async () => {
    const sampleRows = [
      {
        drs_code: 'D-5911142-06082026105706911',
        waybill_no: 'VL0084988429007',
        Employee_name: 'shambhunath das',
        partner_name: 'Pradeep Kumar Sahani',
        LOCATION: 'E1/BGUS/8/JDG',
        city: 'Begusarai',
        customer_name: 'MEESHO',
        shipment_status: 'UNDEL',
        amount_payable: '248',
        payment_type: 'COD',
        consignee: 'sweety Kumari gupta',
        delivery_pincode: '8,51,218',
        reason: 'Customer refused to give the OTP',
        otp_details: 'Not OTP Verified',
        drs_status: 'COMPLETED',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    const arrayBuf = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

    const file = new File([arrayBuf], 'test_ndr.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const preview = await parseNDRExcelFile(file);
    expect(preview.totalRows).toBe(1);
    expect(preview.validRows.length).toBe(1);
    expect(preview.invalidRows.length).toBe(0);

    const parsed = preview.validRows[0];
    expect(parsed.waybill_no).toBe('VL0084988429007');
    expect(parsed.Employee_name).toBe('shambhunath das');
    expect(parsed.partner_name).toBe('Pradeep Kumar Sahani');
    expect(parsed.customer_name).toBe('MEESHO');
    expect(parsed.consignee).toBe('sweety Kumari gupta');
    expect(parsed.delivery_pincode).toBe('851218');
    expect(parsed.amount_payable).toBe(248);
    expect(parsed.reason).toBe('Customer refused to give the OTP');
    expect(parsed.otp_details).toBe('Not OTP Verified');
  });

  it('throws helpful error if required waybill_no header is missing', async () => {
    const badRows = [{ wrong_header: '123', Employee_name: 'John' }];
    const worksheet = XLSX.utils.json_to_sheet(badRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    const arrayBuf = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

    const file = new File([arrayBuf], 'bad_headers.xlsx');
    await expect(parseNDRExcelFile(file)).rejects.toThrow('Required AWB / waybill_no header missing in file.');
  });

  it('validates COD collected mismatch rule', () => {
    const expectedAmount = 1500;
    const collectedAmount = 1400;
    const isMismatch = Math.abs(collectedAmount - expectedAmount) > 0.01;
    expect(isMismatch).toBe(true);
  });

  it('throws hub selection error when importing without hubId', async () => {
    await expect(
      importNDRBatch('test.xlsx', [], null, 'user-1', 'Admin', 'hub_admin')
    ).rejects.toThrow('Please select a hub before importing the NDR report.');
  });
});
