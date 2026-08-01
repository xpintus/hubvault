import { useToast } from '@/components/ui/Toast';
import { Card,EmptyState,Select,Skeleton } from '@/components/ui/primitives';
import { formatDate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { AuditLog } from '@/types';
import { clsx } from 'clsx';
import { Building2,Search,ShieldAlert,User } from 'lucide-react';
import { useCallback,useEffect,useMemo,useState } from 'react';

const ACTION_LABELS: Record<string, string> = {
  user_created: 'User Created',
  user_role_changed: 'Role Changed',
  user_deactivated: 'User Deactivated',
  hub_created: 'Hub Created',
  hub_created_by_hub_admin: 'Hub Created by Admin',
  hub_access_granted: 'Hub Access Granted',
  hub_access_removed: 'Hub Access Removed',
  permissions_changed: 'Permissions Changed',
};

const ACTION_COLORS: Record<string, string> = {
  user_created: 'green',
  user_role_changed: 'blue',
  user_deactivated: 'red',
  hub_created: 'brand',
  hub_created_by_hub_admin: 'amber',
  hub_access_granted: 'green',
  hub_access_removed: 'red',
  permissions_changed: 'amber',
};

const badgeColorMap: Record<string, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200/60',
  blue: 'bg-blue-500/10 text-blue-400 ring-blue-200/60',
  red: 'bg-red-500/10 text-red-400 ring-red-500/30',
  amber: 'bg-amber-500/10 text-amber-400 ring-amber-500/30',
  brand: 'bg-brand-600/15 text-brand-600 ring-brand-600/30',
  slate: 'bg-neutral-100 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 ring-neutral-200 dark:ring-neutral-700/60',
};

export default function AuditLogs() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*, performer: profiles!audit_logs_performed_by_fkey(*), target_user: profiles!audit_logs_target_user_id_fkey(*), target_hub: hubs!audit_logs_target_hub_id_fkey(*)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      setLogs(data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (actionFilter !== 'all' && l.action !== actionFilter) return false;
      if (!q) return true;
      return (
        (l.performer?.name ?? '').toLowerCase().includes(q) ||
        (l.target_user?.name ?? '').toLowerCase().includes(q) ||
        (l.target_hub?.name ?? '').toLowerCase().includes(q) ||
        (l.details ?? '').toLowerCase().includes(q)
      );
    });
  }, [logs, search, actionFilter]);

  const availableActions = useMemo(() => {
    return Array.from(new Set(logs.map((l) => l.action))).sort();
  }, [logs]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Audit Logs</h1>
        <p className="mt-1 text-sm text-neutral-500">Track all access changes, role updates, and hub management actions.</p>
        <p className="mt-2 text-sm text-neutral-500 font-medium">{logs.length} log entr{logs.length !== 1 ? 'ies' : 'y'} (last 200)</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500 dark:text-neutral-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by user, hub, or details…" className="input-base pl-10" />
        </div>
        <Select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="sm:w-52">
          <option value="all">All Actions</option>
          {availableActions.map((a) => <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>)}
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card><EmptyState icon={<ShieldAlert className="h-7 w-7" />} title="No audit logs" message="Access changes and user management actions will appear here." /></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {filtered.map((log) => {
              const color = ACTION_COLORS[log.action] ?? 'slate';
              return (
                <div key={log.id} className="flex items-start gap-4 p-4 hover:bg-neutral-100 dark:hover:bg-neutral-950/70 transition-colors">
                  <div className={clsx('shrink-0 rounded-xl p-2.5 ring-1', badgeColorMap[color])}>
                    <ShieldAlert className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={clsx('inline-flex rounded-lg px-2 py-0.5 text-xs font-semibold ring-1 ring-inset', badgeColorMap[color])}>
                        {ACTION_LABELS[log.action] ?? log.action}
                      </span>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">{formatDate(log.created_at)}</span>
                    </div>
                    <p className="mt-1.5 text-sm text-neutral-700 dark:text-neutral-300">{log.details}</p>
                    <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-neutral-500 dark:text-neutral-400">
                      {log.performer && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" /> by {log.performer.name}
                        </span>
                      )}
                      {log.target_hub && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" /> {log.target_hub.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
