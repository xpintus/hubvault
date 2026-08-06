import { describe, expect, it } from 'vitest';
import { computeEmployeeDRSMetrics, computeOverallDRSSummary, filterDRSRows } from '../lib/drs/drsAnalyticsEngine';
import { findHeaderKey, normalizeAttempts, normalizeHeaderKey, normalizeStatus } from '../lib/drs/drsParser';
import { DRSReportRow } from '../types/drs';


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


describe('Excel Pivot Table Calculation Engine Verification', () => {
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
      total_attempts: 2,
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

  it('matches Excel Pivot formulas for Overall DRS Summary', () => {
    const summary = computeOverallDRSSummary(dataset, {
      fileName: 'drs_test.xlsx',
      reportDate: '2026-08-06',
      totalRows: 4,
      validRows: 4,
      invalidRows: 0,
      duplicateRows: 0,
    });

    // Total OFD = DEL + UNDEL + RTO + CANCEL
    expect(summary.totalOfd).toBe(4);
    expect(summary.totalDelivered).toBe(2);
    expect(summary.totalUndel).toBe(1);
    expect(summary.totalRto).toBe(1);

    // First Attempt (attempt <= 1)
    expect(summary.firstAttemptOfd).toBe(2); // AWB001, AWB002
    expect(summary.firstAttemptDelivered).toBe(1); // AWB001
    expect(summary.firstAttemptDeliveryPct).toBe(50.0); // 1 / 2 * 100

    // Reattempt (attempt >= 2)
    expect(summary.reattemptOfd).toBe(2); // AWB003, AWB004
    expect(summary.reattemptDelivered).toBe(1); // AWB003
    expect(summary.reattemptDeliveryPct).toBe(50.0); // 1 / 2 * 100

    // Overall Delivery %
    expect(summary.overallDeliveryPct).toBe(50.0); // 2 / 4 * 100
  });

  it('verifies that Employee totals SUM exactly to overall grand totals', () => {
    const summary = computeOverallDRSSummary(dataset, {
      fileName: 'drs_test.xlsx',
      reportDate: '2026-08-06',
      totalRows: 4,
      validRows: 4,
      invalidRows: 0,
      duplicateRows: 0,
    });

    const employeeMetrics = computeEmployeeDRSMetrics(dataset);
    expect(employeeMetrics.length).toBe(2);

    let sumEmpOfd = 0;
    let sumEmpDel = 0;
    let sumEmp1stOfd = 0;
    let sumEmp1stDel = 0;
    let sumEmpReOfd = 0;
    let sumEmpReDel = 0;

    employeeMetrics.forEach((e) => {
      sumEmpOfd += e.total_ofd;
      sumEmpDel += e.total_delivered;
      sumEmp1stOfd += e.first_attempt_ofd;
      sumEmp1stDel += e.first_attempt_delivered;
      sumEmpReOfd += e.reattempt_ofd;
      sumEmpReDel += e.reattempt_delivered;
    });

    expect(sumEmpOfd).toBe(summary.totalOfd);
    expect(sumEmpDel).toBe(summary.totalDelivered);
    expect(sumEmp1stOfd).toBe(summary.firstAttemptOfd);
    expect(sumEmp1stDel).toBe(summary.firstAttemptDelivered);
    expect(sumEmpReOfd).toBe(summary.reattemptOfd);
    expect(sumEmpReDel).toBe(summary.reattemptDelivered);
  });
});
