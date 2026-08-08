import { useToast } from '@/components/ui/Toast';
import { Badge,Button,Card,EmptyState,Input,Select,Spinner,Textarea } from '@/components/ui/primitives';
import { useAuth } from '@/lib/auth';
import { buildClosingVarianceRemark,calculateClosingVariances,finalizeDailyClosingDay,getDailyClosingSource,loadClosingHistory,reopenDailyClosing,reviewDailyClosing,submitDailyClosing } from '@/lib/dailyClosing';
import { exportDailyClosingsExcel,printDailyClosingsPdf } from '@/lib/dailyClosingExport';
import { formatDate,formatINR,toISODate } from '@/lib/format';
import { useHub } from '@/lib/hubContext';
import { db } from '@/lib/offline/db';
import { supabase } from '@/lib/supabase';
import { Collector,DailyClosing,DailyClosingFinalization,DailyClosingHistory,DailyClosingStatus } from '@/types';
import { AlertTriangle,ArchiveRestore,CalendarDays,CheckCircle2,Download,FileText,History,Lock,RefreshCw,Send,ShieldCheck,XCircle } from 'lucide-react';
import { useCallback,useEffect,useMemo,useState } from 'react';

const statusColor: Record<DailyClosingStatus, string> = { submitted: 'blue', approved: 'green', rejected: 'red', reopened: 'amber' };

