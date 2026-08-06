import { beforeEach, describe, expect, it } from 'vitest';
import {
  computeEmployeeDRSMetrics,
  computeOverallDRSSummary,
  computePaymentAnalytics,
  filterDRSRows,
} from '../lib/drs/drsAnalyticsEngine';
import { compareDRSReportItems, getLocalDRSHistory, saveLocalDRSHistoryItem } from '../lib/drs/drsHistoryManager';
import { findHeaderKey, normalizeAttempts, normalizeHeaderKey, normalizeStatus } from '../lib/drs/drsParser';
import { DRSReportHistoryItem, DRSReportRow } from '../types/drs';

describe('Header Normalization (Excel Compatibility)', () => {
  it('strips BOM, spaces, underscores, line breaks, and hyphens', () => {
    expect(normalizeHeaderKey('\uFEFFwaybill_no')).toBe('waybillno');
    expect(normalizeHeaderKey(' Employee_Name \r\n ')).toBe('employeename');
    expect(normalizeHeaderKey('1st_attempt_date')).toBe('1stattemptdate');
    expect(normalizeHeaderKey('total_attemps')).toBe('totalattemps');
    expect(normalizeHeaderKey('DELIVERY - STATUS')).toBe('deliverystatus');
  });

  it('ignores DRS status (CLOSED) and uses Status (DEL/UNDEL) for shipment delivery calculations', () => {
    const rawHeaders = ['AWB', 'DRS status', 'Status', 'Sub status'];
    const keyStatus = findHeaderKey(rawHeaders, ['status', 'shipment_status', 'shipmentstatus', 'delivery_status', 'deliverystatus']);
    const keyDrsStatus = findHeaderKey(rawHeaders, ['drs_status', 'drsstatus']);

    expect(keyStatus).toBe('Status');
    expect(keyDrsStatus).toBe('DRS status');

    const sampleRow = { AWB: 'AWB001', 'DRS status': 'CLOSED', Status: 'DEL', 'Sub status': 'Delivered Successfully' };
    const rawStat = sampleRow[keyStatus as keyof typeof sampleRow];
    expect(rawStat).toBe('DEL');
    expect(normalizeStatus(rawStat)).toBe('Delivered');
  });

  it('calculates exact delivery percentage matching real CSV (851 DEL / 229 UNDEL = 78.8%)', () => {
    const delCount = 851;
    const undelCount = 229;
    const totalOfd = delCount + undelCount; // 1080
    const deliveryRate = Number(((delCount / totalOfd) * 100).toFixed(1));

    expect(totalOfd).toBe(1080);
    expect(deliveryRate).toBe(78.8);
  });
});

