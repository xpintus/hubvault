import {
  ClientDRSMetrics,
  DRSFilterOptions,
  DRSReportRow,
  EmployeeDRSMetrics,
  NDRReasonMetrics,
  OverallDRSSummary,
  PaymentAnalyticsMetrics,
  RTOAnalyticsMetrics,
} from '@/types/drs';

export function computeOverallDRSSummary(
  uniqueRows: DRSReportRow[],
  meta: {
    fileName: string;
    reportDate: string;
    totalRows: number;
    validRows: number;
    invalidRows: number;
    duplicateRows: number;
  }
): OverallDRSSummary {
  const totalOfd = uniqueRows.length;

  let firstAttemptOfd = 0;
  let firstAttemptDelivered = 0;
  let firstAttemptUndel = 0;
  let firstAttemptCancelled = 0;
  let firstAttemptRto = 0;

  let reattemptOfd = 0;
  let reattemptDelivered = 0;
  let reattemptUndel = 0;
  let reattemptCancelled = 0;
  let reattemptRto = 0;

  let attempt2Ofd = 0;
  let attempt2Delivered = 0;
  let attempt3Ofd = 0;
  let attempt3Delivered = 0;
  let attempt4PlusOfd = 0;
  let attempt4PlusDelivered = 0;

  let totalDelivered = 0;
  let totalUndel = 0;
  let totalCancelled = 0;
  let totalRto = 0;

  let codOfd = 0;
  let codDelivered = 0;
  let codFirstAttemptOfd = 0;
  let codFirstAttemptDel = 0;

  let prepaidOfd = 0;
  let prepaidDelivered = 0;
  let prepaidFirstAttemptOfd = 0;
  let prepaidFirstAttemptDel = 0;

  let totalCodValue = 0;
  let deliveredCodValue = 0;
  let sumAttempts = 0;
  let maximumAttempts = 0;

  const employeesSet = new Set<string>();
  const drsCodesSet = new Set<string>();

  uniqueRows.forEach((r) => {
    const attempts = r.total_attempts || 1;
    const status = r.shipment_status_normalized;
    const isCod = r.payment_type.toUpperCase().includes('COD');

    sumAttempts += attempts;
    if (attempts > maximumAttempts) maximumAttempts = attempts;

    if (r.employee_name) employeesSet.add(r.employee_name);
    if (r.drs_code) drsCodesSet.add(r.drs_code);

    if (isCod) {
      codOfd++;
      totalCodValue += r.amount_payable;
      if (status === 'Delivered') {
        codDelivered++;
        deliveredCodValue += r.amount_payable;
      }
      if (attempts <= 1) {
        codFirstAttemptOfd++;
        if (status === 'Delivered') codFirstAttemptDel++;
      }
    } else {
      prepaidOfd++;
      if (status === 'Delivered') prepaidDelivered++;
      if (attempts <= 1) {
        prepaidFirstAttemptOfd++;
        if (status === 'Delivered') prepaidFirstAttemptDel++;
      }
    }

    if (status === 'Delivered') {
      totalDelivered++;
    } else if (status === 'Undelivered') {
      totalUndel++;
    } else if (status === 'Cancelled') {
      totalCancelled++;
    } else if (status === 'RTO') {
      totalRto++;
    }

    // First Attempt (attempts <= 1) vs Reattempt (attempts >= 2)
    if (attempts <= 1) {
      firstAttemptOfd++;
      if (status === 'Delivered') firstAttemptDelivered++;
      else if (status === 'Undelivered') firstAttemptUndel++;
      else if (status === 'Cancelled') firstAttemptCancelled++;
      else if (status === 'RTO') firstAttemptRto++;
    } else {
      reattemptOfd++;
      if (status === 'Delivered') reattemptDelivered++;
      else if (status === 'Undelivered') reattemptUndel++;
      else if (status === 'Cancelled') reattemptCancelled++;
      else if (status === 'RTO') reattemptRto++;

      if (attempts === 2) {
        attempt2Ofd++;
        if (status === 'Delivered') attempt2Delivered++;
      } else if (attempts === 3) {
        attempt3Ofd++;
        if (status === 'Delivered') attempt3Delivered++;
      } else if (attempts >= 4) {
        attempt4PlusOfd++;
        if (status === 'Delivered') attempt4PlusDelivered++;
      }
    }
  });

  const firstAttemptDeliveryPct = firstAttemptOfd > 0 ? (firstAttemptDelivered / firstAttemptOfd) * 100 : 0;
  const reattemptDeliveryPct = reattemptOfd > 0 ? (reattemptDelivered / reattemptOfd) * 100 : 0;
  const overallDeliveryPct = totalOfd > 0 ? (totalDelivered / totalOfd) * 100 : 0;

  const firstAttemptContributionPct = totalDelivered > 0 ? (firstAttemptDelivered / totalDelivered) * 100 : 0;
  const reattemptContributionPct = totalDelivered > 0 ? (reattemptDelivered / totalDelivered) * 100 : 0;
  const averageAttempts = totalOfd > 0 ? sumAttempts / totalOfd : 0;

  // Bug 1 Fix: Safe division for COD & Prepaid FAD %
  const codFadPercent = codFirstAttemptOfd > 0 ? (codFirstAttemptDel / codFirstAttemptOfd) * 100 : 0;
  const prepaidFadPercent = prepaidFirstAttemptOfd > 0 ? (prepaidFirstAttemptDel / prepaidFirstAttemptOfd) * 100 : 0;

  return {
    fileName: meta.fileName,
    reportDate: meta.reportDate,
    totalRows: meta.totalRows,
    validRows: meta.validRows,
    invalidRows: meta.invalidRows,
    uniqueAwbs: totalOfd,
    duplicateRows: meta.duplicateRows,
    consolidatedRows: totalOfd,
    totalEmployees: employeesSet.size,
    totalDrsCodes: drsCodesSet.size,

    totalOfd,
    firstAttemptOfd,
    firstAttemptDelivered,
    firstAttemptUndel,
    firstAttemptCancelled,
    firstAttemptRto,
    firstAttemptDeliveryPct: Number(firstAttemptDeliveryPct.toFixed(2)),

    reattemptOfd,
    reattemptDelivered,
    reattemptUndel,
    reattemptCancelled,
    reattemptRto,
    reattemptDeliveryPct: Number(reattemptDeliveryPct.toFixed(2)),

    attempt2Ofd,
    attempt2Delivered,
    attempt3Ofd,
    attempt3Delivered,
    attempt4PlusOfd,
    attempt4PlusDelivered,

    totalDelivered,
    totalUndel,
    totalCancelled,
    totalRto,
    overallDeliveryPct: Number(overallDeliveryPct.toFixed(2)),

    firstAttemptContributionPct: Number(firstAttemptContributionPct.toFixed(2)),
    reattemptContributionPct: Number(reattemptContributionPct.toFixed(2)),

    totalCodValue,
    deliveredCodValue,
    averageAttempts: Number(averageAttempts.toFixed(2)),
    maximumAttempts,

    codOfd,
    codDelivered,
    codFirstAttemptOfd,
    codFirstAttemptDel,
    codFadPercent: Number(codFadPercent.toFixed(2)),

    prepaidOfd,
    prepaidDelivered,
    prepaidFirstAttemptOfd,
    prepaidFirstAttemptDel,
    prepaidFadPercent: Number(prepaidFadPercent.toFixed(2)),
  };
}

