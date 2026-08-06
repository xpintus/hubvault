export type NormalizedShipmentStatus = 'Delivered' | 'Undelivered' | 'Cancelled' | 'RTO' | 'Unknown';

export interface DRSReportRow {
  rowIndex: number;
  drs_code: string;
  waybill_no: string; // AWB Number
  employee_name: string; // Employee / Delivery Executive
  partner_name: string; // Vendor / Courier Partner
  location: string;
  city: string;
  state: string;
  customer_name: string; // Client Name
  consignee: string; // Customer Name
  shipment_status_raw: string;
  shipment_status_normalized: NormalizedShipmentStatus;
  amount_payable: number;
  payment_type: string;
  pod_date: string;
  first_attempt_date: string;
  last_attempt_date: string;
  total_attempts: number;
  delivery_pincode: string;
  is_mobility: string;
  reason: string;
  otp_details: string;
  drs_date: string;
  drs_status: string;
  ndr_instruction_received: string;
  is_duplicate: boolean;
  duplicate_count: number;
  is_invalid: boolean;
  invalid_reason?: string;
}

export interface EmployeeDRSMetrics {
  employee_name: string;
  total_ofd: number;
  first_attempt_ofd: number;
  first_attempt_delivered: number;
  first_attempt_undel: number;
  first_attempt_cancelled: number;
  first_attempt_rto: number;
  first_attempt_delivery_pct: number;

  reattempt_ofd: number;
  reattempt_delivered: number;
  reattempt_undel: number;
  reattempt_cancelled: number;
  reattempt_rto: number;
  reattempt_delivery_pct: number;

  attempt_2_ofd: number;
  attempt_2_delivered: number;
  attempt_3_ofd: number;
  attempt_3_delivered: number;
  attempt_4plus_ofd: number;
  attempt_4plus_delivered: number;

  total_delivered: number;
  total_undel: number;
  total_cancelled: number;
  total_rto: number;
  overall_delivery_pct: number;

  first_attempt_contribution_pct: number;
  reattempt_contribution_pct: number;

  cod_shipments_count: number;
  prepaid_shipments_count: number;
  cod_value_total: number;
  cod_value_delivered: number;

  cod_ofd: number;
  cod_delivered: number;
  cod_undel: number;
  cod_delivery_pct: number;
  cod_pending: number;
  cod_first_attempt_ofd: number;
  cod_first_attempt_del: number;
  cod_fad_percent: number;

  prepaid_ofd: number;
  prepaid_delivered: number;
  prepaid_undel: number;
  prepaid_delivery_pct: number;
  prepaid_pending: number;
  prepaid_amount_total: number;
  prepaid_first_attempt_ofd: number;
  prepaid_first_attempt_del: number;
  prepaid_fad_percent: number;

  average_attempts: number;
  maximum_attempts: number;
}

export interface ClientDRSMetrics {
  client_name: string;
  total_ofd: number;
  total_delivered: number;
  total_undel: number;
  total_rto: number;
  total_cancelled: number;
  overall_delivery_pct: number;

  cod_ofd: number;
  cod_delivered: number;
  cod_delivery_pct: number;
  cod_value_total: number;

  prepaid_ofd: number;
  prepaid_delivered: number;
  prepaid_delivery_pct: number;
  prepaid_value_total: number;
}

export interface PaymentAnalyticsMetrics {
  codOfd: number;
  codDelivered: number;
  codUndel: number;
  codDeliveryPct: number;
  codPending: number;
  codTotalAmount: number;
  codDeliveredAmount: number;
  codFirstAttemptOfd: number;
  codFirstAttemptDel: number;
  codFadPercent: number;

  prepaidOfd: number;
  prepaidDelivered: number;
  prepaidUndel: number;
  prepaidDeliveryPct: number;
  prepaidPending: number;
  prepaidTotalAmount: number;
  prepaidDeliveredAmount: number;
  prepaidFirstAttemptOfd: number;
  prepaidFirstAttemptDel: number;
  prepaidFadPercent: number;
}

