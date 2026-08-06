// Shared constants for NDR Workflow Statuses and Reason Filters
// Do NOT use hardcoded display strings in Supabase queries.

export const NDR_WORKFLOW_STATUS = {
  UNDEL: 'UNDEL',
  CALLING_PENDING: 'Calling Pending',
  CUSTOMER_CONTACTED: 'Customer Contacted',
  REATTEMPT_REQUIRED: 'Reattempt Required',
  SUPERVISOR_REVIEW: 'Supervisor Review',
  REATTEMPT_APPROVED: 'Reattempt Approved',
  OUT_FOR_DELIVERY: 'Out For Delivery',
  DELIVERED: 'Delivered',
  RTO: 'RTO',
  CLOSED: 'Closed',
} as const;

export type NDRWorkflowStatusConst = typeof NDR_WORKFLOW_STATUS[keyof typeof NDR_WORKFLOW_STATUS];

export const NDR_REASON_FILTERS = {
  OTP: 'OTP',
  FAKE: 'Fake',
  WRONG: 'Wrong',
  FUTURE: 'Future',
  REFUSED: 'Refused',
  UNREACHABLE: 'Unreachable',
} as const;

export type NDRReasonFilterConst = typeof NDR_REASON_FILTERS[keyof typeof NDR_REASON_FILTERS];