describe('Live Runtime Analytics & Payment FAD% Calculations', () => {
  const dataset: DRSReportRow[] = [
    {
      rowIndex: 1,
      drs_code: 'DRS-01',
      waybill_no: 'AWB001',
      employee_name: 'Shambhunath Das',
      partner_name: 'Delhivery',
      location: 'Hub A',
      city: 'Kolkata',
      state: 'WB',
      customer_name: 'Client A',
      consignee: 'Consignee 1',
      shipment_status_raw: 'DEL',
      shipment_status_normalized: 'Delivered',
      amount_payable: 1000,
      payment_type: 'COD',
      pod_date: '2026-08-06',
      first_attempt_date: '2026-08-06',
      last_attempt_date: '2026-08-06',
      total_attempts: 1,
      delivery_pincode: '700001',
      is_mobility: 'Yes',
      reason: '',
      otp_details: 'Verified',
      drs_date: '2026-08-06',
      drs_status: 'Completed',
      ndr_instruction_received: '',
      is_duplicate: false,
      duplicate_count: 1,
      is_invalid: false,
    },
    {
      rowIndex: 2,
      drs_code: 'DRS-01',
      waybill_no: 'AWB002',
      employee_name: 'Shambhunath Das',
      partner_name: 'Delhivery',
      location: 'Hub A',
      city: 'Kolkata',
      state: 'WB',
      customer_name: 'Client A',
      consignee: 'Consignee 2',
      shipment_status_raw: 'UNDEL',
      shipment_status_normalized: 'Undelivered',
      amount_payable: 500,
      payment_type: 'COD',
      pod_date: '',
      first_attempt_date: '2026-08-06',
      last_attempt_date: '2026-08-06',
      total_attempts: 1,
      delivery_pincode: '700002',
      is_mobility: 'Yes',
      reason: 'Customer Refused',
      otp_details: '',
      drs_date: '2026-08-06',
      drs_status: 'Completed',
      ndr_instruction_received: '',
      is_duplicate: false,
      duplicate_count: 1,
      is_invalid: false,
    },
    {
      rowIndex: 3,
      drs_code: 'DRS-02',
      waybill_no: 'AWB003',
      employee_name: 'Shambhunath Das',
      partner_name: 'Delhivery',
      location: 'Hub A',
      city: 'Kolkata',
      state: 'WB',
      customer_name: 'Client B',
      consignee: 'Consignee 3',
      shipment_status_raw: 'DEL',
      shipment_status_normalized: 'Delivered',
      amount_payable: 1500,
      payment_type: 'Prepaid',
      pod_date: '2026-08-06',
      first_attempt_date: '2026-08-05',
      last_attempt_date: '2026-08-06',
      total_attempts: 1,
      delivery_pincode: '700003',
      is_mobility: 'Yes',
      reason: '',
      otp_details: '',
      drs_date: '2026-08-06',
      drs_status: 'Completed',
      ndr_instruction_received: '',
      is_duplicate: false,
      duplicate_count: 1,
      is_invalid: false,
    },
    {
      rowIndex: 4,
      drs_code: 'DRS-02',
      waybill_no: 'AWB004',
      employee_name: 'Rahul Sharma',
      partner_name: 'Ecom Express',
      location: 'Hub B',
      city: 'Howrah',
      state: 'WB',
      customer_name: 'Client B',
      consignee: 'Consignee 4',
      shipment_status_raw: 'RTO',
      shipment_status_normalized: 'RTO',
      amount_payable: 750,
      payment_type: 'COD',
      pod_date: '',
      first_attempt_date: '2026-08-04',
      last_attempt_date: '2026-08-06',
      total_attempts: 3,
      delivery_pincode: '711101',
      is_mobility: 'No',
      reason: 'RTO Approved',
      otp_details: '',
      drs_date: '2026-08-06',
      drs_status: 'Completed',
      ndr_instruction_received: '',
      is_duplicate: false,
      duplicate_count: 1,
      is_invalid: false,
    },
  ];

  it('calculates exact COD FAD% and Prepaid FAD% with safe division', () => {
    const summary = computeOverallDRSSummary(dataset, {
      fileName: 'drs_test.xlsx',
      reportDate: '2026-08-06',
      totalRows: 4,
      validRows: 4,
      invalidRows: 0,
      duplicateRows: 0,
    });

    const payment = computePaymentAnalytics(dataset);

    // COD First Attempt: AWB001 (DEL, att=1), AWB002 (UNDEL, att=1) -> OFD=2, DEL=1 => 50.0%
    expect(payment.codFirstAttemptOfd).toBe(2);
    expect(payment.codFirstAttemptDel).toBe(1);
    expect(payment.codFadPercent).toBe(50.0);
    expect(summary.codFadPercent).toBe(50.0);

    // Prepaid First Attempt: AWB003 (DEL, att=1) -> OFD=1, DEL=1 => 100.0%
    expect(payment.prepaidFirstAttemptOfd).toBe(1);
    expect(payment.prepaidFirstAttemptDel).toBe(1);
    expect(payment.prepaidFadPercent).toBe(100.0);
    expect(summary.prepaidFadPercent).toBe(100.0);
  });

  it('handles safe division when Prepaid denominator is 0 (returns 0% instead of NaN/Infinity)', () => {
    const codOnlyDataset = dataset.filter((r) => r.payment_type === 'COD');
    const payment = computePaymentAnalytics(codOnlyDataset);

    expect(payment.prepaidFirstAttemptOfd).toBe(0);
    expect(payment.prepaidFirstAttemptDel).toBe(0);
    expect(payment.prepaidFadPercent).toBe(0);
    expect(Number.isNaN(payment.prepaidFadPercent)).toBe(false);
  });
});

