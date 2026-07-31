import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RotateCcw, Search, Plus, Download, TrendingUp, Banknote, Smartphone,
  Wallet, Calendar, Trash2, FileBarChart,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useHub } from '@/lib/hubContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { Button, Card, EmptyState, Select, Skeleton, Spinner, Input } from '@/components/ui/primitives';
import Modal from '@/components/ui/Modal';
import { confirm } from '@/lib/confirm';
import {
  Due, Recovery, RecoveryPaymentMode, RECOVERY_PAYMENT_MODE_LABELS,
  Collector, DueStatus, DUE_STATUS_LABELS,
} from '@/types';
import { formatINR, formatDate, toISODate } from '@/lib/format';
import { subDays } from 'date-fns';
import { clsx } from 'clsx';
import { db } from '@/lib/offline/db';
import { addToQueue } from '@/lib/offline/syncQueue';
import { v4 as uuidv4 } from 'uuid';

const modeConfig: Record<RecoveryPaymentMode, { icon: typeof Banknote; color: string; badge: string }> = {
  cash: { icon: Banknote, color: 'text-brand-600', badge: 'bg-brand-600/15 text-brand-600 ring-brand-600/30' },
  online: { icon: Smartphone, color: 'text-blue-400', badge: 'bg-blue-500/10 text-blue-400 ring-blue-200/60' },
  other: { icon: Wallet, color: 'text-neutral-500 dark:text-neutral-400', badge: 'bg-neutral-100 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 ring-neutral-200 dark:ring-neutral-700/60' },
};

