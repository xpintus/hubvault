import { buildRTOPreAlertMail, parseRTOPreAlertFile } from '@/lib/rtoPreAlert';
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';

function file(rows: Record<string, unknown>[]) {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'RTO');
  const data = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return new File([data], 'rto.xlsx');
}

describe('RTO pre-alert mail', () => {
  it('groups unique AWBs by bag id', async () => {
    const result = await parseRTOPreAlertFile(file([
      { 'Bag ID': 'BAG-01', AWB: 'A1' },
      { 'Bag ID': 'BAG-01', AWB: 'A2' },
      { 'Bag ID': 'BAG-01', AWB: 'A2' },
      { 'Bag ID': 'BAG-02', AWB: 'A3' },
    ]));
    expect(result.totalShipments).toBe(3);
    expect(result.bags).toEqual([
      { bagId: 'BAG-01', shipmentCount: 2, awbs: ['A1', 'A2'] },
      { bagId: 'BAG-02', shipmentCount: 1, awbs: ['A3'] },
    ]);
  });

  it('generates bag ids and counts in the mail', async () => {
    const result = await parseRTOPreAlertFile(file([{ 'Bag No': 'RTO-9', 'Waybill No': 'AWB-1' }]));
    const mail = buildRTOPreAlertMail({ result, hubName: 'Valmo-JDG', dispatchDate: '2026-08-12', recipientName: 'RTO Team', remarks: 'Seal verified' });
    expect(mail.subject).toContain('Valmo-JDG');
    expect(mail.body).toContain('Bag ID: RTO-9 — 1 shipment');
    expect(mail.body).toContain('Seal verified');
  });
});