export default function DailyClosingPage() {
  const { profile } = useAuth();
  const hub = useHub();
  const toast = useToast();
  const [date, setDate] = useState(toISODate(new Date()));
  const [collectorId, setCollectorId] = useState('');
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [closings, setClosings] = useState<DailyClosing[]>([]);
  const [finalization, setFinalization] = useState<DailyClosingFinalization | null>(null);
  const [requiredCollectorIds, setRequiredCollectorIds] = useState<string[]>([]);
  const [actualCash, setActualCash] = useState('');
  const [actualOnline, setActualOnline] = useState('');
  const [notes, setNotes] = useState('');
  const [source, setSource] = useState({ expectedCash: 0, onlineAmount: 0, entryCount: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [history, setHistory] = useState<DailyClosingHistory[]>([]);
  const [historyFor, setHistoryFor] = useState<DailyClosing | null>(null);

  const isManager = profile?.role === 'super_admin' || profile?.role === 'hub_admin' || profile?.role === 'supervisor';
  const canReview = isManager;
  const hubId = hub.selectedHubId || profile?.hub_id || '';
  const actualCashAmount = Math.max(0, Number(actualCash) || 0);
  const actualOnlineAmount = Math.max(0, Number(actualOnline) || 0);
  const variances = calculateClosingVariances(source.expectedCash, source.onlineAmount, actualCashAmount, actualOnlineAmount);
  const autoRemark = buildClosingVarianceRemark(variances);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      let availableCollectors: Collector[] = [];
      if (navigator.onLine) {
        let cq = supabase.from('collectors').select('*').eq('status', 'active').order('name');
        if (hubId) cq = cq.eq('hub_id', hubId);
        if (profile.role === 'collector') cq = cq.eq('profile_id', profile.id);
        const { data: cols, error: colError } = await cq;
        if (colError) throw colError;
        availableCollectors = cols ?? [];

        let q = supabase.from('daily_closings').select('*, collector:collectors(*), hub:hubs(*)')
          .gte('closing_date', date).lte('closing_date', date).order('submitted_at', { ascending: false });
        if (hubId) q = q.eq('hub_id', hubId);
        const { data, error } = await q;
        if (error) throw error;
        await Promise.all((data ?? []).map((row) => db.daily_closings.put(row as DailyClosing)));

        let eq = supabase.from('collection_entries').select('collector_id, expected_cod').eq('collection_date', date);
        if (hubId) eq = eq.eq('hub_id', hubId);
        const { data: entryCollectors, error: entryError } = await eq;
        if (entryError) throw entryError;
        const codCollectorIds = new Set(
          (entryCollectors ?? [])
            .filter((row) => Number(row.expected_cod || 0) > 0)
            .map((row) => row.collector_id),
        );
        const closingCollectorIds = new Set((data ?? []).map((closing) => closing.collector_id));
        availableCollectors = availableCollectors.filter(
          (collector) => codCollectorIds.has(collector.id) && !closingCollectorIds.has(collector.id),
        );
        setClosings(((data ?? []) as DailyClosing[]).filter((closing) => codCollectorIds.has(closing.collector_id)));
        setRequiredCollectorIds([...codCollectorIds]);

        let fq = supabase.from('daily_closing_finalizations')
          .select('*, finalizer:profiles!finalized_by(*), hub:hubs(*)').eq('closing_date', date);
        if (hubId) fq = fq.eq('hub_id', hubId);
        const { data: finalized, error: finalError } = await fq.maybeSingle();
        if (finalError) throw finalError;
        setFinalization(finalized as DailyClosingFinalization | null);
      } else {
        availableCollectors = (await db.collectors.toArray()).filter((c) => (!hubId || c.hub_id === hubId) && (profile.role !== 'collector' || c.profile_id === profile.id));
        const local = (await db.daily_closings.toArray()).filter((c) => c.closing_date === date && (!hubId || c.hub_id === hubId));
        const localEntries = (await db.collection_entries.toArray()).filter(e => e.collection_date === date && (!hubId || e.hub_id === hubId));
        const codCollectorIds = new Set(
          localEntries
            .filter((entry) => Number(entry.expected_cod || 0) > 0)
            .map((entry) => entry.collector_id),
        );
        const closingCollectorIds = new Set(local.map((closing) => closing.collector_id));
        availableCollectors = availableCollectors.filter(
          (collector) => codCollectorIds.has(collector.id) && !closingCollectorIds.has(collector.id),
        );
        setClosings(local.filter((closing) => codCollectorIds.has(closing.collector_id)));
        setRequiredCollectorIds([...codCollectorIds]);
        setFinalization(null);
      }
      setCollectors(availableCollectors);
      setCollectorId((current) => availableCollectors.some((c) => c.id === current) ? current : availableCollectors[0]?.id ?? '');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load daily closings');
    } finally { setLoading(false); }
  }, [profile, hubId, date, toast]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!collectorId || !hubId) { setSource({ expectedCash: 0, onlineAmount: 0, entryCount: 0 }); return; }
    void getDailyClosingSource(date, collectorId, hubId).then(setSource).catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to calculate closing source'));
  }, [date, collectorId, hubId, toast]);

  const existing = useMemo(() => closings.find((c) => c.collector_id === collectorId), [closings, collectorId]);
  const canSubmit = !finalization && (!existing || existing.status === 'submitted' || existing.status === 'rejected' || existing.status === 'reopened');
  const approvedCollectorIds = useMemo(() => new Set(closings.filter(c => c.status === 'approved').map(c => c.collector_id)), [closings]);
  const allApproved = requiredCollectorIds.length > 0 && requiredCollectorIds.every(id => approvedCollectorIds.has(id));

  const submit = async () => {
    if (!profile || !collectorId || !hubId) return;
    setSaving(true);
    try {
      await submitDailyClosing({ closingId: existing?.id, closingStatus: existing?.status, closingDate: date, collectorId, hubId, actualCash: actualCashAmount, actualOnline: actualOnlineAmount, notes: notes.trim() || autoRemark, userId: profile.id });
      toast.success(navigator.onLine ? 'Daily closing submitted' : 'Daily closing queued for sync');
      setActualCash(''); setActualOnline(''); setNotes(''); await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Failed to submit daily closing'); }
    finally { setSaving(false); }
  };

  const review = async (closing: DailyClosing, decision: 'approved' | 'rejected') => {
    const reason = decision === 'rejected' ? window.prompt('Rejection reason (required):') : undefined;
    if (decision === 'rejected' && !reason?.trim()) return;
    try { await reviewDailyClosing(closing.id, decision, reason ?? undefined); toast.success(`Closing ${decision}`); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Review failed'); }
  };

  const reopen = async (closing: DailyClosing) => {
    const reason = window.prompt('Reason for reopening this approved closing:');
    if (!reason?.trim()) return;
    try { await reopenDailyClosing(closing.id, reason); toast.success('Closing reopened'); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Reopen failed'); }
  };

  const showHistory = async (closing: DailyClosing) => {
    if (!navigator.onLine) { toast.warning('Audit history requires an internet connection'); return; }
    try { setHistoryFor(closing); setHistory(await loadClosingHistory(closing.id)); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Failed to load audit history'); }
  };

  const exportExcel = async () => { await exportDailyClosingsExcel(closings, `daily-closing-${date}.xlsx`); toast.success('Excel report exported'); };
  const exportPdf = () => { try { printDailyClosingsPdf(closings, `Daily Closing Report - ${formatDate(date)}`, finalization); } catch (e) { toast.error(e instanceof Error ? e.message : 'PDF report failed'); } };

  const finalizeDay = async () => {
    if (!hubId || !profile || !allApproved) return;
    setFinalizing(true);
    try {
      const result = await finalizeDailyClosingDay(date, hubId);
      const verified = { ...result, finalizer: profile } as DailyClosingFinalization;
      setFinalization(verified);
      window.dispatchEvent(new CustomEvent('hubvault:daily-closing-finalized', { detail: { hubId, date } }));
      toast.success(`Daily Closing verified by ${profile.name}`);
      printDailyClosingsPdf(closings, `Final Daily Closing Report - ${formatDate(date)}`, verified);
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Final Daily Close failed'); }
    finally { setFinalizing(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Daily Closing</h1><p className="text-sm text-neutral-500 mt-1">Collector-wise cash and online verification, approval and immutable audit history.</p></div>
        <div className="flex gap-2"><Button variant="outline" icon={<Download className="h-4 w-4" />} disabled={!closings.length} onClick={exportExcel}>Excel</Button><Button variant="outline" icon={<FileText className="h-4 w-4" />} disabled={!closings.length} onClick={exportPdf}>PDF</Button></div>
      </div>

      {!finalization && requiredCollectorIds.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm dark:border-amber-500/40 dark:bg-amber-500/10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-amber-100 p-2 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"><AlertTriangle className="h-5 w-5" /></span>
            <div>
              <p className="font-bold text-amber-900 dark:text-amber-100">Today&apos;s Daily Closing is pending</p>
              <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">The Hub Admin must review all COD entries and complete the Final Daily Close.</p>
            </div>
          </div>
          <span className="w-fit rounded-full bg-amber-500 px-3 py-1 text-xs font-black text-white shadow-sm">ACTION REQUIRED</span>
        </div>
      )}

      <Card className="p-5 space-y-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-900">
            <label htmlFor="closing-date" className="mb-1.5 flex items-center gap-2 text-xs font-bold text-neutral-600 dark:text-neutral-300"><CalendarDays className="h-4 w-4 text-brand-500" />Date</label>
            <input id="closing-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full border-0 bg-transparent p-0 text-sm font-bold text-neutral-900 outline-none dark:text-neutral-100" />
          </div>
          <Select label="Employee with COD" value={collectorId} onChange={(e) => setCollectorId(e.target.value)}><option value="">{collectors.length ? 'Select employee' : 'No pending employee'}</option>{collectors.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.employee_id})</option>)}</Select>
          <div className="rounded-xl bg-neutral-50 dark:bg-neutral-900 p-3"><p className="text-xs text-neutral-500">Expected cash</p><p className="font-bold">{formatINR(source.expectedCash)}</p></div>
          <div className="rounded-xl bg-brand-50 dark:bg-brand-500/10 p-3"><p className="text-xs text-neutral-500">Expected online</p><p className="font-bold">{formatINR(source.onlineAmount)}</p></div>
        </div>
        <div className="grid gap-3 md:grid-cols-2"><Input label="Actual Cash Amount" type="number" min={0} value={actualCash} onChange={(e) => setActualCash(e.target.value)} placeholder="Enter cash amount" /><Input label="Actual Online Amount (optional)" type="number" min={0} value={actualOnline} onChange={(e) => setActualOnline(e.target.value)} placeholder="Blank will be submitted as ₹0" /></div>
        <div className="grid gap-3 md:grid-cols-4"><VarianceCard label="Cash variance" value={variances.cash} /><VarianceCard label="Online variance" value={variances.online} /><VarianceCard label="Total variance" value={variances.total} /><Textarea label={variances.reconciled ? 'Notes' : 'Remarks (auto-filled)'} rows={2} value={notes || autoRemark} onChange={(e) => setNotes(e.target.value)} /></div>
        {existing && !canSubmit && <div className="flex items-center gap-2 text-sm text-neutral-500"><Lock className="h-4 w-4" />This employee already has a {existing.status} closing for this date.</div>}
        <div className="flex items-center justify-between gap-3"><p className="text-xs text-neutral-500">Source entries: {source.entryCount} · Blank online amount is treated as ₹0</p><Button icon={<Send className="h-4 w-4" />} onClick={submit} loading={saving} disabled={!collectorId || !canSubmit || actualCash === ''}>{existing ? 'Resubmit Closing' : 'Submit Closing'}</Button></div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? <div className="p-10 text-center"><Spinner /></div> : closings.length === 0 ? <EmptyState title="No daily closings" message="Submit the first collector closing for this date." /> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-neutral-50 dark:bg-neutral-900 text-left text-xs uppercase text-neutral-500"><tr><th className="p-3">Employee</th><th className="p-3">Expected Cash</th><th className="p-3">Actual Cash</th><th className="p-3">Cash Var.</th><th className="p-3">Expected Online</th><th className="p-3">Actual Online</th><th className="p-3">Online Var.</th><th className="p-3">Total Var.</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead><tbody>{closings.map((c) => { const rowVariance = calculateClosingVariances(Number(c.expected_cash), Number(c.expected_online_amount || 0), Number(c.actual_cash), Number(c.online_amount)); return <tr key={c.id} className="border-t border-neutral-100 dark:border-neutral-800"><td className="p-3 font-semibold">{c.collector?.name ?? collectors.find((x) => x.id === c.collector_id)?.name ?? 'Employee'}</td><td className="p-3">{formatINR(c.expected_cash)}</td><td className="p-3">{formatINR(c.actual_cash)}</td><VarianceCell value={rowVariance.cash} /><td className="p-3">{formatINR(c.expected_online_amount || 0)}</td><td className="p-3">{formatINR(c.online_amount)}</td><VarianceCell value={rowVariance.online} /><VarianceCell value={rowVariance.total} /><td className="p-3"><Badge color={statusColor[c.status]}>{c.status}</Badge>{rowVariance.reconciled ? <Badge color="green">Reconciled</Badge> : <Badge color="amber">Mismatch</Badge>}{c.status === 'approved' && <Lock className="inline h-3.5 w-3.5 ml-1 text-neutral-400" />}</td><td className="p-3"><div className="flex flex-wrap gap-1">{!finalization && canReview && c.status === 'submitted' && <><Button size="sm" variant="secondary" icon={<CheckCircle2 className="h-3.5 w-3.5" />} onClick={() => review(c, 'approved')}>Approve</Button><Button size="sm" variant="danger" icon={<XCircle className="h-3.5 w-3.5" />} onClick={() => review(c, 'rejected')}>Reject</Button></>}{!finalization && profile?.role === 'super_admin' && c.status === 'approved' && <Button size="sm" variant="outline" icon={<ArchiveRestore className="h-3.5 w-3.5" />} onClick={() => reopen(c)}>Reopen</Button>}<Button size="sm" variant="ghost" icon={<History className="h-3.5 w-3.5" />} onClick={() => showHistory(c)}>History</Button></div></td></tr>; })}</tbody></table></div>}
      </Card>

      {isManager && <Card className="p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><div className="rounded-xl bg-brand-50 dark:bg-brand-500/10 p-3"><ShieldCheck className="h-5 w-5 text-brand-600" /></div><div><h2 className="font-bold">Final Daily Close</h2>{finalization ? <><p className="text-sm text-success-600">Daily Closing verified by {finalization.finalizer?.name ?? 'Authorized user'}</p><p className="text-xs text-neutral-500">{finalization.finalizer?.role?.replace('_', ' ')} · {new Date(finalization.finalized_at).toLocaleString('en-IN')}</p></> : <p className="text-sm text-neutral-500">Approved: {requiredCollectorIds.filter(id => approvedCollectorIds.has(id)).length}/{requiredCollectorIds.length} employees</p>}</div></div>{finalization ? <Button variant="outline" icon={<FileText className="h-4 w-4" />} onClick={exportPdf}>Final Report</Button> : <Button icon={<ShieldCheck className="h-4 w-4" />} loading={finalizing} disabled={!allApproved || !navigator.onLine} onClick={finalizeDay}>Final Submit & Generate Report</Button>}</div>{!finalization && !allApproved && <p className="mt-3 text-xs text-warning-600">All employees with collection entries must be approved before final submission.</p>}</Card>}

      {historyFor && <Card className="p-5"><div className="flex justify-between"><div><h2 className="font-bold">Audit history</h2><p className="text-xs text-neutral-500">{historyFor.collector?.name} · {formatDate(historyFor.closing_date)}</p></div><Button variant="ghost" size="sm" onClick={() => setHistoryFor(null)}>Close</Button></div><div className="mt-4 space-y-2">{history.map((h) => <div key={h.id} className="flex gap-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 p-3"><RefreshCw className="h-4 w-4 mt-0.5 text-brand-600" /><div><p className="text-sm font-semibold capitalize">{h.action}</p><p className="text-xs text-neutral-500">{new Date(h.created_at).toLocaleString('en-IN')} · {h.performer?.name ?? 'User'}</p>{h.reason && <p className="text-xs mt-1">{h.reason}</p>}</div></div>)}</div></Card>}
    </div>
  );
}

function VarianceCard({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3"><p className="text-xs text-neutral-500">{label}</p><p className={`font-bold ${value < 0 ? 'text-error-600' : value > 0 ? 'text-warning-600' : 'text-success-600'}`}>{formatINR(value)}</p></div>;
}

function VarianceCell({ value }: { value: number }) {
  return <td className={`p-3 font-semibold ${value < 0 ? 'text-error-600' : value > 0 ? 'text-warning-600' : 'text-success-600'}`}>{formatINR(value)}</td>;
}
