import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Mail, Search, Trash2, MailOpen, Circle, User, Building2,
  Calendar, Phone, ArrowLeft, ShoppingBag, Tag, CheckCircle2, XCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { Button, Card, EmptyState, Skeleton, Badge } from '@/components/ui/primitives';
import { PurchaseRequest, PurchaseStatus, PURCHASE_STATUS_LABELS } from '@/types';
import { formatDateTime } from '@/lib/format';
import { confirm } from '@/lib/confirm';
import { clsx } from 'clsx';

const STATUS_COLORS: Record<PurchaseStatus, string> = {
  pending: 'amber',
  contacted: 'blue',
  completed: 'green',
  rejected: 'red',
};

export default function Purchases() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | PurchaseStatus>('all');
  const [selected, setSelected] = useState<PurchaseRequest | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('purchase_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      setRequests(data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load purchase requests');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const pendingCount = useMemo(() => requests.filter((r) => r.status === 'pending').length, [requests]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (filter !== 'all' && r.status !== filter) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q) ||
        (r.company?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [requests, search, filter]);

  const markAsRead = useCallback(async (id: string) => {
    const { error } = await supabase.from('purchase_requests').update({ is_read: true }).eq('id', id);
    if (error) {
      toast.error('Failed to mark as read');
      return;
    }
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, is_read: true } : r)));
    setSelected((prev) => (prev && prev.id === id ? { ...prev, is_read: true } : prev));
  }, [toast]);

  const updateStatus = useCallback(async (id: string, status: PurchaseStatus) => {
    const { error } = await supabase.from('purchase_requests').update({ status }).eq('id', id);
    if (error) {
      toast.error('Failed to update status');
      return;
    }
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    setSelected((prev) => (prev && prev.id === id ? { ...prev, status } : prev));
    toast.success(`Marked as ${PURCHASE_STATUS_LABELS[status]}`);
  }, [toast]);

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Delete purchase request?',
      message: 'This request will be permanently removed.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from('purchase_requests').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete request');
      return;
    }
    setRequests((prev) => prev.filter((r) => r.id !== id));
    setSelected(null);
    toast.success('Request deleted');
  };

  const openRequest = (req: PurchaseRequest) => {
    setSelected(req);
    if (!req.is_read) markAsRead(req.id);
  };

  if (selected) {
    return (
      <div className="space-y-5">
        <button
          onClick={() => setSelected(null)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Purchase Requests
        </button>

        <Card className="p-6">
          <div className="flex items-start justify-between gap-4 pb-5 border-b border-neutral-200 dark:border-neutral-800">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">Purchase Request</h2>
                <Badge color={STATUS_COLORS[selected.status]}>{PURCHASE_STATUS_LABELS[selected.status]}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-neutral-500">
                <span className="flex items-center gap-1.5">
                  <User className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                  {selected.name}
                </span>
                <a href={`mailto:${selected.email}`} className="flex items-center gap-1.5 text-brand-600 hover:text-brand-600 font-medium">
                  <Mail className="h-4 w-4" />
                  {selected.email}
                </a>
                <a href={`tel:${selected.phone}`} className="flex items-center gap-1.5 text-brand-600 hover:text-brand-600 font-medium">
                  <Phone className="h-4 w-4" />
                  {selected.phone}
                </a>
              </div>
              {selected.company && (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-neutral-500">
                  <Building2 className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                  {selected.company}
                </p>
              )}
              <p className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                <Calendar className="h-3.5 w-3.5" />
                {formatDateTime(selected.created_at)}
              </p>
            </div>
            <Button variant="danger" size="sm" onClick={() => handleDelete(selected.id)}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>

          {selected.message && (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-2">Message</p>
              <p className="text-[15px] text-neutral-700 dark:text-neutral-300 leading-[1.75] whitespace-pre-wrap">{selected.message}</p>
            </div>
          )}

          <div className="mt-8 pt-5 border-t border-neutral-200 dark:border-neutral-800 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-2">Update Status</p>
              <div className="flex flex-wrap gap-2">
                {(['pending', 'contacted', 'completed', 'rejected'] as PurchaseStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => updateStatus(selected.id, s)}
                    className={clsx(
                      'rounded-lg px-3.5 py-2 text-sm font-medium transition',
                      selected.status === s
                        ? s === 'rejected'
                          ? 'bg-red-600 text-white shadow-soft'
                          : s === 'completed'
                          ? 'bg-brand-600 text-white shadow-soft'
                          : 'text-[var(--neutral-200)] shadow-soft'
                        : 'bg-[var(--card-bg)] text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    )}
                  >
                    {PURCHASE_STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <a href={`mailto:${selected.email}?subject=HubVault Lifetime License — Payment Options`}>
                <Button variant="outline" size="md">
                  <Mail className="h-4 w-4" />
                  Reply via Email
                </Button>
              </a>
              <a href={`tel:${selected.phone}`}>
                <Button variant="outline" size="md">
                  <Phone className="h-4 w-4" />
                  Call Customer
                </Button>
              </a>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Purchase Requests</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Lifetime license (₹999) buy requests from your website.
            {pendingCount > 0 && (
              <span className="ml-1.5 inline-flex items-center gap-1 rounded-lg bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-400 ring-1 ring-inset ring-amber-500/30">
                {pendingCount} pending
              </span>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500 dark:text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, phone, or company…"
            className="input-base pl-10"
          />
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-[var(--card-bg)] p-1">
          {(['all', 'pending', 'contacted', 'completed', 'rejected'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                'rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition',
                filter === f ? 'bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-soft' : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ShoppingBag className="h-7 w-7" />}
            title="No purchase requests"
            message={filter === 'pending' ? 'No pending requests. You are all caught up!' : 'Buy requests from your website will appear here.'}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {filtered.map((req) => (
              <button
                key={req.id}
                onClick={() => openRequest(req)}
                className="w-full flex items-start gap-4 p-4 hover:bg-neutral-100 dark:hover:bg-neutral-950/70 transition-colors text-left"
              >
                <div className={clsx('shrink-0 mt-1', req.is_read ? 'text-neutral-500 dark:text-neutral-400' : 'text-brand-600')}>
                  {req.is_read ? <MailOpen className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {!req.is_read && <Circle className="h-2 w-2 fill-brand-600 text-brand-600 shrink-0" />}
                    <p className={clsx('text-sm truncate', req.is_read ? 'font-medium text-neutral-500 dark:text-neutral-400' : 'font-bold text-neutral-900 dark:text-neutral-100')}>
                      {req.name}
                    </p>
                    <Badge color={STATUS_COLORS[req.status]}>{PURCHASE_STATUS_LABELS[req.status]}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-neutral-500 flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {req.email}
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {req.phone}
                    </span>
                    {req.company && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {req.company}
                      </span>
                    )}
                  </p>
                  <div className="mt-1.5 flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
                    <span className="flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      ₹999 Lifetime
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDateTime(req.created_at)}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
