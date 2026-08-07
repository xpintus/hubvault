export const NORMALIZED_NDR_REASONS = [
  'Customer Refused to Accept',
  'Customer Refused OTP',
  'Customer Not Reachable',
  'Phone Switched Off',
  'Customer Wants Reattempt',
  'Customer Already Received',
  'Wrong Number',
  'Future Delivery Requested',
  'Fake Order',
  'Address Issue',
  'Payment Issue',
  'OTP Issue',
  'Delivery Executive Did Not Visit',
  'Other',
] as const;

export type NormalizedNDRReasonCategory = (typeof NORMALIZED_NDR_REASONS)[number];

export function normalizeNDRReason(rawReason: string | null | undefined): NormalizedNDRReasonCategory {
  if (!rawReason) return 'Other';

  const r = rawReason.trim().toLowerCase();
  if (!r) return 'Other';

  // OTP Refusal check
  if (
    r.includes('refuse') && r.includes('otp') ||
    r.includes('denied otp') ||
    r.includes('otp refused') ||
    r.includes('otp not shared') ||
    r.includes('customer refused otp')
  ) {
    return 'Customer Refused OTP';
  }

  // Refused to Accept / Reject check
  if (
    r.includes('customer refused') ||
    r.includes('customer reject') ||
    r.includes('refus') ||
    r.includes('reject') ||
    r.includes('denied delivery') ||
    r.includes('denied order') ||
    r.includes('denied')
  ) {
    return 'Customer Refused to Accept';
  }

  // Phone Switched Off
  if (r.includes('switched off') || r.includes('power off') || r.includes('switch off')) {
    return 'Phone Switched Off';
  }

  // Customer Not Reachable
  if (
    r.includes('unreachable') ||
    r.includes('not reachable') ||
    r.includes('unavailable') ||
    r.includes('no response') ||
    r.includes('not responding') ||
    r.includes('no answer') ||
    r.includes('not picked')
  ) {
    return 'Customer Not Reachable';
  }

  // Wrong Number
  if (r.includes('wrong number') || r.includes('invalid number') || r.includes('wrong phone')) {
    return 'Wrong Number';
  }

  // Future Delivery
  if (
    r.includes('future') ||
    r.includes('tomorrow') ||
    r.includes('postpone') ||
    r.includes('reschedule') ||
    r.includes('next week')
  ) {
    return 'Future Delivery Requested';
  }

  // Wants Reattempt
  if (r.includes('want reattempt') || r.includes('wants reattempt') || r.includes('reattempt requested')) {
    return 'Customer Wants Reattempt';
  }

  // Already Received
  if (r.includes('already received') || r.includes('already delivered') || r.includes('already got')) {
    return 'Customer Already Received';
  }

  // Fake Order
  if (r.includes('fake')) {
    return 'Fake Order';
  }

  // Address Issue
  if (
    r.includes('address') ||
    r.includes('location') ||
    r.includes('pincode') ||
    r.includes('landmark') ||
    r.includes('locality')
  ) {
    return 'Address Issue';
  }

  // Payment Issue
  if (r.includes('payment') || r.includes('cash') || r.includes('money') || r.includes('change')) {
    return 'Payment Issue';
  }

  // OTP General Issue
  if (r.includes('otp')) {
    return 'OTP Issue';
  }

  // DE Did Not Visit
  if (r.includes('did not visit') || r.includes('de fake') || r.includes('not visited') || r.includes('no visit')) {
    return 'Delivery Executive Did Not Visit';
  }

  return 'Other';
}