export function computeEmployeeDRSMetrics(uniqueRows: DRSReportRow[]): EmployeeDRSMetrics[] {
  const map = new Map<string, DRSReportRow[]>();

  uniqueRows.forEach((r) => {
    const emp = r.employee_name || 'Unassigned Executive';
    const list = map.get(emp) || [];
    list.push(r);
    map.set(emp, list);
  });

  const employeeMetrics: EmployeeDRSMetrics[] = [];

  map.forEach((rows, empName) => {
    const totalOfd = rows.length;
    let firstAttemptOfd = 0;
    let firstAttemptDelivered = 0;
    let firstAttemptUndel = 0;
    let firstAttemptCancelled = 0;
    let firstAttemptRto = 0;

    let reattemptOfd = 0;
    let reattemptDelivered = 0;
    let reattemptUndel = 0;
    let reattemptCancelled = 0;
    let reattemptRto = 0;

    let attempt_2_ofd = 0;
    let attempt_2_delivered = 0;
    let attempt_3_ofd = 0;
    let attempt_3_delivered = 0;
    let attempt_4plus_ofd = 0;
    let attempt_4plus_delivered = 0;

    let totalDelivered = 0;
    let totalUndel = 0;
    let totalCancelled = 0;
    let totalRto = 0;

    let codCount = 0;
    let codDelivered = 0;
    let codUndel = 0;
    let codFirstAttemptOfd = 0;
    let codFirstAttemptDel = 0;

    let prepaidCount = 0;
    let prepaidDelivered = 0;
    let prepaidUndel = 0;
    let prepaidAmountTotal = 0;
    let prepaidFirstAttemptOfd = 0;
    let prepaidFirstAttemptDel = 0;

    let codTotalValue = 0;
    let codDeliveredValue = 0;

    let sumAttempts = 0;
    let maxAttempts = 0;

    rows.forEach((r) => {
      const attempts = r.total_attempts || 1;
      const status = r.shipment_status_normalized;
      const isCod = r.payment_type.toUpperCase().includes('COD');

      sumAttempts += attempts;
      if (attempts > maxAttempts) maxAttempts = attempts;

      if (isCod) {
        codCount++;
        codTotalValue += r.amount_payable;
        if (status === 'Delivered') {
          codDelivered++;
          codDeliveredValue += r.amount_payable;
        } else if (status === 'Undelivered') {
          codUndel++;
        }
        if (attempts <= 1) {
          codFirstAttemptOfd++;
          if (status === 'Delivered') codFirstAttemptDel++;
        }
      } else {
        prepaidCount++;
        prepaidAmountTotal += r.amount_payable;
        if (status === 'Delivered') prepaidDelivered++;
        else if (status === 'Undelivered') prepaidUndel++;
        if (attempts <= 1) {
          prepaidFirstAttemptOfd++;
          if (status === 'Delivered') prepaidFirstAttemptDel++;
        }
      }

      if (status === 'Delivered') {
        totalDelivered++;
      } else if (status === 'Undelivered') {
        totalUndel++;
      } else if (status === 'Cancelled') {
        totalCancelled++;
      } else if (status === 'RTO') {
        totalRto++;
      }

      if (attempts <= 1) {
        firstAttemptOfd++;
        if (status === 'Delivered') firstAttemptDelivered++;
        else if (status === 'Undelivered') firstAttemptUndel++;
        else if (status === 'Cancelled') firstAttemptCancelled++;
        else if (status === 'RTO') firstAttemptRto++;
      } else {
        reattemptOfd++;
        if (status === 'Delivered') reattemptDelivered++;
        else if (status === 'Undelivered') reattemptUndel++;
        else if (status === 'Cancelled') reattemptCancelled++;
        else if (status === 'RTO') reattemptRto++;

        if (attempts === 2) {
          attempt_2_ofd++;
          if (status === 'Delivered') attempt_2_delivered++;
        } else if (attempts === 3) {
          attempt_3_ofd++;
          if (status === 'Delivered') attempt_3_delivered++;
        } else if (attempts >= 4) {
          attempt_4plus_ofd++;
          if (status === 'Delivered') attempt_4plus_delivered++;
        }
      }
    });

    const firstAttemptDeliveryPct = firstAttemptOfd > 0 ? (firstAttemptDelivered / firstAttemptOfd) * 100 : 0;
    const reattemptDeliveryPct = reattemptOfd > 0 ? (reattemptDelivered / reattemptOfd) * 100 : 0;
    const overallDeliveryPct = totalOfd > 0 ? (totalDelivered / totalOfd) * 100 : 0;

    const firstAttemptContributionPct = totalDelivered > 0 ? (firstAttemptDelivered / totalDelivered) * 100 : 0;
    const reattemptContributionPct = totalDelivered > 0 ? (reattemptDelivered / totalDelivered) * 100 : 0;

    const codDeliveryPct = codCount > 0 ? (codDelivered / codCount) * 100 : 0;
    const prepaidDeliveryPct = prepaidCount > 0 ? (prepaidDelivered / prepaidCount) * 100 : 0;

    const codFadPercent = codFirstAttemptOfd > 0 ? (codFirstAttemptDel / codFirstAttemptOfd) * 100 : 0;
    const prepaidFadPercent = prepaidFirstAttemptOfd > 0 ? (prepaidFirstAttemptDel / prepaidFirstAttemptOfd) * 100 : 0;

    const avgAttempts = totalOfd > 0 ? sumAttempts / totalOfd : 0;

    employeeMetrics.push({
      employee_name: empName,
      total_ofd: totalOfd,

      first_attempt_ofd: firstAttemptOfd,
      first_attempt_delivered: firstAttemptDelivered,
      first_attempt_undel: firstAttemptUndel,
      first_attempt_cancelled: firstAttemptCancelled,
      first_attempt_rto: firstAttemptRto,
      first_attempt_delivery_pct: Number(firstAttemptDeliveryPct.toFixed(2)),

      reattempt_ofd: reattemptOfd,
      reattempt_delivered: reattemptDelivered,
      reattempt_undel: reattemptUndel,
      reattempt_cancelled: reattemptCancelled,
      reattempt_rto: reattemptRto,
      reattempt_delivery_pct: Number(reattemptDeliveryPct.toFixed(2)),

      attempt_2_ofd,
      attempt_2_delivered,
      attempt_3_ofd,
      attempt_3_delivered,
      attempt_4plus_ofd,
      attempt_4plus_delivered,

      total_delivered: totalDelivered,
      total_undel: totalUndel,
      total_cancelled: totalCancelled,
      total_rto: totalRto,
      overall_delivery_pct: Number(overallDeliveryPct.toFixed(2)),

      first_attempt_contribution_pct: Number(firstAttemptContributionPct.toFixed(2)),
      reattempt_contribution_pct: Number(reattemptContributionPct.toFixed(2)),

      cod_shipments_count: codCount,
      prepaid_shipments_count: prepaidCount,
      cod_value_total: codTotalValue,
      cod_value_delivered: codDeliveredValue,

      cod_ofd: codCount,
      cod_delivered: codDelivered,
      cod_undel: codUndel,
      cod_delivery_pct: Number(codDeliveryPct.toFixed(2)),
      cod_pending: codCount - codDelivered,
      cod_first_attempt_ofd: codFirstAttemptOfd,
      cod_first_attempt_del: codFirstAttemptDel,
      cod_fad_percent: Number(codFadPercent.toFixed(2)),

      prepaid_ofd: prepaidCount,
      prepaid_delivered: prepaidDelivered,
      prepaid_undel: prepaidUndel,
      prepaid_delivery_pct: Number(prepaidDeliveryPct.toFixed(2)),
      prepaid_pending: prepaidCount - prepaidDelivered,
      prepaid_amount_total: prepaidAmountTotal,
      prepaid_first_attempt_ofd: prepaidFirstAttemptOfd,
      prepaid_first_attempt_del: prepaidFirstAttemptDel,
      prepaid_fad_percent: Number(prepaidFadPercent.toFixed(2)),

      average_attempts: Number(avgAttempts.toFixed(2)),
      maximum_attempts: maxAttempts,
    });
  });

  employeeMetrics.sort((a, b) => b.total_delivered - a.total_delivered);
  return employeeMetrics;
}

