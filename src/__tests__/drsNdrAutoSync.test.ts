import { describe, expect, it, vi } from 'vitest';
import { normalizeNDRReason } from '../lib/ndr/ndrReasonNormalizer';
import { classifyDRSShipment, syncDRSUndelToNDR } from '../lib/ndr/ndrAutoSync';
import { DRSReportRow } from '../types/drs';

vi.mock('@/lib/supabase', () => {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ data: [], error: null }),
    update: vi.fn().mockResolvedValue({ data: [], error: null }),
    then: (resolve: any) => resolve({ data: [], error: null }),
  };

  return {
    supabase: {
      from: vi.fn().mockReturnValue(chainable),
    },
  };
});

describe('DRS → NDR Auto-Sync & Reason Normalizer System', () => {
  const shipment = (overrides: Partial<DRSReportRow>): DRSReportRow => ({
    rowIndex: 1, drs_code: 'DRS-1', waybill_no: '000123', employee_name: 'Rider',
    partner_name: 'Partner', location: 'Hub', city: '', state: '', customer_name: 'Client',
    consignee: 'Customer', shipment_status_raw: '', shipment_status_normalized: 'Unknown',
    amount_payable: 0, payment_type: 'PREPAID', pod_date: '', first_attempt_date: '',
    last_attempt_date: '', total_attempts: 1, delivery_pincode: '', is_mobility: '', reason: '',
    otp_details: '', drs_date: '2026-08-08', drs_status: '', ndr_instruction_received: '',
    is_duplicate: false, duplicate_count: 1, is_invalid: false, ...overrides,
  });

  it('classifies terminal updates and does not treat every CLOSED DRS as delivered', () => {
    expect(classifyDRSShipment(shipment({ shipment_status_raw: 'UNDEL', shipment_status_normalized: 'Undelivered', drs_status: 'CLOSED', reason: 'Customer refused' }))).toBe('undelivered');
    expect(classifyDRSShipment(shipment({ shipment_status_raw: 'completed', drs_status: 'COMPLETED', pod_date: '2026-08-08' }))).toBe('delivered');
    expect(classifyDRSShipment(shipment({ shipment_status_raw: 'RTO', shipment_status_normalized: 'RTO' }))).toBe('rto');
    expect(classifyDRSShipment(shipment({ drs_status: 'CLOSED', reason: 'address not found' }))).toBe('undelivered');
  });

  it('requires a tenant hub before writing NDR data', async () => {
    await expect(syncDRSUndelToNDR([shipment({ shipment_status_raw: 'UNDEL', shipment_status_normalized: 'Undelivered' })], null, {}))
      .rejects.toThrow('Please select a hub');
  });

  it('normalizes raw NDR reasons accurately into canonical categories', () => {
    expect(normalizeNDRReason('Customer refused to accept')).toBe('Customer Refused to Accept');
    expect(normalizeNDRReason('Customer refused order')).toBe('Customer Refused to Accept');
    expect(normalizeNDRReason('Customer denied delivery')).toBe('Customer Refused to Accept');

    expect(normalizeNDRReason('Customer refused to give the OTP')).toBe('Customer Refused OTP');
    expect(normalizeNDRReason('OTP not shared')).toBe('Customer Refused OTP');

    expect(normalizeNDRReason('Customer unavailable')).toBe('Customer Not Reachable');
    expect(normalizeNDRReason('Customer not responding')).toBe('Customer Not Reachable');

    expect(normalizeNDRReason('Phone switched off')).toBe('Phone Switched Off');
    expect(normalizeNDRReason('Mobile switched off')).toBe('Phone Switched Off');

    expect(normalizeNDRReason('Customer requested for future delivery')).toBe('Future Delivery Requested');
    expect(normalizeNDRReason('Deliver tomorrow')).toBe('Future Delivery Requested');

    expect(normalizeNDRReason('Fake Order')).toBe('Fake Order');
    expect(normalizeNDRReason('Wrong address')).toBe('Address Issue');
    expect(normalizeNDRReason('OTP Issues')).toBe('OTP Issue');
    expect(normalizeNDRReason('Delivery Executive Did Not Visit')).toBe('Delivery Executive Did Not Visit');
    expect(normalizeNDRReason('Random unknown reason')).toBe('Other');
  });

  it('filters only UNDEL shipments and auto-syncs them to NDR cases', async () => {
    const mockRows: DRSReportRow[] = [
      {
        rowIndex: 1,
        waybill_no: 'AWB_DEL_001',
        drs_code: 'DRS001',
        employee_name: 'Rahul Kumar',
        partner_name: 'Delhivery',
        location: 'Delhi Hub',
        city: 'Delhi',
        state: 'Delhi',
        customer_name: 'Myntra',
        consignee: 'Aman Sharma',
        payment_type: 'COD',
        amount_payable: 1500,
        pod_date: '2026-08-06',
        first_attempt_date: '2026-08-06',
        last_attempt_date: '2026-08-06',
        total_attempts: 1,
        delivery_pincode: '110001',
        is_mobility: 'NO',
        reason: '',
        otp_details: 'VERIFIED',
        drs_date: '2026-08-06',
        drs_status: 'CLOSED',
        shipment_status_raw: 'DEL',
        shipment_status_normalized: 'Delivered',
        ndr_instruction_received: '',
        is_duplicate: false,
        duplicate_count: 0,
        is_invalid: false,
      },
      {
        rowIndex: 2,
        waybill_no: 'AWB_UNDEL_001',
        drs_code: 'DRS001',
        employee_name: 'Rahul Kumar',
        partner_name: 'Delhivery',
        location: 'Delhi Hub',
        city: 'Delhi',
        state: 'Delhi',
        customer_name: 'Flipkart',
        consignee: 'Priya Verma',
        payment_type: 'COD',
        amount_payable: 2200,
        pod_date: '2026-08-06',
        first_attempt_date: '2026-08-06',
        last_attempt_date: '2026-08-06',
        total_attempts: 1,
        delivery_pincode: '110002',
        is_mobility: 'NO',
        reason: 'Customer refused to accept',
        otp_details: 'NOT_VERIFIED',
        drs_date: '2026-08-06',
        drs_status: 'CLOSED',
        shipment_status_raw: 'UNDEL',
        shipment_status_normalized: 'Undelivered',
        ndr_instruction_received: '',
        is_duplicate: false,
        duplicate_count: 0,
        is_invalid: false,
      },
      {
        rowIndex: 3,
        waybill_no: 'AWB_UNDEL_002',
        drs_code: 'DRS001',
        employee_name: 'Vikram Singh',
        partner_name: 'Shadowfax',
        location: 'Delhi Hub',
        city: 'Delhi',
        state: 'Delhi',
        customer_name: 'Amazon',
        consignee: 'Suresh Raina',
        payment_type: 'PREPAID',
        amount_payable: 0,
        pod_date: '2026-08-06',
        first_attempt_date: '2026-08-06',
        last_attempt_date: '2026-08-06',
        total_attempts: 2,
        delivery_pincode: '110003',
        is_mobility: 'NO',
        reason: 'Customer refused to give the OTP',
        otp_details: 'FAILED',
        drs_date: '2026-08-06',
        drs_status: 'CLOSED',
        shipment_status_raw: 'UNDEL',
        shipment_status_normalized: 'Undelivered',
        ndr_instruction_received: '',
        is_duplicate: false,
        duplicate_count: 0,
        is_invalid: false,
      },
    ];

    const result = await syncDRSUndelToNDR(mockRows, 'hub-test-01', { name: 'Admin', hub_id: 'hub-test-01' }, {
      fileName: 'TEST_DRS_AUTO_SYNC.xlsx',
      reportDate: '2026-08-06',
    });

    expect(result.undelSentToNdr).toBe(2);
    expect(result.newNdrCreated + result.existingNdrUpdated).toBe(2);
    expect(result.reasonCounts['Customer Refused to Accept']).toBe(1);
    expect(result.reasonCounts['Customer Refused OTP']).toBe(1);
  });
});
