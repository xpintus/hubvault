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

  average_attempts: number;
  maximum_attempts: number;
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
}

export interface DRSFilterOptions {
  drsDate?: string;
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
  minOfdThreshold?: number; // 5, 10, 20, 50
  sortBy?: 'total_delivered' | 'total_ofd' | 'overall_delivery_pct' | 'first_attempt_delivery_pct' | 'reattempt_delivery_pct' | 'cod_value_delivered';
  sortOrder?: 'asc' | 'desc';
}