export function computeClientDRSMetrics(uniqueRows: DRSReportRow[]): ClientDRSMetrics[] {
  const map = new Map<string, DRSReportRow[]>();

  uniqueRows.forEach((r) => {
    const client = r.customer_name || 'Direct / Other';
    const list = map.get(client) || [];
    list.push(r);
    map.set(client, list);
  });

  const clientMetrics: ClientDRSMetrics[] = [];

  map.forEach((rows, clientName) => {
    const totalOfd = rows.length;
    let totalDel = 0;
    let totalUndel = 0;
    let totalRto = 0;
    let totalCancel = 0;

    let codOfd = 0;
    let codDel = 0;
    let codValTotal = 0;

    let prepaidOfd = 0;
    let prepaidDel = 0;
    let prepaidValTotal = 0;

    rows.forEach((r) => {
      const status = r.shipment_status_normalized;
      const isCod = r.payment_type.toUpperCase().includes('COD');

      if (status === 'Delivered') totalDel++;
      else if (status === 'Undelivered') totalUndel++;
      else if (status === 'RTO') totalRto++;
      else if (status === 'Cancelled') totalCancel++;

      if (isCod) {
        codOfd++;
        codValTotal += r.amount_payable;
        if (status === 'Delivered') codDel++;
      } else {
        prepaidOfd++;
        prepaidValTotal += r.amount_payable;
        if (status === 'Delivered') prepaidDel++;
      }
    });

    const overallPct = totalOfd > 0 ? (totalDel / totalOfd) * 100 : 0;
    const codPct = codOfd > 0 ? (codDel / codOfd) * 100 : 0;
    const prepaidPct = prepaidOfd > 0 ? (prepaidDel / prepaidOfd) * 100 : 0;

    clientMetrics.push({
      client_name: clientName,
      total_ofd: totalOfd,
      total_delivered: totalDel,
      total_undel: totalUndel,
      total_rto: totalRto,
      total_cancelled: totalCancel,
      overall_delivery_pct: Number(overallPct.toFixed(2)),

      cod_ofd: codOfd,
      cod_delivered: codDel,
      cod_delivery_pct: Number(codPct.toFixed(2)),
      cod_value_total: codValTotal,

      prepaid_ofd: prepaidOfd,
      prepaid_delivered: prepaidDel,
      prepaid_delivery_pct: Number(prepaidPct.toFixed(2)),
      prepaid_value_total: prepaidValTotal,
    });
  });

  clientMetrics.sort((a, b) => b.total_ofd - a.total_ofd);
  return clientMetrics;
}

