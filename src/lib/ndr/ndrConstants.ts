// Streamlined enterprise NDR workflow statuses & reason constants

export const NDR_WORKFLOW_STATUS = {
  CALLING_PENDING: 'Calling Pending',
  SUPERVISOR_PENDING: 'Supervisor Pending',
  FOLLOW_UP: 'Follow-up',
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
