import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { Badge,Button,Card,EmptyState,Input,Select,Skeleton } from '@/components/ui/primitives';
import { useAuth } from '@/lib/auth';
import { confirm } from '@/lib/confirm';
import { formatDateTime } from '@/lib/format';
import { useNotifications } from '@/lib/notifications';
import { supabase,SUPABASE_URL } from '@/lib/supabase';
import { Hub,LicenseKey,Profile } from '@/types';
import { clsx } from 'clsx';
import {
AlertTriangle,
Building2,
CheckCircle2,
Clock,
Copy,
CreditCard,
Gift,
Image as ImageIcon,
KeyRound,
Mail,
Plus,
RefreshCw,
Search,
ShieldCheck,
Smartphone,X
} from 'lucide-react';
import { useCallback,useEffect,useMemo,useState } from 'react';

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/manage-user`;

interface LicenseAdminRow {
  profile: Profile & { hub?: Hub | null };
  license: LicenseKey | null;
}

interface GiftCard {
  id: string;
  card_code: string;
  license_code: string;
  price: number;
  status: 'available' | 'sold' | 'redeemed' | 'disabled';
  purchased_by: string | null;
  purchased_at: string | null;
  redeemed_at: string | null;
  created_by: string | null;
  notes: string | null;
  created_at: string;
}

interface PaymentRequestAdmin {
  id: string;
  user_id: string;
  amount: number;
  payment_method: string;
  transaction_id: string;
  payer_name: string | null;
  payer_upi: string | null;
  status: 'pending' | 'verified' | 'rejected';
  license_code: string | null;
  submitted_at: string;
  verified_at: string | null;
  verified_by: string | null;
  rejection_reason: string | null;
  notes: string | null;
  request_type?: 'license' | 'hub_add';
  plan_type?: 'lifetime' | 'monthly';
  payment_screenshot_url?: string | null;
  profiles?: { name: string; email: string; phone?: string } | null;
}

export default function Licenses() {
  const toast = useToast();
  const { profile: myProfile } = useAuth();
  const { pendingPayments, refreshPayments } = useNotifications();
  const isSuperAdmin = myProfile?.role === 'super_admin';
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LicenseAdminRow[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [detailRow, setDetailRow] = useState<LicenseAdminRow | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, pending: 0, activated: 0, expired: 0, missing: 0 });

  // Gift cards state
  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
  const [giftCardsLoading, setGiftCardsLoading] = useState(false);
  const [genGiftCardsOpen, setGenGiftCardsOpen] = useState(false);
  const [genCount, setGenCount] = useState('5');
  const [genPrice, setGenPrice] = useState('2999');
  const [generatingCards, setGeneratingCards] = useState(false);
  const [giftCardFilter, setGiftCardFilter] = useState('all');

  // Payment requests state
  const [payRequests, setPayRequests] = useState<PaymentRequestAdmin[]>([]);
  const [payRequestsLoading, setPayRequestsLoading] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [emailingRequestId, setEmailingRequestId] = useState<string | null>(null);

  // Main tab
  const [mainTab, setMainTab] = useState<'licenses' | 'giftcards' | 'payments'>('licenses');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: hubs } = await supabase.from('hubs').select('*').order('name');
      const hubMap = new Map((hubs ?? []).map((h: Hub) => [h.id, h]));

      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'hub_admin')
        .order('created_at', { ascending: false });
      if (pErr) throw pErr;

      const { data: keys, error: kErr } = await supabase
        .from('license_keys')
        .select('*')
        .order('created_at', { ascending: false });
      if (kErr) throw kErr;

      const keyMap = new Map((keys ?? []).map((k: LicenseKey) => [k.user_id, k]));

      const combined: LicenseAdminRow[] = (profiles ?? []).map((p: Profile) => ({
        profile: { ...p, hub: p.hub_id ? hubMap.get(p.hub_id) ?? null : null },
        license: keyMap.get(p.id) ?? null,
      }));
      setRows(combined);

      const pending = combined.filter((r) => r.license?.status === 'pending').length;
      const activated = combined.filter((r) => r.license?.status === 'activated').length;
      const expired = combined.filter((r) => r.license?.status === 'expired').length;
      const missing = combined.filter((r) => !r.license).length;
      setStats({
        total: combined.length,
        pending,
        activated,
        expired,
        missing,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load licenses');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Gift cards loader
  const loadGiftCards = useCallback(async () => {
    if (!isSuperAdmin) return;
    setGiftCardsLoading(true);
    try {
      const data = await callEdgeFunction('list-gift-cards', {});
      setGiftCards(data.cards || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load gift cards');
    } finally {
      setGiftCardsLoading(false);
    }
  }, [isSuperAdmin, toast]);

  // Payment requests loader — fetch requests and profiles separately (user_id → auth.users, no FK to profiles)
  const loadPayRequests = useCallback(async () => {
    if (!isSuperAdmin) return;
    setPayRequestsLoading(true);
    try {
      const { data: requests, error } = await supabase
        .from('license_payment_requests')
        .select('*')
        .order('submitted_at', { ascending: false })
        .limit(200);
      if (error) throw error;

      const userIds = [...new Set((requests ?? []).map((r) => r.user_id))];
      let profileMap = new Map<string, { name: string; email: string; phone?: string }>();
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, name, email, phone')
          .in('id', userIds);
        profileMap = new Map((profs ?? []).map((p) => [p.id, p]));
      }

      const merged: PaymentRequestAdmin[] = (requests ?? []).map((r) => ({
        ...r,
        profiles: profileMap.get(r.user_id) ?? null,
      }));
      setPayRequests(merged);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load payment requests');
    } finally {
      setPayRequestsLoading(false);
    }
  }, [isSuperAdmin, toast]);

  useEffect(() => {
    load();
    if (isSuperAdmin) {
      loadGiftCards();
      loadPayRequests();
    }
  }, [load, isSuperAdmin, loadGiftCards, loadPayRequests]);

  // Realtime: refresh payment requests when a new one is submitted
  useEffect(() => {
    if (!isSuperAdmin) return;
    const channel = supabase
      .channel('licenses-payment-requests')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'license_payment_requests' },
        () => {
          loadPayRequests();
          refreshPayments();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'license_payment_requests' },
        () => {
          loadPayRequests();
          refreshPayments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isSuperAdmin, loadPayRequests, refreshPayments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const st = r.license?.status ?? 'missing';
      if (statusFilter !== 'all' && st !== statusFilter) return false;
      if (!q) return true;
      return (
        r.profile?.name?.toLowerCase().includes(q) ||
        r.profile?.email?.toLowerCase().includes(q) ||
        r.license?.license_code?.toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  const callEdgeFunction = async (action: string, body: Record<string, unknown>) => {
    const { data: session } = await supabase.auth.getSession();
    const response = await fetch(`${FUNCTION_URL}?action=${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.session?.access_token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  };

  const handleGenerate = async (row: LicenseAdminRow) => {
    const hasKey = !!row.license;
    const ok = await confirm({
      title: hasKey ? 'Regenerate license?' : 'Generate license?',
      message: hasKey
        ? `This will issue a new activation code for ${row.profile.name}. The old code will no longer work and the 24-hour clock restarts.`
        : `This will generate a new activation code for ${row.profile.name}. They will have 24 hours to activate it.`,
      confirmLabel: hasKey ? 'Regenerate' : 'Generate',
    });
    if (!ok) return;
    setActionLoading(true);
    try {
      const action = hasKey ? 'regenerate-license' : 'generate-license';
      const data = await callEdgeFunction(action, { user_id: row.profile.id });
      toast.success(`License code: ${data.license_code}`);
      setDetailRow(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate license');
    } finally {
      setActionLoading(false);
    }
  };

  const copyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('License code copied');
  };

  const getTimeRemaining = (expiresAt: string): string | null => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return null;
    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${h}h ${m}m`;
  };

  const handleGenerateGiftCards = async () => {
    const count = parseInt(genCount) || 1;
    if (count < 1 || count > 100) {
      toast.error('Count must be between 1 and 100');
      return;
    }
    setGeneratingCards(true);
    try {
      const data = await callEdgeFunction('generate-gift-cards', {
        count,
        price: parseFloat(genPrice) || 0,
      });
      toast.success(`Generated ${data.count} gift card(s)`);
      setGenGiftCardsOpen(false);
      loadGiftCards();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate gift cards');
    } finally {
      setGeneratingCards(false);
    }
  };

  const handleVerifyPayment = async (reqId: string, approved: boolean) => {
    setActionLoading(true);
    try {
      await callEdgeFunction('verify-upi-payment', {
        request_id: reqId,
        approved,
        rejection_reason: approved ? undefined : rejectReason,
      });
      toast.success(approved ? 'Payment verified — license issued!' : 'Payment rejected');
      setRejectingId(null);
      setRejectReason('');
      loadPayRequests();
      load();
      refreshPayments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to process request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendLicenseEmail = async (requestId: string) => {
    setEmailingRequestId(requestId);
    try {
      let token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) token = (await supabase.auth.refreshSession()).data.session?.access_token;
      if (!token) throw new Error('Your session expired. Please log in again.');
      const response = await fetch('/api/send-license-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ request_id: requestId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'License email could not be sent');
      toast.success(data.message || 'License email sent successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'License email could not be sent');
    } finally {
      setEmailingRequestId(null);
    }
  };

  const handleDisableGiftCard = async (cardId: string) => {
    const ok = await confirm({
      title: 'Disable gift card?',
      message: 'This gift card will no longer be redeemable. This cannot be undone.',
      confirmLabel: 'Disable',
    });
    if (!ok) return;
    try {
      await callEdgeFunction('disable-gift-card', { card_id: cardId });
      toast.success('Gift card disabled');
      loadGiftCards();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to disable gift card');
    }
  };

  const getStatus = (r: LicenseAdminRow): string => r.license?.status ?? 'missing';

  const statusBadge = (status: string) => {
    switch (status) {
      case 'activated':
        return <Badge color="green"><CheckCircle2 className="h-3 w-3 mr-1" /> Activated</Badge>;
      case 'expired':
        return <Badge color="red"><AlertTriangle className="h-3 w-3 mr-1" /> Expired</Badge>;
      case 'pending':
        return <Badge color="amber"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
      case 'missing':
        return <Badge color="slate"><KeyRound className="h-3 w-3 mr-1" /> No Key</Badge>;
      default:
        return <Badge color="slate">—</Badge>;
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">License Management</h1>
        <p className="mt-1 text-sm text-neutral-500">View, generate, and manage activation licenses for all Hub Admins.</p>
      </div>

      {/* Tabs (super admin only) */}
      {isSuperAdmin && (
        <div className="flex gap-2 p-1 bg-neutral-100 dark:bg-neutral-900 rounded-xl w-fit">
          <button onClick={() => setMainTab('licenses')} className={clsx('flex items-center gap-1.5 py-2 px-4 rounded-lg text-sm font-medium transition', mainTab === 'licenses' ? 'bg-white dark:bg-neutral-800 text-brand-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300')}>
            <KeyRound className="h-4 w-4" /> Licenses
          </button>
          <button onClick={() => setMainTab('giftcards')} className={clsx('flex items-center gap-1.5 py-2 px-4 rounded-lg text-sm font-medium transition', mainTab === 'giftcards' ? 'bg-white dark:bg-neutral-800 text-brand-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300')}>
            <Gift className="h-4 w-4" /> Gift Cards
            {giftCards.filter(c => c.status === 'available').length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-green-500 text-white text-[10px] font-bold">{giftCards.filter(c => c.status === 'available').length}</span>
            )}
          </button>
          <button onClick={() => setMainTab('payments')} className={clsx('flex items-center gap-1.5 py-2 px-4 rounded-lg text-sm font-medium transition', mainTab === 'payments' ? 'bg-white dark:bg-neutral-800 text-brand-600 shadow-sm' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300')}>
            <Smartphone className="h-4 w-4" /> UPI Payments
            {pendingPayments > 0 && (
              <span className="ml-1 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold animate-pulse">{pendingPayments}</span>
            )}
          </button>
        </div>
      )}

      {/* === LICENSES TAB === */}
      {mainTab === 'licenses' && (
        <>
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-brand-600/10 text-brand-600 p-2.5">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{stats.total}</p>
              <p className="text-xs text-neutral-500">Hub Admins</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-green-500/10 text-green-500 p-2.5">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{stats.activated}</p>
              <p className="text-xs text-neutral-500">Activated</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-500/10 text-amber-500 p-2.5">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{stats.pending}</p>
              <p className="text-xs text-neutral-500">Pending</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-red-500/10 text-red-500 p-2.5">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{stats.expired}</p>
              <p className="text-xs text-neutral-500">Expired</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-neutral-500/10 text-neutral-500 p-2.5">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{stats.missing}</p>
              <p className="text-xs text-neutral-500">No Key</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <Input
            name="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or code..."
            className="pl-10"
            error={undefined}
          />
        </div>
        <Select
          name="statusFilter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="sm:w-44"
        >
          <option value="all">All Status</option>
          <option value="activated">Activated</option>
          <option value="pending">Pending</option>
          <option value="expired">Expired</option>
          <option value="missing">No Key</option>
        </Select>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<KeyRound className="h-10 w-10 text-neutral-300" />}
            title="No Hub Admins found"
            message={search || statusFilter !== 'all' ? "No records match your filters." : "No Hub Admin accounts exist yet."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
                  <th className="text-left px-4 py-3 font-semibold">Hub Admin</th>
                  <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">License Code</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Time Left</th>
                  <th className="text-left px-4 py-3 font-semibold hidden xl:table-cell">Hub</th>
                  <th className="text-right px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
                {filtered.map((r) => {
                  const st = getStatus(r);
                  const remaining = r.license?.status === 'pending' ? getTimeRemaining(r.license.expires_at) : null;
                  return (
                    <tr key={r.profile.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/30 transition">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-brand-600 to-brand-400 text-white flex items-center justify-center font-bold text-xs shrink-0">
                            {r.profile.name?.charAt(0).toUpperCase() ?? '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-neutral-900 dark:text-neutral-100 truncate">{r.profile.name}</p>
                            <p className="text-xs text-neutral-500 truncate">{r.profile.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        {r.license ? (
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono font-semibold text-brand-600 dark:text-brand-400 tracking-wider">
                              {r.license.license_code}
                            </code>
                            <button onClick={() => copyCode(r.license!.license_code)} className="p-1 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-800 transition" title="Copy">
                              <Copy className="h-3.5 w-3.5 text-neutral-400" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-400 italic">Not generated</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {statusBadge(st)}
                      </td>
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        {r.license?.status === 'pending' ? (
                          remaining ? (
                            <span className={clsx(
                              'text-xs font-medium',
                              remaining.startsWith('0h') ? 'text-red-500' : 'text-amber-600 dark:text-amber-400'
                            )}>
                              {remaining}
                            </span>
                          ) : (
                            <span className="text-xs text-red-500 font-medium">Expired</span>
                          )
                        ) : (
                          <span className="text-xs text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 hidden xl:table-cell">
                        {r.profile.hub ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 px-2 py-0.5 text-xs font-medium">
                            <Building2 className="h-3 w-3 text-neutral-400" />
                            {r.profile.hub.name}
                          </span>
                        ) : (
                          <span className="text-xs text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {r.license && (
                            <button
                              onClick={() => setDetailRow(r)}
                              title="View details"
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-brand-600 hover:bg-brand-600/10 transition active:scale-90"
                            >
                              <ShieldCheck className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleGenerate(r)}
                            title={r.license ? 'Regenerate code' : 'Generate code'}
                            className={clsx(
                              'p-1.5 rounded-lg transition active:scale-90',
                              r.license
                                ? 'text-neutral-400 hover:text-amber-500 hover:bg-amber-500/10'
                                : 'text-brand-600 hover:bg-brand-600/10'
                            )}
                          >
                            {r.license ? <RefreshCw className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Detail Modal */}
      <Modal
        open={!!detailRow}
        onClose={() => setDetailRow(null)}
        title="License Details"
        subtitle={detailRow?.profile?.name ?? ''}
        size="md"
        footer={<>
          <Button variant="outline" onClick={() => setDetailRow(null)}>Close</Button>
          {detailRow && (
            <Button onClick={() => handleGenerate(detailRow)} loading={actionLoading} icon={<RefreshCw className="h-4 w-4" />}>
              Regenerate Code
            </Button>
          )}
        </>}
      >
        {detailRow?.license && (
          <div className="space-y-4">
            {/* License Code */}
            <div className="rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-4">
              <p className="text-xs text-neutral-500 mb-2 font-medium">License Code</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-lg font-mono font-bold tracking-wider text-brand-600 dark:text-brand-400">
                  {detailRow.license.license_code}
                </code>
                <button onClick={() => copyCode(detailRow.license!.license_code)} className="p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition" title="Copy">
                  <Copy className="h-4 w-4 text-neutral-500" />
                </button>
              </div>
            </div>

            {/* Status Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-3">
                <p className="text-xs text-neutral-500">Status</p>
                <div className="mt-1">{statusBadge(detailRow.license.status)}</div>
              </div>
              <div className="rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-3">
                <p className="text-xs text-neutral-500">Hub</p>
                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                  {detailRow.profile?.hub?.name ?? '—'}
                </p>
              </div>
              <div className="rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-3">
                <p className="text-xs text-neutral-500">Generated</p>
                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {formatDateTime(detailRow.license.generated_at)}
                </p>
              </div>
              <div className="rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-3">
                <p className="text-xs text-neutral-500">Activated</p>
                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {detailRow.license.activated_at ? formatDateTime(detailRow.license.activated_at) : 'Not yet'}
                </p>
              </div>
              <div className="col-span-2 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-3">
                <p className="text-xs text-neutral-500">Activation Deadline</p>
                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {formatDateTime(detailRow.license.expires_at)}
                </p>
                {detailRow.license.status === 'pending' && (
                  <p className="text-xs mt-1">
                    {getTimeRemaining(detailRow.license.expires_at) ? (
                      <span className="text-amber-600 dark:text-amber-400">
                        {getTimeRemaining(detailRow.license.expires_at)} remaining
                      </span>
                    ) : (
                      <span className="text-red-500">Deadline passed — awaiting expiry processing</span>
                    )}
                  </p>
                )}
              </div>
            </div>

            {/* Warning for pending/expired */}
            {detailRow.license.status !== 'activated' && (
              <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {detailRow.license.status === 'expired'
                    ? "This license has expired. The Hub Admin is locked out. Regenerate to issue a new code with a fresh 24-hour window."
                    : "This license is still pending activation. Share the code with the Hub Admin — they must activate it before the deadline or the account will be locked."}
                </p>
              </div>
            )}

            {/* Admin info */}
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-600 to-brand-400 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  {detailRow.profile?.name?.charAt(0).toUpperCase() ?? '?'}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">{detailRow.profile.name}</p>
                  <p className="text-xs text-neutral-500 truncate">{detailRow.profile.email}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
        </>
      )}

      {/* === GIFT CARDS TAB === */}
      {mainTab === 'giftcards' && isSuperAdmin && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Gift Cards</h2>
              <p className="text-sm text-neutral-500">Generate and manage gift cards for instant license redemption.</p>
            </div>
            <Button onClick={() => setGenGiftCardsOpen(true)} icon={<Plus className="h-4 w-4" />}>Generate Cards</Button>
          </div>

          {/* Gift card stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-4"><div className="flex items-center gap-3"><div className="rounded-xl bg-green-500/10 text-green-500 p-2.5"><CheckCircle2 className="h-5 w-5" /></div><div><p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{giftCards.filter(c => c.status === 'available').length}</p><p className="text-xs text-neutral-500">Available</p></div></div></Card>
            <Card className="p-4"><div className="flex items-center gap-3"><div className="rounded-xl bg-brand-600/10 text-brand-600 p-2.5"><Gift className="h-5 w-5" /></div><div><p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{giftCards.filter(c => c.status === 'redeemed').length}</p><p className="text-xs text-neutral-500">Redeemed</p></div></div></Card>
            <Card className="p-4"><div className="flex items-center gap-3"><div className="rounded-xl bg-red-500/10 text-red-500 p-2.5"><X className="h-5 w-5" /></div><div><p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{giftCards.filter(c => c.status === 'disabled').length}</p><p className="text-xs text-neutral-500">Disabled</p></div></div></Card>
            <Card className="p-4"><div className="flex items-center gap-3"><div className="rounded-xl bg-neutral-500/10 text-neutral-500 p-2.5"><KeyRound className="h-5 w-5" /></div><div><p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{giftCards.length}</p><p className="text-xs text-neutral-500">Total</p></div></div></Card>
          </div>

          {/* Filter */}
          <Select name="giftCardFilter" value={giftCardFilter} onChange={(e) => setGiftCardFilter(e.target.value)} className="w-44">
            <option value="all">All Cards</option>
            <option value="available">Available</option>
            <option value="redeemed">Redeemed</option>
            <option value="disabled">Disabled</option>
          </Select>

          {/* Gift cards table */}
          <Card className="overflow-hidden">
            {giftCardsLoading ? (
              <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : giftCards.length === 0 ? (
              <EmptyState icon={<Gift className="h-10 w-10 text-neutral-300" />} title="No gift cards" message="Generate gift cards to allow instant license redemption." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
                    <th className="text-left px-4 py-3 font-semibold">Card Code</th>
                    <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">License Code</th>
                    <th className="text-left px-4 py-3 font-semibold">Status</th>
                    <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Price</th>
                    <th className="text-left px-4 py-3 font-semibold hidden xl:table-cell">Redeemed By</th>
                    <th className="text-right px-4 py-3 font-semibold">Actions</th>
                  </tr></thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
                    {giftCards.filter(c => giftCardFilter === 'all' || c.status === giftCardFilter).map((c) => (
                      <tr key={c.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/30 transition">
                        <td className="px-4 py-3.5"><div className="flex items-center gap-2"><code className="text-xs font-mono font-semibold text-purple-600 dark:text-purple-400 tracking-wider">{c.card_code}</code><button onClick={() => copyCode(c.card_code)} className="p-1 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-800 transition"><Copy className="h-3.5 w-3.5 text-neutral-400" /></button></div></td>
                        <td className="px-4 py-3.5 hidden md:table-cell"><code className="text-xs font-mono text-neutral-500">{c.license_code}</code></td>
                        <td className="px-4 py-3.5">{c.status === 'available' ? <Badge color="green">Available</Badge> : c.status === 'redeemed' ? <Badge color="blue">Redeemed</Badge> : <Badge color="red">Disabled</Badge>}</td>
                        <td className="px-4 py-3.5 hidden lg:table-cell"><span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">₹{c.price}</span></td>
                        <td className="px-4 py-3.5 hidden xl:table-cell"><span className="text-xs text-neutral-500 truncate">{c.purchased_by ? c.purchased_by.substring(0, 8) + '…' : '—'}</span></td>
                        <td className="px-4 py-3.5 text-right">{c.status === 'available' && <button onClick={() => handleDisableGiftCard(c.id)} title="Disable" className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-500/10 transition active:scale-90"><X className="h-4 w-4" /></button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* === PAYMENTS TAB === */}
      {mainTab === 'payments' && isSuperAdmin && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">UPI Payment Verification</h2>
            <p className="text-sm text-neutral-500">Review and verify manual UPI payments from Hub Admins.</p>
          </div>

          <Card className="overflow-hidden">
            {payRequestsLoading ? (
              <div className="p-6 space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
            ) : payRequests.length === 0 ? (
              <EmptyState icon={<Smartphone className="h-10 w-10 text-neutral-300" />} title="No payment requests" message="When Hub Admins submit UPI payments, they'll appear here for verification." />
            ) : (
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
                {payRequests.map((req) => (
                  <div key={req.id} className="p-4 flex flex-col lg:flex-row lg:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{(req as any).profiles?.name || 'Unknown'}</p>
                        <span className="text-xs text-neutral-400">{(req as any).profiles?.email}</span>
                        {req.request_type === 'hub_add' && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400 px-2 py-0.5 rounded-full">
                            <CreditCard className="h-3 w-3" /> Hub Add
                          </span>
                        )}
                        {req.request_type !== 'hub_add' && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 bg-violet-50 dark:bg-violet-950/30 dark:text-violet-400 px-2 py-0.5 rounded-full">
                            <CreditCard className="h-3 w-3" /> {req.plan_type === 'monthly' ? '₹99 Monthly' : '₹999 Lifetime'}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
                        <span>TXN: <strong className="font-mono text-neutral-700 dark:text-neutral-300">{req.transaction_id}</strong></span>
                        <span>Amount: <strong>₹{req.amount}</strong></span>
                        <span>Method: {req.payment_method}</span>
                        {req.payer_name && <span>Payer: {req.payer_name}</span>}
                        <span>{formatDateTime(req.submitted_at)}</span>
                      </div>
                      {req.payment_screenshot_url && (
                        <a href={req.payment_screenshot_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline mt-1">
                          <ImageIcon className="h-3.5 w-3.5" /> View payment screenshot
                        </a>
                      )}
                      {req.status === 'rejected' && req.rejection_reason && (
                        <p className="text-xs text-red-500 mt-1">Rejected: {req.rejection_reason}</p>
                      )}
                      {req.status === 'verified' && req.license_code && (
                        <p className="text-xs text-green-500 mt-1">License issued: <code className="font-mono">{req.license_code}</code></p>
                      )}
                      {req.status === 'verified' && req.request_type === 'hub_add' && (
                        <p className="text-xs text-green-500 mt-1">1 hub credit granted to user</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {req.status === 'pending' ? (
                        rejectingId === req.id ? (
                          <>
                            <Input name="reject_reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Rejection reason" className="flex-1 min-w-48" error={undefined} />
                            <Button variant="outline" onClick={() => { setRejectingId(null); setRejectReason(''); }}>Cancel</Button>
                            <Button variant="danger" onClick={() => handleVerifyPayment(req.id, false)} loading={actionLoading}>Reject</Button>
                            <Button onClick={() => handleVerifyPayment(req.id, true)} loading={actionLoading} icon={<CheckCircle2 className="h-4 w-4" />}>Verify</Button>
                          </>
                        ) : (
                          <>
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600"><Clock className="h-3 w-3" /> Pending</span>
                            <Button variant="outline" onClick={() => setRejectingId(req.id)}>Reject</Button>
                            <Button onClick={() => handleVerifyPayment(req.id, true)} icon={<CheckCircle2 className="h-4 w-4" />}>Verify & Issue License</Button>
                          </>
                        )
                      ) : (
                        <>
                          <Badge color={req.status === 'verified' ? 'green' : 'red'}>{req.status === 'verified' ? 'Verified' : 'Rejected'}</Badge>
                          {req.status === 'verified' && req.license_code && req.request_type !== 'hub_add' && (
                            <Button variant="outline" onClick={() => handleSendLicenseEmail(req.id)} loading={emailingRequestId === req.id} icon={<Mail className="h-4 w-4" />}>Email License</Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Generate Gift Cards Modal */}
      <Modal
        open={genGiftCardsOpen}
        onClose={() => setGenGiftCardsOpen(false)}
        title="Generate Gift Cards"
        subtitle="Create gift cards that can be redeemed for instant license activation"
        size="sm"
        footer={<><Button variant="outline" onClick={() => setGenGiftCardsOpen(false)}>Cancel</Button><Button onClick={handleGenerateGiftCards} loading={generatingCards} icon={<Gift className="h-4 w-4" />}>Generate</Button></>}
      >
        <div className="space-y-4">
          <Input label="Number of cards" name="gen_count" type="number" value={genCount} onChange={(e) => setGenCount(e.target.value)} placeholder="5" error={undefined} />
          <Input label="Price per card (₹)" name="gen_price" type="number" value={genPrice} onChange={(e) => setGenPrice(e.target.value)} placeholder="2999" error={undefined} />
          <div className="flex items-start gap-2 rounded-xl bg-brand-600/10 border border-brand-600/30 px-4 py-3">
            <Gift className="h-4 w-4 text-brand-600 shrink-0 mt-0.5" />
            <p className="text-xs text-brand-600">Each gift card gets a unique card code and a unique license code. Hub Admins can redeem the card code to instantly get their license key.</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