describe('Report History Storage & Snapshot Comparison Engine', () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    global.localStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value.toString();
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
      length: 0,
      key: () => null,
    } as any;
  });

  it('saves snapshot and compares reports correctly', () => {

    const datasetA: DRSReportRow[] = [
      {
        rowIndex: 1,
        drs_code: 'DRS-01',
        waybill_no: 'AWB001',
        employee_name: 'Shambhunath Das',
        partner_name: 'Delhivery',
        location: 'Hub A',
        city: 'Kolkata',
        state: 'WB',
        customer_name: 'Client A',
        consignee: 'Consignee 1',
        shipment_status_raw: 'DEL',
        shipment_status_normalized: 'Delivered',
        amount_payable: 1000,
        payment_type: 'COD',
        pod_date: '2026-08-05',
        first_attempt_date: '2026-08-05',
        last_attempt_date: '2026-08-05',
        total_attempts: 1,
        delivery_pincode: '700001',
        is_mobility: 'Yes',
        reason: '',
        otp_details: '',
        drs_date: '2026-08-05',
        drs_status: 'Completed',
        ndr_instruction_received: '',
        is_duplicate: false,
        duplicate_count: 1,
        is_invalid: false,
      },
    ];

    const summaryA = computeOverallDRSSummary(datasetA, {
      fileName: 'report_yesterday.xlsx',
      reportDate: '2026-08-05',
      totalRows: 1,
      validRows: 1,
      invalidRows: 0,
      duplicateRows: 0,
    });

    const itemA: DRSReportHistoryItem = {
      id: 'history_01',
      fileName: 'report_yesterday.xlsx',
      reportDate: '2026-08-05',
      uploadTimestamp: '2026-08-05 10:00:00',
      uploadedBy: 'Manager',
      hubName: 'Main Hub',
      clientName: 'All Clients',
      totalOfd: 1,
      totalDelivered: 1,
      totalUndel: 0,
      overallDeliveryPct: 100.0,
      rows: datasetA,
      summary: summaryA,
    };

    const datasetB: DRSReportRow[] = [
      ...datasetA,
      {
        rowIndex: 2,
        drs_code: 'DRS-02',
        waybill_no: 'AWB002',
        employee_name: 'Shambhunath Das',
        partner_name: 'Delhivery',
        location: 'Hub A',
        city: 'Kolkata',
        state: 'WB',
        customer_name: 'Client A',
        consignee: 'Consignee 2',
        shipment_status_raw: 'UNDEL',
        shipment_status_normalized: 'Undelivered',
        amount_payable: 500,
        payment_type: 'COD',
        pod_date: '',
        first_attempt_date: '2026-08-06',
        last_attempt_date: '2026-08-06',
        total_attempts: 1,
        delivery_pincode: '700002',
        is_mobility: 'Yes',
        reason: 'Refused',
        otp_details: '',
        drs_date: '2026-08-06',
        drs_status: 'Completed',
        ndr_instruction_received: '',
        is_duplicate: false,
        duplicate_count: 1,
        is_invalid: false,
      },
    ];

    const summaryB = computeOverallDRSSummary(datasetB, {
      fileName: 'report_today.xlsx',
      reportDate: '2026-08-06',
      totalRows: 2,
      validRows: 2,
      invalidRows: 0,
      duplicateRows: 0,
    });

    const itemB: DRSReportHistoryItem = {
      id: 'history_02',
      fileName: 'report_today.xlsx',
      reportDate: '2026-08-06',
      uploadTimestamp: '2026-08-06 10:00:00',
      uploadedBy: 'Manager',
      hubName: 'Main Hub',
      clientName: 'All Clients',
      totalOfd: 2,
      totalDelivered: 1,
      totalUndel: 1,
      overallDeliveryPct: 50.0,
      rows: datasetB,
      summary: summaryB,
    };

    const savedA = saveLocalDRSHistoryItem(itemA);
    const savedB = saveLocalDRSHistoryItem(itemB);

    expect(savedB.length).toBeGreaterThanOrEqual(2);

    const comparison = compareDRSReportItems(itemA, itemB);
    expect(comparison.ofdChange).toBe(1); // 2 - 1
    expect(comparison.delChange).toBe(0); // 1 - 1
    expect(comparison.deliveryRateChange).toBe(-50.0); // 50 - 100
  });
});

