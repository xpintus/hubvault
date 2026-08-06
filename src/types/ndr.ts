export type NDRWorkflowStatus =
  | 'Calling Pending'
  | 'Supervisor Pending'
  | 'Follow-up'
  | 'Delivered'
  | 'RTO'
  | 'Closed';

export type NDRCallerResult =
  | 'Connected'
  | 'Not Connected'
  | 'Switched Off'
  | 'Wrong Number'
  | 'Customer Accepted'
  | 'Customer Refused'
  | 'Future Delivery'
  | 'OTP Issue'
  | 'Other';

export type NDRSupervisorActionType =
  | 'Approve Delivery'
  | 'Approve Reattempt'
  | 'Approve RTO';


export interface NDRShipment {
  id: string;
  awb_number: string;
  drs_code: string | null;
  client_name: string | null;
  consignee_name: string | null;
  delivery_executive: string | null;
  partner_name: string | null;
  hub_location: string | null;
  city: string | null;
  state: string | null;
  payment_type: string;
  amount_payable: number;

  // Original Preserved Data
  shipment_status_original: string;
  original_ndr_reason: string | null;
  otp_status: string | null;
  drs_status: string | null;
  drs_date: string | null;
  first_attempt_date: string | null;
  last_attempt_date: string | null;
  total_attempts: number;
  delivery_pincode: string | null;
  is_mobility: string | null;

  // Workflow Data
  shipment_status_current: string;
  ndr_workflow_status: NDRWorkflowStatus;

  // Assignments
  assigned_caller_id: string | null;
  assigned_supervisor_id: string | null;
  hub_id: string | null;
  import_batch_id: string | null;

  // Delivered Details
  delivered_date: string | null;
  delivered_by: string | null;
  delivered_user: string | null;
  pod_reference: string | null;
  cod_collected_amount: number | null;
  cod_exception_remark: string | null;

  // RTO Details
  rto_date: string | null;
  rto_reason: string | null;
  rto_remarks: string | null;
  expected_rto_date: string | null;

  // Cycle counter
  ndr_cycle: number;

  // Audit & Metadata
  raw_data?: Record<string, unknown>;
  created_by?: string | null;
  created_at: string;
  updated_at: string;

  // Joined relations
  assigned_caller?: { id: string; name: string; email?: string } | null;
  assigned_supervisor?: { id: string; name: string; email?: string } | null;
  hub?: { id: string; name: string; code: string } | null;
  last_call_log?: NDRCallLog | null;
  last_supervisor_action?: NDRSupervisorAction | null;
}

export interface NDRImportBatch {
  id: string;
  filename: string;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  upload_time: string;
  total_rows: number;
  valid_rows: number;
  duplicate_rows: number;
  invalid_rows: number;
  ready_to_import: number;
  status?: 'processing' | 'completed' | 'failed';
  error_message?: string | null;
  hub_id: string | null;
  created_at: string;
}

export interface NDRCallLog {
  id: string;
  shipment_id: string;
  caller_id: string | null;
  caller_name: string | null;
  call_date: string;
  call_time: string | null;
  call_connected: boolean;
  attempt_number: number;
  customer_response: string | null;
  caller_result: NDRCallerResult;
  customer_verified_reason: string | null;
  customer_complaint: string | null;
  customer_wants_delivery: boolean;
  preferred_delivery_date: string | null;
  alternate_number: string | null;
  next_followup_date: string | null;
  caller_remarks: string | null;
  call_duration: string | null;
  created_at: string;
}

export interface NDRSupervisorAction {
  id: string;
  shipment_id: string;
  supervisor_id: string | null;
  supervisor_name: string | null;
  supervisor_called_customer: boolean;
  delivery_executive_reason_correct: boolean;
  fake_attempt_suspected: boolean;
  otp_misuse_suspected: boolean;
  escalate_delivery_executive: boolean;
  escalate_vendor: boolean;
  action_taken: NDRSupervisorActionType;
  supervisor_remarks: string | null;
  next_action_date: string | null;
  created_at: string;
}

export interface NDRTimelineLog {
  id: string;
  shipment_id: string;
  event_type: 'import' | 'caller_update' | 'supervisor_update' | 'reattempt_approval' | 'delivered' | 'rto' | 'closure' | 'assignment';
  action_title: string;
  user_id: string | null;
  user_name: string | null;
  user_role: string | null;
  previous_status: string | null;
  new_status: string | null;
  remarks: string | null;
  meta_data?: Record<string, unknown>;
  created_at: string;
}

export interface NDRMetrics {
  totalActive: number;
  callingPending: number;
  supervisorPending: number;
  followUpToday: number;
  deliveredAfterNdr: number;
  rtoClosed: number;
}


export interface NDRFilterParams {
  search?: string;
  startDate?: string;
  endDate?: string;
  hubId?: string;
  vendor?: string;
  executive?: string;
  status?: string;
  workflowStatus?: NDRWorkflowStatus | 'ALL' | string;

  reason?: string;
  callerId?: string;
  supervisorId?: string;
  paymentType?: string;
  otpStatus?: string;
  deliveryStatus?: string;
  followUpDate?: string;
  aging?: number;
  page?: number;
  limit?: number;
}


export interface ParsedNDRExcelRow {
  rowIndex: number;
  drs_code: string;
  waybill_no: string;
  Employee_name: string;
  partner_name: string;
  LOCATION: string;
  city: string;
  customer_name: string;
  state: string;
  shipment_status: string;
  amount_payable: number;
  payment_type: string;
  POD_date: string;
  first_attempt_date: string;
  last_attempt_date: string;
  total_attemps: number;
  consignee: string;
  delivery_pincode: string;
  is_mobility: string;
  reason: string;
  otp_details: string;
  drs_date: string;
  drs_status: string;
  ndr_instruction_received: string;
  errors: string[];
  warnings: string[];
  isDuplicateInFile: boolean;
  isExistingInDB: boolean;
}

export interface NDRExcelImportPreview {
  validRows: ParsedNDRExcelRow[];
  invalidRows: ParsedNDRExcelRow[];
  duplicateRows: ParsedNDRExcelRow[];
  existingRows: ParsedNDRExcelRow[];
  delSkippedRows: ParsedNDRExcelRow[];
  undelEligibleRows: ParsedNDRExcelRow[];
  warningRows: ParsedNDRExcelRow[];
  missingAwbRows: ParsedNDRExcelRow[];
  totalRows: number;
  undelEligibleCount: number;
  delSkippedCount: number;
  readyToImportCount: number;
}

