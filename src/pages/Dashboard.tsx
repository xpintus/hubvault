import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Wallet, Banknote, Smartphone, TrendingDown, TrendingUp, Scale, Target,
  ChevronLeft, ChevronRight, Calendar, Plus, Download, Upload, Search, Eye,
  Pencil, Trash2, Inbox, Copy, CheckCircle2, Building2, Clock, MapPin,
  AlertCircle, RotateCcw, Phone, BadgeCheck, Receipt,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useHub } from '@/lib/hubContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { Button, Card, EmptyState, Select, Spinner, Skeleton, SkeletonCard } from '@/components/ui/primitives';
import AdSlot from '@/components/ui/AdSlot';
import StatusBadge from '@/components/StatusBadge';
import DenominationPanel from '@/components/DenominationPanel';
import CollectionEntryModal from '@/components/CollectionEntryModal';
import ImportModal from '@/components/ImportModal';
import Modal from '@/components/ui/Modal';
import { confirm } from '@/lib/confirm';
import {
  CollectionEntry, Collector, DenominationInput, DENOMINATIONS, EMPTY_DENOMINATIONS, EntryStatus, Hub, Due, Recovery,
} from '@/types';
import { formatINR, formatDate, formatDateLong, toISODate } from '@/lib/format';
import { exportEntriesToExcel } from '@/lib/excel';
import { db } from '@/lib/offline/db';
import { addToQueue } from '@/lib/offline/syncQueue';
import { computePendingAmount, computeExcessAmount } from '@/lib/calc';
import { subDays, addDays, isToday as isDateToday, parseISO } from 'date-fns';
import { clsx } from 'clsx';

type FilterStatus = 'all' | EntryStatus;

