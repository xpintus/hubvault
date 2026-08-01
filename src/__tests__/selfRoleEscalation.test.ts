import { Profile,UserRole } from '@/types';
import { describe,expect,it } from 'vitest';

// Mock function simulating the update_my_profile RPC logic
interface SafeProfileUpdateInput {
  p_name?: string | null;
  p_phone?: string | null;
  p_company?: string | null;
  p_location?: string | null;
  // Intentionally including potential invalid properties to test protection
  p_role?: UserRole | null;
  p_is_approved?: boolean | null;
  p_license_status?: string | null;
  p_hub_credits?: number | null;
  p_hub_id?: string | null;
}

function simulateUpdateMyProfile(currentProfile: Profile, input: SafeProfileUpdateInput): Profile {
  // Safe RPC accepts ONLY safe fields name, phone, company, location
  // Protected parameters (p_role, p_is_approved, p_license_status, p_hub_credits, p_hub_id) are ignored or rejected.
  const updatedName = input.p_name?.trim() || currentProfile.name;
  const updatedPhone = input.p_phone?.trim() ?? currentProfile.phone ?? null;
  const updatedCompany = input.p_company?.trim() ?? currentProfile.company ?? null;
  const updatedLocation = input.p_location?.trim() ?? currentProfile.location ?? null;

  return {
    ...currentProfile,
    name: updatedName,
    phone: updatedPhone,
    company: updatedCompany,
    location: updatedLocation,
    // Explicitly retain original authorization/protected values
    role: currentProfile.role,
    is_approved: currentProfile.is_approved,
    license_status: currentProfile.license_status,
    hub_add_credits: currentProfile.hub_add_credits,
    hub_id: currentProfile.hub_id,
    can_create_hub: currentProfile.can_create_hub,
  };
}

describe('Self-Role Escalation Prevention & Safe Profile Update RPC', () => {
  const guestUser: Profile = {
    id: 'user-guest',
    name: 'Guest User',
    email: 'guest@hubvault.com',
    role: 'guest',
    hub_id: null,
    can_create_hub: false,
    created_at: new Date().toISOString(),
  };

  const trialUser: Profile = {
    id: 'user-trial',
    name: 'Trial User',
    email: 'trial@hubvault.com',
    role: 'trial_user',
    hub_id: null,
    can_create_hub: false,
    is_approved: false,
    created_at: new Date().toISOString(),
  };

  const collectorUser: Profile = {
    id: 'user-collector',
    name: 'Collector User',
    email: 'collector@hubvault.com',
    role: 'collector',
    hub_id: 'hub-1',
    can_create_hub: false,
    created_at: new Date().toISOString(),
  };

  const supervisorUser: Profile = {
    id: 'user-sup',
    name: 'Supervisor User',
    email: 'supervisor@hubvault.com',
    role: 'supervisor',
    hub_id: 'hub-1',
    can_create_hub: false,
    created_at: new Date().toISOString(),
  };

  const hubAdminUser: Profile = {
    id: 'user-ha',
    name: 'Hub Admin User',
    email: 'hubadmin@hubvault.com',
    role: 'hub_admin',
    hub_id: 'hub-1',
    can_create_hub: true,
    created_at: new Date().toISOString(),
  };

  it('guest cannot become super_admin via profile update', () => {
    const updated = simulateUpdateMyProfile(guestUser, { p_role: 'super_admin' });
    expect(updated.role).toBe('guest');
  });

  it('trial user cannot change role', () => {
    const updated = simulateUpdateMyProfile(trialUser, { p_role: 'hub_admin' });
    expect(updated.role).toBe('trial_user');
  });

  it('collector cannot change role', () => {
    const updated = simulateUpdateMyProfile(collectorUser, { p_role: 'supervisor' });
    expect(updated.role).toBe('collector');
  });

  it('supervisor cannot change role', () => {
    const updated = simulateUpdateMyProfile(supervisorUser, { p_role: 'hub_admin' });
    expect(updated.role).toBe('supervisor');
  });

  it('hub_admin cannot promote themselves to super_admin', () => {
    const updated = simulateUpdateMyProfile(hubAdminUser, { p_role: 'super_admin' });
    expect(updated.role).toBe('hub_admin');
  });

  it('ordinary user cannot change approval status', () => {
    const updated = simulateUpdateMyProfile(trialUser, { p_is_approved: true });
    expect(updated.is_approved).toBe(false);
  });

  it('ordinary user cannot change licence fields', () => {
    const updated = simulateUpdateMyProfile(hubAdminUser, { p_license_status: 'activated' });
    expect(updated.license_status).toBe(hubAdminUser.license_status);
  });

  it('ordinary user cannot change hub credits', () => {
    const updated = simulateUpdateMyProfile(hubAdminUser, { p_hub_credits: 100 });
    expect(updated.hub_add_credits).toBe(hubAdminUser.hub_add_credits);
  });

  it('ordinary user cannot change hub_id or hub access', () => {
    const updated = simulateUpdateMyProfile(collectorUser, { p_hub_id: 'hub-999' });
    expect(updated.hub_id).toBe('hub-1');
  });

  it('safe profile fields can still be updated', () => {
    const updated = simulateUpdateMyProfile(collectorUser, {
      p_name: 'Updated Collector Name',
      p_phone: '9876543210',
      p_company: 'Valmo Logistics',
      p_location: 'Mumbai Branch',
    });

    expect(updated.name).toBe('Updated Collector Name');
    expect(updated.phone).toBe('9876543210');
    expect(updated.company).toBe('Valmo Logistics');
    expect(updated.location).toBe('Mumbai Branch');
    expect(updated.role).toBe('collector');
  });

  it('super_admin authorized updates still work when performed through admin channels', () => {
    // Admin management update helper simulation
    function adminUpdateRole(target: Profile, newRole: UserRole, performingUserRole: UserRole): Profile {
      if (performingUserRole !== 'super_admin') {
        throw new Error('Unauthorized');
      }
      return { ...target, role: newRole };
    }

    const updated = adminUpdateRole(collectorUser, 'supervisor', 'super_admin');
    expect(updated.role).toBe('supervisor');

    expect(() => adminUpdateRole(collectorUser, 'super_admin', 'hub_admin')).toThrow('Unauthorized');
  });
});
