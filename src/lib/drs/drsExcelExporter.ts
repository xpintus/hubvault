import { DRSReportRow, EmployeeDRSMetrics, OverallDRSSummary } from '@/types/drs';
import * as XLSX from 'xlsx';

export function exportDRSPerformanceWorkbook(
  summary: OverallDRSSummary,
  employeeMetrics: EmployeeDRSMetrics[],
  uniqueRows: DRSReportRow[],
  duplicateRows: DRSReportRow[],
  invalidRows: DRSReportRow[],
  fileNamePrefix: string = 'DRS_Performance_Report'
): void {
  const wb = XLSX.utils.book_new();

  // 1. Sheet: DRS Summary
  const summaryData = [
    ['DRS PERFORMANCE OPERATIONAL SUMMARY REPORT'],
    ['Report Generated At', new Date().toLocaleString()],
    ['Source File Name', summary.fileName],
    ['Report Date', summary.reportDate || 'N/A'],
    [''],
    ['Metric', 'Value'],
    ['Total Rows in Source File', summary.totalRows],
    ['Valid Operational Rows', summary.validRows],
    ['Invalid Rows (Missing AWB)', summary.invalidRows],
    ['Unique Shipment AWBs (Total OFD)', summary.totalOfd],
    ['Duplicate AWB Records Consolidated', summary.duplicateRows],
    ['Total Delivery Executives / Employees', summary.totalEmployees],
    ['Total DRS Batches / Codes', summary.totalDrsCodes],
    [''],
    ['FIRST ATTEMPT METRICS (Attempt = 1)'],
    ['First Attempt OFD', summary.firstAttemptOfd],
    ['First Attempt Delivered', summary.firstAttemptDelivered],
    ['First Attempt UNDEL', summary.firstAttemptUndel],
    ['First Attempt Cancelled', summary.firstAttemptCancelled],
    ['First Attempt RTO', summary.firstAttemptRto],
    ['First Attempt Delivery Rate (%)', `${summary.firstAttemptDeliveryPct}%`],
    [''],
    ['REATTEMPT METRICS (Attempt >= 2)'],
    ['Reattempt OFD', summary.reattemptOfd],
    ['Reattempt Delivered', summary.reattemptDelivered],
    ['Reattempt UNDEL', summary.reattemptUndel],
    ['Reattempt Cancelled', summary.reattemptCancelled],
    ['Reattempt RTO', summary.reattemptRto],
    ['Reattempt Delivery Rate (%)', `${summary.reattemptDeliveryPct}%`],
    ['Attempt 2 Delivered', summary.attempt2Delivered],
    ['Attempt 3 Delivered', summary.attempt3Delivered],
    ['Attempt 4+ Delivered', summary.attempt4PlusDelivered],
    [''],
    ['TOTAL OVERALL METRICS'],
    ['Total OFD Shipments', summary.totalOfd],
    ['Total Delivered Shipments', summary.totalDelivered],
    ['Total UNDEL Shipments', summary.totalUndel],
    ['Total Cancelled Shipments', summary.totalCancelled],
    ['Total RTO Shipments', summary.totalRto],
    ['Overall Delivery Rate (%)', `${summary.overallDeliveryPct}%`],
    ['First Attempt Contribution (%)', `${summary.firstAttemptContributionPct}%`],
    ['Reattempt Contribution (%)', `${summary.reattemptContributionPct}%`],
    ['Total COD Value (₹)', summary.totalCodValue],
    ['Delivered COD Value (₹)', summary.deliveredCodValue],
    ['Average Attempts Per Shipment', summary.averageAttempts],
    ['Maximum Attempts Made', summary.maximumAttempts],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'DRS Summary');

  // Helper for converting objects to worksheet with formatting
  const addFormattedSheet = (sheetName: string, data: Record<string, unknown>[]) => {
    if (!data || data.length === 0) {
      const wsEmpty = XLSX.utils.aoa_to_sheet([['No data available for this report section']]);
      XLSX.utils.book_append_sheet(wb, wsEmpty, sheetName);
      return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  };

  // 2. Sheet: Employee Wise Report
  const empSheetData = employeeMetrics.map((e, idx) => ({
    'SR No': idx + 1,
    'Employee Name': e.employee_name,
    'Total OFD': e.total_ofd,
    '1st Attempt OFD': e.first_attempt_ofd,
    '1st Attempt Delivered': e.first_attempt_delivered,
    '1st Attempt UNDEL': e.first_attempt_undel,
    '1st Attempt Delivery %': `${e.first_attempt_delivery_pct}%`,
    'Reattempt OFD': e.reattempt_ofd,
    'Reattempt Delivered': e.reattempt_delivered,
    'Reattempt UNDEL': e.reattempt_undel,
    'Reattempt Delivery %': `${e.reattempt_delivery_pct}%`,
    'Total Delivered': e.total_delivered,
    'Total UNDEL': e.total_undel,
    Cancelled: e.total_cancelled,
    RTO: e.total_rto,
    'Overall Delivery %': `${e.overall_delivery_pct}%`,
    'COD Count': e.cod_shipments_count,
    'Prepaid Count': e.prepaid_shipments_count,
    'COD Value (₹)': e.cod_value_total,
    'COD Value Delivered (₹)': e.cod_value_delivered,
    'Avg Attempts': e.average_attempts,
    'Max Attempts': e.maximum_attempts,
  }));
  addFormattedSheet('Employee Wise Report', empSheetData);

  // 3. Sheet: First Attempt Report
  const firstAttemptData = [...employeeMetrics]
    .sort((a, b) => b.first_attempt_delivery_pct - a.first_attempt_delivery_pct)
    .map((e, idx) => ({
      Rank: idx + 1,
      'Employee Name': e.employee_name,
      'Total 1st Attempt OFD': e.first_attempt_ofd,
      '1st Attempt Delivered': e.first_attempt_delivered,
      '1st Attempt UNDEL': e.first_attempt_undel,
      '1st Attempt Cancelled': e.first_attempt_cancelled,
      '1st Attempt RTO': e.first_attempt_rto,
      '1st Attempt Delivery %': `${e.first_attempt_delivery_pct}%`,
    }));
  addFormattedSheet('First Attempt Report', firstAttemptData);

  // 4. Sheet: Reattempt Report
  const reattemptData = [...employeeMetrics]
    .sort((a, b) => b.reattempt_delivery_pct - a.reattempt_delivery_pct)
    .map((e, idx) => ({
      Rank: idx + 1,
      'Employee Name': e.employee_name,
      'Total Reattempt OFD': e.reattempt_ofd,
      'Reattempt Delivered': e.reattempt_delivered,
      'Reattempt UNDEL': e.reattempt_undel,
      'Reattempt Cancelled': e.reattempt_cancelled,
      'Reattempt RTO': e.reattempt_rto,
      'Reattempt Delivery %': `${e.reattempt_delivery_pct}%`,
      'Attempt 2 Delivered': e.attempt_2_delivered,
      'Attempt 3 Delivered': e.attempt_3_delivered,
      'Attempt 4+ Delivered': e.attempt_4plus_delivered,
      'Average Attempts': e.average_attempts,
    }));
  addFormattedSheet('Reattempt Report', reattemptData);

  // 5. Sheet: Total Delivery Report
  const totalDeliveryData = [...employeeMetrics]
    .sort((a, b) => b.total_delivered - a.total_delivered)
    .map((e, idx) => ({
      Rank: idx + 1,
      'Employee Name': e.employee_name,
      'Total OFD': e.total_ofd,
      'Total Delivered': e.total_delivered,
      'Total UNDEL': e.total_undel,
      Cancelled: e.total_cancelled,
      RTO: e.total_rto,
      '1st Attempt Delivered': e.first_attempt_delivered,
      'Reattempt Delivered': e.reattempt_delivered,
      'Overall Delivery %': `${e.overall_delivery_pct}%`,
      '1st Attempt Contribution %': `${e.first_attempt_contribution_pct}%`,
      'Reattempt Contribution %': `${e.reattempt_contribution_pct}%`,
      'COD Value Delivered (₹)': e.cod_value_delivered,
    }));
  addFormattedSheet('Total Delivery Report', totalDeliveryData);

  // Helper for shipment row formatting
  const mapShipmentRow = (r: DRSReportRow) => ({
    'AWB Number': r.waybill_no,
    'DRS Code': r.drs_code,
    Employee: r.employee_name,
    Customer: r.consignee,
    Client: r.customer_name,
    Status: r.shipment_status_normalized,
    Attempts: r.total_attempts,
    'Attempt Type': r.total_attempts <= 1 ? 'Fresh (Attempt 1)' : `Reattempt (Attempt ${r.total_attempts})`,
    'NDR Reason': r.reason,
    'OTP Status': r.otp_details,
    'Amount (₹)': r.amount_payable,
    'Payment Type': r.payment_type,
    Pincode: r.delivery_pincode,
    City: r.city,
    'DRS Date': r.drs_date,
    'Last Attempt Date': r.last_attempt_date || r.pod_date,
  });

  // 6. Delivered Shipments
  const deliveredRows = uniqueRows.filter((r) => r.shipment_status_normalized === 'Delivered').map(mapShipmentRow);
  addFormattedSheet('Delivered Shipments', deliveredRows);

  // 7. UNDEL Shipments
  const undelRows = uniqueRows.filter((r) => r.shipment_status_normalized === 'Undelivered').map(mapShipmentRow);
  addFormattedSheet('UNDEL Shipments', undelRows);

  // 8. Cancelled Shipments
  const cancelledRows = uniqueRows.filter((r) => r.shipment_status_normalized === 'Cancelled').map(mapShipmentRow);
  addFormattedSheet('Cancelled Shipments', cancelledRows);

  // 9. RTO Shipments
  const rtoRows = uniqueRows.filter((r) => r.shipment_status_normalized === 'RTO').map(mapShipmentRow);
  addFormattedSheet('RTO Shipments', rtoRows);

  // 10. Duplicate Rows
  const dupRows = duplicateRows.map((r) => ({
    'Source Row Index': r.rowIndex,
    'AWB Number': r.waybill_no,
    Employee: r.employee_name,
    Status: r.shipment_status_normalized,
    Attempts: r.total_attempts,
    'DRS Code': r.drs_code,
    Reason: r.reason,
    'Duplicate Occurrence Count': r.duplicate_count,
  }));
  addFormattedSheet('Duplicate Rows', dupRows);

  // 11. Invalid Rows
  const invRows = invalidRows.map((r) => ({
    'Source Row Index': r.rowIndex,
    'Invalid Reason': r.invalid_reason || 'Missing AWB',
    'Raw Status': r.shipment_status_raw,
    Employee: r.employee_name,
    'DRS Code': r.drs_code,
  }));
  addFormattedSheet('Invalid Rows', invRows);

  // Download Workbook
  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `${fileNamePrefix}_${dateStr}.xlsx`);
}
