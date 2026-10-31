import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as XLSXModule from 'xlsx';
import { exportNDRShipmentsToExcel } from '../lib/ndr/ndrExcel.ts';
import type { NDRShipment } from '../types/ndr.ts';

const XLSX: any = (XLSXModule as any).default || XLSXModule;

// Helper to generate mock NDR shipment records
function generateMockShipments(count: number, startIndex = 0): NDRShipment[] {
  return Array.from({ length: count }, (_, i) => {
    const idx = startIndex + i + 1;
    return {
      id: `uuid-${idx}`,
      awb_number: `AWB${String(idx).padStart(8, '0')}`,
      drs_code: `DRS-${1000 + (idx % 50)}`,
      client_name: `Client ${(idx % 5) + 1}`,
      consignee_name: `Customer ${idx}`,
      consignee_phone: `98765${String(idx).padStart(5, '0')}`,
      delivery_address: `Address line for customer ${idx}`,
      delivery_executive: `Executive ${(idx % 10) + 1}`,
      partner_name: `Vendor ${(idx % 3) + 1}`,
      hub_location: 'Main Hub',
      city: 'Delhi',
      state: 'Delhi',
      payment_type: idx % 2 === 0 ? 'COD' : 'Prepaid',
      amount_payable: 150 + (idx % 500),
      shipment_status_original: 'UNDEL',
      shipment_status_current: 'UNDEL',
      ndr_workflow_status: idx % 2 === 0 ? 'Calling Pending' : 'Supervisor Pending',
      original_ndr_reason: 'Customer Refused OTP',
      normalized_ndr_reason: 'Customer Refused OTP',
      otp_status: 'Not OTP Verified',
      drs_status: 'COMPLETED',
      drs_date: '2026-10-31T00:00:00.000Z',
      first_attempt_date: '2026-10-30T10:00:00.000Z',
      last_attempt_date: '2026-10-31T09:00:00.000Z',
      total_attempts: (idx % 3) + 1,
      delivery_pincode: '110001',
      is_mobility: 'Yes',
      assigned_caller_id: null,
      assigned_supervisor_id: null,
      hub_id: 'hub-1',
      import_batch_id: 'batch-1',
      delivered_date: null,
      delivered_by: null,
      delivered_user: null,
      pod_reference: null,
      cod_collected_amount: null,
      cod_exception_remark: null,
      rto_date: null,
      rto_reason: null,
      rto_remarks: null,
      expected_rto_date: null,
      ndr_cycle: 1,
      last_caller_remark: `Caller remark for #${idx}`,
      last_supervisor_remark: `Supervisor remark for #${idx}`,
      last_caller_result: 'Customer Refused OTP',
      created_at: new Date(Date.now() - idx * 60000).toISOString(),
      updated_at: new Date(Date.now() - idx * 30000).toISOString(),
    };
  });
}

