import { supabase } from './supabase';

export async function logAudit(
  action: string,
  performedBy: string | null,
  details: string,
  targetUserId: string | null = null,
  targetHubId: string | null = null,
) {
  try {
    await supabase.from('audit_logs').insert({
      action,
      performed_by: performedBy,
      target_user_id: targetUserId,
      target_hub_id: targetHubId,
      details,
    });
  } catch {
    // silent fail — audit logging should not block user actions
  }
}
