import { describe, expect, it } from 'vitest';
import { computeEmployeeDRSMetrics, computeOverallDRSSummary, filterDRSRows } from '../lib/drs/drsAnalyticsEngine';
import { normalizeAttempts, normalizeHeaderKey, normalizeStatus } from '../lib/drs/drsParser';
import { DRSReportRow } from '../types/drs';

describe('DRS Parser & Normalization Utility', () => {
  it('normalizes headers safely regardless of BOM, case, or special characters', () => {
    expect(normalizeHeaderKey('\uFEFFdrs_code')).toBe('drscode');
    expect(normalizeHeaderKey('  Employee Name  ')).toBe('employeename');
    expect(normalizeHeaderKey('1st_attempt_date')).toBe('1stattemptdate');
    expect(normalizeHeaderKey('total_attemps')).toBe('totalattemps');
  });

  it('normalizes shipment statuses accurately', () => {
    expect(normalizeStatus('DEL')).toBe('Delivered');
    expect(normalizeStatus('DELIVERED')).toBe('Delivered');
    expect(normalizeStatus('UNDEL')).toBe('Undelivered');
    expect(normalizeStatus('UNDELIVERED')).toBe('Undelivered');
    expect(normalizeStatus('CANCEL')).toBe('Cancelled');
    expect(normalizeStatus('CANCELLED')).toBe('Cancelled');
    expect(normalizeStatus('RTO')).toBe('RTO');
    expect(normalizeStatus('RETURN TO ORIGIN')).toBe('RTO');
    expect(normalizeStatus('UNKNOWN_STATUS')).toBe('Unknown');
  });

  it('cleans attempt numbers safely', () => {
    expect(normalizeAttempts('1')).toBe(1);
    expect(normalizeAttempts(' Attempt 3 ')).toBe(3);
    expect(normalizeAttempts('')).toBe(0);
    expect(normalizeAttempts(null)).toBe(0);
    expect(normalizeAttempts(undefined)).toBe(0);
  });
});

describe('DRS Analytics Engine Calculations', () => {
  const sampleUniqueRows: DRSReportRow[] = [
    {
      rowIndex: 1,
      drs_code: 'DRS001',
      waybill_no: 'AWB1001',
      employee_name: 'Shambhunath Das',
      partner_name: 'Delhivery',
      location: 'Hub A',
      city: 'Kolkata',
      state: 'WB',
      customer_name: 'Client X',
      consignee: 'Customer A',
      shipment_status_raw: 'DEL',
      shipment_status_normalized: 'Delivered',
      amount_payable: 500,
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
      drs_code: 'DRS001',
      waybill_no: 'AWB1002',
      employee_name: 'Shambhunath Das',
      partner_name: 'Delhivery',
      location: 'Hub A',
      city: 'Kolkata',
      state: 'WB',
      customer_name: 'Client X',
      consignee: 'Customer B',
      shipment_status_raw: 'UNDEL',
      shipment_status_normalized: 'Undelivered',
      amount_payable: 800,
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
      drs_code: 'DRS002',
      waybill_no: 'AWB1003',
      employee_name: 'Shambhunath Das',
      partner_name: 'Delhivery',
      location: 'Hub A',
      city: 'Kolkata',
      state: 'WB',
      customer_name: 'Client Y',
      consignee: 'Customer C',
      shipment_status_raw: 'DEL',
      shipment_status_normalized: 'Delivered',
      amount_payable: 1200,
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
  ];

  it('computes overall DRS summary metrics accurately', () => {
    const summary = computeOverallDRSSummary(sampleUniqueRows, {
      fileName: 'test.xlsx',
      reportDate: '2026-08-06',
      totalRows: 3,
      validRows: 3,
      invalidRows: 0,
      duplicateRows: 0,
    });

    expect(summary.totalOfd).toBe(3);
    expect(summary.firstAttemptOfd).toBe(2);
    expect(summary.firstAttemptDelivered).toBe(1);
    expect(summary.firstAttemptUndel).toBe(1);
    expect(summary.firstAttemptDeliveryPct).toBe(50.0);

    expect(summary.reattemptOfd).toBe(1);
    expect(summary.reattemptDelivered).toBe(1);
    expect(summary.reattemptDeliveryPct).toBe(100.0);

    expect(summary.totalDelivered).toBe(2);
    expect(summary.totalUndel).toBe(1);
    expect(summary.overallDeliveryPct).toBe(66.67);

    expect(summary.firstAttemptContributionPct).toBe(50.0);
    expect(summary.reattemptContributionPct).toBe(50.0);
  });

  it('computes employee-wise DRS metrics accurately', () => {
    const empMetrics = computeEmployeeDRSMetrics(sampleUniqueRows);
    expect(empMetrics.length).toBe(1);

    const das = empMetrics[0];
    expect(das.employee_name).toBe('Shambhunath Das');
    expect(das.total_ofd).toBe(3);
    expect(das.first_attempt_ofd).toBe(2);
    expect(das.first_attempt_delivered).toBe(1);
    expect(das.reattempt_ofd).toBe(1);
    expect(das.reattempt_delivered).toBe(1);
    expect(das.total_delivered).toBe(2);
    expect(das.overall_delivery_pct).toBe(66.67);
  });

  it('filters rows based on minimum OFD threshold', () => {
    const empMetrics = computeEmployeeDRSMetrics(sampleUniqueRows);

    const filterMin1 = empMetrics.filter((e) => e.total_ofd >= 1);
    expect(filterMin1.length).toBe(1);

    const filterMin5 = empMetrics.filter((e) => e.total_ofd >= 5);
    expect(filterMin5.length).toBe(0);
  });
});