export interface NDRReasonMetrics {
  reason: string;
  count: number;
  percentage: number;
  affectedExecutives: { name: string; count: number }[];
}

export interface RTOAnalyticsMetrics {
  reason: string;
  count: number;
  percentage: number;
  affectedExecutives: { name: string; count: number }[];
}

export interface OverallDRSSummary {
  fileName: string;
  reportDate: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  uniqueAwbs: number;
  duplicateRows: number;
  consolidatedRows: number;
  totalEmployees: number;
  totalDrsCodes: number;

  // OFD Totals
  totalOfd: number; // Total unique valid AWBs
  firstAttemptOfd: number;
  firstAttemptDelivered: number;
  firstAttemptUndel: number;
  firstAttemptCancelled: number;
  firstAttemptRto: number;
  firstAttemptDeliveryPct: number;

  reattemptOfd: number;
  reattemptDelivered: number;
  reattemptUndel: number;
  reattemptCancelled: number;
  reattemptRto: number;
  reattemptDeliveryPct: number;

  attempt2Ofd: number;
  attempt2Delivered: number;
  attempt3Ofd: number;
  attempt3Delivered: number;
  attempt4PlusOfd: number;
  attempt4PlusDelivered: number;

  totalDelivered: number;
  totalUndel: number;
  totalCancelled: number;
  totalRto: number;
  overallDeliveryPct: number;

  firstAttemptContributionPct: number;
  reattemptContributionPct: number;

  totalCodValue: number;
  deliveredCodValue: number;
  averageAttempts: number;
  maximumAttempts: number;

  // Bug 1 Fix: Payment FAD% fields
  codOfd: number;
  codDelivered: number;
  codFirstAttemptOfd: number;
  codFirstAttemptDel: number;
  codFadPercent: number;

  prepaidOfd: number;
  prepaidDelivered: number;
  prepaidFirstAttemptOfd: number;
  prepaidFirstAttemptDel: number;
  prepaidFadPercent: number;
}

export interface DRSFilterOptions {
  drsDate?: string;
  dateRangePreset?: 'ALL' | 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM';
  startDate?: string;
  endDate?: string;
  employee?: string;
  partner?: string;
  hubLocation?: string;
  city?: string;
  client?: string;
  shipmentStatus?: string;
  attemptType?: 'ALL' | 'FIRST_ATTEMPT' | 'REATTEMPT';
  attemptCount?: string;
  paymentType?: string;
  pincode?: string;
  reason?: string;
  otpStatus?: string;
  minOfdThreshold?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface DRSReportHistoryItem {
  id: string;
  fileName: string;
  reportDate: string;
  uploadTimestamp: string;
  uploadedBy: string;
  hubId?: string;
  hubName: string;
  clientName: string;
  totalOfd: number;
  totalDelivered: number;
  totalUndel: number;
  totalRto?: number;
  totalCancel?: number;
  firstAttemptOfd?: number;
  firstAttemptDel?: number;
  reattemptOfd?: number;
  reattemptDel?: number;
  overallDeliveryPct: number;

  codOfd?: number;
  codDel?: number;
  codFirstAttemptOfd?: number;
  codFirstAttemptDel?: number;
  codFadPercent?: number;

  prepaidOfd?: number;
  prepaidDel?: number;
  prepaidFirstAttemptOfd?: number;
  prepaidFirstAttemptDel?: number;
  prepaidFadPercent?: number;

  codAmount?: number;
  prepaidAmount?: number;
  averageAttempt?: number;

  rows: DRSReportRow[];
  summary: OverallDRSSummary;
}

export interface DRSReportComparison {
  reportA: DRSReportHistoryItem;
  reportB: DRSReportHistoryItem;
  ofdChange: number;
  ofdChangePct: number;
  delChange: number;
  delChangePct: number;
  undelChange: number;
  deliveryRateChange: number;
  codAmountChange: number;
}
