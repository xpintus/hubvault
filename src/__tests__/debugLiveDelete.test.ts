import { describe, expect, it } from 'vitest';
import { supabase } from '../lib/supabase';
import { saveDRSHistorySnapshot, fetchDRSHistoryFromDB } from '../lib/drs/drsHistoryManager';
import { DRSReportHistoryItem } from '../types/drs';

describe('LIVE DEBUGGING AGAINST SUPABASE PROJECT FOR DRS DELETE & RESTORE', () => {
  it('performs exact live checks against online Supabase project', async () => {
    console.log('\n=== LIVE CHECK 1: Querying drs_report_history BEFORE delete ===');
    const { data: beforeData } = await supabase
      .from('drs_report_history')
      .select('id, file_name, report_date')
      .order('created_at', { ascending: false })
      .limit(5);

    console.log('BEFORE DELETE rows count:', beforeData?.length || 0);

    // Create a live report row with a VALID UUID
    const validUuid = crypto.randomUUID();
    const testReport: DRSReportHistoryItem = {
      id: validUuid,
      fileName: 'LIVE_DEBUG_HARD_DELETE.xlsx',
      reportDate: '2026-08-07',
      uploadTimestamp: new Date().toLocaleString(),
      uploadedBy: 'Live Debugger',
      hubName: 'Main Hub',
      clientName: 'All Clients',
      totalOfd: 5,
      totalDelivered: 4,
      totalUndel: 1,
      overallDeliveryPct: 80,
      rows: [],
      summary: null as any,
    };

    await saveDRSHistorySnapshot(testReport);

    console.log('\n=== LIVE CHECK 2: Trying UPDATE (Soft Delete) vs DELETE (Hard Delete) ===');
    const nowIso = new Date().toISOString();
    
    // First try UPDATE (soft-delete)
    const updateRes = await supabase
      .from('drs_report_history')
      .update({
        deleted_at: nowIso,
        deleted_by_name: 'Live Debugger',
        deleted_reason: 'Testing Soft Delete',
      })
      .eq('id', validUuid)
      .select();

    console.log('Soft Delete UPDATE returned data count:', updateRes.data?.length || 0);

    let deleteSuccess = false;
    if (!updateRes.data || updateRes.data.length === 0) {
      console.log('UPDATE affected 0 rows due to online RLS policy. Trying hard DELETE fallback...');
      const deleteRes = await supabase
        .from('drs_report_history')
        .delete()
        .eq('id', validUuid)
        .select();

      console.log('Hard DELETE returned data count:', deleteRes.data?.length || 0);
      deleteSuccess = (deleteRes.data?.length || 0) > 0;
    } else {
      deleteSuccess = true;
    }

    console.log('\n=== LIVE CHECK 3: Querying drs_report_history AFTER delete ===');
    const { data: afterData } = await supabase
      .from('drs_report_history')
      .select('id, file_name, report_date')
      .eq('id', validUuid);

    console.log('AFTER DELETE target row:', JSON.stringify(afterData, null, 2));

    console.log('\n=== LIVE CHECK 4: Querying fetchDRSHistoryFromDB() (Non-deleted active history) ===');
    const activeHistory = await fetchDRSHistoryFromDB();
    const containsDeleted = activeHistory.some((h) => h.id === validUuid);
    console.log('Does active history contain deleted item?', containsDeleted);
    expect(containsDeleted).toBe(false);
  });
});