export default function RecoveryPage() {
  const { profile } = useAuth();
  const hubCtx = useHub();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [recoveries, setRecoveries] = useState<Recovery[]>([]);
  const [dues, setDues] = useState<Due[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState(toISODate(subDays(new Date(), 29)));
  const [to, setTo] = useState(toISODate(new Date()));
  const [collectorFilter, setCollectorFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | DueStatus>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    collector_id: '',
    due_id: '',
    recovery_date: toISODate(new Date()),
    amount: '',
    payment_mode: 'cash' as RecoveryPaymentMode,
    reference_number: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const isSuperAdmin = profile?.role === 'super_admin';
  const canManage = ['super_admin', 'hub_admin', 'supervisor'].includes(profile?.role ?? '');

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const effectiveHub = hubCtx.selectedHubId;

      if (!navigator.onLine) {
         let localRecs = await db.recoveries.toArray();
         if (effectiveHub) localRecs = localRecs.filter(r => r.hub_id === effectiveHub);
         localRecs = localRecs.filter(r => r.recovery_date >= from && r.recovery_date <= to);
         if (collectorFilter !== 'all') localRecs = localRecs.filter(r => r.collector_id === collectorFilter);
         if (modeFilter !== 'all') localRecs = localRecs.filter(r => r.payment_mode === modeFilter);

         const hydratedRecs = await Promise.all(localRecs.map(async r => {
             const collector = await db.collectors.get(r.collector_id);
             const due = await db.dues.get(r.due_id);
             return { ...r, collector, due };
         }));
         setRecoveries(hydratedRecs.sort((a, b) => new Date(b.recovery_date).getTime() - new Date(a.recovery_date).getTime()) as any[]);

         let localDues = await db.dues.filter(d => d.status !== 'fully_recovered').toArray();
         const hydratedDues = await Promise.all(localDues.map(async d => {
             const collector = await db.collectors.get(d.collector_id);
             return { ...d, collector };
         }));
         setDues(hydratedDues.sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime()) as any[]);

         let cols = await db.collectors.toArray();
         if (effectiveHub) cols = cols.filter(c => c.hub_id === effectiveHub);
         setCollectors(cols as any[]);
      } else {
        let recQ = supabase
          .from('recoveries')
          .select('*, collector: collectors(*), hub: hubs(*), due: dues(*)')
          .gte('recovery_date', from)
          .lte('recovery_date', to)
          .order('recovery_date', { ascending: false });
        if (effectiveHub) recQ = recQ.eq('hub_id', effectiveHub);
        if (collectorFilter !== 'all') recQ = recQ.eq('collector_id', collectorFilter);
        if (modeFilter !== 'all') recQ = recQ.eq('payment_mode', modeFilter);
        const { data: recs, error } = await recQ;
        if (error) throw error;
        setRecoveries(recs ?? []);

        const pureRecs = (recs ?? []).map(r => {
            const { collector, hub, due, ...rest } = r as any;
            return rest;
        });
        await db.recoveries.bulkPut(pureRecs);

        const dueQ = supabase
          .from('dues')
          .select('*, collector: collectors(*)')
          .neq('status', 'fully_recovered')
          .order('due_date', { ascending: false });
        const { data: dueData } = await dueQ;
        setDues(dueData ?? []);

        const pureDues = (dueData ?? []).map(d => {
            const { collector, ...rest } = d as any;
            return rest;
        });
        await db.dues.bulkPut(pureDues);

        let colQ = supabase.from('collectors').select('*');
        if (effectiveHub) colQ = colQ.eq('hub_id', effectiveHub);
        const { data: cols } = await colQ.order('name');
        setCollectors(cols ?? []);

        await db.collectors.bulkPut(cols ?? []);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load recoveries');
    } finally {
      setLoading(false);
    }
  }, [profile, hubCtx.selectedHubId, from, to, collectorFilter, modeFilter, toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recoveries.filter((r) => {
      if (statusFilter !== 'all' && r.due?.status !== statusFilter) return false;
      if (!q) return true;
      const name = r.collector?.name?.toLowerCase() ?? '';
      const empId = r.collector?.employee_id?.toLowerCase() ?? '';
      const phone = r.collector?.phone?.toLowerCase() ?? '';
      return name.includes(q) || empId.includes(q) || phone.includes(q);
    });
  }, [recoveries, search, statusFilter]);

  const stats = useMemo(() => {
    const totalRecovered = recoveries.reduce((s, r) => s + Number(r.amount), 0);
    const todayStr = toISODate(new Date());
    const recoveredToday = recoveries.filter((r) => r.recovery_date === todayStr).reduce((s, r) => s + Number(r.amount), 0);
    const cashRecoveries = recoveries.filter((r) => r.payment_mode === 'cash').reduce((s, r) => s + Number(r.amount), 0);
    const onlineRecoveries = recoveries.filter((r) => r.payment_mode === 'online').reduce((s, r) => s + Number(r.amount), 0);
    return { totalRecovered, recoveredToday, cashRecoveries, onlineRecoveries, count: recoveries.length };
  }, [recoveries]);

  const availableDues = useMemo(() => {
    if (!form.collector_id) return [];
    return dues.filter((d) => d.collector_id === form.collector_id);
  }, [dues, form.collector_id]);

  const selectedDue = useMemo(() => dues.find((d) => d.id === form.due_id) ?? null, [dues, form.due_id]);

  const openAdd = () => {
    setForm({
      collector_id: '',
      due_id: '',
      recovery_date: toISODate(new Date()),
      amount: '',
      payment_mode: 'cash',
      reference_number: '',
      notes: '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.collector_id) { toast.error('Select an employee'); return; }
    if (!form.due_id) { toast.error('Select a due to recover against'); return; }
    const amount = Number(form.amount);
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    if (selectedDue && amount > Number(selectedDue.remaining_amount)) {
      toast.error(`Amount exceeds remaining due of ${formatINR(selectedDue.remaining_amount)}`);
      return;
    }
    setSaving(true);
    try {
      const due = selectedDue ?? dues.find((d) => d.id === form.due_id);
      if (!due) { toast.error('Selected due not found'); setSaving(false); return; }

      const payload = {
        collector_id: form.collector_id,
        hub_id: due.hub_id,
        due_id: form.due_id,
        recovery_date: form.recovery_date,
        amount,
        payment_mode: form.payment_mode,
        reference_number: form.reference_number.trim() || null,
        notes: form.notes.trim() || null,
        created_by: profile?.id ?? null,
      };

      const newRecovered = Number(due.recovered_amount) + amount;
      const newRemaining = Number(due.original_amount) - newRecovered;
      const newStatus: DueStatus = newRemaining <= 0 ? 'fully_recovered' : 'partially_recovered';

      const dueUpdate = {
          recovered_amount: newRecovered,
          remaining_amount: Math.max(0, newRemaining),
          status: newStatus,
          updated_at: new Date().toISOString(),
      };

      if (!navigator.onLine) {
         const recId = uuidv4();
         const offlineRecPayload = { ...payload, id: recId, created_at: new Date().toISOString(), client_id: profile?.id, created_offline: true };
         await db.recoveries.add(offlineRecPayload as any);
         await addToQueue(profile?.id || '', due.hub_id, 'recoveries', 'INSERT', offlineRecPayload);

         const offlineDueUpdate = { ...dueUpdate, id: due.id, client_id: profile?.id };
         await db.dues.update(due.id, offlineDueUpdate);
         await addToQueue(profile?.id || '', due.hub_id, 'dues', 'UPDATE', offlineDueUpdate);

         toast.success(newStatus === 'fully_recovered' ? 'Recovery recorded offline — due fully recovered' : 'Recovery recorded offline');
      } else {
          const { error: rpcErr } = await supabase.rpc('record_recovery_atomic', {
            p_collector_id: form.collector_id,
            p_hub_id: due.hub_id,
            p_due_id: due.id,
            p_recovery_date: form.recovery_date,
            p_amount: amount,
            p_payment_mode: form.payment_mode,
            p_reference_number: form.reference_number.trim() || null,
            p_notes: form.notes.trim() || null,
            p_created_by: profile?.id ?? null,
          });

          if (rpcErr) {
            const { error: recErr } = await supabase.from('recoveries').insert(payload);
            if (recErr) throw recErr;

            const { error: dueErr } = await supabase
              .from('dues')
              .update(dueUpdate)
              .eq('id', due.id);
            if (dueErr) throw dueErr;
          }

          toast.success(newStatus === 'fully_recovered' ? 'Recovery recorded — due fully recovered' : 'Recovery recorded');
      }

      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save recovery');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rec: Recovery) => {
    const ok = await confirm({
      title: 'Delete this recovery?',
      message: `This will remove the recovery of ${formatINR(rec.amount)} for ${rec.collector?.name ?? 'this employee'}. The due's remaining balance will be recalculated.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;

    try {
      const due = rec.due;
      let newRecovered = 0;
      let newRemaining = 0;
      let newStatus: DueStatus = 'outstanding';
      let dueUpdate: any = null;

      if (due) {
        newRecovered = Math.max(0, Number(due.recovered_amount) - Number(rec.amount));
        newRemaining = Number(due.original_amount) - newRecovered;
        newStatus = newRemaining <= 0 ? 'fully_recovered' : newRecovered > 0 ? 'partially_recovered' : 'outstanding';
        dueUpdate = {
          recovered_amount: newRecovered,
          remaining_amount: Math.max(0, newRemaining),
          status: newStatus,
          updated_at: new Date().toISOString(),
        };
      }

      if (!navigator.onLine) {
          await db.recoveries.delete(rec.id);
          await addToQueue(profile?.id || '', rec.hub_id, 'recoveries', 'DELETE', { id: rec.id });
          if (dueUpdate) {
              const offlineDueUpdate = { ...dueUpdate, id: due!.id, client_id: profile?.id };
              await db.dues.update(due!.id, offlineDueUpdate);
              await addToQueue(profile?.id || '', rec.hub_id, 'dues', 'UPDATE', offlineDueUpdate);
          }
          toast.success('Recovery deleted offline');
      } else {
          const { error: delErr } = await supabase.from('recoveries').delete().eq('id', rec.id);
          if (delErr) throw delErr;

          if (dueUpdate) {
              await supabase.from('dues').update(dueUpdate).eq('id', due!.id);
          }
          toast.success('Recovery deleted');
      }

      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete recovery');
    }
  };

  const kpiCards = [
    { label: 'Recovery Today', value: stats.recoveredToday, icon: RotateCcw, accent: 'blue', sub: 'collected today' },
    { label: 'Total Recovered', value: stats.totalRecovered, icon: TrendingUp, accent: 'brand', sub: `${stats.count} transactions` },
    { label: 'Cash Recoveries', value: stats.cashRecoveries, icon: Banknote, accent: 'emerald', sub: 'via cash payments' },
    { label: 'Online Recoveries', value: stats.onlineRecoveries, icon: Smartphone, accent: 'blue', sub: 'via online payments' },
  ];

  const accentMap: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-400 ring-blue-100',
    brand: 'bg-brand-50 dark:bg-brand-600/15 text-brand-600 ring-brand-600/30',
    emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    slate: 'bg-neutral-100 dark:bg-neutral-900 text-neutral-500 ring-neutral-200 dark:ring-neutral-800',
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Recovery Management</h1>
          <p className="mt-1 text-sm text-neutral-500">Record and track payments collected against outstanding dues.</p>
          <div className="mt-2 flex items-center gap-2 text-sm text-neutral-500">
            <Calendar className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
            {formatDate(from)} — {formatDate(to)}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {canManage && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={openAdd} className="shadow-glow">Record Recovery</Button>
          )}
        </div>
      </div>

      {/* KPI cards */}
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
              <p className="mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">{formatINR(c.value)}</p>
              <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">{c.sub}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input-base py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-s slate-600 mb-1.5">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input-base py-2 text-sm" />
          </div>
          <Select value={collectorFilter} onChange={(e) => setCollectorFilter(e.target.value)}>
            <option value="all">All Employees</option>
            {collectors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}>
            <option value="all">All Modes</option>
            <option value="cash">Cash</option>
            <option value="online">Online</option>
            <option value="other">Other</option>
          </Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | DueStatus)}>
            <option value="all">All Statuses</option>
            <option value="outstanding">Outstanding</option>
            <option value="partially_recovered">Partial</option>
            <option value="fully_recovered">Fully Recovered</option>
          </Select>
        </div>
        <div className="mt-3 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500 dark:text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by employee name, ID, or phone…"
            className="input-base pl-10"
          />
        </div>
      </Card>

      {/* Recovery history table */}
      {loading ? (
        <Card className="p-8 flex justify-center"><Spinner className="h-6 w-6" /></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileBarChart className="h-7 w-7" />}
            title="No recovery records found"
            message={search || collectorFilter !== 'all' || modeFilter !== 'all' ? 'Try adjusting your filters.' : 'Recoveries will appear here once you record payments against outstanding dues.'}
            action={canManage ? <Button icon={<Plus className="h-4 w-4" />} onClick={openAdd}>Record Recovery</Button> : undefined}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold">Recovery Date</th>
                  <th className="text-left px-4 py-3 font-semibold">Employee</th>
                  <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Emp ID</th>
                  <th className="text-right px-4 py-3 font-semibold hidden md:table-cell">Previous Due</th>
                  <th className="text-right px-4 py-3 font-semibold">Recovery Amount</th>
                  <th className="text-right px-4 py-3 font-semibold hidden lg:table-cell">Remaining Due</th>
                  <th className="text-center px-4 py-3 font-semibold">Mode</th>
                  <th className="text-center px-4 py-3 font-semibold hidden xl:table-cell">Status</th>
                  <th className="text-right px-5 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {filtered.map((r) => {
                  const mc = modeConfig[r.payment_mode];
                  return (
                    <tr key={r.id} className="group hover:bg-neutral-100 dark:hover:bg-neutral-950/70 transition-colors">
                      <td className="px-5 py-3.5 text-neutral-500 dark:text-neutral-400 tabular-nums">{formatDate(r.recovery_date)}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                            {r.collector?.name?.charAt(0).toUpperCase() ?? '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-neutral-800 dark:text-neutral-200 truncate">{r.collector?.name ?? '—'}</p>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 sm:hidden font-mono">{r.collector?.employee_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-neutral-500 font-mono text-xs hidden sm:table-cell">{r.collector?.employee_id}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-neutral-500 hidden md:table-cell">{formatINR(r.due?.original_amount ?? 0)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-bold text-blue-400">{formatINR(r.amount)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-neutral-500 dark:text-neutral-400 hidden lg:table-cell">
                        {formatINR(Math.max(0, Number(r.due?.remaining_amount ?? 0)))}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={clsx('inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', mc.badge)}>
                          <mc.icon className="h-3 w-3" />
                          {RECOVERY_PAYMENT_MODE_LABELS[r.payment_mode]}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center hidden xl:table-cell">
                        {r.due && (
                          <span className={clsx('inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
                            r.due.status === 'fully_recovered' ? 'bg-brand-600/15 text-brand-600 ring-brand-600/30' :
                            r.due.status === 'partially_recovered' ? 'bg-amber-500/10 text-amber-400 ring-amber-500/30' :
                            'bg-red-500/10 text-red-400 ring-red-500/30'
                          )}>
                            {DUE_STATUS_LABELS[r.due.status]}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                          {canManage && (
                            <button
                              onClick={() => handleDelete(r)}
                              title="Delete"
                              className="p-1.5 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition active:scale-90"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
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

      {/* Record Recovery Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Record Recovery"
        subtitle="Record a payment against an outstanding due"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>Record Recovery</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Employee / Collector"
            value={form.collector_id}
            onChange={(e) => setForm({ ...form, collector_id: e.target.value, due_id: '' })}
          >
            <option value="">Select employee…</option>
            {collectors.filter((c) => dues.some((d) => d.collector_id === c.id)).map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.employee_id})</option>
            ))}
          </Select>

          {form.collector_id && (
            <Select
              label="Against Due / Previous Pending Amount"
              value={form.due_id}
              onChange={(e) => setForm({ ...form, due_id: e.target.value })}
            >
              <option value="">Select due…</option>
              {availableDues.map((d) => (
                <option key={d.id} value={d.id}>
                  Due {formatINR(d.original_amount)} · Remaining {formatINR(d.remaining_amount)} · Since {formatDate(d.due_date)}
                </option>
              ))}
            </Select>
          )}

          {selectedDue && (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800/70 p-3">
                <p className="text-xs text-neutral-500">Original Due</p>
                <p className="text-base font-bold text-neutral-800 dark:text-neutral-200 tabular-nums mt-0.5">{formatINR(selectedDue.original_amount)}</p>
              </div>
              <div className="rounded-xl bg-brand-50 dark:bg-brand-600/15 border border-brand-600/30 p-3">
                <p className="text-xs text-brand-600">Recovered</p>
                <p className="text-base font-bold text-brand-600 tabular-nums mt-0.5">{formatINR(selectedDue.recovered_amount)}</p>
              </div>
              <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3">
                <p className="text-xs text-red-400">Remaining</p>
                <p className="text-base font-bold text-red-400 tabular-nums mt-0.5">{formatINR(selectedDue.remaining_amount)}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Recovery Date"
              type="date"
              value={form.recovery_date}
              onChange={(e) => setForm({ ...form, recovery_date: e.target.value })}
            />
            <Input
              label="Recovery Amount"
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder={selectedDue ? `Max: ${formatINR(selectedDue.remaining_amount)}` : '0'}
            />
          </div>

          <Select
            label="Payment Mode"
            value={form.payment_mode}
            onChange={(e) => setForm({ ...form, payment_mode: e.target.value as RecoveryPaymentMode })}
          >
            <option value="cash">Cash</option>
            <option value="online">Online</option>
            <option value="other">Other</option>
          </Select>

          <Input
            label="Reference Number (optional)"
            value={form.reference_number}
            onChange={(e) => setForm({ ...form, reference_number: e.target.value })}
            placeholder="Transaction ID, receipt number…"
          />

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              placeholder="Any notes about this recovery…"
              className="input-base resize-none"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
