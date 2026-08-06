import {
  ClientDRSMetrics,
  DRSReportRow,
  EmployeeDRSMetrics,
  NDRReasonMetrics,
  OverallDRSSummary,
  PaymentAnalyticsMetrics,
  RTOAnalyticsMetrics,
} from '@/types/drs';
import * as XLSX from 'xlsx';

export function exportDRSPerformanceWorkbook(
  summary: OverallDRSSummary,
  employeeMetrics: EmployeeDRSMetrics[],
  clientMetrics: ClientDRSMetrics[],
  paymentMetrics: PaymentAnalyticsMetrics,
  reasonMetrics: NDRReasonMetrics[],
  rtoMetrics: RTOAnalyticsMetrics[],
  uniqueRows: DRSReportRow[],
  duplicateRows: DRSReportRow[],
  invalidRows: DRSReportRow[],
  fileNamePrefix: string = 'DRS_Performance_Enterprise_Report'
): void {
  const wb = XLSX.utils.book_new();

  // Helper for adding formatted json worksheet
  const addSheet = (name: string, data: Record<string, unknown>[]) => {
    if (!data || data.length === 0) {
      const wsEmpty = XLSX.utils.aoa_to_sheet([['No data available for this section']]);
      XLSX.utils.book_append_sheet(wb, wsEmpty, name);
      return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, name);
  };

  // 1. Overview Sheet
  const summaryAoa = [
    ['HUBVAULT DRS PERFORMANCE ENTERPRISE LOGISTICS REPORT'],
    ['Generated At', new Date().toLocaleString()],
    ['Source File', summary.fileName],
    ['Report Date', summary.reportDate || 'N/A'],
    [''],
    ['Metric Description', 'Value'],
    ['Total Rows in File', summary.totalRows],
    ['Valid Operational Rows', summary.validRows],
    ['Invalid Rows (Missing AWB)', summary.invalidRows],
    ['Unique Shipment AWBs (Total OFD)', summary.totalOfd],
    ['Duplicate AWBs Consolidated', summary.duplicateRows],
    ['Total Delivery Executives', summary.totalEmployees],
    ['Total DRS Codes', summary.totalDrsCodes],
    [''],
    ['DELIVERY PERFORMANCE METRICS'],
    ['Total Delivered Shipments', summary.totalDelivered],
    ['Total UNDEL Shipments', summary.totalUndel],
    ['Total Cancelled Shipments', summary.totalCancelled],
    ['Total RTO Shipments', summary.totalRto],
    ['Overall Delivery Rate (%)', `${summary.overallDeliveryPct}%`],
    [''],
    ['FIRST ATTEMPT METRICS (Attempt = 1)'],
    ['1st Attempt OFD', summary.firstAttemptOfd],
    ['1st Attempt Delivered', summary.firstAttemptDelivered],
    ['1st Attempt Delivery Rate (%)', `${summary.firstAttemptDeliveryPct}%`],
    ['1st Attempt Contribution (%)', `${summary.firstAttemptContributionPct}%`],
    [''],
    ['REATTEMPT METRICS (Attempt >= 2)'],
    ['Reattempt OFD', summary.reattemptOfd],
    ['Reattempt Delivered', summary.reattemptDelivered],
    ['Reattempt Delivery Rate (%)', `${summary.reattemptDeliveryPct}%`],
    ['Reattempt Contribution (%)', `${summary.reattemptContributionPct}%`],
    [''],
    ['PAYMENT METRICS'],
    ['COD Total OFD', paymentMetrics.codOfd],
    ['COD Delivered', paymentMetrics.codDelivered],
    ['COD Delivery Rate (%)', `${paymentMetrics.codDeliveryPct}%`],
    ['COD Total Amount (₹)', paymentMetrics.codTotalAmount],
    ['COD Delivered Amount (₹)', paymentMetrics.codDeliveredAmount],
    ['Prepaid Total OFD', paymentMetrics.prepaidOfd],
    ['Prepaid Delivered', paymentMetrics.prepaidDelivered],
    ['Prepaid Delivery Rate (%)', `${paymentMetrics.prepaidDeliveryPct}%`],
    ['Prepaid Amount (₹)', paymentMetrics.prepaidTotalAmount],
  ];

  const wsOverview = XLSX.utils.aoa_to_sheet(summaryAoa);
  XLSX.utils.book_append_sheet(wb, wsOverview, 'Overview');

  // 2. Employee Report Sheet
  addSheet(
    'Employee Report',
    employeeMetrics.map((e, idx) => ({
      Rank: idx + 1,
      Employee: e.employee_name,
      'Total OFD': e.total_ofd,
      '1st OFD': e.first_attempt_ofd,
      '1st DEL': e.first_attempt_delivered,
      '1st Rate (%)': `${e.first_attempt_delivery_pct}%`,
      'Re OFD': e.reattempt_ofd,
      'Re DEL': e.reattempt_delivered,
      'Re Rate (%)': `${e.reattempt_delivery_pct}%`,
      'Total DEL': e.total_delivered,
      UNDEL: e.total_undel,
      RTO: e.total_rto,
      Cancel: e.total_cancelled,
      'Overall Rate (%)': `${e.overall_delivery_pct}%`,
      'COD OFD': e.cod_ofd,
      'COD DEL': e.cod_delivered,
      'COD Rate (%)': `${e.cod_delivery_pct}%`,
      'Prepaid OFD': e.prepaid_ofd,
      'Prepaid DEL': e.prepaid_delivered,
      'Prepaid Rate (%)': `${e.prepaid_delivery_pct}%`,
      'COD Amount (₹)': e.cod_value_total,
    }))
  );

  // 3. First Attempt Report
  addSheet(
    'First Attempt Report',
    [...employeeMetrics]
      .sort((a, b) => b.first_attempt_delivery_pct - a.first_attempt_delivery_pct)
      .map((e, idx) => ({
        Rank: idx + 1,
        Employee: e.employee_name,
        '1st OFD': e.first_attempt_ofd,
        '1st DEL': e.first_attempt_delivered,
        '1st UNDEL': e.first_attempt_undel,
        '1st RTO': e.first_attempt_rto,
        '1st Cancel': e.first_attempt_cancelled,
        '1st Delivery %': `${e.first_attempt_delivery_pct}%`,
        'COD Count': e.cod_ofd,
        'Prepaid Count': e.prepaid_ofd,
      }))
  );

  // 4. Reattempt Report
  addSheet(
    'Reattempt Report',
    [...employeeMetrics]
      .sort((a, b) => b.reattempt_delivery_pct - a.reattempt_delivery_pct)
      .map((e, idx) => ({
        Rank: idx + 1,
        Employee: e.employee_name,
        'Reattempt OFD': e.reattempt_ofd,
        'Reattempt DEL': e.reattempt_delivered,
        'Reattempt UNDEL': e.reattempt_undel,
        'Attempt 2 DEL': e.attempt_2_delivered,
        'Attempt 3 DEL': e.attempt_3_delivered,
        'Attempt 4+ DEL': e.attempt_4plus_delivered,
        'Reattempt Delivery %': `${e.reattempt_delivery_pct}%`,
        'Avg Attempts': e.average_attempts,
        'Max Attempt': e.maximum_attempts,
      }))
  );

  // 5. Total Delivery Report
  addSheet(
    'Total Delivery Report',
    [...employeeMetrics]
      .sort((a, b) => b.total_delivered - a.total_delivered)
      .map((e, idx) => ({
        Rank: idx + 1,
        Employee: e.employee_name,
        'Total OFD': e.total_ofd,
        'Total DEL': e.total_delivered,
        UNDEL: e.total_undel,
        RTO: e.total_rto,
        Cancel: e.total_cancelled,
        'Overall Delivery %': `${e.overall_delivery_pct}%`,
        'COD DEL': e.cod_delivered,
        'Prepaid DEL': e.prepaid_delivered,
      }))
  );

  // 6. COD Report
  addSheet(
    'COD Report',
    [...employeeMetrics]
      .sort((a, b) => b.cod_ofd - a.cod_ofd)
      .map((e, idx) => ({
        Rank: idx + 1,
        Employee: e.employee_name,
        'COD OFD': e.cod_ofd,
        'COD DEL': e.cod_delivered,
        'COD Pending': e.cod_pending,
        'COD Delivery %': `${e.cod_delivery_pct}%`,
        'COD Amount Total (₹)': e.cod_value_total,
        'COD Amount Collected (₹)': e.cod_value_delivered,
      }))
  );

  // 7. Prepaid Report
  addSheet(
    'Prepaid Report',
    [...employeeMetrics]
      .sort((a, b) => b.prepaid_ofd - a.prepaid_ofd)
      .map((e, idx) => ({
        Rank: idx + 1,
        Employee: e.employee_name,
        'Prepaid OFD': e.prepaid_ofd,
        'Prepaid DEL': e.prepaid_delivered,
        'Prepaid Pending': e.prepaid_pending,
        'Prepaid Delivery %': `${e.prepaid_delivery_pct}%`,
        'Prepaid Amount (₹)': e.prepaid_amount_total,
      }))
  );

  // 8. Client Report
  addSheet(
    'Client Report',
    clientMetrics.map((c, idx) => ({
      Rank: idx + 1,
      'Client Name': c.client_name,
      'Total OFD': c.total_ofd,
      'Total DEL': c.total_delivered,
      UNDEL: c.total_undel,
      RTO: c.total_rto,
      'Overall Delivery %': `${c.overall_delivery_pct}%`,
      'COD OFD': c.cod_ofd,
      'COD DEL': c.cod_delivered,
      'COD Rate (%)': `${c.cod_delivery_pct}%`,
      'COD Value (₹)': c.cod_value_total,
      'Prepaid OFD': c.prepaid_ofd,
      'Prepaid DEL': c.prepaid_delivered,
      'Prepaid Rate (%)': `${c.prepaid_delivery_pct}%`,
    }))
  );

  // 9. UNDEL Analysis
  addSheet(
    'UNDEL Analysis',
    reasonMetrics.map((r, idx) => ({
      Rank: idx + 1,
      'NDR Reason': r.reason,
      'UNDEL Count': r.count,
      'Share (%)': `${r.percentage}%`,
      'Top Executive Affected': r.affectedExecutives[0]?.name || 'N/A',
      'Top Exec Fail Count': r.affectedExecutives[0]?.count || 0,
    }))
  );

  // 10. RTO Analysis
  addSheet(
    'RTO Analysis',
    rtoMetrics.map((r, idx) => ({
      Rank: idx + 1,
      'RTO Reason': r.reason,
      'RTO Count': r.count,
      'Share (%)': `${r.percentage}%`,
      'Top Executive Affected': r.affectedExecutives[0]?.name || 'N/A',
    }))
  );

  // Helper shipment row mapping
  const mapShipmentRow = (r: DRSReportRow) => ({
    AWB: r.waybill_no,
    'DRS Code': r.drs_code,
    Employee: r.employee_name,
    Customer: r.consignee,
    Client: r.customer_name,
    Status: r.shipment_status_normalized,
    Attempts: r.total_attempts,
    Reason: r.reason,
    OTP: r.otp_details,
    'Amount (₹)': r.amount_payable,
    'Payment Type': r.payment_type,
    Pincode: r.delivery_pincode,
    City: r.city,
    'DRS Date': r.drs_date,
  });

  // 11. Delivered Shipments
  addSheet('Delivered Shipments', uniqueRows.filter((r) => r.shipment_status_normalized === 'Delivered').map(mapShipmentRow));

  // 12. UNDEL Shipments
  addSheet('UNDEL Shipments', uniqueRows.filter((r) => r.shipment_status_normalized === 'Undelivered').map(mapShipmentRow));

  // 13. Duplicate Rows
  addSheet(
    'Duplicate Rows',
    duplicateRows.map((r) => ({
      'Row Index': r.rowIndex,
      AWB: r.waybill_no,
      Employee: r.employee_name,
      Status: r.shipment_status_normalized,
      Attempts: r.total_attempts,
      'DRS Code': r.drs_code,
      Reason: r.reason,
      Occurrences: r.duplicate_count,
    }))
  );

  // 14. Invalid Rows
  addSheet(
    'Invalid Rows',
    invalidRows.map((r) => ({
      'Row Index': r.rowIndex,
      Reason: r.invalid_reason || 'Missing AWB',
      'Raw Status': r.shipment_status_raw,
      Employee: r.employee_name,
    }))
  );

  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `${fileNamePrefix}_${dateStr}.xlsx`);
}
