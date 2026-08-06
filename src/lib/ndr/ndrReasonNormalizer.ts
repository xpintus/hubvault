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

  if (r.includes('refuse') && r.includes('otp')) return 'Customer Refused OTP';
  if (r.includes('denied otp') || r.includes('otp refused') || r.includes('otp not shared')) return 'Customer Refused OTP';

  if (r.includes('refus') || r.includes('denied delivery') || r.includes('denied order')) return 'Customer Refused to Accept';

  if (r.includes('switched off') || r.includes('power off')) return 'Phone Switched Off';

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

  if (r.includes('wrong number') || r.includes('invalid number') || r.includes('wrong phone')) return 'Wrong Number';

  if (r.includes('future') || r.includes('tomorrow') || r.includes('postpone') || r.includes('reschedule') || r.includes('next week')) {
    return 'Future Delivery Requested';
  }

  if (r.includes('want reattempt') || r.includes('wants reattempt') || r.includes('reattempt requested')) return 'Customer Wants Reattempt';

  if (r.includes('already received') || r.includes('already delivered') || r.includes('already got')) return 'Customer Already Received';

  if (r.includes('fake')) return 'Fake Order';

  if (r.includes('address') || r.includes('location') || r.includes('pincode') || r.includes('landmark') || r.includes('locality')) {
    return 'Address Issue';
  }

  if (r.includes('payment') || r.includes('cash') || r.includes('money') || r.includes('change')) return 'Payment Issue';

  if (r.includes('otp')) return 'OTP Issue';

  if (r.includes('did not visit') || r.includes('de fake') || r.includes('not visited') || r.includes('no visit')) {
    return 'Delivery Executive Did Not Visit';
  }

  return 'Other';
}