export function computePaymentAnalytics(uniqueRows: DRSReportRow[]): PaymentAnalyticsMetrics {
  let codOfd = 0;
  let codDelivered = 0;
  let codUndel = 0;
  let codTotalAmount = 0;
  let codDeliveredAmount = 0;

  let codFirstAttemptOfd = 0;
  let codFirstAttemptDel = 0;

  let prepaidOfd = 0;
  let prepaidDelivered = 0;
  let prepaidUndel = 0;
  let prepaidTotalAmount = 0;
  let prepaidDeliveredAmount = 0;

  let prepaidFirstAttemptOfd = 0;
  let prepaidFirstAttemptDel = 0;

  uniqueRows.forEach((r) => {
    const isCod = r.payment_type.toUpperCase().includes('COD');
    const status = r.shipment_status_normalized;
    const attempts = r.total_attempts || 1;

    if (isCod) {
      codOfd++;
      codTotalAmount += r.amount_payable;
      if (status === 'Delivered') {
        codDelivered++;
        codDeliveredAmount += r.amount_payable;
      } else if (status === 'Undelivered') {
        codUndel++;
      }
      if (attempts <= 1) {
        codFirstAttemptOfd++;
        if (status === 'Delivered') codFirstAttemptDel++;
      }
    } else {
      prepaidOfd++;
      prepaidTotalAmount += r.amount_payable;
      if (status === 'Delivered') {
        prepaidDelivered++;
        prepaidDeliveredAmount += r.amount_payable;
      } else if (status === 'Undelivered') {
        prepaidUndel++;
      }
      if (attempts <= 1) {
        prepaidFirstAttemptOfd++;
        if (status === 'Delivered') prepaidFirstAttemptDel++;
      }
    }
  });

  const codDeliveryPct = codOfd > 0 ? (codDelivered / codOfd) * 100 : 0;
  const prepaidDeliveryPct = prepaidOfd > 0 ? (prepaidDelivered / prepaidOfd) * 100 : 0;

  // Bug 1 Fix: Safe Division for COD FAD % and Prepaid FAD %
  const codFadPercent = codFirstAttemptOfd > 0 ? (codFirstAttemptDel / codFirstAttemptOfd) * 100 : 0;
  const prepaidFadPercent = prepaidFirstAttemptOfd > 0 ? (prepaidFirstAttemptDel / prepaidFirstAttemptOfd) * 100 : 0;

  return {
    codOfd,
    codDelivered,
    codUndel,
    codDeliveryPct: Number(codDeliveryPct.toFixed(2)),
    codPending: codOfd - codDelivered,
    codTotalAmount,
    codDeliveredAmount,
    codFirstAttemptOfd,
    codFirstAttemptDel,
    codFadPercent: Number(codFadPercent.toFixed(2)),

    prepaidOfd,
    prepaidDelivered,
    prepaidUndel,
    prepaidDeliveryPct: Number(prepaidDeliveryPct.toFixed(2)),
    prepaidPending: prepaidOfd - prepaidDelivered,
    prepaidTotalAmount,
    prepaidDeliveredAmount,
    prepaidFirstAttemptOfd,
    prepaidFirstAttemptDel,
    prepaidFadPercent: Number(prepaidFadPercent.toFixed(2)),
  };
}

