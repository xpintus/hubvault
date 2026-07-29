import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Landmark, Search, Plus, Trash2, Banknote, TrendingDown,
  Wallet, Calendar, FileBarChart, Edit3, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useHub } from '@/lib/hubContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { Button, Card, EmptyState, Skeleton, Spinner, Input, Select } from '@/components/ui/primitives';
import Modal from '@/components/ui/Modal';
import { confirm } from '@/lib/confirm';
import { CmsDeposit } from '@/types';
import { formatINR, formatDate, toISODate } from '@/lib/format';
import { subDays } from 'date-fns';
import { clsx } from 'clsx';
import { logAudit } from '@/lib/audit';

interface CollectionStats {
  totalExpectedCod: number;
  totalCollection: number;
  totalCash: number;
  totalOnline: number;
  totalShortage: number;
  entryCount: number;
}

interface FormState {
  deposit_date: string;
  hub_id: string;
  cash_collected: string;
  online_amount: string;
  total_deposited: string;
  reference_number: string;
  remarks: string;
}

const emptyForm: FormState = {
  deposit_date: toISODate(new Date()),
  hub_id: '',
  cash_collected: '',
  online_amount: '',
  total_deposited: '',
  reference_number: '',
  remarks: '',
};

export default function DepositsPage() {
  const { profile } = useAuth();
  const hubCtx = useHub();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [deposits, setDeposits] = useState<CmsDeposit[]>([]);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState(toISODate(subDays(new Date(), 29)));
  const [to, setTo] = useState(toISODate(new Date()));
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CmsDeposit | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [autoTotals, setAutoTotals] = useState<{ cash: number; online: number; expectedCod: number } | null>(null);
  const [fetchingTotals, setFetchingTotals] = useState(false);
  const [collStats, setCollStats] = useState<CollectionStats | null>(null);
  const [collStatsLoading, setCollStatsLoading] = useState(false);

  const canManage = ['super_admin', 'hub_admin', 'supervisor'].includes(profile?.role ?? '');
  const isSuperAdmin = profile?.role === 'super_admin';

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      let q = supabase
        .from('cms_deposits')
        .select('*, hub: hubs(*)')
        .gte('deposit_date', from)
        .lte('deposit_date', to)
        .order('deposit_date', { ascending: false });
      if (hubCtx.selectedHubId) q = q.eq('hub_id', hubCtx.selectedHubId);
      const { data, error } = await q;
      if (error) throw error;
      setDeposits(data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load deposits');
    } finally {
      setLoading(false);
    }
  }, [profile, hubCtx.selectedHubId, from, to, toast]);

  useEffect(() => { load(); }, [load]);

  const loadCollStats = useCallback(async () => {
    if (!profile) return;
    setCollStatsLoading(true);
    try {
      let q = supabase
        .from('collection_entries')
        .select('expected_cod, total_collection, cash_amount, online_amount, gap')
        .gte('collection_date', from)
        .lte('collection_date', to);
      if (hubCtx.selectedHubId) q = q.eq('hub_id', hubCtx.selectedHubId);
      const { data, error } = await q;
      if (error) throw error;
      const rows = data ?? [];
      setCollStats({
        totalExpectedCod: rows.reduce((s, r) => s + Number(r.expected_cod), 0),
        totalCollection: rows.reduce((s, r) => s + Number(r.total_collection), 0),
        totalCash: rows.reduce((s, r) => s + Number(r.cash_amount), 0),
        totalOnline: rows.reduce((s, r) => s + Number(r.online_amount), 0),
        totalShortage: rows.reduce((s, r) => s + Number(r.gap), 0),
        entryCount: rows.length,
      });
    } catch {
      setCollStats(null);
    } finally {
      setCollStatsLoading(false);
    }
  }, [profile, hubCtx.selectedHubId, from, to]);

  useEffect(() => { loadCollStats(); }, [loadCollStats]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return deposits;
    return deposits.filter((d) => {
      const ref = d.reference_number?.toLowerCase() ?? '';
      const hub = d.hub?.name?.toLowerCase() ?? '';
      const rem = d.remarks?.toLowerCase() ?? '';
      return ref.includes(q) || hub.includes(q) || rem.includes(q);
    });
  }, [deposits, search]);

  const stats = useMemo(() => {
    const totalExpected = deposits.reduce((s, d) => s + Number(d.total_expected_cms ?? d.total_cash_collected), 0);
    const totalDeposited = deposits.reduce((s, d) => s + Number(d.total_deposited ?? d.cash_deposited), 0);
    const totalShort = deposits.reduce((s, d) => s + Number(d.short_amount), 0);
    return { totalExpected, totalDeposited, totalShort, count: deposits.length };
  }, [deposits]);

  const activeHubId = hubCtx.selectedHubId;
  const fetchAutoTotals = useCallback(async (date: string, hubId: string, autoApply: boolean) => {
    if (!date || !hubId) { setAutoTotals(null); return; }
    setFetchingTotals(true);
    try {
      const { data, error } = await supabase
        .from('collection_entries')
        .select('expected_cod, cash_amount, online_amount')
        .eq('collection_date', date)
        .eq('hub_id', hubId);
      if (error) throw error;
      const cash = (data ?? []).reduce((s, r) => s + Number(r.cash_amount), 0);
      const online = (data ?? []).reduce((s, r) => s + Number(r.online_amount), 0);
      const expectedCod = (data ?? []).reduce((s, r) => s + Number(r.expected_cod), 0);
      setAutoTotals({ cash, online, expectedCod });
      if (autoApply) {
        setForm((f) => ({
          ...f,
          cash_collected: String(cash),
          online_amount: String(online),
        }));
      }
    } catch {
      setAutoTotals(null);
    } finally {
      setFetchingTotals(false);
    }
  }, []);

  const openAdd = () => {
    setEditing(null);
    const presetHub = activeHubId || (hubCtx.accessibleHubs[0]?.id ?? '');
    setForm({ ...emptyForm, hub_id: presetHub });
    setAutoTotals(null);
    setModalOpen(true);
    fetchAutoTotals(emptyForm.deposit_date, presetHub, true);
  };

  const openEdit = (d: CmsDeposit) => {
    setEditing(d);
    setForm({
      deposit_date: d.deposit_date,
      hub_id: d.hub_id,
      cash_collected: String(d.total_cash_collected),
      online_amount: String(d.online_amount),
      total_deposited: String(d.total_deposited ?? d.cash_deposited),
      reference_number: d.reference_number ?? '',
      remarks: d.remarks ?? '',
    });
    setAutoTotals(null);
    setModalOpen(true);
    fetchAutoTotals(d.deposit_date, d.hub_id, false);
  };

  const handleDateChange = (date: string) => {
    setForm((f) => ({ ...f, deposit_date: date }));
    fetchAutoTotals(date, form.hub_id, !editing);
  };

  const handleHubChange = (hubId: string) => {
    setForm((f) => ({ ...f, hub_id: hubId }));
    fetchAutoTotals(form.deposit_date, hubId, !editing);
  };

  const applyAutoTotals = () => {
    if (!autoTotals) return;
    setForm((f) => ({
      ...f,
      cash_collected: String(autoTotals.cash),
      online_amount: String(autoTotals.online),
    }));
    toast.success('Auto-filled from collection entries');
  };

  const expectedCodAmount = useMemo(() => autoTotals?.expectedCod ?? 0, [autoTotals]);

  // Total to CMS = cash + online (auto-calculated)
  const totalToCms = useMemo(() => {
    const cash = Number(form.cash_collected) || 0;
    const online = Number(form.online_amount) || 0;
    return cash + online;
  }, [form.cash_collected, form.online_amount]);

  // Auto-sync deposited to cash + online
  useEffect(() => {
    setForm((f) => ({ ...f, total_deposited: String(totalToCms) }));
  }, [totalToCms]);

  // Short = Expected COD - Total to CMS
  const computedShort = useMemo(() => {
    return expectedCodAmount - totalToCms;
  }, [expectedCodAmount, totalToCms]);

  const handleSave = async () => {
    const hubId = form.hub_id || activeHubId;
    if (!hubId) { toast.error('Please select a hub first'); return; }
    const cash = Number(form.cash_collected) || 0;
    const online = Number(form.online_amount) || 0;
    const deposited = Number(form.total_deposited) || 0;
    if (!form.deposit_date) { toast.error('Select a deposit date'); return; }
    if (cash < 0 || online < 0 || deposited < 0) { toast.error('Amounts cannot be negative'); return; }

    setSaving(true);
    try {
      const payload = {
        deposit_date: form.deposit_date,
        hub_id: hubId,
        total_cash_collected: cash,
        cash_deposited: totalToCms,
        online_amount: online,
        total_expected_cms: expectedCodAmount,
        total_deposited: totalToCms,
        short_amount: computedShort,
        reference_number: form.reference_number.trim() || null,
        remarks: form.remarks.trim() || null,
      };
      if (editing) {
        const { error } = await supabase.from('cms_deposits').update(payload).eq('id', editing.id);
        if (error) throw error;
        await logAudit('cms_deposit_update', profile?.id ?? null, `Updated CMS deposit of ${formatINR(deposited)} for ${formatDate(form.deposit_date)}`, null, hubId);
        toast.success('Deposit updated');
      } else {
        const { error } = await supabase.from('cms_deposits').insert({ ...payload, created_by: profile?.id ?? null });
        if (error) throw error;
        await logAudit('cms_deposit_create', profile?.id ?? null, `Recorded CMS deposit of ${formatINR(deposited)} for ${formatDate(form.deposit_date)}`, null, hubId);
        toast.success('Deposit recorded');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save deposit');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (d: CmsDeposit) => {
    const ok = await confirm({
      title: 'Delete this deposit?',
      message: `This will remove the CMS deposit of ${formatINR(d.total_deposited ?? d.cash_deposited)} dated ${formatDate(d.deposit_date)}.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      const { error } = await supabase.from('cms_deposits').delete().eq('id', d.id);
      if (error) throw error;
      await logAudit('cms_deposit_delete', profile?.id ?? null, `Deleted CMS deposit of ${formatINR(d.total_deposited ?? d.cash_deposited)} for ${formatDate(d.deposit_date)}`, null, d.hub_id);
      toast.success('Deposit deleted');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete deposit');
    }
  };

  const kpiCards = [
    { label: 'Total Expected CMS', value: stats.totalExpected, icon: Wallet, accent: 'brand', sub: 'expected COD total' },
    { label: 'Total Deposited', value: stats.totalDeposited, icon: Landmark, accent: 'emerald', sub: 'amount deposited' },
    { label: 'Short / Pending', value: stats.totalShort, icon: TrendingDown, accent: 'red', sub: stats.totalShort >= 0 ? 'not yet deposited' : 'excess deposited' },
    { label: 'Deposit Count', value: stats.count, icon: FileBarChart, accent: 'blue', sub: 'total entries', isCount: true },
  ];

  const accentMap: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-400 ring-blue-100',
    brand: 'bg-brand-50 dark:bg-brand-600/15 text-brand-600 ring-brand-600/30',
    emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    red: 'bg-red-500/10 text-red-400 ring-red-500/30',
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">CMS Deposition</h1>
          <p className="mt-1 text-sm text-neutral-500">Deposit collected cash at the bank / CMS counter. Online payments are already digital.</p>
          <div className="mt-2 flex items-center gap-2 text-sm text-neutral-500">
            <Calendar className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
            {formatDate(from)} — {formatDate(to)}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {canManage && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={openAdd} className="shadow-glow">Record Deposit</Button>
          )}
        </div>
      </div>

      {/* Collection summary cards — from collection_entries */}
      <div>
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-3">Collection Summary (from entries)</p>
        {collStatsLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {[0,1,2,3,4].map((i) => <Skeleton key={i} className="h-28" />)}
          </div>
        ) : collStats ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {/* Total Expected COD */}
            <Card hover className="p-4 animate-fade-in">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800/80 ring-1 ring-neutral-200 dark:ring-neutral-700">
                <Wallet className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />
              </div>
              <p className="mt-3 text-xs font-medium text-neutral-500">Total Expected COD</p>
              <p className="mt-0.5 text-xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">{formatINR(collStats.totalExpectedCod)}</p>
              <p className="mt-1 text-[11px] text-neutral-500">{collStats.entryCount} entries</p>
            </Card>

            {/* Total Collection */}
            <Card hover className="p-4 animate-fade-in">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 ring-1 ring-blue-500/30">
                <Landmark className="h-5 w-5 text-blue-400" />
              </div>
              <p className="mt-3 text-xs font-medium text-neutral-500">Total Collection</p>
              <p className="mt-0.5 text-xl font-bold text-blue-400 tabular-nums">{formatINR(collStats.totalCollection)}</p>
              <p className="mt-1 text-[11px] text-blue-400/60">{collStats.entryCount} entries today</p>
            </Card>

            {/* Cash Collected */}
            <Card hover className="p-4 animate-fade-in">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/30">
                <Banknote className="h-5 w-5 text-emerald-400" />
              </div>
              <p className="mt-3 text-xs font-medium text-neutral-500">Cash Collected</p>
              <p className="mt-0.5 text-xl font-bold text-emerald-400 tabular-nums">{formatINR(collStats.totalCash)}</p>
              <p className="mt-1 text-[11px] text-neutral-500">
                {collStats.totalCollection > 0
                  ? Math.round((collStats.totalCash / collStats.totalCollection) * 100)
                  : 0}% of total
              </p>
            </Card>

            {/* Online Collected */}
            <Card hover className="p-4 animate-fade-in">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 ring-1 ring-blue-500/30">
                <FileBarChart className="h-5 w-5 text-blue-400" />
              </div>
              <p className="mt-3 text-xs font-medium text-neutral-500">Online Collected</p>
              <p className="mt-0.5 text-xl font-bold text-blue-400 tabular-nums">{formatINR(collStats.totalOnline)}</p>
              <p className="mt-1 text-[11px] text-neutral-500">
                {collStats.totalCollection > 0
                  ? Math.round((collStats.totalOnline / collStats.totalCollection) * 100)
                  : 0}% of total
              </p>
            </Card>

            {/* Shortage */}
            <Card hover className="p-4 animate-fade-in col-span-2 sm:col-span-1">
              <div className="flex items-start justify-between">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 ring-1 ring-red-500/30">
                  <TrendingDown className="h-5 w-5 text-red-400" />
                </div>
                {collStats.totalShortage !== 0 && (
                  <span className="text-[10px] font-bold tracking-widest text-red-400 bg-red-500/10 border border-red-500/30 px-2 py-0.5 rounded-full">SHORT</span>
                )}
              </div>
              <p className="mt-3 text-xs font-medium text-neutral-500">Shortage</p>
              <p className={clsx('mt-0.5 text-xl font-bold tabular-nums', collStats.totalShortage < 0 ? 'text-red-400' : collStats.totalShortage > 0 ? 'text-amber-400' : 'text-neutral-500 dark:text-neutral-400')}>
                {formatINR(collStats.totalShortage)}
              </p>
              <p className="mt-1 text-[11px] text-neutral-500">vs Expected: {formatINR(collStats.totalExpectedCod)}</p>
            </Card>
          </div>
        ) : null}
      </div>

      {/* CMS Deposit KPI cards */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpiCards.map((c) => (
            <Card key={c.label} hover className="p-5 animate-fade-in">
              <div className={clsx('inline-flex h-11 w-11 items-center justify-center rounded-xl ring-1', accentMap[c.accent])}>
                <c.icon className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-medium text-neutral-500">{c.label}</p>
              <p className="mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">{c.isCount ? c.value : formatINR(c.value)}</p>
              <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">{c.sub}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input-base py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input-base py-2 text-sm" />
          </div>
        </div>
        <div className="mt-3 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500 dark:text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by reference number, hub, or remarks…"
            className="input-base pl-10"
          />
        </div>
      </Card>

      {/* Deposits table */}
      {loading ? (
        <Card className="p-8 flex justify-center"><Spinner className="h-6 w-6" /></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Landmark className="h-7 w-7" />}
            title="No CMS deposits recorded"
            message={search ? 'Try adjusting your filters.' : 'Record your first cash deposit at the bank / CMS counter.'}
            action={canManage ? <Button icon={<Plus className="h-4 w-4" />} onClick={openAdd}>Record Deposit</Button> : undefined}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold">Deposit Date</th>
                  {isSuperAdmin && <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Hub</th>}
                  <th className="text-right px-4 py-3 font-semibold">Cash</th>
                  <th className="text-right px-4 py-3 font-semibold hidden sm:table-cell">Online</th>
                  <th className="text-right px-4 py-3 font-semibold">Expected CMS</th>
                  <th className="text-right px-4 py-3 font-semibold">Deposited</th>
                  <th className="text-right px-4 py-3 font-semibold">Short</th>
                  <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Reference</th>
                  <th className="text-right px-5 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {filtered.map((d) => {
                  const expected = Number(d.total_expected_cms ?? d.total_cash_collected);
                  const deposited = Number(d.total_deposited ?? d.cash_deposited);
                  const short = Number(d.short_amount);
                  return (
                    <tr key={d.id} className="group hover:bg-neutral-50 dark:hover:bg-neutral-950/70 transition-colors">
                      <td className="px-5 py-3.5 text-neutral-500 dark:text-neutral-400 tabular-nums">{formatDate(d.deposit_date)}</td>
                      {isSuperAdmin && <td className="px-4 py-3.5 text-neutral-500 dark:text-neutral-400 hidden md:table-cell">{d.hub?.name ?? '—'}</td>}
                      <td className="px-4 py-3.5 text-right tabular-nums text-neutral-700 dark:text-neutral-300">{formatINR(d.total_cash_collected)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-blue-400 hidden sm:table-cell">{formatINR(d.online_amount)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-brand-600">{formatINR(expected)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-bold text-emerald-400">{formatINR(deposited)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-semibold">
                        <span className={short > 0 ? 'text-red-400' : short < 0 ? 'text-amber-400' : 'text-neutral-500 dark:text-neutral-400'}>
                          {formatINR(short)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-neutral-500 font-mono text-xs hidden lg:table-cell">{d.reference_number ?? '—'}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                          {canManage && (
                            <>
                              <button
                                onClick={() => openEdit(d)}
                                title="Edit"
                                className="p-1.5 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-600/10 transition active:scale-90"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(d)}
                                title="Delete"
                                className="p-1.5 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition active:scale-90"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Record / Edit Deposit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit CMS Deposit' : 'Record CMS Deposit'}
        subtitle="Deposit collected cash to CMS; online payments are already digital"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>{editing ? 'Update Deposit' : 'Record Deposit'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Deposit Date"
            type="date"
            value={form.deposit_date}
            onChange={(e) => handleDateChange(e.target.value)}
          />

          {(isSuperAdmin || hubCtx.isAllHubs) && hubCtx.accessibleHubs.length > 0 && (
            <Select
              label="Hub"
              value={form.hub_id}
              onChange={(e) => handleHubChange(e.target.value)}
            >
              {hubCtx.accessibleHubs.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </Select>
          )}

          {autoTotals && !editing && (
            <div className="rounded-xl bg-brand-50 dark:bg-brand-600/10 border border-brand-600/30 p-4 animate-fade-in">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Banknote className="h-5 w-5 text-brand-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-brand-600">Expected COD (amount to be deposited to CMS)</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      Cash {formatINR(autoTotals.cash)} · Online {formatINR(autoTotals.online)} · COD {formatINR(autoTotals.expectedCod)}
                      {fetchingTotals && ' · loading…'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-xl font-bold text-brand-600 tabular-nums">{formatINR(autoTotals.expectedCod)}</p>
                  <button
                    type="button"
                    onClick={applyAutoTotals}
                    className="shrink-0 rounded-lg bg-brand-600 text-white px-2.5 py-1 text-xs font-semibold hover:bg-brand-700 transition active:scale-95"
                  >
                    Auto-fill
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Cash and Online inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Cash Collected"
              type="number"
              value={form.cash_collected}
              onChange={(e) => setForm((f) => ({ ...f, cash_collected: e.target.value }))}
              placeholder="0"
            />
            <Input
              label="Online Amount"
              type="number"
              value={form.online_amount}
              onChange={(e) => setForm((f) => ({ ...f, online_amount: e.target.value }))}
              placeholder="0"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl bg-brand-50 dark:bg-brand-600/10 border border-brand-600/30 p-4">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-brand-600" />
                <p className="text-sm font-semibold text-brand-600">Expected COD</p>
              </div>
              <p className="text-xl font-bold text-brand-600 tabular-nums mt-2">{formatINR(expectedCodAmount)}</p>
            </div>
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4">
              <div className="flex items-center gap-2">
                <Banknote className="h-5 w-5 text-emerald-400" />
                <p className="text-sm font-semibold text-emerald-400">Total to CMS (Cash + Online)</p>
              </div>
              <p className="text-xl font-bold text-emerald-400 tabular-nums mt-2">{formatINR(totalToCms)}</p>
            </div>
          </div>

          {/* Live short calculation */}
          <div className={clsx('rounded-xl border p-4', computedShort > 0 ? 'bg-red-500/10 border-red-500/30' : computedShort < 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-neutral-950 border-neutral-800/70')}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {computedShort !== 0 && <AlertTriangle className="h-5 w-5 shrink-0" />}
                <p className={clsx('text-sm font-semibold', computedShort > 0 ? 'text-red-400' : computedShort < 0 ? 'text-amber-400' : 'text-neutral-500 dark:text-neutral-400')}>
                  {computedShort > 0 ? 'Short Amount' : computedShort < 0 ? 'Excess Amount' : 'Perfectly Matched'}
                </p>
              </div>
              <p className={clsx('text-xl font-bold tabular-nums', computedShort > 0 ? 'text-red-400' : computedShort < 0 ? 'text-amber-400' : 'text-neutral-700 dark:text-neutral-300')}>
                {formatINR(Math.abs(computedShort))}
              </p>
            </div>
            <p className={clsx('text-xs mt-1', computedShort > 0 ? 'text-red-400/60' : computedShort < 0 ? 'text-amber-400/60' : 'text-neutral-500')}>
              Expected COD {formatINR(expectedCodAmount)} − CMS {formatINR(totalToCms)} = {computedShort >= 0 ? 'Short' : 'Excess'} {formatINR(Math.abs(computedShort))}
            </p>
          </div>

          <Input
            label="Reference Number (optional)"
            value={form.reference_number}
            onChange={(e) => setForm({ ...form, reference_number: e.target.value })}
            placeholder="Bank / CMS receipt number…"
          />

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Remarks (optional)</label>
            <textarea
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              rows={2}
              placeholder="Any notes about this deposit…"
              className="input-base resize-none"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
