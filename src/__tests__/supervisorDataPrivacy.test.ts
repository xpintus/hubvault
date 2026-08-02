import { Profile,UserRole } from '@/types';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe,expect,it } from 'vitest';

// Mock authorization evaluator representing RLS and Edge Function policies
interface _QueryContext {
  caller: Profile;
  accessibleHubIds: string[];
}

function canSupervisorSelectProfile(caller: Profile, target: Profile, accessibleHubIds: string[]): boolean {
  if (caller.role === 'super_admin') return true;
  if (caller.id === target.id) return true;

  if (caller.role === 'hub_admin') {
    if (!target.hub_id || !accessibleHubIds.includes(target.hub_id)) return false;
    return ['collector', 'supervisor'].includes(target.role);
  }

  if (caller.role === 'supervisor') {
    if (!target.hub_id || !accessibleHubIds.includes(target.hub_id)) return false;
    return target.role === 'collector';
  }

  return false;
}

function sanitizeProfileForSupervisor(profile: Profile): Partial<Profile> {
  // Omit sensitive hub-admin fields
  const {
    email,
    license_status,
    license_expires_at,
    license_activated_at,
    hub_add_credits,
    referral_code,
    referral_earnings,
    is_approved,
    can_create_hub,
    ...safeFields
  } = profile;
  return safeFields;
}

function canSupervisorManageUserAction(callerRole: UserRole, action: string): boolean {
  const selfService = ['get-referral-stats', 'apply-referral-code', 'request-withdrawal', 'get-withdrawals'];
  if (callerRole === 'super_admin' || callerRole === 'hub_admin') return true;
  if (callerRole === 'supervisor' && selfService.includes(action)) return true;
  return false;
}

