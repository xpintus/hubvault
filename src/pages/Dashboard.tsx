import CollectionEntryModal from '@/components/CollectionEntryModal';
import DenominationPanel from '@/components/DenominationPanel';
import ErrorBoundary from '@/components/ErrorBoundary';
import ImportModal from '@/components/ImportModal';
import StatusBadge from '@/components/StatusBadge';
import AdSlot from '@/components/ui/AdSlot';
import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { Button,Card,EmptyState,SkeletonCard,Spinner } from '@/components/ui/primitives';
import { useAuth } from '@/lib/auth';
import { confirm } from '@/lib/confirm';
import { exportEntriesToExcel } from '@/lib/excel';
import { computeExcessAmount,computePendingAmount,normalizeRecoveryMode,safeAmount } from '@/lib/financeCalculations';
import { formatDate,formatDateLong,formatINR,toISODate } from '@/lib/format';
import { useHub } from '@/lib/hubContext';
import { db } from '@/lib/offline/db';
import { addToQueue } from '@/lib/offline/syncQueue';
import { supabase } from '@/lib/supabase';
import {
CollectionEntry,Collector,DenominationInput,DENOMINATIONS,
Due,
DailyClosing,
EMPTY_DENOMINATIONS,EntryStatus,
Recovery,
} from '@/types';
import { clsx } from 'clsx';
import { addDays,isToday as isDateToday,parseISO,subDays } from 'date-fns';
import {
ArrowRight,
Banknote,
Building2,
Calendar,
CheckCircle2,
ChevronLeft,ChevronRight,
Clock,
Copy,
Download,
Eye,
Inbox,
Pencil,
Plus,
RotateCcw,
Scale,
Search,
Smartphone,
Target,
Trash2,
TrendingDown,TrendingUp,
Upload,
Wallet
} from 'lucide-react';
import { useCallback,useEffect,useMemo,useState } from 'react';