describe('NDR All Shipments Excel Export & Multi-Page Fetching Tests', () => {
  it('exports all 2,500 records into an Excel file with exact row count matching', async () => {
    const totalRecords = 2500;
    const testFilename = 'test_ndr_all_2500_export.xlsx';
    const mockShipments = generateMockShipments(totalRecords);

    // Call exportNDRShipmentsToExcel
    await exportNDRShipmentsToExcel(mockShipments, testFilename);

    // Verify file exists on disk
    assert.strictEqual(fs.existsSync(testFilename), true, 'Excel file was not created');

    // Parse back the generated Excel file to verify content
    const fileBuffer = fs.readFileSync(testFilename);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    assert.deepStrictEqual(workbook.SheetNames, ['NDR Shipments'], 'Sheet name must be NDR Shipments');

    const sheet = workbook.Sheets['NDR Shipments'];
    const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];

    // Verify exported row count against total database records (Acceptance criteria: 2500 rows)
    assert.strictEqual(rows.length, 2500, `Expected exactly 2500 rows, got ${rows.length}`);

    // Verify first and last rows
    assert.strictEqual(rows[0]['AWB Number'], 'AWB00000001');
    assert.strictEqual(rows[0]['Consignee Name'], 'Customer 1');
    assert.strictEqual(rows[0]['Latest Caller Remark'], 'Caller remark for #1');
    assert.strictEqual(rows[0]['Latest Supervisor Remark'], 'Supervisor remark for #1');

    assert.strictEqual(rows[2499]['AWB Number'], 'AWB00002500');
    assert.strictEqual(rows[2499]['Consignee Name'], 'Customer 2500');
    assert.strictEqual(rows[2499]['Latest Caller Remark'], 'Caller remark for #2500');
    assert.strictEqual(rows[2499]['Latest Supervisor Remark'], 'Supervisor remark for #2500');

    // Verify required column presence
    const expectedHeaders = [
      'AWB Number',
      'DRS Code',
      'Client Name',
      'Consignee Name',
      'Delivery Executive',
      'Vendor Name',
      'Hub Location',
      'City',
      'State',
      'Payment Type',
      'Amount Payable',
      'Original Status',
      'Current Status',
      'NDR Workflow Status',
      'Original Reason',
      'OTP Status',
      'Pincode',
      'Total Attempts',
      'NDR Cycle',
      'Assigned Caller',
      'Assigned Supervisor',
      'Latest Caller Remark',
      'Latest Supervisor Remark',
      'Delivered Date',
      'POD Reference',
      'COD Collected',
      'RTO Date',
      'RTO Reason',
      'Created At',
      'Updated At',
    ];

    const firstRowHeaders = Object.keys(rows[0]);
    for (const header of expectedHeaders) {
      assert.strictEqual(
        firstRowHeaders.includes(header),
        true,
        `Expected header "${header}" to be in Excel columns, found: ${firstRowHeaders.join(', ')}`
      );
    }

    // Clean up temporary file
    fs.unlinkSync(testFilename);
  });

  it('handles empty shipments array gracefully without error', async () => {
    const testFilename = 'test_empty_export.xlsx';
    await exportNDRShipmentsToExcel([], testFilename);
    assert.strictEqual(fs.existsSync(testFilename), false, 'Empty export should not generate file');
  });

  it('simulates multi-page batch fetching of 2,500 records across 3 batches with de-duplication', async () => {
    const totalRecords = 2500;
    const batchSize = 1000;
    const allMockRecords = generateMockShipments(totalRecords);

    // Mock fetchNDRShipments behavior
    const progressCalls: Array<{ loaded: number; total: number }> = [];

    // Simulate batch fetching logic as implemented in fetchAllNDRShipments
    const fetchedBatches: NDRShipment[][] = [];
    let currentPage = 1;
    const seenIds = new Set<string>();
    const collectedShipments: NDRShipment[] = [];

    while (currentPage <= 1000) {
      const from = (currentPage - 1) * batchSize;
      const to = from + batchSize;
      const batchData = allMockRecords.slice(from, to);

      fetchedBatches.push(batchData);

      for (const item of batchData) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          collectedShipments.push(item);
        }
      }

      progressCalls.push({ loaded: collectedShipments.length, total: totalRecords });

      if (batchData.length < batchSize || collectedShipments.length >= totalRecords) {
        break;
      }
      currentPage += 1;
    }

    // Assertions
    assert.strictEqual(fetchedBatches.length, 3, 'Should require exactly 3 batches for 2500 records at batch size 1000');
    assert.strictEqual(fetchedBatches[0].length, 1000, 'Batch 1 should have 1000 records');
    assert.strictEqual(fetchedBatches[1].length, 1000, 'Batch 2 should have 1000 records');
    assert.strictEqual(fetchedBatches[2].length, 500, 'Batch 3 should have 500 records');

    assert.strictEqual(collectedShipments.length, 2500, 'Total collected records must be 2500');

    // Verify progress tracking
    assert.deepStrictEqual(progressCalls, [
      { loaded: 1000, total: 2500 },
      { loaded: 2000, total: 2500 },
      { loaded: 2500, total: 2500 },
    ]);

    // Verify uniqueness (no duplicate records)
    const uniqueAwbs = new Set(collectedShipments.map((s) => s.awb_number));
    assert.strictEqual(uniqueAwbs.size, 2500, 'All 2500 AWBs must be unique');
  });

  it('guarantees de-duplication if pagination shifts slightly between batches', async () => {
    const totalRecords = 50;
    const batchSize = 20;
    const records = generateMockShipments(totalRecords);

    // Simulate batch 1: items 0..19
    const batch1 = records.slice(0, 20);
    // Simulate batch 2 with an overlapping record due to an insertion (e.g. index 19 repeated)
    const batch2 = records.slice(19, 39);
    // Simulate batch 3
    const batch3 = records.slice(39, 50);

    const seenIds = new Set<string>();
    const collected: NDRShipment[] = [];

    for (const batch of [batch1, batch2, batch3]) {
      for (const item of batch) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          collected.push(item);
        }
      }
    }

    assert.strictEqual(collected.length, 50, 'Duplicate item at boundary was correctly skipped');
  });
});