export function computeNDRReasonAnalytics(uniqueRows: DRSReportRow[]): NDRReasonMetrics[] {
  const undelRows = uniqueRows.filter((r) => r.shipment_status_normalized === 'Undelivered');
  const totalUndel = undelRows.length;
  if (totalUndel === 0) return [];

  const reasonMap = new Map<string, { count: number; execMap: Map<string, number> }>();

  undelRows.forEach((r) => {
    const reason = r.reason || 'Unspecified NDR Reason';
    const exec = r.employee_name || 'Unassigned Executive';
    const entry = reasonMap.get(reason) || { count: 0, execMap: new Map() };
    entry.count++;
    entry.execMap.set(exec, (entry.execMap.get(exec) || 0) + 1);
    reasonMap.set(reason, entry);
  });

  const result: NDRReasonMetrics[] = [];

  reasonMap.forEach((entry, reason) => {
    const pct = (entry.count / totalUndel) * 100;
    const affectedExecutives = Array.from(entry.execMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    result.push({
      reason,
      count: entry.count,
      percentage: Number(pct.toFixed(2)),
      affectedExecutives,
    });
  });

  result.sort((a, b) => b.count - a.count);
  return result;
}

export function computeRTOAnalytics(uniqueRows: DRSReportRow[]): RTOAnalyticsMetrics[] {
  const rtoRows = uniqueRows.filter((r) => r.shipment_status_normalized === 'RTO');
  const totalRto = rtoRows.length;
  if (totalRto === 0) return [];

  const reasonMap = new Map<string, { count: number; execMap: Map<string, number> }>();

  rtoRows.forEach((r) => {
    const reason = r.reason || 'RTO Action Approved';
    const exec = r.employee_name || 'Unassigned Executive';
    const entry = reasonMap.get(reason) || { count: 0, execMap: new Map() };
    entry.count++;
    entry.execMap.set(exec, (entry.execMap.get(exec) || 0) + 1);
    reasonMap.set(reason, entry);
  });

  const result: RTOAnalyticsMetrics[] = [];

  reasonMap.forEach((entry, reason) => {
    const pct = (entry.count / totalRto) * 100;
    const affectedExecutives = Array.from(entry.execMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    result.push({
      reason,
      count: entry.count,
      percentage: Number(pct.toFixed(2)),
      affectedExecutives,
    });
  });

  result.sort((a, b) => b.count - a.count);
  return result;
}

export function filterDRSRows(rows: DRSReportRow[], filters: DRSFilterOptions): DRSReportRow[] {
  return rows.filter((r) => {
    if (filters.drsDate && r.drs_date && !r.drs_date.includes(filters.drsDate)) return false;
    if (filters.employee && r.employee_name.toLowerCase() !== filters.employee.toLowerCase()) return false;
    if (filters.partner && !r.partner_name.toLowerCase().includes(filters.partner.toLowerCase())) return false;
    if (filters.hubLocation && !r.location.toLowerCase().includes(filters.hubLocation.toLowerCase())) return false;
    if (filters.city && !r.city.toLowerCase().includes(filters.city.toLowerCase())) return false;
    if (filters.client && !r.customer_name.toLowerCase().includes(filters.client.toLowerCase())) return false;
    if (filters.shipmentStatus && filters.shipmentStatus !== 'ALL' && r.shipment_status_normalized !== filters.shipmentStatus) return false;
    if (filters.paymentType && filters.paymentType !== 'ALL' && r.payment_type !== filters.paymentType) return false;
    if (filters.pincode && !r.delivery_pincode.includes(filters.pincode)) return false;
    if (filters.reason && !r.reason.toLowerCase().includes(filters.reason.toLowerCase())) return false;

    if (filters.attemptType === 'FIRST_ATTEMPT' && (r.total_attempts || 1) > 1) return false;
    if (filters.attemptType === 'REATTEMPT' && (r.total_attempts || 1) < 2) return false;

    if (filters.search) {
      const q = filters.search.toLowerCase();
      const matchAwb = r.waybill_no.toLowerCase().includes(q);
      const matchEmp = r.employee_name.toLowerCase().includes(q);
      const matchClient = r.customer_name.toLowerCase().includes(q);
      const matchConsignee = r.consignee.toLowerCase().includes(q);
      const matchDrs = r.drs_code.toLowerCase().includes(q);
      if (!matchAwb && !matchEmp && !matchClient && !matchConsignee && !matchDrs) return false;
    }

    if (filters.attemptCount) {
      const att = parseInt(filters.attemptCount, 10);
      if (!isNaN(att)) {
        if (filters.attemptCount.endsWith('+')) {
          if (r.total_attempts < att) return false;
        } else if (r.total_attempts !== att) return false;
      }
    }

    return true;
  });
}