export default function Dashboard() {
  const { profile } = useAuth();
  const hubCtx = useHub();
  const toast = useToast();
  const [date, setDate] = useState(new Date());
  const [entries, setEntries] = useState<CollectionEntry[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editing, setEditing] = useState<CollectionEntry | null>(null);
  const [viewing, setViewing] = useState<CollectionEntry | null>(null);
  const [kpiDetail, setKpiDetail] = useState<{
    title: string; label: string; icon: React.ElementType; accent: string;
    value: number; isGap: boolean;
    breakdown: { label: string; amount: number; sub?: string }[];
  } | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [dues, setDues] = useState<Due[]>([]);
  const [recoveries, setRecoveries] = useState<Recovery[]>([]);

  const dateStr = toISODate(date);

  const loadData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const superAdmin = profile.role === 'super_admin';
    setCanManage(['super_admin', 'hub_admin', 'supervisor'].includes(profile.role));

    const effectiveHubId = hubCtx.selectedHubId;
    try {
      if (!navigator.onLine) {
          // Offline read
          let cols = await db.collectors.toArray();
          if (effectiveHubId) cols = cols.filter(c => c.hub_id === effectiveHubId);
          setCollectors(cols as any[]);

          let ents = await db.collection_entries.where('collection_date').equals(dateStr).toArray();
          if (effectiveHubId) ents = ents.filter(e => e.hub_id === effectiveHubId);

          // Hydrate relations
          const hydratedEnts = await Promise.all(ents.map(async (e) => {
              const collector = await db.collectors.get(e.collector_id);
              const denominations = await db.denominations.where('collection_entry_id').equals(e.id).toArray();
              return { ...e, collector, denominations };
          }));

          setEntries(hydratedEnts.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) as any[]);

          let dueData = await db.dues.filter(d => d.status !== 'fully_recovered').toArray();
          if (effectiveHubId) dueData = dueData.filter(d => d.hub_id === effectiveHubId);
          const hydratedDues = await Promise.all(dueData.map(async (d) => {
              const collector = await db.collectors.get(d.collector_id);
              return { ...d, collector };
          }));
          setDues(hydratedDues.sort((a: any, b: any) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime()) as any[]);

          let recData = await db.recoveries.filter(r => r.recovery_date === dateStr).toArray();
          if (effectiveHubId) recData = recData.filter(r => r.hub_id === effectiveHubId);
          const hydratedRecs = await Promise.all(recData.map(async (r) => {
              const collector = await db.collectors.get(r.collector_id);
              return { ...r, collector };
          }));
          setRecoveries(hydratedRecs.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()) as any[]);

      } else {
        let collectorQuery = supabase.from('collectors').select('*');
        if (effectiveHubId) collectorQuery = collectorQuery.eq('hub_id', effectiveHubId);
        const { data: cols, error: colErr } = await collectorQuery.order('name');
        if (colErr) throw colErr;
        setCollectors(cols ?? []);

        // Populate offline cache
        await db.collectors.bulkPut(cols ?? []);

        let entryQuery = supabase
          .from('collection_entries')
          .select('*, collector: collectors(*), hub: hubs(*), denominations: denominations(*)')
          .eq('collection_date', dateStr);
        if (effectiveHubId) entryQuery = entryQuery.eq('hub_id', effectiveHubId);
        const { data: ents, error: entErr } = await entryQuery.order('created_at', { ascending: false });
        if (entErr) throw entErr;
        setEntries((ents ?? []) as CollectionEntry[]);

        // Populate offline cache
        const pureEntries = (ents ?? []).map(e => {
            const { collector, hub, denominations, ...rest } = e as any;
            return rest;
        });
        const denoms = (ents ?? []).flatMap((e: any) => e.denominations || []);
        await db.collection_entries.bulkPut(pureEntries);
        await db.denominations.bulkPut(denoms);

        let dueQuery = supabase
          .from('dues')
          .select('*, collector: collectors(*)')
          .neq('status', 'fully_recovered');
        if (effectiveHubId) dueQuery = dueQuery.eq('hub_id', effectiveHubId);
        const { data: dueData } = await dueQuery.order('due_date', { ascending: false });
        setDues(dueData ?? []);

        const pureDues = (dueData ?? []).map(d => {
            const { collector, ...rest } = d as any;
            return rest;
        });
        await db.dues.bulkPut(pureDues);

        let recQuery = supabase
          .from('recoveries')
          .select('*, collector: collectors(*)')
          .eq('recovery_date', dateStr);
        if (effectiveHubId) recQuery = recQuery.eq('hub_id', effectiveHubId);
        const { data: recData } = await recQuery.order('created_at', { ascending: false });
        setRecoveries(recData ?? []);

        const pureRecs = (recData ?? []).map(r => {
            const { collector, ...rest } = r as any;
            return rest;
        });
        await db.recoveries.bulkPut(pureRecs);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load data';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [profile, dateStr, hubCtx.selectedHubId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const summary = useMemo(() => {
    const total = entries.reduce((s, e) => s + Number(e.total_collection), 0);
    const cash = entries.reduce((s, e) => s + Number(e.cash_amount), 0);
    const online = entries.reduce((s, e) => s + Number(e.online_amount), 0);
    const expectedCod = entries.reduce((s, e) => s + Number(e.expected_cod), 0);
    const gap = total - expectedCod;
    const totalPending = entries.reduce((s, e) => s + computePendingAmount(Number(e.expected_cod), Number(e.total_collection)), 0);
    return { total, cash, online, expectedCod, gap, totalPending };
  }, [entries]);

  const outstandingDues = useMemo(() => {
    return dues.filter((d) => d.status !== 'fully_recovered').reduce((s, d) => s + Number(d.remaining_amount), 0);
  }, [dues]);

  const recoveryToday = useMemo(() => {
    return recoveries.reduce((s, r) => s + Number(r.amount), 0);
  }, [recoveries]);

  const recoveryThisMonth = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return dues.reduce((s, d) => {
      if (new Date(d.updated_at) >= monthStart) return s + Number(d.recovered_amount);
      return s;
    }, 0);
  }, [dues]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (filter !== 'all' && e.status !== filter) return false;
      if (!q) return true;
      const name = e.collector?.name?.toLowerCase() ?? '';
      const empId = e.collector?.employee_id?.toLowerCase() ?? '';
      const phone = e.collector?.phone?.toLowerCase() ?? '';
      return name.includes(q) || empId.includes(q) || phone.includes(q);
    });
  }, [entries, search, filter]);

  const counts = useMemo(() => {
    const c = { reconciled: 0, pending: 0, shortage: 0, excess: 0 };
    entries.forEach((e) => (c[e.status] += 1));
    return c;
  }, [entries]);

  const reconciledRate = entries.length > 0
    ? Math.round((counts.reconciled / entries.length) * 100)
    : 0;

  const handleDelete = async (entry: CollectionEntry) => {
    const ok = await confirm({
      title: 'Delete collection entry?',
      message: `This will permanently remove ${entry.collector?.name ?? 'this employee'}'s collection record for ${formatDate(entry.collection_date)}. This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    if (!navigator.onLine) {
        await db.collection_entries.delete(entry.id);
        await db.denominations.where('collection_entry_id').equals(entry.id).delete();
        await addToQueue(profile?.id || '', entry.hub_id, 'collection_entries', 'DELETE', { id: entry.id });
        toast.success('Entry deleted offline');
        loadData();
    } else {
        const { error } = await supabase.from('collection_entries').delete().eq('id', entry.id);
        if (error) {
          toast.error(error.message);
        } else {
          toast.success('Entry deleted');
          loadData();
        }
    }
  };

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.warning('No records to export for the current view');
      return;
    }
    const fname = `collections_${dateStr}${hubCtx.selectedHub ? `_${hubCtx.selectedHub.code}` : ''}.xlsx`;
    exportEntriesToExcel(filtered, fname);
    toast.success(`Exported ${filtered.length} records`);
  };

  const kpiCards = [
    {
      label: 'Total Expected COD', value: summary.expectedCod, icon: Target,
      accent: 'slate', sub: `${entries.length} entries`,
      desc: 'The total Cash-on-Delivery amount your team was expected to collect on the selected date. This is the baseline against which actual collections are compared to detect shortages and excesses.',
      points: [
        'Sum of expected COD across all entries for the selected date',
        'Serves as the baseline for automatic gap detection',
        'Tracked per collector and per hub for granular accountability',
      ],
    },
    {
      label: 'Total Collection', value: summary.total, icon: Wallet,
      accent: 'brand', sub: `${entries.length} entries today`,
      desc: 'The combined cash and online amount actually collected today. This is what your team brought in, regardless of what was expected.',
      points: [
        'Includes both physical cash and digital (UPI, bank transfer) payments',
        'Compared against expected COD to calculate the reconciliation gap',
        'Updates in real time as entries are added, edited, or deleted',
      ],
    },
    {
      label: 'Cash Collected', value: summary.cash, icon: Banknote,
      accent: 'emerald', sub: entries.length > 0 && summary.total > 0 ? `${Math.round((summary.cash / summary.total) * 100)}% of total` : '0% of total',
      desc: 'Physical currency collected by field staff. Each cash entry is backed by a note-by-note denomination breakdown for full accountability.',
      points: [
        'Verified via denomination breakdown (₹500, ₹200, ₹100, and so on)',
        'Note-level counting eliminates manual tallying errors',
        'Typically the largest portion of total collection',
      ],
    },
    {
      label: 'Online Collected', value: summary.online, icon: Smartphone,
      accent: 'blue', sub: entries.length > 0 && summary.total > 0 ? `${Math.round((summary.online / summary.total) * 100)}% of total` : '0% of total',
      desc: 'Digital payments recorded separately from cash — UPI transfers, bank deposits, and other online modes. Tracking these separately keeps reconciliation clean.',
      points: [
        'Recorded separately from cash for accurate mixed-mode reconciliation',
        'Includes UPI, bank transfers, and other digital payment methods',
        'Reduces physical cash handling and associated counting errors',
      ],
    },
    {
      label: summary.gap < 0 ? 'Shortage' : summary.gap > 0 ? 'Excess' : 'On Track',
      value: summary.gap, icon: summary.gap < 0 ? TrendingDown : summary.gap > 0 ? TrendingUp : Scale,
      accent: summary.gap < 0 ? 'red' : summary.gap > 0 ? 'amber' : 'slate',
      sub: `vs Expected: ${formatINR(summary.expectedCod)}`,
      desc: summary.gap < 0
        ? 'Your team collected less than the expected COD. The shortfall needs to be tracked and recovered from the responsible collector.'
        : summary.gap > 0
        ? 'Your team collected more than the expected COD. The surplus should be investigated and accounted for.'
        : 'Your team\'s collections match the expected COD exactly. Every rupee has been reconciled.',
      points: summary.gap < 0
        ? [
            'Gap = Total Collection − Expected COD (negative)',
            'Shortfalls are automatically tracked as dues for recovery',
            'Color-coded red so shortages are never missed',
          ]
        : summary.gap > 0
        ? [
            'Gap = Total Collection − Expected COD (positive)',
            'Surpluses are flagged amber for investigation',
            'Helps identify over-collection or misreported expectations',
          ]
        : [
            'Gap = Total Collection − Expected COD (zero)',
            'All entries are perfectly balanced',
            'This is the goal for every collection day',
          ],
    },
  ];

  const duesKpiCards = [
    { label: 'Pending Today', value: summary.totalPending, icon: AlertCircle, accent: 'amber', sub: 'unpaid from today',
      desc: 'Amount still unpaid from today\'s collection entries. These are the gaps between expected and actual collection for the selected date.',
      points: [
        'Calculated as the shortfall for each entry on the selected date',
        'Represents unpaid amounts that still need to be collected',
        'Tracked per collector for targeted follow-up',
      ],
    },
    { label: 'Outstanding Dues', value: outstandingDues, icon: TrendingDown, accent: 'red', sub: 'total across all dates',
      desc: 'The total amount pending across all dates — not just today. This is your cumulative recovery backlog across the selected hub(s).',
      points: [
        'Sum of remaining amounts across all open dues',
        'Includes dues from previous days, weeks, and months',
        'Each due is tracked until it is fully recovered',
      ],
    },
    { label: 'Recovery Today', value: recoveryToday, icon: RotateCcw, accent: 'blue', sub: `${recoveries.length} transactions`,
      desc: 'Amount recovered today from previously outstanding dues. This shows how much of your backlog was cleared on the selected date.',
      points: [
        'Sum of all recovery transactions recorded on the selected date',
        'Each recovery is linked to a specific collector and due',
        'Directly reduces the outstanding dues balance',
      ],
    },
    { label: 'Recovery This Month', value: recoveryThisMonth, icon: CheckCircle2, accent: 'brand', sub: 'total recovered',
      desc: 'Total amount recovered in the current calendar month. This gives you a broader view of recovery momentum beyond just the selected date.',
      points: [
        'Sum of all recoveries since the first of the current month',
        'Includes recoveries across all collectors and hubs',
        'A key metric for assessing recovery team performance',
      ],
    },
  ];

  const accentMap: Record<string, { icon: string; ring: string; text: string }> = {
    brand: { icon: 'bg-brand-600/15 text-brand-600', ring: 'ring-brand-600/30', text: 'text-brand-600' },
    emerald: { icon: 'bg-emerald-50 text-emerald-600', ring: 'ring-emerald-100', text: 'text-emerald-600' },
    blue: { icon: 'bg-blue-500/10 text-blue-400', ring: 'ring-blue-100', text: 'text-blue-400' },
    red: { icon: 'bg-red-500/10 text-red-400', ring: 'ring-red-100', text: 'text-red-400' },
    amber: { icon: 'bg-amber-500/10 text-amber-400', ring: 'ring-amber-100', text: 'text-amber-400' },
    slate: { icon: 'bg-[var(--card-bg)] text-neutral-500', ring: 'ring-neutral-200 dark:ring-neutral-800', text: 'text-neutral-500' },
  };

  const filterTabs: { key: FilterStatus; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: entries.length },
    { key: 'reconciled', label: 'Reconciled', count: counts.reconciled },
    { key: 'pending', label: 'Pending', count: counts.pending },
    { key: 'shortage', label: 'Shortage', count: counts.shortage },
    { key: 'excess', label: 'Excess', count: counts.excess },
  ];

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Dashboard</h1>
          <p className="mt-1 text-sm text-neutral-500">Monitor daily collections and reconciliation status.</p>
          <div className="mt-2 flex items-center gap-2 text-sm text-neutral-500">
            <Calendar className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
            {formatDateLong(date)}
            {hubCtx.selectedHub && (
              <>
                <span className="text-neutral-500 dark:text-neutral-400">·</span>
                <Building2 className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                <span className="font-medium text-neutral-500 dark:text-neutral-400">{hubCtx.selectedHub.name}</span>
                {hubCtx.selectedHub.location && (
                  <>
                    <span className="text-neutral-600 dark:text-neutral-400">·</span>
                    <MapPin className="h-3.5 w-3.5 text-neutral-500" />
                    <span className="text-neutral-500">{hubCtx.selectedHub.location}</span>
                  </>
                )}
              </>
            )}
            {hubCtx.isAllHubs && (
              <>
                <span className="text-neutral-500 dark:text-neutral-400">·</span>
                <Building2 className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                <span className="font-medium text-neutral-500 dark:text-neutral-400">All Hubs</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {canManage && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => { setEditing(null); setEntryModalOpen(true); }} className="shadow-glow">
              Add Entry
            </Button>
          )}
        </div>
      </div>

      {/* KPI cards */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {kpiCards.map((c) => {
            const a = accentMap[c.accent];
            const isGap = c.label === 'Shortage' || c.label === 'Excess' || c.label === 'On Track';
            const openDetail = () => {
              let breakdown: { label: string; amount: number; sub?: string }[] = [];
              if (c.label === 'Total Expected COD') {
                breakdown = entries.map(e => ({ label: e.collector?.name ?? '—', amount: Number(e.expected_cod), sub: e.collector?.employee_id }));
              } else if (c.label === 'Total Collection') {
                breakdown = entries.map(e => ({ label: e.collector?.name ?? '—', amount: Number(e.total_collection), sub: e.collector?.employee_id }));
              } else if (c.label === 'Cash Collected') {
                breakdown = entries.filter(e => Number(e.cash_amount) > 0).map(e => ({ label: e.collector?.name ?? '—', amount: Number(e.cash_amount), sub: e.collector?.employee_id }));
              } else if (c.label === 'Online Collected') {
                breakdown = entries.filter(e => Number(e.online_amount) > 0).map(e => ({ label: e.collector?.name ?? '—', amount: Number(e.online_amount), sub: e.collector?.employee_id }));
              } else {
                breakdown = entries.map(e => ({ label: e.collector?.name ?? '—', amount: Number(e.total_collection) - Number(e.expected_cod), sub: e.collector?.employee_id })).filter(b => b.amount !== 0);
              }
              breakdown.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
              setKpiDetail({ title: c.label, label: c.label, icon: c.icon, accent: c.accent, value: c.value, isGap, breakdown });
            };
            return (
              <Card
                key={c.label}
                hover
                className="p-5 animate-fade-in group/kpi cursor-pointer transition-all duration-300 hover:-translate-y-0.5"
                role="button"
                tabIndex={0}
                onClick={openDetail}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(); } }}
              >
                <div className="flex items-center justify-between">
                  <div className={clsx('flex h-11 w-11 items-center justify-center rounded-xl ring-1', a.icon, a.ring)}>
                    <c.icon className="h-5 w-5" />
                  </div>
                  {isGap && c.value !== 0 && (
                    <span className={clsx(
                      'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold',
                      c.value < 0 ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
                    )}>
                      {c.value < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                      {c.value < 0 ? 'SHORT' : 'OVER'}
                    </span>
                  )}
                </div>
                <div className="mt-4">
                  <p className="text-sm font-medium text-neutral-500">{c.label}</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 tabular-nums">
                    {isGap && c.value < 0 ? '-' : isGap && c.value > 0 ? '+' : ''}
                    {formatINR(Math.abs(c.value))}
                  </p>
                  <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">{c.sub}</p>
                  <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 opacity-0 -translate-y-1 transition-all duration-300 group-hover/kpi:opacity-100 group-hover/kpi:translate-y-0">
                    Click for details
                    <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dues & Recovery KPI cards */}
      {!loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {duesKpiCards.map((c) => {
            const a = accentMap[c.accent];
            const openDetail = () => {
              let breakdown: { label: string; amount: number; sub?: string }[] = [];
              if (c.label === 'Pending Today') {
                breakdown = entries.map(e => ({ label: e.collector?.name ?? '—', amount: computePendingAmount(Number(e.expected_cod), Number(e.total_collection)), sub: e.collector?.employee_id })).filter(b => b.amount > 0);
              } else if (c.label === 'Outstanding Dues') {
                breakdown = dues.map(d => ({ label: d.collector?.name ?? '—', amount: Number(d.remaining_amount), sub: formatDate(d.due_date) }));
              } else if (c.label === 'Recovery Today') {
                breakdown = recoveries.map(r => ({ label: r.collector?.name ?? '—', amount: Number(r.amount), sub: r.collector?.employee_id }));
              } else if (c.label === 'Recovery This Month') {
                const ms = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
                breakdown = dues.filter(d => new Date(d.updated_at) >= ms && Number(d.recovered_amount) > 0).map(d => ({ label: d.collector?.name ?? '—', amount: Number(d.recovered_amount), sub: formatDate(d.due_date) }));
              }
              breakdown.sort((a, b) => b.amount - a.amount);
              setKpiDetail({ title: c.label, label: c.label, icon: c.icon, accent: c.accent, value: c.value, isGap: false, breakdown });
            };
            return (
              <Card
                key={c.label}
                hover
                className="p-5 animate-fade-in group/dues cursor-pointer transition-all duration-300 hover:-translate-y-0.5"
                role="button"
                tabIndex={0}
                onClick={openDetail}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(); } }}
              >
                <div className={clsx('flex h-11 w-11 items-center justify-center rounded-xl ring-1', a.icon, a.ring)}>
                  <c.icon className="h-5 w-5" />
                </div>
                <div className="mt-4">
                  <p className="text-sm font-medium text-neutral-500">{c.label}</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 tabular-nums">{formatINR(c.value)}</p>
                  <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">{c.sub}</p>
                  <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 opacity-0 -translate-y-1 transition-all duration-300 group-hover/dues:opacity-100 group-hover/dues:translate-y-0">
                    Click for details
                    <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Reconciliation progress + date toolbar */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Reconciliation rate */}
        <Card className="p-5 lg:col-span-1">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">Reconciliation Rate</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{counts.reconciled} of {entries.length} reconciled</p>
            </div>
            <span className={clsx('text-2xl font-bold tabular-nums', reconciledRate === 100 ? 'text-brand-600' : reconciledRate >= 80 ? 'text-neutral-700 dark:text-neutral-300' : 'text-amber-400')}>
              {reconciledRate}%
            </span>
          </div>
          <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-900">
            <div
              className={clsx('h-full rounded-full transition-all duration-700 ease-out', reconciledRate === 100 ? 'bg-brand-500' : 'bg-brand-400')}
              style={{ width: `${reconciledRate}%` }}
            />
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {([
              { label: 'Reconciled', count: counts.reconciled, color: 'text-brand-600', dot: 'bg-brand-500' },
              { label: 'Pending', count: counts.pending, color: 'text-neutral-500', dot: 'bg-slate-400' },
              { label: 'Shortage', count: counts.shortage, color: 'text-red-400', dot: 'bg-red-500' },
              { label: 'Excess', count: counts.excess, color: 'text-amber-400', dot: 'bg-amber-500' },
            ]).map((s) => (
              <div key={s.label} className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <span className={clsx('h-1.5 w-1.5 rounded-full', s.dot)} />
                  <span className={clsx('text-base font-bold tabular-nums', s.color)}>{s.count}</span>
                </div>
                <p className="mt-0.5 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">{s.label}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Date toolbar */}
        <Card className="p-5 lg:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">Date Navigation</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">View and manage collections for any date</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 p-1">
                <button
                  onClick={() => setDate(subDays(date, 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900 hover:text-neutral-700 dark:hover:text-neutral-300 transition active:scale-90"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="relative">
                  <input
                    type="date"
                    value={dateStr}
                    onChange={(e) => { const d = parseISO(e.target.value); if (d) setDate(d); }}
                    className="border-0 bg-transparent px-2 py-1.5 text-sm font-semibold text-neutral-700 dark:text-neutral-300 outline-none focus:ring-0 [color-scheme:light] tabular-nums"
                  />
                </div>
                <button
                  onClick={() => setDate(addDays(date, 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900 hover:text-neutral-700 dark:hover:text-neutral-300 transition active:scale-90"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <Button
                variant={isDateToday(date) ? 'primary' : 'outline'}
                size="md"
                onClick={() => setDate(new Date())}
                className="shrink-0"
              >
                Today
              </Button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-neutral-200 dark:border-neutral-800 pt-4">
            <Button variant="outline" size="sm" icon={<Download className="h-4 w-4" />} onClick={handleExport}>
              Export Excel
            </Button>
            {canManage && (
              <Button variant="outline" size="sm" icon={<Upload className="h-4 w-4" />} onClick={() => setImportModalOpen(true)}>
                Import Excel
              </Button>
            )}
            <div className="ml-auto flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
              <Clock className="h-3.5 w-3.5" />
              <span>{filtered.length} of {entries.length} records shown</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Search and filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500 dark:text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by employee name, employee ID, or phone…"
            className="input-base pl-10"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          {filterTabs.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={clsx(
                'inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-all active:scale-95',
                filter === f.key
                  ? 'text-[var(--neutral-200)] shadow-soft'
                  : 'bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700 hover:text-neutral-800 dark:hover:text-neutral-200'
              )}
            >
              {f.label}
              <span className={clsx(
                'rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                filter === f.key ? 'bg-neutral-900/20 text-white' : 'bg-neutral-200 dark:bg-neutral-900 text-neutral-500'
              )}>{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Staff activity table + denomination panel */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800/70 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-neutral-900 dark:text-neutral-100">Staff Activity</h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Collection records for {formatDate(date)}</p>
              </div>
            </div>
            {loading ? (
              <div className="py-20 flex justify-center"><Spinner className="h-6 w-6" /></div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<Inbox className="h-8 w-8" />}
                title="No activity for selected date"
                message={search || filter !== 'all' ? 'Try adjusting your search or filter.' : 'Add a collection entry to get started.'}
              />
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-50 dark:bg-neutral-950/80 text-neutral-500 text-xs uppercase tracking-wide sticky top-0">
                      <tr>
                        <th className="text-left px-5 py-3 font-semibold">Employee</th>
                        <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Emp ID</th>
                        <th className="text-right px-4 py-3 font-semibold hidden xl:table-cell">Expected COD</th>
                        <th className="text-right px-4 py-3 font-semibold">Cash</th>
                        <th className="text-right px-4 py-3 font-semibold hidden sm:table-cell">Online</th>
                        <th className="text-right px-4 py-3 font-semibold">Total</th>
                        <th className="text-right px-4 py-3 font-semibold">Pending</th>
                        <th className="text-right px-4 py-3 font-semibold hidden xl:table-cell">Excess</th>
                        <th className="text-center px-4 py-3 font-semibold">Status</th>
                        <th className="text-right px-5 py-3 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                      {filtered.map((e) => (
                        <tr key={e.id} className="group hover:bg-neutral-50 dark:hover:bg-neutral-950/70 transition-colors">
                          <td className="px-5 py-3.5 relative">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-brand-600/20 to-brand-600/10 text-brand-600 flex items-center justify-center font-bold text-xs shrink-0">
                                {e.collector?.name?.charAt(0).toUpperCase() ?? '?'}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-neutral-800 dark:text-neutral-200 truncate">{e.collector?.name ?? '—'}</div>
                                <div className="text-xs text-neutral-500 dark:text-neutral-400 lg:hidden">{e.collector?.employee_id}</div>
                              </div>
                            </div>
                            <RowHoverPopup entry={e} onView={() => setViewing(e)} />
                          </td>
                          <td className="px-4 py-3.5 text-neutral-500 font-mono text-xs hidden lg:table-cell">{e.collector?.employee_id}</td>
                          <td className="px-4 py-3.5 text-right tabular-nums text-neutral-500 hidden xl:table-cell">{formatINR(e.expected_cod)}</td>
                          <td className="px-4 py-3.5 text-right tabular-nums text-neutral-500 dark:text-neutral-400">{formatINR(e.cash_amount)}</td>
                          <td className="px-4 py-3.5 text-right tabular-nums text-neutral-500 dark:text-neutral-400 hidden sm:table-cell">{formatINR(e.online_amount)}</td>
                          <td className="px-4 py-3.5 text-right tabular-nums font-bold text-neutral-800 dark:text-neutral-200">{formatINR(e.total_collection)}</td>
                          {(() => {
                            const pending = computePendingAmount(Number(e.expected_cod), Number(e.total_collection));
                            const excess = computeExcessAmount(Number(e.expected_cod), Number(e.total_collection));
                            return (
                              <>
                                <td className={clsx('px-4 py-3.5 text-right tabular-nums font-semibold', pending > 0 ? 'text-amber-400' : 'text-neutral-500 dark:text-neutral-400')}>{formatINR(pending)}</td>
                                <td className={clsx('px-4 py-3.5 text-right tabular-nums font-semibold hidden xl:table-cell', excess > 0 ? 'text-brand-600' : 'text-neutral-500 dark:text-neutral-400')}>{formatINR(excess)}</td>
                              </>
                            );
                          })()}
                          <td className="px-4 py-3.5 text-center"><StatusBadge status={e.status} size="sm" /></td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setViewing(e)} title="View" className="p-1.5 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-blue-400 hover:bg-blue-500/10 transition active:scale-90">
                                <Eye className="h-4 w-4" />
                              </button>
                              {canManage && (
                                <button onClick={() => { setEditing(e); setEntryModalOpen(true); }} title="Edit" className="p-1.5 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-600/15 transition active:scale-90">
                                  <Pencil className="h-4 w-4" />
                                </button>
                              )}
                              {canManage && (
                                <button onClick={() => handleDelete(e)} title="Delete" className="p-1.5 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition active:scale-90">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile card list */}
                <div className="divide-y divide-neutral-200 dark:divide-neutral-800 md:hidden">
                  {filtered.map((e) => (
                    <div key={e.id} className="p-4 hover:bg-neutral-50 dark:hover:bg-neutral-950/70 transition-colors">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-600/20 to-brand-600/10 text-brand-600 flex items-center justify-center font-bold text-sm shrink-0">
                            {e.collector?.name?.charAt(0).toUpperCase() ?? '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-neutral-800 dark:text-neutral-200 truncate">{e.collector?.name ?? '—'}</p>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">{e.collector?.employee_id}</p>
                          </div>
                        </div>
                        <StatusBadge status={e.status} size="sm" />
                      </div>
                      <RowHoverPopup entry={e} mobile onView={() => setViewing(e)} />
                      <div className="mt-3 grid grid-cols-4 gap-2">
                        <div className="rounded-lg bg-neutral-100 dark:bg-neutral-950 px-2 py-2">
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Cash</p>
                          <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 tabular-nums">{formatINR(e.cash_amount)}</p>
                        </div>
                        <div className="rounded-lg bg-neutral-100 dark:bg-neutral-950 px-2 py-2">
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Online</p>
                          <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 tabular-nums">{formatINR(e.online_amount)}</p>
                        </div>
                        <div className="rounded-lg bg-neutral-100 dark:bg-neutral-950 px-2 py-2">
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Total</p>
                          <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200 tabular-nums">{formatINR(e.total_collection)}</p>
                        </div>
                        <div className="rounded-lg bg-amber-500/10 px-2 py-2">
                          <p className="text-[11px] text-amber-500">Pending</p>
                          <p className="text-sm font-semibold text-amber-400 tabular-nums">{formatINR(computePendingAmount(Number(e.expected_cod), Number(e.total_collection)))}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className={clsx('text-sm font-semibold tabular-nums', e.gap < 0 ? 'text-red-400' : e.gap > 0 ? 'text-amber-400' : 'text-brand-600')}>
                          {e.gap < 0 ? '-' : e.gap > 0 ? '+' : ''}{formatINR(Math.abs(Number(e.gap)))}
                        </span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setViewing(e)} className="p-2 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-blue-400 hover:bg-blue-500/10 transition active:scale-90">
                            <Eye className="h-4 w-4" />
                          </button>
                          {canManage && (
                            <button onClick={() => { setEditing(e); setEntryModalOpen(true); }} className="p-2 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-600/15 transition active:scale-90">
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {canManage && (
                            <button onClick={() => handleDelete(e)} className="p-2 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition active:scale-90">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>

        {/* Denomination panel */}
        <div>
          <Card className="p-5">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div>
                <h3 className="font-bold text-neutral-900 dark:text-neutral-100">Denomination Summary</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Aggregated note counts for {formatDate(date)}</p>
              </div>
              <CopyDenominationButton entries={filtered} />
            </div>
            <div className="mt-4">
              <AggregateDenominations entries={filtered} />
            </div>
          </Card>
        </div>
      </div>

      {/* Subtle in-content ad — hidden for super_admin */}
      {profile?.role !== 'super_admin' && (
        <div className="mt-6">
          <AdSlot slot="9999999999" className="rounded-xl overflow-hidden opacity-90" />
        </div>
      )}

      {/* Modals */}
      {canManage && (
        <CollectionEntryModal
          open={entryModalOpen}
          onClose={() => setEntryModalOpen(false)}
          onSaved={loadData}
          collectors={collectors}
          hubId={hubCtx.selectedHub?.id ?? profile?.hub_id ?? ''}
          defaultDate={dateStr}
          editing={editing}
        />
      )}
      {canManage && (
        <ImportModal
          open={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          onImported={loadData}
          collectors={collectors}
          hubId={hubCtx.selectedHub?.id ?? profile?.hub_id ?? ''}
          createdById={profile?.id ?? ''}
        />
      )}

      <ViewEntryModal entry={viewing} onClose={() => setViewing(null)} />

      {kpiDetail && (
        <Modal
          open={!!kpiDetail}
          onClose={() => setKpiDetail(null)}
          title={kpiDetail.title}
          subtitle={kpiDetail.label}
          size="md"
        >
          <div className="flex items-center gap-4">
            <div className={clsx('flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ring-1', accentMap[kpiDetail.accent].icon, accentMap[kpiDetail.accent].ring)}>
              <kpiDetail.icon className="h-7 w-7" />
            </div>
            <div>
              <p className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 tabular-nums">
                {kpiDetail.isGap && kpiDetail.value < 0 ? '-' : kpiDetail.isGap && kpiDetail.value > 0 ? '+' : ''}
                {formatINR(Math.abs(kpiDetail.value))}
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">{kpiDetail.label}</p>
            </div>
          </div>
          <div className="mt-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">Amount Breakdown</p>
            <div className="max-h-80 overflow-y-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-neutral-50 dark:bg-neutral-950 text-neutral-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold">Name</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800/70">
                  {kpiDetail.breakdown.length === 0 ? (
                    <tr><td colSpan={2} className="px-4 py-8 text-center text-neutral-500">No data available</td></tr>
                  ) : (
                    kpiDetail.breakdown.map((b, i) => (
                      <tr key={i} className="hover:bg-neutral-50 dark:hover:bg-neutral-950/50 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-neutral-800 dark:text-neutral-200">{b.label}</div>
                          {b.sub && <div className="text-xs text-neutral-500">{b.sub}</div>}
                        </td>
                        <td className={clsx('px-4 py-2.5 text-right font-bold tabular-nums', kpiDetail.isGap && b.amount < 0 ? 'text-red-400' : kpiDetail.isGap && b.amount > 0 ? 'text-amber-400' : 'text-neutral-800 dark:text-neutral-200')}>
                          {kpiDetail.isGap && b.amount < 0 ? '-' : kpiDetail.isGap && b.amount > 0 ? '+' : ''}{formatINR(Math.abs(b.amount))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AggregateDenominations({ entries }: { entries: CollectionEntry[] }) {
  const agg = useMemo(() => aggregateDenominations(entries), [entries]);
  const hasAny = (Object.values(agg) as number[]).some((v) => v > 0);

  if (!hasAny) {
    return <EmptyState icon={<Banknote className="h-6 w-6" />} title="No denominations recorded" message="Denomination breakdowns will appear here once entries are added." />;
  }
  return <DenominationPanel value={agg} onChange={() => {}} compact />;
}

function denominationToText(d: DenominationInput): string {
  const lines = DENOMINATIONS.map((item) => {
    const qty = d[item.key];
    if (qty === 0) return null;
    const lineTotal = qty * item.value;
    return `${item.label} x ${qty} = ₹${lineTotal}`;
  }).filter(Boolean) as string[];
  const totalCash = DENOMINATIONS.reduce((sum, item) => sum + d[item.key] * item.value, 0);
  const totalNotes = DENOMINATIONS.reduce((sum, item) => sum + d[item.key], 0);
  lines.push('--------------------------------');
  lines.push(`Total Notes: ${totalNotes}`);
  lines.push(`Total Cash: ₹${totalCash}`);
  return lines.join('\n');
}

function aggregateDenominations(entries: CollectionEntry[]): DenominationInput {
  const agg: DenominationInput = { ...EMPTY_DENOMINATIONS };
  entries.forEach((e) => {
    const d = Array.isArray(e.denominations) ? e.denominations[0] : e.denominations;
    if (d) {
      agg.note_500 += d.note_500;
      agg.note_200 += d.note_200;
      agg.note_100 += d.note_100;
      agg.note_50 += d.note_50;
      agg.note_20 += d.note_20;
      agg.note_10 += d.note_10;
      agg.note_5 += d.note_5;
      agg.note_2 += d.note_2;
      agg.note_1 += d.note_1;
    }
  });
  return agg;
}

function CopyDenominationButton({ entries }: { entries: CollectionEntry[] }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const agg = aggregateDenominations(entries);
    const hasAny = (Object.values(agg) as number[]).some((v) => v > 0);
    if (!hasAny) {
      toast.warning('No denominations to copy yet.');
      return;
    }
    const text = denominationToText(agg);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Denomination summary copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy. Please try again.');
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all active:scale-95 shrink-0',
        copied
          ? 'border-brand-600/30 bg-brand-50 dark:bg-brand-600/15 text-brand-600'
          : 'border-neutral-200 dark:border-neutral-800 bg-[var(--card-bg)] text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-950 hover:text-neutral-700 dark:hover:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700'
      )}
    >
      {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function RowHoverPopup({ entry, mobile = false, onView }: { entry: CollectionEntry; mobile?: boolean; onView: () => void }) {
  const denom: DenominationInput = (() => {
    const d = Array.isArray(entry.denominations) ? entry.denominations[0] : entry.denominations;
    if (!d) return { ...EMPTY_DENOMINATIONS };
    return {
      note_500: d.note_500, note_200: d.note_200, note_100: d.note_100, note_50: d.note_50,
      note_20: d.note_20, note_10: d.note_10, note_5: d.note_5, note_2: d.note_2, note_1: d.note_1,
    };
  })();
  const pending = computePendingAmount(Number(entry.expected_cod), Number(entry.total_collection));
  const excess = computeExcessAmount(Number(entry.expected_cod), Number(entry.total_collection));
  const hasDenoms = (Object.values(denom) as number[]).some((v) => v > 0);

  return (
    <div className={clsx(
      'absolute z-50 left-0 top-full mt-1',
      'opacity-0 invisible group-hover:opacity-100 group-hover:visible',
      'transition-all duration-200 ease-out',
      mobile ? 'right-0' : 'w-80'
    )}>
      <div
        role="button"
        tabIndex={0}
        onClick={onView}
        onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onView(); } }}
        className="rounded-xl border border-neutral-300 dark:border-neutral-700 bg-[var(--card-bg)] shadow-2xl shadow-black/50 p-4 text-left cursor-pointer hover:border-brand-600/50 transition-colors"
      >
        {/* Employee info */}
        <div className="flex items-center gap-3 pb-3 border-b border-neutral-200 dark:border-neutral-800">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-600/20 to-brand-600/10 text-brand-600 flex items-center justify-center font-bold text-sm shrink-0">
            {entry.collector?.name?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-neutral-900 dark:text-neutral-100 truncate">{entry.collector?.name ?? '—'}</p>
            <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
              <span className="flex items-center gap-1">
                <BadgeCheck className="h-3 w-3" />
                {entry.collector?.employee_id ?? '—'}
              </span>
              {entry.collector?.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {entry.collector.phone}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Amounts grid */}
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="rounded-lg bg-neutral-100 dark:bg-neutral-950 px-3 py-2">
            <p className="text-[11px] text-neutral-500">Expected COD</p>
            <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200 tabular-nums">{formatINR(entry.expected_cod)}</p>
          </div>
          <div className="rounded-lg bg-neutral-100 dark:bg-neutral-950 px-3 py-2">
            <p className="text-[11px] text-neutral-500">Total Collection</p>
            <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200 tabular-nums">{formatINR(entry.total_collection)}</p>
          </div>
          <div className="rounded-lg bg-emerald-500/5 px-3 py-2">
            <p className="text-[11px] text-neutral-500">Cash</p>
            <p className="text-sm font-bold text-emerald-400 tabular-nums">{formatINR(entry.cash_amount)}</p>
          </div>
          <div className="rounded-lg bg-blue-500/5 px-3 py-2">
            <p className="text-[11px] text-neutral-500">Online</p>
            <p className="text-sm font-bold text-blue-400 tabular-nums">{formatINR(entry.online_amount)}</p>
          </div>
        </div>

        {/* Gap / Pending / Excess */}
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 rounded-lg bg-neutral-100 dark:bg-neutral-950 px-3 py-2 text-center">
            <p className="text-[11px] text-neutral-500">Gap</p>
            <p className={clsx('text-sm font-bold tabular-nums', entry.gap < 0 ? 'text-red-400' : entry.gap > 0 ? 'text-amber-400' : 'text-brand-600')}>
              {entry.gap < 0 ? '-' : entry.gap > 0 ? '+' : ''}{formatINR(Math.abs(Number(entry.gap)))}
            </p>
          </div>
          {pending > 0 && (
            <div className="flex-1 rounded-lg bg-amber-500/5 px-3 py-2 text-center">
              <p className="text-[11px] text-neutral-500">Pending</p>
              <p className="text-sm font-bold text-amber-400 tabular-nums">{formatINR(pending)}</p>
            </div>
          )}
          {excess > 0 && (
            <div className="flex-1 rounded-lg bg-brand-600/5 px-3 py-2 text-center">
              <p className="text-[11px] text-neutral-500">Excess</p>
              <p className="text-sm font-bold text-brand-600 tabular-nums">{formatINR(excess)}</p>
            </div>
          )}
        </div>

        {/* Denomination breakdown */}
        {hasDenoms && (
          <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
            <p className="flex items-center gap-1.5 text-xs font-bold text-neutral-500 dark:text-neutral-400 mb-2">
              <Receipt className="h-3.5 w-3.5" />
              Denomination Breakdown
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {DENOMINATIONS.map((d) => {
                const qty = denom[d.key];
                if (qty === 0) return null;
                return (
                  <div key={d.key} className="rounded-lg bg-neutral-100 dark:bg-neutral-950 px-2 py-1.5 text-center">
                    <p className="text-[10px] text-neutral-500">{d.label}</p>
                    <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200 tabular-nums">{qty}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Remarks */}
        {entry.remarks && (
          <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
            <p className="text-xs font-bold text-amber-400 mb-1">Remarks</p>
            <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">{entry.remarks}</p>
          </div>
        )}

        {/* Click to view full details */}
        <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-center gap-1.5 text-xs font-bold text-brand-600 group-hover/popup:gap-2 transition-all">
          <Eye className="h-3.5 w-3.5" />
          Click to view full details
        </div>
      </div>
    </div>
  );
}

function ViewEntryModal({ entry, onClose }: { entry: CollectionEntry | null; onClose: () => void }) {
  const denom: DenominationInput = (() => {
    const d = entry ? (Array.isArray(entry.denominations) ? entry.denominations[0] : entry.denominations) : null;
    if (!d) return { ...EMPTY_DENOMINATIONS };
    return {
      note_500: d.note_500, note_200: d.note_200, note_100: d.note_100, note_50: d.note_50,
      note_20: d.note_20, note_10: d.note_10, note_5: d.note_5, note_2: d.note_2, note_1: d.note_1,
    };
  })();

  return (
    <Modal
      open={!!entry}
      onClose={onClose}
      title="Collection Details"
      subtitle={entry ? `${entry.collector?.name} · ${formatDate(entry.collection_date)}` : ''}
      size="lg"
      footer={<Button variant="outline" onClick={onClose}>Close</Button>}
    >
      {entry && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Expected COD', value: formatINR(entry.expected_cod) },
              { label: 'Cash', value: formatINR(entry.cash_amount) },
              { label: 'Online', value: formatINR(entry.online_amount) },
              { label: 'Total Collection', value: formatINR(entry.total_collection) },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800/70 p-3">
                <p className="text-xs text-neutral-500">{s.label}</p>
                <p className="text-base font-bold text-neutral-800 dark:text-neutral-200 tabular-nums mt-0.5">{s.value}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800/70 p-3 flex items-center justify-between">
              <span className="text-sm text-neutral-500">Gap</span>
              <span className={clsx('font-bold tabular-nums', entry.gap < 0 ? 'text-red-400' : entry.gap > 0 ? 'text-amber-400' : 'text-brand-600')}>
                {entry.gap < 0 ? '-' : entry.gap > 0 ? '+' : ''}{formatINR(Math.abs(Number(entry.gap)))}
              </span>
            </div>
            <div className="rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800/70 p-3 flex items-center justify-between">
              <span className="text-sm text-neutral-500">Status</span>
              <StatusBadge status={entry.status} size="sm" />
            </div>
          </div>
          <div>
            <DenominationPanel value={denom} onChange={() => {}} />
          </div>
          {entry.remarks && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30/70 p-3">
              <p className="text-xs font-semibold text-amber-400 mb-1">Remarks</p>
              <p className="text-sm text-amber-800">{entry.remarks}</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