import AvailableCollectionModal from '@/components/dashboard/AvailableCollectionModal';
import { RowHoverPopup } from '@/components/dashboard/StaffActivityTable';

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
    value: number; isGap?: boolean;
    breakdown: { label: string; amount: number; sub?: string }[];
  } | null>(null);
  const [availableModalOpen, setAvailableModalOpen] = useState(false);
  const [availableModalFilter, setAvailableModalFilter] = useState<'all' | 'cash' | 'online' | 'collection_only' | 'recovery_only'>('all');
  const [availableModalSearch, setAvailableModalSearch] = useState('');
  const [canManage, setCanManage] = useState(false);
  const [dues, setDues] = useState<Due[]>([]);
  const [dailyClosings, setDailyClosings] = useState<DailyClosing[]>([]);
  const [recoveries, setRecoveries] = useState<Recovery[]>([]);

  const dateStr = toISODate(date);
  const todayStr = toISODate(new Date());
  const isNextDisabled = dateStr >= todayStr;

  // Selected date's month start and end dates (YYYY-MM-01 to YYYY-MM-lastday)
  const monthStartStr = useMemo(() => {
    const d = new Date(date.getFullYear(), date.getMonth(), 1);
    return toISODate(d);
  }, [date]);

  const monthEndStr = useMemo(() => {
    const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return toISODate(d);
  }, [date]);

  const loadData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
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

        let localClosings = (await db.daily_closings.toArray()).filter(c => c.closing_date === dateStr);
        if (effectiveHubId) localClosings = localClosings.filter(c => c.hub_id === effectiveHubId);
        setDailyClosings(localClosings);

        // Offline recoveries for the selected date's calendar month
        let recData = await db.recoveries
          .filter(r => r.recovery_date >= monthStartStr && r.recovery_date <= monthEndStr)
          .toArray();
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

        await db.collectors.bulkPut(cols ?? []);

        let entryQuery = supabase
          .from('collection_entries')
          .select('*, collector: collectors(*), hub: hubs(*), denominations: denominations(*)')
          .eq('collection_date', dateStr);
        if (effectiveHubId) entryQuery = entryQuery.eq('hub_id', effectiveHubId);
        const { data: ents, error: entErr } = await entryQuery.order('created_at', { ascending: false });
        if (entErr) throw entErr;
        setEntries((ents ?? []) as CollectionEntry[]);

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

        let closingQuery = supabase.from('daily_closings').select('*').eq('closing_date', dateStr);
        if (effectiveHubId) closingQuery = closingQuery.eq('hub_id', effectiveHubId);
        const { data: closingData, error: closingErr } = await closingQuery;
        if (closingErr) throw closingErr;
        setDailyClosings((closingData ?? []) as DailyClosing[]);
        await db.daily_closings.bulkPut((closingData ?? []) as DailyClosing[]);

        // Fetch all recoveries whose recovery_date is in the selected date's calendar month
        let recQuery = supabase
          .from('recoveries')
          .select('*, collector: collectors(*)')
          .gte('recovery_date', monthStartStr)
          .lte('recovery_date', monthEndStr);
        if (effectiveHubId) recQuery = recQuery.eq('hub_id', effectiveHubId);
        const { data: recData, error: recErr } = await recQuery.order('created_at', { ascending: false });
        if (recErr) throw recErr;
        setRecoveries(recData ?? []);

        const pureRecs = (recData ?? []).map(r => {
          const { collector, ...rest } = r as any;
          return rest;
        });
        await db.recoveries.bulkPut(pureRecs);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load dashboard data';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [profile, dateStr, monthStartStr, monthEndStr, hubCtx.selectedHubId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const closingByCollector = useMemo(() => new Map(
    dailyClosings
      .filter(c => c.status !== 'rejected')
      .map(c => [c.collector_id, c]),
  ), [dailyClosings]);

  const entryCountByCollector = useMemo(() => {
    const counts = new Map<string, number>();
    entries.forEach(e => counts.set(e.collector_id, (counts.get(e.collector_id) ?? 0) + 1));
    return counts;
  }, [entries]);

  const dashboardEntries = useMemo(() => entries.map(e => {
    const closing = closingByCollector.get(e.collector_id);
    if (!closing || entryCountByCollector.get(e.collector_id) !== 1) return e;
    const cash = safeAmount(closing.actual_cash);
    const online = safeAmount(closing.online_amount);
    const total = cash + online;
    const expected = safeAmount(closing.expected_cash) + safeAmount(closing.expected_online_amount);
    const cashVariance = cash - safeAmount(closing.expected_cash);
    const onlineVariance = online - safeAmount(closing.expected_online_amount);
    const status: EntryStatus = cashVariance < 0 || onlineVariance < 0
      ? 'shortage'
      : cashVariance > 0 || onlineVariance > 0 ? 'excess' : 'reconciled';
    return { ...e, cash_amount: cash, online_amount: online, total_collection: total, gap: total - expected, status };
  }), [entries, closingByCollector, entryCountByCollector]);

  // Summary Metrics use verified Daily Closing totals when available.
  const summary = useMemo(() => {
    let cash = 0;
    let online = 0;
    let expectedCod = 0;
    const countedClosings = new Set<string>();
    entries.forEach(e => {
      const closing = closingByCollector.get(e.collector_id);
      if (closing) {
        if (countedClosings.has(closing.id)) return;
        countedClosings.add(closing.id);
        cash += safeAmount(closing.actual_cash);
        online += safeAmount(closing.online_amount);
        expectedCod += safeAmount(closing.expected_cash) + safeAmount(closing.expected_online_amount);
        return;
      }
      cash += safeAmount(e.cash_amount);
      online += safeAmount(e.online_amount);
      expectedCod += safeAmount(e.expected_cod);
    });
    const total = cash + online;
    const difference = total - expectedCod;
    return { total, cash, online, expectedCod, difference };
  }, [entries, closingByCollector]);

  const verifiedCollectorBreakdown = useMemo(() => {
    const rows = new Map<string, {
      label: string; employeeId?: string; expected: number;
      cash: number; online: number; total: number; difference: number;
    }>();
    entries.forEach(e => {
      const current = rows.get(e.collector_id) ?? {
        label: e.collector?.name ?? '—', employeeId: e.collector?.employee_id,
        expected: 0, cash: 0, online: 0, total: 0, difference: 0,
      };
      current.expected += safeAmount(e.expected_cod);
      current.cash += safeAmount(e.cash_amount);
      current.online += safeAmount(e.online_amount);
      current.total = current.cash + current.online;
      current.difference = current.total - current.expected;
      rows.set(e.collector_id, current);
    });
    closingByCollector.forEach((closing, collectorId) => {
      const collector = collectors.find(c => c.id === collectorId);
      const current = rows.get(collectorId) ?? {
        label: collector?.name ?? 'Employee', employeeId: collector?.employee_id,
        expected: 0, cash: 0, online: 0, total: 0, difference: 0,
      };
      current.expected = safeAmount(closing.expected_cash) + safeAmount(closing.expected_online_amount);
      current.cash = safeAmount(closing.actual_cash);
      current.online = safeAmount(closing.online_amount);
      current.total = current.cash + current.online;
      current.difference = current.total - current.expected;
      rows.set(collectorId, current);
    });
    return [...rows.values()];
  }, [entries, closingByCollector, collectors]);

  const outstandingDues = useMemo(() => {
    return dues.filter((d) => d.status !== 'fully_recovered' && d.status !== 'cancelled').reduce((s, d) => s + safeAmount(d.remaining_amount), 0);
  }, [dues]);

  // Recoveries on selected date
  const recoveriesToday = useMemo(() => {
    return recoveries.filter((r) => r.recovery_date === dateStr);
  }, [recoveries, dateStr]);

  const cashRecoveryToday = useMemo(() => {
    return recoveriesToday
      .filter((r) => normalizeRecoveryMode(r.payment_mode) === 'cash')
      .reduce((s, r) => s + safeAmount(r.amount), 0);
  }, [recoveriesToday]);

  const onlineRecoveryToday = useMemo(() => {
    return recoveriesToday
      .filter((r) => normalizeRecoveryMode(r.payment_mode) === 'online')
      .reduce((s, r) => s + safeAmount(r.amount), 0);
  }, [recoveriesToday]);

  const otherRecoveryToday = useMemo(() => {
    return recoveriesToday
      .filter((r) => normalizeRecoveryMode(r.payment_mode) === 'other')
      .reduce((s, r) => s + safeAmount(r.amount), 0);
  }, [recoveriesToday]);

  const availableCash = useMemo(() => summary.cash + cashRecoveryToday, [summary.cash, cashRecoveryToday]);
  const availableOnline = useMemo(() => summary.online + onlineRecoveryToday, [summary.online, onlineRecoveryToday]);
  const totalAvailable = useMemo(() => availableCash + availableOnline + otherRecoveryToday, [availableCash, availableOnline, otherRecoveryToday]);

  const recoveryToday = useMemo(() => {
    return recoveriesToday.reduce((s, r) => s + safeAmount(r.amount), 0);
  }, [recoveriesToday]);

  const availableCollectionMetrics = useMemo(() => {
    return {
      normalCash: summary.cash,
      normalOnline: summary.online,
      normalTotal: summary.total,
      cashRec: cashRecoveryToday,
      onlineRec: onlineRecoveryToday,
      otherRec: otherRecoveryToday,
      totalRec: recoveryToday,
      availableCash,
      availableOnline,
      totalAvailableCollection: totalAvailable,
    };
  }, [summary.cash, summary.online, summary.total, cashRecoveryToday, onlineRecoveryToday, otherRecoveryToday, recoveryToday, availableCash, availableOnline, totalAvailable]);

  const todayRecoveryCount = useMemo(() => {
    return recoveriesToday.length;
  }, [recoveriesToday]);

  // Recoveries this calendar month (includes today)
  const recoveryThisMonth = useMemo(() => {
    return recoveries.reduce((s, r) => s + safeAmount(r.amount), 0);
  }, [recoveries]);

  const monthRecoveryCount = useMemo(() => {
    return recoveries.length;
  }, [recoveries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dashboardEntries.filter((e) => {
      if (filter !== 'all' && e.status !== filter) return false;
      if (!q) return true;
      const name = e.collector?.name?.toLowerCase() ?? '';
      const empId = e.collector?.employee_id?.toLowerCase() ?? '';
      const phone = e.collector?.phone?.toLowerCase() ?? '';
      return name.includes(q) || empId.includes(q) || phone.includes(q);
    });
  }, [dashboardEntries, search, filter]);

  const counts = useMemo(() => {
    const c = { reconciled: 0, pending: 0, shortage: 0, excess: 0 };
    dashboardEntries.forEach((e) => {
      if (e.status in c) c[e.status] += 1;
    });
    return c;
  }, [dashboardEntries]);

  const reconciledRate = dashboardEntries.length > 0
    ? Math.round((counts.reconciled / dashboardEntries.length) * 100)
    : 0;

  const handleDelete = async (entry: CollectionEntry) => {
    const ok = await confirm({
      title: 'Delete collection entry?',
      message: `This will permanently remove ${entry.collector?.name ?? 'this employee'}'s collection record for ${formatDate(entry.collection_date)}. Any associated unrecovered due will also be deleted.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    if (!navigator.onLine) {
      const localDues = await db.dues.where('collection_entry_id').equals(entry.id).toArray();
      for (const due of localDues) {
        await db.dues.delete(due.id);
        await addToQueue(profile?.id || '', due.hub_id, 'dues', 'DELETE', { id: due.id });
      }
      await db.collection_entries.delete(entry.id);
      await db.denominations.where('collection_entry_id').equals(entry.id).delete();
      await addToQueue(profile?.id || '', entry.hub_id, 'collection_entries', 'DELETE', { id: entry.id });
      toast.success('Entry deleted offline');
      loadData();
    } else {
      const { data: linkedDues } = await supabase
        .from('dues')
        .select('id, recovered_amount')
        .eq('collection_entry_id', entry.id);

      if (linkedDues && linkedDues.length > 0) {
        const unrecoveredDues = linkedDues.filter((d) => (d.recovered_amount || 0) === 0);
        if (unrecoveredDues.length > 0) {
          await supabase
            .from('dues')
            .delete()
            .in('id', unrecoveredDues.map((d) => d.id));
        }
      }

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

  // Dynamic reconciliation difference logic
  const diffInfo = useMemo(() => {
    const diff = summary.difference;
    if (diff < 0) {
      return {
        title: 'Shortage',
        icon: TrendingDown,
        accent: 'red',
        value: Math.abs(diff),
        formatted: formatINR(Math.abs(diff)),
        sub: `Shortfall vs Expected (${formatINR(summary.expectedCod)})`,
        stateClass: 'text-red-500 dark:text-red-400',
        badge: 'SHORTAGE',
        badgeClass: 'bg-red-500/10 text-red-500 dark:text-red-400',
      };
    } else if (diff > 0) {
      return {
        title: 'Excess',
        icon: TrendingUp,
        accent: 'emerald',
        value: diff,
        formatted: formatINR(diff),
        sub: `Surplus vs Expected (${formatINR(summary.expectedCod)})`,
        stateClass: 'text-emerald-500 dark:text-emerald-400',
        badge: 'EXCESS',
        badgeClass: 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400',
      };
    } else {
      return {
        title: 'Fully Reconciled',
        icon: CheckCircle2,
        accent: 'emerald',
        value: 0,
        formatted: '₹0',
        sub: 'Collections match expected COD',
        stateClass: 'text-emerald-500 dark:text-emerald-400',
        badge: 'RECONCILED',
        badgeClass: 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400',
      };
    }
  }, [summary.difference, summary.expectedCod]);

  const topSummaryCards = [
    {
      title: 'Expected COD',
      value: summary.expectedCod,
      formatted: formatINR(summary.expectedCod),
      icon: Target,
      accent: 'slate',
      sub: `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} today`,
      openModal: () => {
        const breakdown = verifiedCollectorBreakdown.map(e => ({ label: e.label, amount: e.expected, sub: e.employeeId }));
        breakdown.sort((a, b) => b.amount - a.amount);
        setKpiDetail({ title: 'Expected COD', label: 'Expected COD Breakdown', icon: Target, accent: 'slate', value: summary.expectedCod, breakdown });
      }
    },
    {
      title: 'Total Collection',
      value: summary.total,
      formatted: formatINR(summary.total),
      icon: Wallet,
      accent: 'brand',
      sub: `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} collected`,
      openModal: () => {
        const breakdown = verifiedCollectorBreakdown.map(e => ({ label: e.label, amount: e.total, sub: e.employeeId }));
        breakdown.sort((a, b) => b.amount - a.amount);
        setKpiDetail({ title: 'Total Collection', label: 'Total Collection Breakdown', icon: Wallet, accent: 'brand', value: summary.total, breakdown });
      }
    },
    {
      title: 'Available Collection',
      value: totalAvailable,
      formatted: formatINR(totalAvailable),
      icon: Scale,
      accent: 'emerald',
      sub: `Cash: ${formatINR(availableCash)} · Online: ${formatINR(availableOnline)}`,
      openModal: () => {
        setKpiDetail(null);
        setAvailableModalOpen(true);
      }
    },
    {
      title: diffInfo.title,
      value: diffInfo.value,
      formatted: diffInfo.formatted,
      icon: diffInfo.icon,
      accent: diffInfo.accent,
      sub: diffInfo.sub,
      badge: diffInfo.badge,
      badgeClass: diffInfo.badgeClass,
      stateClass: diffInfo.stateClass,
      openModal: () => {
        const breakdown = verifiedCollectorBreakdown
          .map(e => ({ label: e.label, amount: e.difference, sub: e.employeeId }))
          .filter(b => b.amount !== 0);
        breakdown.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
        setKpiDetail({ title: diffInfo.title, label: `${diffInfo.title} Breakdown`, icon: diffInfo.icon, accent: diffInfo.accent, value: summary.difference, isGap: true, breakdown });
      }
    }
  ];

  const collectionBreakdownCards = [
    {
      title: 'Cash Collected',
      value: summary.cash,
      formatted: formatINR(summary.cash),
      icon: Banknote,
      accent: 'emerald',
      sub: summary.total > 0 ? `${Math.round((summary.cash / summary.total) * 100)}% of total` : '0% of total',
      openModal: () => {
        const breakdown = verifiedCollectorBreakdown.filter(e => e.cash > 0).map(e => ({ label: e.label, amount: e.cash, sub: e.employeeId }));
        breakdown.sort((a, b) => b.amount - a.amount);
        setKpiDetail({ title: 'Cash Collected', label: 'Cash Collection Breakdown', icon: Banknote, accent: 'emerald', value: summary.cash, breakdown });
      }
    },
    {
      title: 'Online Collected',
      value: summary.online,
      formatted: formatINR(summary.online),
      icon: Smartphone,
      accent: 'blue',
      sub: summary.total > 0 ? `${Math.round((summary.online / summary.total) * 100)}% of total` : '0% of total',
      openModal: () => {
        const breakdown = verifiedCollectorBreakdown.filter(e => e.online > 0).map(e => ({ label: e.label, amount: e.online, sub: e.employeeId }));
        breakdown.sort((a, b) => b.amount - a.amount);
        setKpiDetail({ title: 'Online Collected', label: 'Online Collection Breakdown', icon: Smartphone, accent: 'blue', value: summary.online, breakdown });
      }
    }
  ];

  const duesAndRecoveryCards = [
    {
      title: 'Outstanding Dues',
      value: outstandingDues,
      formatted: formatINR(outstandingDues),
      icon: TrendingDown,
      accent: 'red',
      sub: 'Across all unpaid dues',
      openModal: () => {
        const breakdown = dues.map(d => ({ label: d.collector?.name ?? '—', amount: safeAmount(d.remaining_amount), sub: `Due Date: ${formatDate(d.due_date)}` }));
        breakdown.sort((a, b) => b.amount - a.amount);
        setKpiDetail({ title: 'Outstanding Dues', label: 'Outstanding Dues Breakdown', icon: TrendingDown, accent: 'red', value: outstandingDues, breakdown });
      }
    },
    {
      title: 'Recovery Today',
      value: recoveryToday,
      formatted: formatINR(recoveryToday),
      icon: RotateCcw,
      accent: 'blue',
      sub: `${todayRecoveryCount} ${todayRecoveryCount === 1 ? 'recovery' : 'recoveries'} today`,
      openModal: () => {
        const breakdown = recoveriesToday.map(r => ({ label: r.collector?.name ?? '—', amount: safeAmount(r.amount), sub: `Mode: ${r.payment_mode}` }));
        breakdown.sort((a, b) => b.amount - a.amount);
        setKpiDetail({ title: 'Recovery Today', label: "Today's Recovery Transactions", icon: RotateCcw, accent: 'blue', value: recoveryToday, breakdown });
      }
    },
    {
      title: 'Recovery This Month',
      value: recoveryThisMonth,
      formatted: formatINR(recoveryThisMonth),
      icon: CheckCircle2,
      accent: 'brand',
      sub: `${monthRecoveryCount} ${monthRecoveryCount === 1 ? 'recovery' : 'recoveries'} this month`,
      openModal: () => {
        const breakdown = recoveries.map(r => ({ label: r.collector?.name ?? '—', amount: safeAmount(r.amount), sub: `${formatDate(r.recovery_date)} · ${r.payment_mode}` }));
        breakdown.sort((a, b) => b.amount - a.amount);
        setKpiDetail({ title: 'Recovery This Month', label: 'Monthly Recovery Transactions', icon: CheckCircle2, accent: 'brand', value: recoveryThisMonth, breakdown });
      }
    }
  ];

  const accentMap: Record<string, { icon: string; ring: string; text: string }> = {
    brand: { icon: 'bg-brand-500/10 text-brand-600 dark:text-brand-400 dark:bg-brand-500/20', ring: 'ring-1 ring-brand-500/20 dark:ring-brand-500/30', text: 'text-brand-600 dark:text-brand-400' },
    emerald: { icon: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 dark:bg-emerald-500/20', ring: 'ring-1 ring-emerald-500/20 dark:ring-emerald-500/30', text: 'text-emerald-600 dark:text-emerald-400' },
    blue: { icon: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 dark:bg-blue-500/20', ring: 'ring-1 ring-blue-500/20 dark:ring-blue-500/30', text: 'text-blue-600 dark:text-blue-400' },
    red: { icon: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 dark:bg-rose-500/20', ring: 'ring-1 ring-rose-500/20 dark:ring-rose-500/30', text: 'text-rose-600 dark:text-rose-400' },
    amber: { icon: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 dark:bg-amber-500/20', ring: 'ring-1 ring-amber-500/20 dark:ring-amber-500/30', text: 'text-amber-600 dark:text-amber-400' },
    slate: { icon: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400', ring: 'ring-1 ring-neutral-200 dark:ring-neutral-700/60', text: 'text-neutral-600 dark:text-neutral-400' },
  };

  const filterTabs: { key: FilterStatus; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: entries.length },
    { key: 'reconciled', label: 'Reconciled', count: counts.reconciled },
    ...(counts.pending > 0 ? [{ key: 'pending' as FilterStatus, label: 'Pending', count: counts.pending }] : []),
    { key: 'shortage', label: 'Shortage', count: counts.shortage },
    { key: 'excess', label: 'Excess', count: counts.excess },
  ];

  return (
    <ErrorBoundary fallbackTitle="Dashboard Error">
      <div className="space-y-6 max-w-full overflow-x-hidden">
      {/* Page Header */}
      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between border-b border-neutral-200/80 dark:border-neutral-800/80 pb-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-50 truncate">
              Dashboard
            </h1>
            <span className="inline-flex items-center rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 px-2.5 py-0.5 text-[11px] font-extrabold tracking-wide uppercase">
              Live
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm font-medium text-neutral-500 dark:text-neutral-400 truncate">
            Monitor daily collections and reconciliation status.
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-850 px-2.5 py-1 font-semibold text-neutral-700 dark:text-neutral-300 border border-neutral-200/70 dark:border-neutral-800">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
              {formatDateLong(date)}
            </span>
            {hubCtx.selectedHub && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 dark:bg-brand-950/50 px-2.5 py-1 font-semibold text-brand-700 dark:text-brand-300 border border-brand-200/60 dark:border-brand-900/50 truncate max-w-[240px]">
                <Building2 className="h-3.5 w-3.5 shrink-0 text-brand-500" />
                {hubCtx.selectedHub.name}
                {hubCtx.selectedHub.location && (
                  <span className="hidden xs:inline text-neutral-400 font-normal">({hubCtx.selectedHub.location})</span>
                )}
              </span>
            )}
            {hubCtx.isAllHubs && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-850 px-2.5 py-1 font-semibold text-neutral-800 dark:text-neutral-200 border border-neutral-200/70 dark:border-neutral-800">
                <Building2 className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                All Hubs
              </span>
            )}
          </div>
        </div>

        {/* Primary Header Action */}
        <div className="flex items-center gap-2 shrink-0">
          {canManage && (
            <Button
              icon={<Plus className="h-4 w-4" />}
              onClick={() => { setEditing(null); setEntryModalOpen(true); }}
              className="w-full sm:w-auto min-h-[44px] shadow-glow px-4 py-2.5 font-bold text-sm"
            >
              Add Entry
            </Button>
          )}
        </div>
      </div>

      {/* Loading Skeletons */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="space-y-6">
          {/* SECTION 1: Top Summary & Collection Breakdown */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Daily Summary & Collections
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              {topSummaryCards.map((c) => {
                const a = accentMap[c.accent];
                return (
                  <Card
                    key={c.title}
                    hover
                    className="p-4 sm:p-5 group/kpi cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md w-full min-w-0 border border-neutral-200/80 dark:border-neutral-700 rounded-2xl bg-white dark:bg-[var(--card-bg)]"
                    role="button"
                    tabIndex={0}
                    onClick={c.openModal}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); c.openModal(); } }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className={clsx('flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl shrink-0 transition-transform group-hover/kpi:scale-105', a.icon, a.ring)}>
                        <c.icon className="h-5 w-5" />
                      </div>
                      {c.badge && (
                        <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-wide uppercase', c.badgeClass)}>
                          {c.badge}
                        </span>
                      )}
                    </div>
                    <div className="mt-3.5 min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 truncate">{c.title}</p>
                      <p className={clsx('mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums truncate', c.stateClass || 'text-neutral-900 dark:text-neutral-50')}>
                        {c.formatted}
                      </p>
                      <p className="mt-1 text-xs font-medium text-neutral-500 dark:text-neutral-400 truncate">{c.sub}</p>
                      <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-brand-600 dark:text-brand-400 opacity-0 -translate-y-1 transition-all duration-200 group-hover/kpi:opacity-100 group-hover/kpi:translate-y-0">
                        Click for details <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Collection Breakdown: Cash & Online */}
            <div className="grid grid-cols-2 gap-3.5">
              {collectionBreakdownCards.map((c) => {
                const a = accentMap[c.accent];
                return (
                  <Card
                    key={c.title}
                    hover
                    className="p-4 sm:p-5 group/kpi cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md w-full min-w-0 border border-neutral-200/80 dark:border-neutral-700 rounded-2xl bg-white dark:bg-[var(--card-bg)]"
                    role="button"
                    tabIndex={0}
                    onClick={c.openModal}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); c.openModal(); } }}
                  >
                    <div className={clsx('flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl shrink-0 transition-transform group-hover/kpi:scale-105', a.icon, a.ring)}>
                      <c.icon className="h-5 w-5" />
                    </div>
                    <div className="mt-3.5 min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 truncate">{c.title}</p>
                      <p className="mt-1 text-xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-50 tabular-nums truncate">
                        {c.formatted}
                      </p>
                      <p className="mt-1 text-[11px] sm:text-xs font-medium text-neutral-500 dark:text-neutral-400 truncate">{c.sub}</p>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: Dues & Recovery Overview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Dues & Recovery Overview
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {duesAndRecoveryCards.map((c) => {
                const a = accentMap[c.accent];
                return (
                  <Card
                    key={c.title}
                    hover
                    className="p-4 sm:p-5 group/dues cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md w-full min-w-0 border border-neutral-200/80 dark:border-neutral-700 rounded-2xl bg-white dark:bg-[var(--card-bg)]"
                    role="button"
                    tabIndex={0}
                    onClick={c.openModal}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); c.openModal(); } }}
                  >
                    <div className={clsx('flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl shrink-0 transition-transform group-hover/dues:scale-105', a.icon, a.ring)}>
                      <c.icon className="h-5 w-5" />
                    </div>
                    <div className="mt-3.5 min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 truncate">{c.title}</p>
                      <p className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-50 tabular-nums truncate">
                        {c.formatted}
                      </p>
                      <p className="mt-1 text-xs font-medium text-neutral-500 dark:text-neutral-400 truncate">{c.sub}</p>
                      <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-brand-600 dark:text-brand-400 opacity-0 -translate-y-1 transition-all duration-200 group-hover/dues:opacity-100 group-hover/dues:translate-y-0">
                        Click for details <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: Performance & Date Toolbar */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Reconciliation Rate Card */}
        <Card className="p-4 sm:p-5 lg:col-span-1 min-w-0 border border-neutral-200/80 dark:border-neutral-800/80 rounded-2xl bg-white dark:bg-neutral-900/90">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-neutral-900 dark:text-neutral-100">Reconciliation Rate</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 font-medium">
                {counts.reconciled} of {entries.length} {entries.length === 1 ? 'entry' : 'entries'} reconciled
              </p>
            </div>
            <span className={clsx(
              'text-2xl sm:text-3xl font-extrabold tabular-nums',
              reconciledRate === 100 ? 'text-brand-600 dark:text-brand-400' : reconciledRate >= 80 ? 'text-neutral-700 dark:text-neutral-300' : 'text-amber-500'
            )}>
              {reconciledRate}%
            </span>
          </div>

          <div className="mt-3.5 h-3 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800 p-0.5">
            <div
              className={clsx('h-full rounded-full transition-all duration-700 ease-out', reconciledRate === 100 ? 'bg-gradient-to-r from-brand-600 to-emerald-500' : 'bg-gradient-to-r from-brand-600 to-indigo-500')}
              style={{ width: `${reconciledRate}%` }}
            />
          </div>

          {/* Breakdown counts: compact grid for mobile */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { label: 'Reconciled', count: counts.reconciled, color: 'text-brand-600 dark:text-brand-400', dot: 'bg-brand-500' },
              ...(counts.pending > 0 ? [{ label: 'Pending', count: counts.pending, color: 'text-neutral-500', dot: 'bg-neutral-400' }] : []),
              { label: 'Shortage', count: counts.shortage, color: 'text-rose-500 dark:text-rose-400', dot: 'bg-rose-500' },
              { label: 'Excess', count: counts.excess, color: 'text-emerald-500 dark:text-emerald-400', dot: 'bg-emerald-500' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200/60 dark:border-neutral-800/60 p-2 text-center">
                <div className="flex items-center justify-center gap-1">
                  <span className={clsx('h-1.5 w-1.5 rounded-full shrink-0', s.dot)} />
                  <span className={clsx('text-sm sm:text-base font-extrabold tabular-nums', s.color)}>{s.count}</span>
                </div>
                <p className="mt-0.5 text-[10px] sm:text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 truncate">{s.label}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Date Navigation Toolbar Card */}
        <Card className="p-4 sm:p-5 lg:col-span-2 min-w-0 flex flex-col justify-between border border-neutral-200/80 dark:border-neutral-800/80 rounded-2xl bg-white dark:bg-neutral-900/90">
          <div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-neutral-900 dark:text-neutral-100">Date Navigation</h3>
                <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Select date to inspect daily collection activity
                </p>
              </div>
              
              {/* Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 p-1 shadow-xs">
                  <button
                    onClick={() => setDate(subDays(date, 1))}
                    aria-label="Previous day"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 transition active:scale-95 min-h-[44px] min-w-[44px]"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="relative px-1">
                    <input
                      type="date"
                      value={dateStr}
                      max={todayStr}
                      onChange={(e) => { const d = parseISO(e.target.value); if (d && !isNaN(d.getTime())) setDate(d); }}
                      className="border-0 bg-transparent px-2 py-1 text-xs sm:text-sm font-bold text-neutral-800 dark:text-neutral-200 outline-none focus:ring-0 [color-scheme:light] dark:[color-scheme:dark] tabular-nums"
                    />
                  </div>
                  <button
                    onClick={() => !isNextDisabled && setDate(addDays(date, 1))}
                    disabled={isNextDisabled}
                    aria-label="Next day"
                    className={clsx(
                      'flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 dark:text-neutral-400 transition active:scale-95 min-h-[44px] min-w-[44px]',
                      isNextDisabled
                        ? 'opacity-30 cursor-not-allowed'
                        : 'hover:bg-neutral-200/70 dark:hover:bg-neutral-800'
                    )}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <Button
                  variant={isDateToday(date) ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setDate(new Date())}
                  className="shrink-0 min-h-[44px] px-3.5 font-bold text-xs sm:text-sm"
                >
                  Today
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-neutral-200/80 dark:border-neutral-800/80 pt-4">
            <Button
              variant="outline"
              size="sm"
              icon={<Download className="h-4 w-4" />}
              onClick={handleExport}
              className="min-h-[44px] px-3.5 text-xs sm:text-sm font-semibold"
            >
              Export Excel
            </Button>
            {canManage && (
              <Button
                variant="outline"
                size="sm"
                icon={<Upload className="h-4 w-4" />}
                onClick={() => setImportModalOpen(true)}
                className="min-h-[44px] px-3.5 text-xs sm:text-sm font-semibold"
              >
                Import Excel
              </Button>
            )}
            <div className="ml-auto flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-950 px-2.5 py-1 rounded-lg border border-neutral-200/60 dark:border-neutral-800/60">
              <Clock className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
              <span>{filtered.length} of {entries.length} shown</span>
            </div>
          </div>
        </Card>
      </div>

      {/* SECTION 4: Search & Filter Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by employee name, employee ID, or phone…"
            className="input-base pl-10 min-h-[44px] text-sm rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs focus:ring-2 focus:ring-brand-500/20"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {filterTabs.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={clsx(
                'inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium transition-all active:scale-95 min-h-[44px]',
                filter === f.key
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm font-bold'
                  : 'bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700'
              )}
            >
              {f.label}
              <span className={clsx(
                'rounded-full px-2 py-0.5 text-[10px] font-extrabold tabular-nums',
                filter === f.key ? 'bg-white/20 dark:bg-neutral-900/20 text-current' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200/60 dark:border-neutral-700/60'
              )}>
                {f.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 5: Staff Activity Table & Denomination Summary */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2 min-w-0">
          <Card className="overflow-hidden border border-neutral-200/80 dark:border-neutral-800/80 rounded-2xl bg-white dark:bg-neutral-900/90 shadow-xs">
            <div className="px-4 sm:px-5 py-4 border-b border-neutral-200/80 dark:border-neutral-800/80 flex items-center justify-between">
              <div>
                <h2 className="font-extrabold text-neutral-900 dark:text-neutral-100 text-sm sm:text-base">Staff Activity</h2>
                <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mt-0.5">Collection records for {formatDate(date)}</p>
              </div>
            </div>
            {loading ? (
              <div className="py-20 flex justify-center"><Spinner className="h-6 w-6 text-brand-600" /></div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<Inbox className="h-8 w-8" />}
                title="No activity for selected date"
                message={search || filter !== 'all' ? 'Try adjusting your search or filter.' : 'Add a collection entry to get started.'}
              />
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-50/90 dark:bg-neutral-950/90 backdrop-blur-xs text-neutral-500 text-[11px] uppercase tracking-wider font-bold border-b border-neutral-200/80 dark:border-neutral-800/80 sticky top-0">
                      <tr>
                        <th className="text-left px-5 py-3.5 font-bold">Employee</th>
                        <th className="text-left px-4 py-3.5 font-bold hidden lg:table-cell">Emp ID</th>
                        <th className="text-right px-4 py-3.5 font-bold hidden xl:table-cell">Expected COD</th>
                        <th className="text-right px-4 py-3.5 font-bold">Cash</th>
                        <th className="text-right px-4 py-3.5 font-bold hidden sm:table-cell">Online</th>
                        <th className="text-right px-4 py-3.5 font-bold">Total</th>
                        <th className="text-right px-4 py-3.5 font-bold">Pending</th>
                        <th className="text-right px-4 py-3.5 font-bold hidden xl:table-cell">Excess</th>
                        <th className="text-center px-4 py-3.5 font-bold">Status</th>
                        <th className="text-right px-5 py-3.5 font-bold">Actions</th>
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
                            const pending = computePendingAmount(safeAmount(e.expected_cod), safeAmount(e.total_collection));
                            const excess = computeExcessAmount(safeAmount(e.expected_cod), safeAmount(e.total_collection));
                            return (
                              <>
                                <td className={clsx('px-4 py-3.5 text-right tabular-nums font-semibold', pending > 0 ? 'text-amber-500' : 'text-neutral-500 dark:text-neutral-400')}>{formatINR(pending)}</td>
                                <td className={clsx('px-4 py-3.5 text-right tabular-nums font-semibold hidden xl:table-cell', excess > 0 ? 'text-brand-600' : 'text-neutral-500 dark:text-neutral-400')}>{formatINR(excess)}</td>
                              </>
                            );
                          })()}
                          <td className="px-4 py-3.5 text-center"><StatusBadge status={e.status} size="sm" /></td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setViewing(e)} title="View" className="p-2 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-blue-500 hover:bg-blue-500/10 transition active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center">
                                <Eye className="h-4 w-4" />
                              </button>
                              {canManage && (
                                <button onClick={() => { setEditing(e); setEntryModalOpen(true); }} title="Edit" className="p-2 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-600/15 transition active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center">
                                  <Pencil className="h-4 w-4" />
                                </button>
                              )}
                              {canManage && (
                                <button onClick={() => handleDelete(e)} title="Delete" className="p-2 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-red-500 hover:bg-red-500/10 transition active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center">
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

                {/* Mobile Card List */}
                <div className="divide-y divide-neutral-200 dark:divide-neutral-800 md:hidden">
                  {filtered.map((e) => (
                    <div key={e.id} className="p-4 hover:bg-neutral-50 dark:hover:bg-neutral-950/70 transition-colors">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-600/20 to-brand-600/10 text-brand-600 flex items-center justify-center font-bold text-sm shrink-0">
                            {e.collector?.name?.charAt(0).toUpperCase() ?? '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-neutral-800 dark:text-neutral-200 truncate text-sm">{e.collector?.name ?? '—'}</p>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono truncate">{e.collector?.employee_id}</p>
                          </div>
                        </div>
                        <StatusBadge status={e.status} size="sm" />
                      </div>

                      <RowHoverPopup entry={e} mobile onView={() => setViewing(e)} />

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div className="rounded-lg bg-neutral-100 dark:bg-neutral-900 px-2.5 py-2 text-center">
                          <p className="text-[10px] text-neutral-500 dark:text-neutral-400">Cash</p>
                          <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200 tabular-nums">{formatINR(e.cash_amount)}</p>
                        </div>
                        <div className="rounded-lg bg-neutral-100 dark:bg-neutral-900 px-2.5 py-2 text-center">
                          <p className="text-[10px] text-neutral-500 dark:text-neutral-400">Online</p>
                          <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200 tabular-nums">{formatINR(e.online_amount)}</p>
                        </div>
                        <div className="rounded-lg bg-neutral-100 dark:bg-neutral-900 px-2.5 py-2 text-center">
                          <p className="text-[10px] text-neutral-500 dark:text-neutral-400">Total</p>
                          <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">{formatINR(e.total_collection)}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <span className={clsx(
                          'text-xs font-semibold tabular-nums',
                          e.gap < 0 ? 'text-red-500 dark:text-red-400' : e.gap > 0 ? 'text-amber-500 dark:text-amber-400' : 'text-brand-600 dark:text-brand-400'
                        )}>
                          Gap: {e.gap < 0 ? '-' : e.gap > 0 ? '+' : ''}{formatINR(Math.abs(Number(e.gap)))}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setViewing(e)}
                            className="p-2 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-blue-500 hover:bg-blue-500/10 transition active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {canManage && (
                            <button
                              onClick={() => { setEditing(e); setEntryModalOpen(true); }}
                              className="p-2 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-600/15 transition active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {canManage && (
                            <button
                              onClick={() => handleDelete(e)}
                              className="p-2 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-red-500 hover:bg-red-500/10 transition active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center"
                            >
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

        {/* Denomination Summary */}
        <div className="min-w-0">
          <Card className="p-4 sm:p-5 border border-neutral-200/80 dark:border-neutral-800/80 rounded-2xl bg-white dark:bg-neutral-900/90 shadow-xs">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div>
                <h3 className="font-extrabold text-neutral-900 dark:text-neutral-100 text-sm sm:text-base">Denomination Summary</h3>
                <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mt-0.5">Aggregated notes for {formatDate(date)}</p>
              </div>
              <CopyDenominationButton entries={filtered} />
            </div>
            <div className="mt-4">
              <AggregateDenominations entries={filtered} />
            </div>
          </Card>
        </div>
      </div>

      {/* Subtle Ad Slot */}
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
            <div className={clsx('flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl ring-1', accentMap[kpiDetail.accent].icon, accentMap[kpiDetail.accent].ring)}>
              <kpiDetail.icon className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 tabular-nums truncate">
                {kpiDetail.isGap && kpiDetail.value < 0 ? '-' : kpiDetail.isGap && kpiDetail.value > 0 ? '+' : ''}
                {formatINR(Math.abs(kpiDetail.value))}
              </p>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 font-medium truncate">{kpiDetail.label}</p>
            </div>
          </div>
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Amount Breakdown</p>
            <div className="max-h-80 overflow-y-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-neutral-50 dark:bg-neutral-950 text-neutral-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold">Name / Detail</th>
                    <th className="text-right px-4 py-2.5 font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800/70">
                  {kpiDetail.breakdown.length === 0 ? (
                    <tr><td colSpan={2} className="px-4 py-8 text-center text-neutral-500">No records available</td></tr>
                  ) : (
                    kpiDetail.breakdown.map((b, i) => (
                      <tr key={i} className="hover:bg-neutral-50 dark:hover:bg-neutral-950/50 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-neutral-800 dark:text-neutral-200">{b.label}</div>
                          {b.sub && <div className="text-xs text-neutral-500">{b.sub}</div>}
                        </td>
                        <td className={clsx('px-4 py-2.5 text-right font-bold tabular-nums', kpiDetail.isGap && b.amount < 0 ? 'text-red-500' : kpiDetail.isGap && b.amount > 0 ? 'text-amber-500' : 'text-neutral-800 dark:text-neutral-200')}>
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

      {availableModalOpen && (
        <AvailableCollectionModal
          open={availableModalOpen}
          onClose={() => setAvailableModalOpen(false)}
          metrics={availableCollectionMetrics}
          entries={entries}
          recoveries={recoveriesToday}
          dateStr={dateStr}
          filter={availableModalFilter}
          setFilter={setAvailableModalFilter}
          search={availableModalSearch}
          setSearch={setAvailableModalSearch}
        />
      )}
    </div>
    </ErrorBoundary>
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
      agg.note_500 += d.note_500 || 0;
      agg.note_200 += d.note_200 || 0;
      agg.note_100 += d.note_100 || 0;
      agg.note_50 += d.note_50 || 0;
      agg.note_20 += d.note_20 || 0;
      agg.note_10 += d.note_10 || 0;
      agg.note_5 += d.note_5 || 0;
      agg.note_2 += d.note_2 || 0;
      agg.note_1 += d.note_1 || 0;
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
        'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-all active:scale-95 shrink-0 min-h-[44px]',
        copied
          ? 'border-brand-600/30 bg-brand-50 dark:bg-brand-600/15 text-brand-600'
          : 'border-neutral-200 dark:border-neutral-800 bg-[var(--card-bg)] text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900 hover:text-neutral-700 dark:hover:text-neutral-300'
      )}
    >
      {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}



function ViewEntryModal({ entry, onClose }: { entry: CollectionEntry | null; onClose: () => void }) {
  const denom: DenominationInput = (() => {
    const d = entry ? (Array.isArray(entry.denominations) ? entry.denominations[0] : entry.denominations) : null;
    if (!d) return { ...EMPTY_DENOMINATIONS };
    return {
      note_500: d.note_500 || 0, note_200: d.note_200 || 0, note_100: d.note_100 || 0, note_50: d.note_50 || 0,
      note_20: d.note_20 || 0, note_10: d.note_10 || 0, note_5: d.note_5 || 0, note_2: d.note_2 || 0, note_1: d.note_1 || 0,
    };
  })();

  return (
    <Modal
      open={!!entry}
      onClose={onClose}
      title="Collection Details"
      subtitle={entry ? `${entry.collector?.name} · ${formatDate(entry.collection_date)}` : ''}
      size="lg"
      footer={<Button variant="outline" onClick={onClose} className="min-h-[44px]">Close</Button>}
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
              <span className={clsx('font-bold tabular-nums', entry.gap < 0 ? 'text-red-500' : entry.gap > 0 ? 'text-amber-500' : 'text-brand-600')}>
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
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3">
              <p className="text-xs font-semibold text-amber-500 mb-1">Remarks</p>
              <p className="text-sm text-neutral-800 dark:text-neutral-200">{entry.remarks}</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}


