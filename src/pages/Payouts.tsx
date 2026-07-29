import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Wallet, RefreshCw, CheckCircle2, XCircle, Clock, Landmark,
  IndianRupee, Users, TrendingUp, AlertCircle, Phone,
} from 'lucide-react';
import { supabase, SUPABASE_URL } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { Button, Card, EmptyState, Input, Badge, Spinner } from '@/components/ui/primitives';
import Modal from '@/components/ui/Modal';
import { confirm } from '@/lib/confirm';
import { formatINR, formatDate, formatDateTime } from '@/lib/format';
import { clsx } from 'clsx';

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/manage-user`;

interface PayoutWithdrawal {
  id: string;
  user_id: string;
  amount: number;
  status: 'pending' | 'processed' | 'rejected';
  bank_account_name: string;
  bank_account_number: string;
  bank_ifsc: string;
  bank_name: string;
  upi_id: string | null;
  admin_notes: string | null;
  processed_at: string | null;
  processed_by: string | null;
  created_at: string;
  user: { name: string; email: string; phone?: string; referral_code?: string; referral_earnings?: number } | null;
}

interface Earner {
  id: string;
  name: string;
  email: string;
  phone?: string;
  referral_code?: string;
  referral_earnings: number;
  created_at: string;
  referral_stats: { total: number; earned: number; paid: number; pending: number };
  total_withdrawn: number;
  available_balance: number;
}

interface PayoutStats {
  total: number;
  pending: number;
  processed: number;
  total_paid_out: number;
  total_pending_amount: number;
}

export default function Payouts() {
  const toast = useToast();
  const { profile: myProfile } = useAuth();
  const isSuperAdmin = myProfile?.role === 'super_admin';

  const [tab, setTab] = useState<'withdrawals' | 'earners'>('withdrawals');
  const [loading, setLoading] = useState(true);
  const [withdrawals, setWithdrawals] = useState<PayoutWithdrawal[]>([]);
  const [earners, setEarners] = useState<Earner[]>([]);
  const [stats, setStats] = useState<PayoutStats>({ total: 0, pending: 0, processed: 0, total_paid_out: 0, total_pending_amount: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState(false);
  const [detailWd, setDetailWd] = useState<PayoutWithdrawal | null>(null);
  const [rejectModal, setRejectModal] = useState<PayoutWithdrawal | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const callApi = async (action: string, body?: Record<string, unknown>) => {
    let token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) {
      const { data } = await supabase.auth.refreshSession();
      token = data.session?.access_token;
    }
    if (!token) throw new Error('Your session has expired. Please log in again.');
    const doFetch = async (tok: string) => {
      const response = await fetch(`${FUNCTION_URL}?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: body ? JSON.stringify(body) : undefined,
      });
      return { response, data: await response.json() };
    };
    let { response, data } = await doFetch(token);
    if (response.status === 401) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      if (refreshed.session?.access_token) {
        ({ response, data } = await doFetch(refreshed.session.access_token));
      }
    }
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  };

  const loadWithdrawals = useCallback(async () => {
    setLoading(true);
    try {
      const { data: wdData, error: wdErr } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (wdErr) throw wdErr;

      const userIds = [...new Set((wdData ?? []).map((w: PayoutWithdrawal) => w.user_id))];
      const profileMap = new Map<string, { name: string; email: string; phone?: string; referral_code?: string; referral_earnings?: number }>();
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, name, email, phone, referral_code, referral_earnings')
          .in('id', userIds);
        for (const p of profs ?? []) {
          profileMap.set(p.id, p);
        }
      }

      const merged: PayoutWithdrawal[] = (wdData ?? []).map((w: PayoutWithdrawal) => ({
        ...w,
        user: profileMap.get(w.user_id) ?? null,
      }));

      const allWd = merged as PayoutWithdrawal[];
      const pending = allWd.filter((w) => w.status === 'pending');
      const processed = allWd.filter((w) => w.status === 'processed');
      const totalPaidOut = processed.reduce((sum, w) => sum + Number(w.amount), 0);
      const totalPendingAmount = pending.reduce((sum, w) => sum + Number(w.amount), 0);

      setWithdrawals(allWd);
      setStats({
        total: allWd.length,
        pending: pending.length,
        processed: processed.length,
        total_paid_out: totalPaidOut,
        total_pending_amount: totalPendingAmount,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load withdrawals');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadEarners = useCallback(async () => {
    try {
      const { data: earnersData, error: earnersErr } = await supabase
        .from('profiles')
        .select('id, name, email, phone, referral_code, referral_earnings, created_at')
        .gt('referral_earnings', 0)
        .order('referral_earnings', { ascending: false });
      if (earnersErr) throw earnersErr;

      const earnerIds = (earnersData ?? []).map((e: { id: string }) => e.id);
      const referralMap = new Map<string, { total: number; earned: number; paid: number; pending: number }>();
      if (earnerIds.length > 0) {
        const { data: refs } = await supabase
          .from('referrals')
          .select('referrer_id, status')
          .in('referrer_id', earnerIds);
        for (const r of refs ?? []) {
          const cur = referralMap.get(r.referrer_id) ?? { total: 0, earned: 0, paid: 0, pending: 0 };
          cur.total += 1;
          if (r.status === 'commission_earned') cur.earned += 1;
          else if (r.status === 'commission_paid') cur.paid += 1;
          else if (r.status === 'pending') cur.pending += 1;
          referralMap.set(r.referrer_id, cur);
        }
      }

      const withdrawnMap = new Map<string, number>();
      if (earnerIds.length > 0) {
        const { data: wds } = await supabase
          .from('withdrawal_requests')
          .select('user_id, status, amount')
          .in('user_id', earnerIds);
        for (const w of wds ?? []) {
          if (w.status === 'processed') {
            withdrawnMap.set(w.user_id, (withdrawnMap.get(w.user_id) ?? 0) + Number(w.amount));
          }
        }
      }

      const result: Earner[] = (earnersData ?? []).map((e: typeof earnersData[number]) => ({
        ...e,
        referral_stats: referralMap.get(e.id) ?? { total: 0, earned: 0, paid: 0, pending: 0 },
        total_withdrawn: withdrawnMap.get(e.id) ?? 0,
        available_balance: Number(e.referral_earnings) || 0,
      }));

      setEarners(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load earners');
    }
  }, [toast]);

  useEffect(() => {
    if (isSuperAdmin) {
      loadWithdrawals();
      loadEarners();
    }
  }, [isSuperAdmin, loadWithdrawals, loadEarners]);

  const filteredWithdrawals = useMemo(() => {
    const q = search.trim().toLowerCase();
    return withdrawals.filter((w) => {
      if (statusFilter !== 'all' && w.status !== statusFilter) return false;
      if (!q) return true;
      return (
        w.user?.name?.toLowerCase().includes(q) ||
        w.user?.email?.toLowerCase().includes(q) ||
        w.bank_name?.toLowerCase().includes(q) ||
        w.bank_account_number?.includes(q)
      );
    });
  }, [withdrawals, search, statusFilter]);

  const filteredEarners = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return earners;
    return earners.filter((e) =>
      e.name?.toLowerCase().includes(q) ||
      e.email?.toLowerCase().includes(q) ||
      e.referral_code?.toLowerCase().includes(q)
    );
  }, [earners, search]);

  const handleProcess = async (wd: PayoutWithdrawal) => {
    const ok = await confirm({
      title: 'Mark as Paid?',
      message: `Confirm that you have transferred ${formatINR(wd.amount)} to ${wd.user?.name ?? 'this user'}'s bank account (${wd.bank_name}, A/C ending ${wd.bank_account_number.slice(-4)}). This action will be logged.`,
      confirmLabel: 'Yes, Mark Paid',
    });
    if (!ok) return;
    setActionLoading(true);
    try {
      await callApi('admin-process-withdrawal', { withdrawal_id: wd.id });
      toast.success('Withdrawal marked as paid');
      setDetailWd(null);
      loadWithdrawals();
      loadEarners();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to process withdrawal');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setActionLoading(true);
    try {
      await callApi('admin-reject-withdrawal', {
        withdrawal_id: rejectModal.id,
        admin_notes: rejectReason.trim() || undefined,
      });
      toast.success('Withdrawal rejected. Earnings refunded to user.');
      setRejectModal(null);
      setRejectReason('');
      loadWithdrawals();
      loadEarners();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reject withdrawal');
    } finally {
      setActionLoading(false);
    }
  };

  const statusBadge = (status: PayoutWithdrawal['status']) => {
    if (status === 'pending') return <Badge color="amber"><Clock className="h-3 w-3 inline mr-1" />Pending</Badge>;
    if (status === 'processed') return <Badge color="green"><CheckCircle2 className="h-3 w-3 inline mr-1" />Paid</Badge>;
    return <Badge color="red"><XCircle className="h-3 w-3 inline mr-1" />Rejected</Badge>;
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex justify-center py-20">
        <EmptyState icon={<AlertCircle className="h-8 w-8" />} title="Access Denied" message="Only super admins can manage payouts." />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Payouts & Commissions</h1>
          <p className="mt-1 text-sm text-neutral-500">View referral earnings, process withdrawal requests, and track payouts.</p>
        </div>
        <Button variant="outline" size="md" icon={<RefreshCw className="h-4 w-4" />} onClick={() => { loadWithdrawals(); loadEarners(); }} disabled={loading}>
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5 animate-fade-in">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl ring-1 bg-amber-500/10 text-amber-600 ring-amber-200 dark:ring-amber-500/30">
            <Clock className="h-5 w-5" />
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium text-neutral-500">Pending Payouts</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 tabular-nums">{stats.pending}</p>
            <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">{formatINR(stats.total_pending_amount)} to pay</p>
          </div>
        </Card>

        <Card className="p-5 animate-fade-in">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl ring-1 bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400 dark:ring-emerald-500/30">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium text-neutral-500">Total Paid Out</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 tabular-nums">{formatINR(stats.total_paid_out)}</p>
            <p className="mt-1.5 text-xs text-neutral-500">{stats.processed} completed</p>
          </div>
        </Card>

        <Card className="p-5 animate-fade-in">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl ring-1 bg-brand-600/15 text-brand-600 ring-brand-600/30">
            <Users className="h-5 w-5" />
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium text-neutral-500">Active Earners</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 tabular-nums">{earners.length}</p>
            <p className="mt-1.5 text-xs text-neutral-500">users with earnings</p>
          </div>
        </Card>

        <Card className="p-5 animate-fade-in">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl ring-1 bg-blue-50 text-blue-600 ring-blue-100 dark:bg-blue-500/15 dark:text-blue-400 dark:ring-blue-500/30">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium text-neutral-500">Total Withdrawals</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 tabular-nums">{stats.total}</p>
            <p className="mt-1.5 text-xs text-neutral-500">all-time requests</p>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-neutral-100 dark:bg-neutral-800/60 p-1 w-fit">
        <button
          onClick={() => setTab('withdrawals')}
          className={clsx(
            'rounded-lg px-4 py-2 text-sm font-semibold transition',
            tab === 'withdrawals' ? 'bg-white dark:bg-neutral-900 text-brand-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
          )}
        >
          Withdrawal Requests
        </button>
        <button
          onClick={() => setTab('earners')}
          className={clsx(
            'rounded-lg px-4 py-2 text-sm font-semibold transition',
            tab === 'earners' ? 'bg-white dark:bg-neutral-900 text-brand-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
          )}
        >
          All Earners
        </button>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          name="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tab === 'withdrawals' ? 'Search by name, email, bank...' : 'Search by name, email, code...'}
          className="sm:max-w-xs"
        />
        {tab === 'withdrawals' && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-2.5 text-sm font-medium text-neutral-700 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="processed">Paid</option>
            <option value="rejected">Rejected</option>
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      ) : tab === 'withdrawals' ? (
        <Card className="overflow-hidden">
          {filteredWithdrawals.length > 0 ? (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 dark:bg-neutral-950/80 text-neutral-500 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-5 py-3 font-semibold">User</th>
                      <th className="text-right px-4 py-3 font-semibold">Amount</th>
                      <th className="text-left px-4 py-3 font-semibold">Bank Details</th>
                      <th className="text-center px-4 py-3 font-semibold">Status</th>
                      <th className="text-right px-4 py-3 font-semibold">Requested</th>
                      <th className="text-center px-5 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {filteredWithdrawals.map((w) => (
                      <tr key={w.id} className={clsx('hover:bg-neutral-50 dark:hover:bg-neutral-950/70 transition-colors', w.status === 'pending' && 'bg-amber-50/40 dark:bg-amber-500/5')}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-brand-600/20 to-brand-600/10 text-brand-600 flex items-center justify-center font-bold text-xs shrink-0">
                              {w.user?.name?.charAt(0).toUpperCase() ?? '?'}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-neutral-800 dark:text-neutral-200 truncate">{w.user?.name ?? 'Unknown'}</div>
                              <div className="text-xs text-neutral-500 truncate">{w.user?.email ?? ''}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums font-bold text-neutral-800 dark:text-neutral-200">{formatINR(w.amount)}</td>
                        <td className="px-4 py-3.5">
                          <div className="text-neutral-800 dark:text-neutral-200 font-medium">{w.bank_name}</div>
                          <div className="text-xs text-neutral-500">A/C: {w.bank_account_number.slice(-4)} · IFSC: {w.bank_ifsc}</div>
                          {w.upi_id && <div className="text-xs text-neutral-500">UPI: {w.upi_id}</div>}
                        </td>
                        <td className="px-4 py-3.5 text-center">{statusBadge(w.status)}</td>
                        <td className="px-4 py-3.5 text-right text-neutral-500 text-xs">{formatDate(w.created_at)}</td>
                        <td className="px-5 py-3.5 text-center">
                          {w.status === 'pending' ? (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleProcess(w)}
                                disabled={actionLoading}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" /> Pay
                              </button>
                              <button
                                onClick={() => { setRejectModal(w); setRejectReason(''); }}
                                disabled={actionLoading}
                                className="inline-flex items-center gap-1 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 transition hover:bg-red-500/20 active:scale-95 disabled:opacity-50"
                              >
                                <XCircle className="h-3.5 w-3.5" /> Reject
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDetailWd(w)}
                              className="text-xs font-medium text-brand-600 hover:underline"
                            >
                              View Details
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="divide-y divide-neutral-200 dark:divide-neutral-800 md:hidden">
                {filteredWithdrawals.map((w) => (
                  <div key={w.id} className={clsx('p-4', w.status === 'pending' && 'bg-amber-50/40 dark:bg-amber-500/5')}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-600/20 to-brand-600/10 text-brand-600 flex items-center justify-center font-bold text-sm shrink-0">
                          {w.user?.name?.charAt(0).toUpperCase() ?? '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-neutral-800 dark:text-neutral-200 truncate">{w.user?.name ?? 'Unknown'}</p>
                          <p className="text-xs text-neutral-500 truncate">{w.user?.email ?? ''}</p>
                        </div>
                      </div>
                      {statusBadge(w.status)}
                    </div>
                    <div className="flex items-center justify-between text-xs text-neutral-500 mb-2">
                      <span>{w.bank_name} · A/C {w.bank_account_number.slice(-4)}</span>
                      <span className="font-bold text-base text-neutral-800 dark:text-neutral-200">{formatINR(w.amount)}</span>
                    </div>
                    <p className="text-xs text-neutral-500 mb-3">Requested: {formatDate(w.created_at)}</p>
                    {w.status === 'pending' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleProcess(w)}
                          disabled={actionLoading}
                          className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Mark Paid
                        </button>
                        <button
                          onClick={() => { setRejectModal(w); setRejectReason(''); }}
                          disabled={actionLoading}
                          className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 transition hover:bg-red-500/20 active:scale-95 disabled:opacity-50"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Reject
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setDetailWd(w)} className="text-xs font-medium text-brand-600 hover:underline">
                        View Details
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              icon={<Wallet className="h-8 w-8" />}
              title="No withdrawal requests"
              message="When users request commission withdrawals, they'll appear here for you to process."
            />
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {filteredEarners.length > 0 ? (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 dark:bg-neutral-950/80 text-neutral-500 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-5 py-3 font-semibold">User</th>
                      <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Referral Code</th>
                      <th className="text-center px-4 py-3 font-semibold">Referrals</th>
                      <th className="text-right px-4 py-3 font-semibold">Total Earned</th>
                      <th className="text-right px-4 py-3 font-semibold">Withdrawn</th>
                      <th className="text-right px-5 py-3 font-semibold">Available</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {filteredEarners.map((e) => (
                      <tr key={e.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-950/70 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0">
                              {e.name?.charAt(0).toUpperCase() ?? '?'}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-neutral-800 dark:text-neutral-200 truncate">{e.name}</div>
                              <div className="text-xs text-neutral-500 truncate">{e.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 hidden lg:table-cell">
                          <code className="text-xs font-mono font-semibold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-600/10 px-2 py-0.5 rounded">{e.referral_code ?? '—'}</code>
                        </td>
                        <td className="px-4 py-3.5 text-center text-neutral-600 dark:text-neutral-300">
                          <span className="font-bold">{e.referral_stats.total}</span>
                          <span className="text-xs text-neutral-400 ml-1">({e.referral_stats.earned} earned)</span>
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums font-bold text-emerald-600 dark:text-emerald-400">{formatINR(e.referral_earnings)}</td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-neutral-500">{formatINR(e.total_withdrawn)}</td>
                        <td className="px-5 py-3.5 text-right tabular-nums font-bold text-neutral-800 dark:text-neutral-200">{formatINR(e.available_balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-neutral-200 dark:divide-neutral-800 md:hidden">
                {filteredEarners.map((e) => (
                  <div key={e.id} className="p-4">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-sm shrink-0">
                          {e.name?.charAt(0).toUpperCase() ?? '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-neutral-800 dark:text-neutral-200 truncate">{e.name}</p>
                          <p className="text-xs text-neutral-500 truncate">{e.email}</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center mt-3">
                      <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/50 px-2 py-1.5">
                        <p className="text-[10px] text-neutral-500">Earned</p>
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatINR(e.referral_earnings)}</p>
                      </div>
                      <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/50 px-2 py-1.5">
                        <p className="text-[10px] text-neutral-500">Withdrawn</p>
                        <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300">{formatINR(e.total_withdrawn)}</p>
                      </div>
                      <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/50 px-2 py-1.5">
                        <p className="text-[10px] text-neutral-500">Available</p>
                        <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200">{formatINR(e.available_balance)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              icon={<IndianRupee className="h-8 w-8" />}
              title="No earners yet"
              message="Users who have earned referral commission will appear here."
            />
          )}
        </Card>
      )}

      {/* Detail Modal */}
      <Modal
        open={!!detailWd}
        onClose={() => setDetailWd(null)}
        title="Withdrawal Details"
        size="md"
        closable
        footer={
          detailWd?.status === 'pending' ? (
            <>
              <Button variant="outline" onClick={() => setDetailWd(null)}>Close</Button>
              <Button
                variant="outline"
                className="text-red-600 border-red-300 hover:bg-red-500/10"
                onClick={() => { setRejectModal(detailWd); setRejectReason(''); setDetailWd(null); }}
                icon={<XCircle className="h-4 w-4" />}
                disabled={actionLoading}
              >
                Reject
              </Button>
              <Button
                onClick={() => detailWd && handleProcess(detailWd)}
                loading={actionLoading}
                icon={<CheckCircle2 className="h-4 w-4" />}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Mark as Paid
              </Button>
            </>
          ) : <Button variant="outline" onClick={() => setDetailWd(null)}>Close</Button>
        }
      >
        {detailWd && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-brand-600/20 to-brand-600/10 text-brand-600 flex items-center justify-center font-bold">
                  {detailWd.user?.name?.charAt(0).toUpperCase() ?? '?'}
                </div>
                <div>
                  <p className="font-bold text-neutral-900 dark:text-neutral-100">{detailWd.user?.name ?? 'Unknown'}</p>
                  <p className="text-xs text-neutral-500">{detailWd.user?.email}</p>
                </div>
              </div>
              {statusBadge(detailWd.status)}
            </div>

            <div className="rounded-xl bg-gradient-to-r from-brand-600/10 to-brand-400/10 border border-brand-600/20 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-neutral-500 font-medium">Withdrawal Amount</p>
                  <p className="text-3xl font-bold gradient-text">{formatINR(detailWd.amount)}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-600/15">
                  <IndianRupee className="h-6 w-6 text-brand-600" />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Landmark className="h-4 w-4 text-brand-600" />
                <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">Bank Account Details</h3>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-neutral-500">Account Holder</p>
                  <p className="font-medium text-neutral-800 dark:text-neutral-200">{detailWd.bank_account_name}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Bank Name</p>
                  <p className="font-medium text-neutral-800 dark:text-neutral-200">{detailWd.bank_name}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Account Number</p>
                  <p className="font-medium text-neutral-800 dark:text-neutral-200 font-mono">{detailWd.bank_account_number}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">IFSC Code</p>
                  <p className="font-medium text-neutral-800 dark:text-neutral-200 font-mono">{detailWd.bank_ifsc}</p>
                </div>
                {detailWd.upi_id && (
                  <div className="col-span-2">
                    <p className="text-xs text-neutral-500">UPI ID</p>
                    <p className="font-medium text-neutral-800 dark:text-neutral-200 font-mono">{detailWd.upi_id}</p>
                  </div>
                )}
              </div>
            </div>

            {detailWd.user?.phone && (
              <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
                <Phone className="h-4 w-4 text-neutral-400" />
                <span>{detailWd.user.phone}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/50 px-3 py-2">
                <p className="text-xs text-neutral-500">Requested On</p>
                <p className="font-medium text-neutral-800 dark:text-neutral-200">{formatDateTime(detailWd.created_at)}</p>
              </div>
              {detailWd.processed_at && (
                <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/50 px-3 py-2">
                  <p className="text-xs text-neutral-500">{detailWd.status === 'rejected' ? 'Rejected On' : 'Processed On'}</p>
                  <p className="font-medium text-neutral-800 dark:text-neutral-200">{formatDateTime(detailWd.processed_at)}</p>
                </div>
              )}
            </div>

            {detailWd.admin_notes && (
              <div className={clsx(
                'rounded-lg p-3 text-sm',
                detailWd.status === 'rejected'
                  ? 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400'
                  : 'bg-neutral-50 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-300'
              )}>
                <p className="text-xs font-semibold mb-0.5">Admin Notes</p>
                <p>{detailWd.admin_notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        open={!!rejectModal}
        onClose={() => { setRejectModal(null); setRejectReason(''); }}
        title="Reject Withdrawal?"
        subtitle="The withdrawn amount will be refunded to the user's earnings balance."
        size="sm"
        closable
        footer={
          <>
            <Button variant="outline" onClick={() => { setRejectModal(null); setRejectReason(''); }}>Cancel</Button>
            <Button
              onClick={handleReject}
              loading={actionLoading}
              className="bg-red-600 hover:bg-red-700"
              icon={<XCircle className="h-4 w-4" />}
            >
              Confirm Rejection
            </Button>
          </>
        }
      >
        {rejectModal && (
          <div className="space-y-4">
            <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800 dark:text-red-400">Reject {formatINR(rejectModal.amount)} withdrawal?</p>
                  <p className="text-xs text-red-700 dark:text-red-500/80 mt-0.5">
                    User: {rejectModal.user?.name} · Bank: {rejectModal.bank_name} (A/C {rejectModal.bank_account_number.slice(-4)})
                  </p>
                </div>
              </div>
            </div>
            <Input
              label="Rejection Reason (optional)"
              name="reject_reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Invalid bank details, duplicate request..."
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
