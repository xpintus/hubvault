import { Profile } from '@/types';

export type SubscriptionStatusType = 'lifetime' | 'active' | 'expired';

/**
 * Returns the exact subscription status for a profile ('lifetime' | 'active' | 'expired').
 * Respects configurable grace days from app_settings.
 */
export function getSubscriptionStatus(
  profile: Profile | null | undefined,
  graceDays = 0
): SubscriptionStatusType {
  if (!profile) return 'expired';

  // Super admin always has lifetime bypass
  if (profile.role === 'super_admin') return 'lifetime';

  // Explicit lifetime plan
  if (profile.plan_type === 'lifetime') return 'lifetime';

  // Monthly plan
  if (profile.plan_type === 'monthly') {
    const expiryStr = profile.subscription_expires_at ?? profile.license_expires_at;
    if (!expiryStr) return 'expired';

    const expiryTime = new Date(expiryStr).getTime();
    if (isNaN(expiryTime)) return 'expired';

    const graceTimeMs = Math.max(0, graceDays) * 24 * 60 * 60 * 1000;
    const effectiveExpiry = expiryTime + graceTimeMs;

    return Date.now() <= effectiveExpiry ? 'active' : 'expired';
  }

  // Fallback for legacy profiles where plan_type might be unset
  if (profile.license_status === 'activated' && !profile.license_expires_at) {
    return 'lifetime';
  }

  if (profile.license_expires_at) {
    const expiryTime = new Date(profile.license_expires_at).getTime();
    const graceTimeMs = Math.max(0, graceDays) * 24 * 60 * 60 * 1000;
    return Date.now() <= (expiryTime + graceTimeMs) ? 'active' : 'expired';
  }

  return 'expired';
}

/**
 * Calculates days remaining until expiration (negative if already expired).
 * Returns null for lifetime plans.
 */
export function getDaysRemaining(
  profile: Profile | null | undefined
): number | null {
  if (!profile || profile.role === 'super_admin' || profile.plan_type === 'lifetime') {
    return null;
  }

  const expiryStr = profile.subscription_expires_at ?? profile.license_expires_at;
  if (!expiryStr) return 0;

  const expiryTime = new Date(expiryStr).getTime();
  if (isNaN(expiryTime)) return 0;

  const diffMs = expiryTime - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Utility helper returning structured subscription details for UI widgets.
 */
export function getSubscriptionDetails(
  profile: Profile | null | undefined,
  graceDays = 0
) {
  const status = getSubscriptionStatus(profile, graceDays);
  const daysRemaining = getDaysRemaining(profile);
  const expiresAt = profile?.subscription_expires_at ?? profile?.license_expires_at ?? null;

  const isNearExpiry = status === 'active' && daysRemaining !== null && daysRemaining <= 7 && daysRemaining >= 0;

  let label = 'Active';
  if (status === 'lifetime') label = 'Lifetime Access';
  else if (status === 'expired') label = 'Subscription Expired';
  else if (isNearExpiry) label = `Expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`;

  return {
    status,
    label,
    daysRemaining,
    expiresAt,
    isNearExpiry,
  };
}
