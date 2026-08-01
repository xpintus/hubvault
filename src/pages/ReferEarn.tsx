import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { Badge,Button,Card,EmptyState,Input,Spinner } from '@/components/ui/primitives';
import { useAuth } from '@/lib/auth';
import { formatDate,formatINR } from '@/lib/format';
import { supabase,SUPABASE_URL } from '@/lib/supabase';
import { clsx } from 'clsx';
import {
ArrowDownToLine,
BadgeCheck,
CalendarClock,
CheckCircle,
CheckCircle2,
ChevronRight,
Clock,
Copy,
Gift,
IndianRupee,
Landmark,
Share2,
Sparkles,
TrendingUp,
Users,
Wallet,
XCircle
} from 'lucide-react';
import { useCallback,useEffect,useState } from 'react';

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/manage-user`;

interface ReferralRecord {
  id: string;
  referee_id: string;
  status: 'pending' | 'commission_earned' | 'commission_paid';
  commission_amount: number;
  earned_at: string | null;
  created_at: string;
  referee: { name: string; email: string } | null;
}

interface ReferralStats {
  referral_code: string;
  total_referrals: number;
  total_earnings: number;
  referrals: ReferralRecord[];
}

interface WithdrawalRecord {
  id: string;
  amount: number;
  status: 'pending' | 'processed' | 'rejected';
  bank_account_name: string;
  bank_account_number: string;
  bank_ifsc: string;
  bank_name: string;
  upi_id: string | null;
  admin_notes: string | null;
  processed_at: string | null;
  created_at: string;
}

export default function ReferEarn() {
  const { profile } = useAuth();
  const toast = useToast();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [applyCode, setApplyCode] = useState('');
  const [applying, setApplying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasReferrer, setHasReferrer] = useState(false);

  // Withdrawal state
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [upiId, setUpiId] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(false);
  const [withdrawSuccess, setWithdrawSuccess] = useState<WithdrawalRecord | null>(null);

  const callApi = async (action: string, body?: Record<string, unknown>) => {
    let token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) {
      const { data } = await supabase.auth.refreshSession();
      token = data.session?.access_token;
    }
    if (!token) throw new Error('Your session has expired. Please log in again.');
    const response = await fetch(`${FUNCTION_URL}?action=${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed.session?.access_token) {
          const retry = await fetch(`${FUNCTION_URL}?action=${action}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${refreshed.session.access_token}`,
            },
            body: body ? JSON.stringify(body) : undefined,
          });
          const retryData = await retry.json();
          if (!retry.ok) throw new Error(retryData.error || `Request failed (${retry.status})`);
          return retryData;
        }
      }
      throw new Error(data.error || `Request failed (${response.status})`);
    }
    return data;
  };

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callApi('get-referral-stats');
      setStats(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load referral data');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadWithdrawals = useCallback(async () => {
    setLoadingWithdrawals(true);
    try {
      const { data, error } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setWithdrawals((data ?? []) as WithdrawalRecord[]);
    } catch {
      // silent fail — withdrawals list is supplementary
    } finally {
      setLoadingWithdrawals(false);
    }
  }, []);

  useEffect(() => {
    // Check if user already has a referrer
    if (profile?.referred_by) setHasReferrer(true);
    loadStats();
    loadWithdrawals();
  }, [profile, loadStats, loadWithdrawals]);

  const handleCopyCode = () => {
    if (!stats?.referral_code) return;
    navigator.clipboard.writeText(stats.referral_code);
    setCopied(true);
    toast.success('Referral code copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareMessage = `🚀 Join HubVault — the smartest way to manage your collection reconciliation!

📋 Use my referral code: ${stats?.referral_code ?? ''}

✅ Track daily collections with note-by-note denomination breakdown
✅ Automatic shortage/excess detection & due recovery tracking
✅ Multi-hub support with real-time dashboards

Sign up now and enter my referral code to get started!`;

  const handleShare = async () => {
    if (!stats?.referral_code) {
      toast.error('Referral code not loaded yet. Please wait a moment.');
      return;
    }

    const shareData = {
      title: 'Join HubVault with my referral code',
      text: shareMessage,
      url: window.location.origin,
    };

    // Try native share first (works on mobile + some desktop browsers)
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // If user explicitly cancelled, don't show error
        if (err instanceof Error && err.name === 'AbortError') return;
        // For other errors, fall through to clipboard fallback
      }
    }

    // Fallback: copy full message to clipboard
    try {
      const fullText = `${shareMessage}\n\n${window.location.origin}`;
      await navigator.clipboard.writeText(fullText);
      toast.success('Referral message copied to clipboard! Paste it anywhere to share.');
    } catch {
      // Final fallback: open WhatsApp with pre-filled message
      const waText = encodeURIComponent(`${shareMessage}\n\n${window.location.origin}`);
      window.open(`https://wa.me/?text=${waText}`, '_blank');
      toast.success('Opened WhatsApp with your referral message.');
    }
  };

  const handleApplyCode = async () => {
    if (!applyCode.trim()) {
      toast.error('Please enter a referral code');
      return;
    }
    setApplying(true);
    try {
      const resp = await callApi('apply-referral-code', { code: applyCode.trim() });
      toast.success(resp.message || 'Referral code applied successfully!');
      setHasReferrer(true);
      setApplyCode('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to apply referral code');
    } finally {
      setApplying(false);
    }
  };

  const availableEarnings = Number(stats?.total_earnings ?? 0);
  const pendingWithdrawal = withdrawals.find(w => w.status === 'pending');
  const totalWithdrawn = withdrawals.filter(w => w.status === 'processed').reduce((sum, w) => sum + Number(w.amount), 0);

  const openWithdrawModal = () => {
    if (availableEarnings <= 0) {
      toast.error('You have no earnings to withdraw yet.');
      return;
    }
    if (pendingWithdrawal) {
      toast.error('You already have a pending withdrawal request. Please wait for it to be processed.');
      return;
    }
    setWithdrawAmount(String(availableEarnings.toFixed(2)));
    setBankName('');
    setAccountName(profile?.name ?? '');
    setAccountNumber('');
    setIfsc('');
    setUpiId('');
    setWithdrawModalOpen(true);
  };

  const handleWithdraw = async () => {
    const amt = parseFloat(withdrawAmount);
    if (!amt || amt <= 0) { toast.error('Please enter a valid amount'); return; }
    if (amt > availableEarnings) { toast.error(`Amount cannot exceed your available earnings (${formatINR(availableEarnings)})`); return; }
    if (!accountName.trim()) { toast.error('Account holder name is required'); return; }
    if (!accountNumber.trim()) { toast.error('Bank account number is required'); return; }
    if (!ifsc.trim()) { toast.error('IFSC code is required'); return; }
    if (!bankName.trim()) { toast.error('Bank name is required'); return; }

    setWithdrawing(true);
    try {
      const resp = await callApi('request-withdrawal', {
        amount: amt,
        bank_account_name: accountName.trim(),
        bank_account_number: accountNumber.trim(),
        bank_ifsc: ifsc.trim().toUpperCase(),
        bank_name: bankName.trim(),
        upi_id: upiId.trim() || undefined,
      });
      toast.success(resp.message || 'Withdrawal request submitted!');
      setWithdrawModalOpen(false);

      // Optimistic update: immediately reflect the new pending withdrawal and
      // reduced balance so the withdraw button stays disabled.
      const newWd: WithdrawalRecord = {
        id: resp.withdrawal_id,
        amount: amt,
        status: 'pending',
        bank_account_name: accountName.trim(),
        bank_account_number: accountNumber.trim(),
        bank_ifsc: ifsc.trim().toUpperCase(),
        bank_name: bankName.trim(),
        upi_id: upiId.trim() || null,
        admin_notes: null,
        processed_at: null,
        created_at: new Date().toISOString(),
      };
      setWithdrawals(prev => [newWd, ...prev]);
      setStats(prev => prev ? { ...prev, total_earnings: Math.max(0, Number(prev.total_earnings) - amt) } : prev);
      setWithdrawSuccess(newWd);

      // Reload from server to sync authoritative state
      loadWithdrawals();
      loadStats();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit withdrawal request');
    } finally {
      setWithdrawing(false);
    }
  };

  const withdrawalStatusBadge = (status: WithdrawalRecord['status']) => {
    if (status === 'pending') return <Badge color="amber"><Clock className="h-3 w-3 inline mr-1" />Processing</Badge>;
    if (status === 'processed') return <Badge color="green"><CheckCircle className="h-3 w-3 inline mr-1" />Completed</Badge>;
    return <Badge color="red"><XCircle className="h-3 w-3 inline mr-1" />Rejected</Badge>;
  };

  // Calculate expected date (7 days from request)
  const expectedDate = (createdAt: string) => {
    const d = new Date(createdAt);
    d.setDate(d.getDate() + 7);
    return d;
  };

  const pendingCount = stats?.referrals.filter(r => r.status === 'pending').length ?? 0;
  const earnedCount = stats?.referrals.filter(r => r.status === 'commission_earned').length ?? 0;

  const statusBadge = (status: ReferralRecord['status']) => {
    if (status === 'pending') return <Badge color="amber">Pending</Badge>;
    if (status === 'commission_earned') return <Badge color="green">Commission Earned</Badge>;
    return <Badge color="blue">Paid</Badge>;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Refer & Earn</h1>
        <p className="mt-1 text-sm text-neutral-500">Invite others to HubVault and earn 50% commission on every license payment they make.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      ) : (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="p-5 animate-fade-in group cursor-pointer transition-all duration-300 hover:-translate-y-0.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl ring-1 bg-brand-600/15 text-brand-600 ring-brand-600/30">
                <Users className="h-5 w-5" />
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium text-neutral-500">Total Referrals</p>
                <p className="mt-1 text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 tabular-nums">{stats?.total_referrals ?? 0}</p>
                <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">{earnedCount} earned commission · {pendingCount} pending</p>
              </div>
            </Card>

            <Card className="p-5 animate-fade-in group transition-all duration-300 hover:-translate-y-0.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl ring-1 bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400 dark:ring-emerald-500/30">
                <IndianRupee className="h-5 w-5" />
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium text-neutral-500">Available to Withdraw</p>
                <p className="mt-1 text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 tabular-nums">{formatINR(availableEarnings)}</p>
                <button
                  onClick={openWithdrawModal}
                  disabled={availableEarnings <= 0 || !!pendingWithdrawal}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ArrowDownToLine className="h-3.5 w-3.5" />
                  {pendingWithdrawal ? 'Request Pending' : 'Withdraw'}
                </button>
              </div>
            </Card>

            <Card className="p-5 animate-fade-in group cursor-pointer transition-all duration-300 hover:-translate-y-0.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl ring-1 bg-amber-500/10 text-amber-500 ring-amber-100 dark:ring-amber-500/30">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium text-neutral-500">Pending Commission</p>
                <p className="mt-1 text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 tabular-nums">{pendingCount}</p>
                <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">awaiting first payment</p>
              </div>
            </Card>
          </div>

          {/* Promo code section */}
          <Card className="p-6 animate-fade-in overflow-hidden relative">
            <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-brand-500/10 to-transparent rounded-full -translate-y-16 translate-x-16" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-brand-600" />
                  <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Your Referral Code</h2>
                </div>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md">Share this code with others. When they sign up and pay for a license, you earn 50% commission automatically.</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-brand-400 dark:border-brand-600/50 bg-brand-50 dark:bg-brand-600/10 px-6 py-4">
                  <code className="text-2xl font-bold font-mono tracking-wider text-brand-600 dark:text-brand-400">{stats?.referral_code ?? '--------'}</code>
                </div>
                <div className="flex flex-col gap-2">
                  <Button variant="outline" size="md" icon={copied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />} onClick={handleCopyCode}>
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                  <Button variant="secondary" size="md" icon={<Share2 className="h-4 w-4" />} onClick={handleShare}>
                    Share
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* Apply referral code (only if user hasn't applied one yet) */}
          {!hasReferrer && (
            <Card className="p-6 animate-fade-in border-amber-300 dark:border-amber-500/30">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 bg-amber-500/10 text-amber-500 ring-amber-100 dark:ring-amber-500/30">
                  <Gift className="h-5 w-5" />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">Have a referral code?</h3>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">Enter a friend's referral code to link your account to them. You can only do this once.</p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <Input
                        name="apply_code"
                        value={applyCode}
                        onChange={(e) => setApplyCode(e.target.value.toUpperCase())}
                        placeholder="Enter referral code"
                        className="font-mono uppercase"
                      />
                    </div>
                    <Button onClick={handleApplyCode} loading={applying} icon={<BadgeCheck className="h-4 w-4" />}>
                      Apply Code
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {hasReferrer && (
            <Card className="p-4 animate-fade-in border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/5">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">You have already applied a referral code. Your referrer will earn commission when you make a license payment.</p>
              </div>
            </Card>
          )}

          {/* Referral list */}
          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800/70 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-neutral-900 dark:text-neutral-100">Your Referrals</h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">People you've referred to HubVault</p>
              </div>
              <span className="text-sm font-semibold text-neutral-500 tabular-nums">{stats?.referrals.length ?? 0} total</span>
            </div>

            {stats && stats.referrals.length > 0 ? (
              <>
                {/* Desktop table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-50 dark:bg-neutral-950/80 text-neutral-500 text-xs uppercase tracking-wide">
                      <tr>
                        <th className="text-left px-5 py-3 font-semibold">Name</th>
                        <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Joined</th>
                        <th className="text-center px-4 py-3 font-semibold">Status</th>
                        <th className="text-right px-4 py-3 font-semibold">Commission</th>
                        <th className="text-right px-5 py-3 font-semibold hidden lg:table-cell">Earned On</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                      {stats.referrals.map((r) => (
                        <tr key={r.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-950/70 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-brand-600/20 to-brand-600/10 text-brand-600 flex items-center justify-center font-bold text-xs shrink-0">
                                {r.referee?.name?.charAt(0).toUpperCase() ?? '?'}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-neutral-800 dark:text-neutral-200 truncate">{r.referee?.name ?? 'Unknown'}</div>
                                <div className="text-xs text-neutral-500 truncate">{r.referee?.email ?? ''}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-neutral-500 hidden lg:table-cell">{formatDate(r.created_at)}</td>
                          <td className="px-4 py-3.5 text-center">{statusBadge(r.status)}</td>
                          <td className={clsx('px-4 py-3.5 text-right tabular-nums font-bold', r.commission_amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-400')}>
                            {r.commission_amount > 0 ? formatINR(r.commission_amount) : '—'}
                          </td>
                          <td className="px-5 py-3.5 text-right text-neutral-500 hidden lg:table-cell">{r.earned_at ? formatDate(r.earned_at) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile card list */}
                <div className="divide-y divide-neutral-200 dark:divide-neutral-800 md:hidden">
                  {stats.referrals.map((r) => (
                    <div key={r.id} className="p-4">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-600/20 to-brand-600/10 text-brand-600 flex items-center justify-center font-bold text-sm shrink-0">
                            {r.referee?.name?.charAt(0).toUpperCase() ?? '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-neutral-800 dark:text-neutral-200 truncate">{r.referee?.name ?? 'Unknown'}</p>
                            <p className="text-xs text-neutral-500 truncate">{r.referee?.email ?? ''}</p>
                          </div>
                        </div>
                        {statusBadge(r.status)}
                      </div>
                      <div className="flex items-center justify-between text-xs text-neutral-500 mt-2">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDate(r.created_at)}</span>
                        <span className={clsx('font-bold', r.commission_amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-400')}>
                          {r.commission_amount > 0 ? `Earned ${formatINR(r.commission_amount)}` : 'No commission yet'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState
                icon={<Users className="h-8 w-8" />}
                title="No referrals yet"
                message="Share your referral code with friends and colleagues. When they sign up and purchase a license, you'll earn 50% commission."
              />
            )}
          </Card>

          {/* Withdrawal History */}
          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800/70 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-neutral-900 dark:text-neutral-100">Withdrawal History</h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Your commission withdrawal requests</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-neutral-500">Withdrawn: {formatINR(totalWithdrawn)}</span>
              </div>
            </div>

            {withdrawSuccess && (
              <div className="m-4 rounded-xl border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-4 animate-fade-in">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-emerald-800 dark:text-emerald-400">Withdrawal Request Submitted!</p>
                    <p className="text-sm text-emerald-700 dark:text-emerald-500/80 mt-0.5">
                      {formatINR(withdrawSuccess.amount)} will be transferred to your bank account within 7 days.
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-white dark:bg-neutral-800/60 px-3 py-2">
                        <span className="text-neutral-500">Amount</span>
                        <p className="font-semibold text-neutral-800 dark:text-neutral-200">{formatINR(withdrawSuccess.amount)}</p>
                      </div>
                      <div className="rounded-lg bg-white dark:bg-neutral-800/60 px-3 py-2">
                        <span className="text-neutral-500">Expected by</span>
                        <p className="font-semibold text-neutral-800 dark:text-neutral-200">{formatDate(expectedDate(withdrawSuccess.created_at).toISOString())}</p>
                      </div>
                      <div className="rounded-lg bg-white dark:bg-neutral-800/60 px-3 py-2 col-span-2">
                        <span className="text-neutral-500">Bank</span>
                        <p className="font-semibold text-neutral-800 dark:text-neutral-200">{withdrawSuccess.bank_name} · A/C ending {withdrawSuccess.bank_account_number.slice(-4)}</p>
                      </div>
                    </div>
                    <button onClick={() => setWithdrawSuccess(null)} className="mt-3 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline">
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )}

            {loadingWithdrawals ? (
              <div className="flex justify-center py-10"><Spinner className="h-6 w-6" /></div>
            ) : withdrawals.length > 0 ? (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-50 dark:bg-neutral-950/80 text-neutral-500 text-xs uppercase tracking-wide">
                      <tr>
                        <th className="text-left px-5 py-3 font-semibold">Date</th>
                        <th className="text-right px-4 py-3 font-semibold">Amount</th>
                        <th className="text-left px-4 py-3 font-semibold">Bank</th>
                        <th className="text-center px-4 py-3 font-semibold">Status</th>
                        <th className="text-right px-5 py-3 font-semibold">Expected / Processed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                      {withdrawals.map((w) => (
                        <tr key={w.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-950/70 transition-colors">
                          <td className="px-5 py-3.5 text-neutral-600 dark:text-neutral-300">{formatDate(w.created_at)}</td>
                          <td className="px-4 py-3.5 text-right tabular-nums font-bold text-neutral-800 dark:text-neutral-200">{formatINR(w.amount)}</td>
                          <td className="px-4 py-3.5">
                            <div className="text-neutral-800 dark:text-neutral-200 font-medium">{w.bank_name}</div>
                            <div className="text-xs text-neutral-500">A/C ending {w.bank_account_number.slice(-4)} · {w.bank_ifsc}</div>
                          </td>
                          <td className="px-4 py-3.5 text-center">{withdrawalStatusBadge(w.status)}</td>
                          <td className="px-5 py-3.5 text-right text-neutral-500">
                            {w.status === 'processed' && w.processed_at ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium">{formatDate(w.processed_at)}</span>
                            ) : w.status === 'pending' ? (
                              <span className="flex items-center justify-end gap-1 text-amber-600 dark:text-amber-400">
                                <CalendarClock className="h-3.5 w-3.5" />
                                {formatDate(expectedDate(w.created_at).toISOString())}
                              </span>
                            ) : (
                              <span className="text-red-500">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="divide-y divide-neutral-200 dark:divide-neutral-800 md:hidden">
                  {withdrawals.map((w) => (
                    <div key={w.id} className="p-4">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-bold text-neutral-800 dark:text-neutral-200 tabular-nums">{formatINR(w.amount)}</span>
                        {withdrawalStatusBadge(w.status)}
                      </div>
                      <p className="text-xs text-neutral-500 mb-1">{w.bank_name} · A/C ending {w.bank_account_number.slice(-4)}</p>
                      <p className="text-xs text-neutral-500 mb-2">Requested: {formatDate(w.created_at)}</p>
                      {w.status === 'processed' && w.processed_at && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Processed on {formatDate(w.processed_at)}</p>
                      )}
                      {w.status === 'pending' && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <CalendarClock className="h-3 w-3" /> Expected by {formatDate(expectedDate(w.created_at).toISOString())}
                        </p>
                      )}
                      {w.status === 'rejected' && w.admin_notes && (
                        <p className="text-xs text-red-500 mt-1">Reason: {w.admin_notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState
                icon={<Wallet className="h-8 w-8" />}
                title="No withdrawals yet"
                message="When you earn commission and withdraw it, your withdrawal history will appear here."
              />
            )}
          </Card>

          {/* How it works */}
          <Card className="p-6 animate-fade-in">
            <h2 className="font-bold text-neutral-900 dark:text-neutral-100 mb-4">How It Works</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { step: 1, icon: Share2, title: 'Share Your Code', desc: 'Send your unique referral code to friends and colleagues who might need HubVault.' },
                { step: 2, icon: Users, title: 'They Sign Up', desc: 'When they create an account using your code, they get linked to your referral network.' },
                { step: 3, icon: IndianRupee, title: 'Earn 50% Commission', desc: 'When they pay for any license (₹999 or ₹499), you automatically earn 50% of the payment amount.' },
              ].map((s) => (
                <div key={s.step} className="relative rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white text-xs font-bold">{s.step}</span>
                    <s.icon className="h-4 w-4 text-brand-600" />
                  </div>
                  <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">{s.title}</p>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">{s.desc}</p>
                  {s.step < 3 && <ChevronRight className="hidden sm:block absolute -right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-300 dark:text-neutral-700" />}
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {/* Withdrawal Modal */}
      <Modal
        open={withdrawModalOpen}
        onClose={() => setWithdrawModalOpen(false)}
        title="Withdraw Commission"
        subtitle="Enter your bank details to request a withdrawal"
        size="md"
        closable
        footer={
          <>
            <Button variant="outline" onClick={() => setWithdrawModalOpen(false)}>Cancel</Button>
            <Button onClick={handleWithdraw} loading={withdrawing} icon={<ArrowDownToLine className="h-4 w-4" />}>Submit Request</Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Available balance info */}
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Available Balance</p>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{formatINR(availableEarnings)}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
                <Wallet className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </div>

          <Input
            label="Withdrawal Amount (₹)"
            name="withdraw_amount"
            type="number"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            placeholder="Enter amount"
          />

          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-brand-600" />
              <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">Bank Account Details</h3>
            </div>
            <Input
              label="Account Holder Name *"
              name="account_name"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Name as per bank records"
            />
            <Input
              label="Bank Account Number *"
              name="account_number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="Your bank account number"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="IFSC Code *"
                name="ifsc"
                value={ifsc}
                onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                placeholder="e.g. HDFC0001234"
                className="font-mono uppercase"
              />
              <Input
                label="Bank Name *"
                name="bank_name"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. State Bank of India"
              />
            </div>
            <Input
              label="UPI ID (optional)"
              name="upi_id"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="yourname@upi"
            />
          </div>

          {/* 7-day notice */}
          <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-4">
            <div className="flex items-start gap-3">
              <CalendarClock className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">Processing Time: 7 Days</p>
                <p className="text-xs text-amber-700 dark:text-amber-500/80 mt-0.5">Your withdrawal will be processed and transferred to your bank account within 7 days of submission. You will receive the amount directly in your bank account.</p>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
