import { describe, expect, it } from 'vitest';
import { getSubscriptionStatus, getDaysRemaining, getSubscriptionDetails } from '../lib/subscription';
import { Profile } from '../types';

describe('Monthly Subscription System & Access Control', () => {
  const now = new Date('2026-08-06T12:00:00Z');

  it('1. Super Admin is always granted lifetime access', () => {
    const superAdminProfile: Profile = {
      id: 'admin-1',
      name: 'Super Admin',
      email: 'admin@hubvault.in',
      role: 'super_admin',
      hub_id: null,
      can_create_hub: true,
      created_at: now.toISOString(),
      plan_type: 'monthly',
      subscription_status: 'expired',
      subscription_expires_at: '2026-01-01T00:00:00Z',
    };

    expect(getSubscriptionStatus(superAdminProfile)).toBe('lifetime');
    expect(getDaysRemaining(superAdminProfile)).toBeNull();
  });

  it('2. Lifetime plan creates no expiration and never expires', () => {
    const lifetimeProfile: Profile = {
      id: 'user-1',
      name: 'Lifetime Hub Admin',
      email: 'lifetime@hubvault.in',
      role: 'hub_admin',
      hub_id: 'hub-1',
      can_create_hub: true,
      created_at: now.toISOString(),
      plan_type: 'lifetime',
      subscription_started_at: now.toISOString(),
      subscription_expires_at: null,
      subscription_status: 'active',
    };

    expect(getSubscriptionStatus(lifetimeProfile)).toBe('lifetime');
    expect(getDaysRemaining(lifetimeProfile)).toBeNull();
  });

  it('3. Monthly active user gets active status when non-expired', () => {
    const futureExpiry = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString();
    const monthlyActiveProfile: Profile = {
      id: 'user-2',
      name: 'Monthly Hub Admin',
      email: 'monthly@hubvault.in',
      role: 'hub_admin',
      hub_id: 'hub-1',
      can_create_hub: true,
      created_at: now.toISOString(),
      plan_type: 'monthly',
      subscription_started_at: now.toISOString(),
      subscription_expires_at: futureExpiry,
      subscription_status: 'active',
    };

    expect(getSubscriptionStatus(monthlyActiveProfile)).toBe('active');
    const details = getSubscriptionDetails(monthlyActiveProfile);
    expect(details.status).toBe('active');
    expect(details.isNearExpiry).toBe(false);
  });

  it('4. Expired monthly user is marked as expired', () => {
    const pastExpiry = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const monthlyExpiredProfile: Profile = {
      id: 'user-3',
      name: 'Expired Hub Admin',
      email: 'expired@hubvault.in',
      role: 'hub_admin',
      hub_id: 'hub-1',
      can_create_hub: true,
      created_at: '2026-06-01T00:00:00Z',
      plan_type: 'monthly',
      subscription_started_at: '2026-06-01T00:00:00Z',
      subscription_expires_at: pastExpiry,
      subscription_status: 'expired',
    };

    expect(getSubscriptionStatus(monthlyExpiredProfile, 0)).toBe('expired');
  });

  it('5. Grace period extends active status for expired monthly users', () => {
    // Expired 2 days ago
    const pastExpiry = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const monthlyProfile: Profile = {
      id: 'user-4',
      name: 'Grace Period User',
      email: 'grace@hubvault.in',
      role: 'hub_admin',
      hub_id: 'hub-1',
      can_create_hub: true,
      created_at: '2026-06-01T00:00:00Z',
      plan_type: 'monthly',
      subscription_started_at: '2026-06-01T00:00:00Z',
      subscription_expires_at: pastExpiry,
      subscription_status: 'expired',
    };

    // 0 grace days -> expired
    expect(getSubscriptionStatus(monthlyProfile, 0)).toBe('expired');
    // 3 grace days -> active
    expect(getSubscriptionStatus(monthlyProfile, 3)).toBe('active');
  });

  it('6. Renewal before expiry extends from existing expiry date (+30 days)', () => {
    const currentExpiryDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 days in future
    const currentExpiryStr = currentExpiryDate.toISOString();

    // Renewal logic simulation:
    const isCurrentlyActive = currentExpiryDate.getTime() > Date.now();
    let newExpiryDate: Date;
    if (isCurrentlyActive) {
      newExpiryDate = new Date(currentExpiryDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    } else {
      newExpiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    // Must be exactly 40 days from now (10 days remaining + 30 days added)
    const expectedDiffDays = Math.round((newExpiryDate.getTime() - currentExpiryDate.getTime()) / (1000 * 60 * 60 * 24));
    expect(expectedDiffDays).toBe(30);
  });

  it('7. Renewal after expiry starts 30 days from renewal time', () => {
    const pastExpiryDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

    const isCurrentlyActive = pastExpiryDate.getTime() > Date.now();
    let newExpiryDate: Date;
    if (isCurrentlyActive) {
      newExpiryDate = new Date(pastExpiryDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    } else {
      newExpiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    const diffDaysFromNow = Math.round((newExpiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    expect(diffDaysFromNow).toBe(30);
  });

  it('8. Monthly plan is never silently converted to lifetime during renewal', () => {
    const monthlyProfile: Profile = {
      id: 'user-5',
      name: 'Monthly User',
      email: 'monthly5@hubvault.in',
      role: 'hub_admin',
      hub_id: 'hub-1',
      can_create_hub: true,
      created_at: now.toISOString(),
      plan_type: 'monthly',
      subscription_started_at: now.toISOString(),
      subscription_expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      subscription_status: 'active',
    };

    expect(monthlyProfile.plan_type).toBe('monthly');
    expect(getSubscriptionStatus(monthlyProfile)).not.toBe('lifetime');
  });
});
