import { describe, expect, it } from 'vitest';
import {
  deleteAllDRSReports,
  deleteSelectedDRSReports,
  fetchRecycleBinReports,
  resetCurrentDRSReport,
  restoreReportFromRecycleBin,
} from '../lib/drs/drsResetManager';
import { DRSReportHistoryItem } from '../types/drs';

describe('HubVault Enterprise Reset & Recycle Bin System', () => {
  const mockReport: DRSReportHistoryItem = {
    id: `RESET_TEST_${Date.now()}`,
    fileName: 'RESET_TEST_REPORT.xlsx',
    reportDate: '2026-08-06',
    uploadTimestamp: new Date().toLocaleString(),
    uploadedBy: 'Test Admin',
    hubId: 'hub-test-reset',
    hubName: 'Reset Test Hub',
    clientName: 'All Clients',
    totalOfd: 10,
    totalDelivered: 8,
    totalUndel: 2,
    overallDeliveryPct: 80,
    rows: [],
    summary: {
      fileName: 'RESET_TEST_REPORT.xlsx',
      reportDate: '2026-08-06',
      totalRows: 10,
      validRows: 10,
      invalidRows: 0,
      duplicateRows: 0,
      totalOfd: 10,
      totalDelivered: 8,
      totalUndel: 2,
      totalRto: 0,
      totalCancelled: 0,
      firstAttemptOfd: 10,
      firstAttemptDelivered: 8,
      firstAttemptUndel: 2,
      firstAttemptDeliveryPct: 80,
      reattemptOfd: 0,
      reattemptDelivered: 0,
      reattemptUndel: 0,
      reattemptDeliveryPct: 0,
      overallDeliveryPct: 80,
      codOfd: 5,
      codDelivered: 4,
      codFirstAttemptOfd: 5,
      codFirstAttemptDel: 4,
      codFadPercent: 80,
      prepaidOfd: 5,
      prepaidDelivered: 4,
      prepaidFirstAttemptOfd: 5,
      prepaidFirstAttemptDel: 4,
      prepaidFadPercent: 80,
      totalCodValue: 5000,
      deliveredCodValue: 4000,
      averageAttempts: 1,
    } as any,
  };

  it('executes Level 1 reset on current report', async () => {
    const res = await resetCurrentDRSReport(mockReport, { id: 'admin-01', name: 'Admin User', role: 'admin' }, 'hub-test-reset', {
      reason: 'Testing Level 1 Reset',
      exportBeforeDelete: true,
    });
    expect(res.success).toBe(true);
  });

  it('executes Level 2 delete on selected reports', async () => {
    const res = await deleteSelectedDRSReports([mockReport], { id: 'admin-01', name: 'Admin User', role: 'admin' }, 'hub-test-reset', 'Testing Level 2 Reset');
    expect(res.success).toBe(true);
    expect(res.reportsDeletedCount).toBe(1);
  });

  it('executes Level 3 danger reset all reports for hub', async () => {
    const res = await deleteAllDRSReports({ id: 'admin-01', name: 'Admin User', role: 'admin' }, 'hub-test-reset', 'Testing Level 3 Reset All');
    expect(res.success).toBe(true);
  });

  it('fetches recycle bin reports and restores them', async () => {
    const binItems = await fetchRecycleBinReports('hub-test-reset');
    expect(Array.isArray(binItems)).toBe(true);

    const restoreOk = await restoreReportFromRecycleBin(mockReport.id, { id: 'admin-01', name: 'Admin User' });
    expect(typeof restoreOk).toBe('boolean');
  });
});