describe('Supervisor Data Privacy & User Management Access', () => {
  const superAdmin: Profile = {
    id: 'sa-1',
    name: 'Super Admin',
    email: 'admin@hubvault.com',
    role: 'super_admin',
    hub_id: null,
    can_create_hub: true,
    created_at: new Date().toISOString(),
  };

  const hubAdmin: Profile = {
    id: 'ha-1',
    name: 'Hub Admin',
    email: 'hubadmin@hubvault.com',
    role: 'hub_admin',
    hub_id: 'hub-100',
    can_create_hub: true,
    created_at: new Date().toISOString(),
    license_status: 'activated',
    license_expires_at: '2027-01-01',
    hub_add_credits: 5,
    referral_code: 'REF123',
    referral_earnings: 1500,
    is_approved: true,
  };

  const supervisor: Profile = {
    id: 'sup-1',
    name: 'Supervisor John',
    email: 'sup@hubvault.com',
    role: 'supervisor',
    hub_id: 'hub-100',
    can_create_hub: false,
    created_at: new Date().toISOString(),
  };

  const collector: Profile = {
    id: 'col-1',
    name: 'Collector Dave',
    email: 'col@hubvault.com',
    role: 'collector',
    hub_id: 'hub-100',
    can_create_hub: false,
    created_at: new Date().toISOString(),
  };

  it('supervisor cannot read hub-admin email when querying profiles', () => {
    const accessibleHubs = ['hub-100'];
    const canSelect = canSupervisorSelectProfile(supervisor, hubAdmin, accessibleHubs);
    expect(canSelect).toBe(false);

    // If sanitized, email is omitted
    const sanitized = sanitizeProfileForSupervisor(hubAdmin);
    expect(sanitized.email).toBeUndefined();
  });

  it('supervisor cannot read hub-admin licence information', () => {
    const sanitized = sanitizeProfileForSupervisor(hubAdmin);
    expect(sanitized.license_status).toBeUndefined();
    expect(sanitized.license_expires_at).toBeUndefined();
    expect(sanitized.license_activated_at).toBeUndefined();
  });

  it('supervisor cannot read hub credits', () => {
    const sanitized = sanitizeProfileForSupervisor(hubAdmin);
    expect(sanitized.hub_add_credits).toBeUndefined();
  });

  it('supervisor cannot read approval fields', () => {
    const sanitized = sanitizeProfileForSupervisor(hubAdmin);
    expect(sanitized.is_approved).toBeUndefined();
  });

  it('supervisor cannot edit or delete the hub admin', () => {
    // Supervisor attempting user management actions against hubAdmin
    const canUpdate = canSupervisorSelectProfile(supervisor, hubAdmin, ['hub-100']);
    expect(canUpdate).toBe(false);

    const canCallManage = canSupervisorManageUserAction(supervisor.role, 'update');
    expect(canCallManage).toBe(false);

    const canCallDelete = canSupervisorManageUserAction(supervisor.role, 'delete');
    expect(canCallDelete).toBe(false);
  });

  it('supervisor cannot call privileged manage-user actions', () => {
    expect(canSupervisorManageUserAction(supervisor.role, 'create')).toBe(false);
    expect(canSupervisorManageUserAction(supervisor.role, 'reset-password')).toBe(false);
    expect(canSupervisorManageUserAction(supervisor.role, 'generate-license')).toBe(false);
    expect(canSupervisorManageUserAction(supervisor.role, 'verify-upi-payment')).toBe(false);
  });

  it('supervisor can still access permitted hub operational data for collectors', () => {
    const accessibleHubs = ['hub-100'];
    const canSelectCollector = canSupervisorSelectProfile(supervisor, collector, accessibleHubs);
    expect(canSelectCollector).toBe(true);

    const canSelectSelf = canSupervisorSelectProfile(supervisor, supervisor, accessibleHubs);
    expect(canSelectSelf).toBe(true);
  });

  it('hub_admin and super_admin behavior remains unchanged for user management', () => {
    expect(canSupervisorManageUserAction(superAdmin.role, 'create')).toBe(true);
    expect(canSupervisorManageUserAction(superAdmin.role, 'delete')).toBe(true);

    expect(canSupervisorManageUserAction(hubAdmin.role, 'create')).toBe(true);
    expect(canSupervisorManageUserAction(hubAdmin.role, 'update')).toBe(true);

    const canHubAdminSelectSupervisor = canSupervisorSelectProfile(hubAdmin, supervisor, ['hub-100']);
    expect(canHubAdminSelectSupervisor).toBe(true);
  });

  it('preserves Daily Closing history when an authorized admin deletes a user', () => {
    const migration = readFileSync(resolve('supabase/migrations/20260803210000_allow_user_delete_with_closing_history.sql'), 'utf8');
    const edgeFunction = readFileSync(resolve('supabase/functions/manage-user/index.ts'), 'utf8');

    expect(migration).toContain('alter column submitted_by drop not null');
    expect(migration).toContain('alter column performed_by drop not null');
    expect(migration).toContain('alter column finalized_by drop not null');
    expect((migration.match(/on delete set null/g) ?? [])).toHaveLength(3);
    expect(edgeFunction).toContain('target_user_id: null');
    expect(edgeFunction).toContain('Deleted user ${target.name} (${body.user_id})');
  });

  it('allows only Super Admin to permanently delete a hub transactionally', () => {
    const hubsPage = readFileSync(resolve('src/pages/Hubs.tsx'), 'utf8');
    const migration = readFileSync(resolve('supabase/migrations/20260803220000_super_admin_permanent_hub_delete.sql'), 'utf8');
    expect(hubsPage).toContain('const permanentlyDelete = isSuperAdmin');
    expect(hubsPage).toContain("supabase.rpc('permanently_delete_hub'");
    expect(hubsPage).toContain("update({ status: 'inactive' })");
    expect(hubsPage).toContain("isSuperAdmin ? 'Delete permanently' : 'Deactivate'");
    expect(migration).toContain("public.user_role() <> 'super_admin'");
    expect(migration).toContain("if tg_op = 'DELETE' then");
    expect(migration).toContain('return old');
    expect(migration).toContain('delete from public.daily_closing_finalizations');
    expect(migration).toContain('delete from public.daily_closings');
    expect(migration).toContain('delete from public.audit_logs where target_hub_id = p_hub_id');
    expect(migration).toContain('delete from public.hubs where id = p_hub_id');
  });
});
