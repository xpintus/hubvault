import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, Search, RotateCcw, Eye, TrendingDown, Users as UsersIcon,
  CheckCircle2, Clock, ChevronDown, ChevronUp, ArrowLeft, BookOpen, Printer, Download, FileText,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useHub } from '@/lib/hubContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { Button, Card, EmptyState, Select, Skeleton, Spinner } from '@/components/ui/primitives';
import Modal from '@/components/ui/Modal';
import { confirm } from '@/lib/confirm';
import { Due, DueStatus, DUE_STATUS_LABELS, Collector, Recovery } from '@/types';
import { formatINR, formatDate } from '@/lib/format';
import { db } from '@/lib/offline/db';
import { addToQueue } from '@/lib/offline/syncQueue';
import { v4 as uuidv4 } from 'uuid';
import { clsx } from 'clsx';
import * as XLSX from 'xlsx';

const statusConfig: Record<DueStatus, { color: string; dot: string; badge: string }> = {
  outstanding: {
    color: 'text-red-400',
    dot: 'bg-red-500',
    badge: 'bg-red-500/10 text-red-400 ring-red-500/30',
  },
  partially_recovered: {
    color: 'text-amber-400',
    dot: 'bg-amber-500',
    badge: 'bg-amber-500/10 text-amber-400 ring-amber-500/30',
  },
  fully_recovered: {
    color: 'text-brand-600',
    dot: 'bg-brand-500',
    badge: 'bg-brand-600/15 text-brand-600 ring-brand-600/30',
  },
};

interface EmployeeOutstandingGroup {
  collectorId: string;
  collectorName: string;
  employeeId: string;
  phone: string;
  entriesCount: number;
  totalOriginal: number;
  totalRecovered: number;
  totalRemaining: number;
  dueRecords: Due[];
}

export default function Dues() {
  const { profile } = useAuth();
  const hubCtx = useHub();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [dues, setDues] = useState<Due[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [recoveries, setRecoveries] = useState<Recovery[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | DueStatus>('all');
  const [expandedDue, setExpandedDue] = useState<string | null>(null);
  const [recoveryForDue, setRecoveryForDue] = useState<Due | null>(null);
  const [recoveryAmount, setRecoveryAmount] = useState('');
  const [recoveryMode, setRecoveryMode] = useState('cash');
  const [recoveryNotes, setRecoveryNotes] = useState('');
  const [recoveryRef, setRecoveryRef] = useState('');
  const [savingRecovery, setSavingRecovery] = useState(false);

  const [showOutstandingModal, setShowOutstandingModal] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const [selectedLedgerCollector, setSelectedLedgerCollector] = useState<Collector | null>(null);
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState<'all' | 'pending' | 'recovered' | 'partial'>('all');
  const [ledgerStartDate, setLedgerStartDate] = useState('');
  const [ledgerEndDate, setLedgerEndDate] = useState('');

  const isSuperAdmin = profile?.role === 'super_admin';
  const canManage = ['super_admin', 'hub_admin', 'supervisor'].includes(profile?.role ?? '');

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const effectiveHub = hubCtx.selectedHubId;

      if (!navigator.onLine) {
         let localDues = await db.dues.toArray();
         if (effectiveHub) localDues = localDues.filter(d => d.hub_id === effectiveHub);

         const hydratedDues = await Promise.all(localDues.map(async d => {
             const collector = await db.collectors.get(d.collector_id);
             return { ...d, collector };
         }));
         setDues(hydratedDues.sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime()) as any[]);

         let cols = await db.collectors.toArray();
         if (effectiveHub) cols = cols.filter(c => c.hub_id === effectiveHub);
         setCollectors(cols as any[]);

         let localRecs = await db.recoveries.toArray();
         if (effectiveHub) localRecs = localRecs.filter(r => r.hub_id === effectiveHub);
         const hydratedRecs = await Promise.all(localRecs.map(async r => {
             const collector = await db.collectors.get(r.collector_id);
             return { ...r, collector };
         }));
         setRecoveries(hydratedRecs as any[]);
      } else {
        let dueQuery = supabase
          .from('dues')
          .select('*, collector: collectors(*), hub: hubs(*), collection_entry: collection_entries(*)')
          .order('due_date', { ascending: false });
        if (effectiveHub) dueQuery = dueQuery.eq('hub_id', effectiveHub);
        const { data, error } = await dueQuery;
        if (error) throw error;
        setDues(data ?? []);

        const pureDues = (data ?? []).map(d => {
            const { collector, hub, collection_entry, ...rest } = d as any;
            return rest;
        });
        await db.dues.bulkPut(pureDues);

        let colQ = supabase.from('collectors').select('*');
        if (effectiveHub) colQ = colQ.eq('hub_id', effectiveHub);
        const { data: cols } = await colQ.order('name');
        setCollectors(cols ?? []);

        let recQ = supabase.from('recoveries').select('*, collector: collectors(*)').order('recovery_date', { ascending: true });
        if (effectiveHub) recQ = recQ.eq('hub_id', effectiveHub);
        const { data: recData } = await recQ;
        setRecoveries(recData ?? []);

        if (recData && recData.length > 0) {
          const pureRecs = recData.map(r => {
            const { collector, ...rest } = r as any;
            return rest;
          });
          await db.recoveries.bulkPut(pureRecs);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load dues');
    } finally {
      setLoading(false);
    }
  }, [profile, hubCtx.selectedHubId, toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dues.filter((d) => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (!q) return true;
      const name = d.collector?.name?.toLowerCase() ?? '';
      const empId = d.collector?.employee_id?.toLowerCase() ?? '';
      const phone = d.collector?.phone?.toLowerCase() ?? '';
      return name.includes(q) || empId.includes(q) || phone.includes(q);
    });
  }, [dues, search, statusFilter]);

  const stats = useMemo(() => {
    const outstandingDues = dues.filter((d) => d.status !== 'fully_recovered');
    const totalOutstanding = outstandingDues.reduce((s, d) => s + Number(d.remaining_amount), 0);
    const employeesWithDues = new Set(outstandingDues.map((d) => d.collector_id)).size;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const recoveredThisMonth = dues.reduce((s, d) => {
      if (new Date(d.updated_at) >= monthStart) return s + Number(d.recovered_amount);
      return s;
    }, 0);
    const totalDuesIssued = dues.reduce((s, d) => s + Number(d.original_amount || 0), 0);
    return { totalOutstanding, employeesWithDues, recoveredThisMonth, totalDuesIssued };
  }, [dues]);

  const employeeOutstandingSummary = useMemo<EmployeeOutstandingGroup[]>(() => {
    const map = new Map<string, EmployeeOutstandingGroup>();

    for (const due of dues) {
      const rem = Number(due.remaining_amount || 0);
      if (rem <= 0) continue;

      const cid = due.collector_id || due.collector?.id || 'unknown';
      const cName = due.collector?.name || 'Unknown Employee';
      const empCode = due.collector?.employee_id || 'N/A';
      const phone = due.collector?.phone || 'N/A';
      const orig = Number(due.original_amount || 0);
      const rec = Number(due.recovered_amount || 0);

      if (!map.has(cid)) {
        map.set(cid, {
          collectorId: cid,
          collectorName: cName,
          employeeId: empCode,
          phone,
          entriesCount: 1,
          totalOriginal: orig,
          totalRecovered: rec,
          totalRemaining: rem,
          dueRecords: [due],
        });
      } else {
        const existing = map.get(cid)!;
        existing.entriesCount += 1;
        existing.totalOriginal += orig;
        existing.totalRecovered += rec;
        existing.totalRemaining += rem;
        existing.dueRecords.push(due);
      }
    }

    const result = Array.from(map.values());

    result.sort((a, b) => {
      if (b.totalRemaining !== a.totalRemaining) {
        return b.totalRemaining - a.totalRemaining;
      }
      return a.collectorName.localeCompare(b.collectorName);
    });

    return result;
  }, [dues]);

  const filteredEmployeeSummary = useMemo(() => {
    const q = modalSearch.trim().toLowerCase();
    if (!q) return employeeOutstandingSummary;
    return employeeOutstandingSummary.filter((group) => {
      const name = group.collectorName.toLowerCase();
      const empId = group.employeeId.toLowerCase();
      const phone = group.phone.toLowerCase();
      return name.includes(q) || empId.includes(q) || phone.includes(q);
    });
  }, [employeeOutstandingSummary, modalSearch]);

  const selectedEmployeeGroup = useMemo(() => {
    if (!selectedEmployeeId) return null;
    const group = employeeOutstandingSummary.find((g) => g.collectorId === selectedEmployeeId);
    if (!group) return null;
    const sortedRecords = [...group.dueRecords].sort(
      (a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime()
    );
    return { ...group, dueRecords: sortedRecords };
  }, [selectedEmployeeId, employeeOutstandingSummary]);

  const grandTotalOutstandingModal = useMemo(() => {
    return employeeOutstandingSummary.reduce((sum, g) => sum + g.totalRemaining, 0);
  }, [employeeOutstandingSummary]);

  const rawLedgerEvents = useMemo(() => {
    if (!selectedLedgerCollector) return [];

    const cid = selectedLedgerCollector.id;
    const empDues = dues.filter((d) => d.collector_id === cid || d.collector?.id === cid);
    const empRecs = recoveries.filter((r) => r.collector_id === cid || r.collector?.id === cid);

    interface RawEvent {
      id: string;
      rawDate: Date;
      dateStr: string;
      eventType: 'due_created' | 'recovery';
      typeLabel: string;
      originalDue: number | null;
      recovered: number | null;
      paymentMode: string;
      remarks: string;
      status: string;
      amountChange: number;
    }

    const events: RawEvent[] = [];

    empDues.forEach((d) => {
      events.push({
        id: `due-${d.id}`,
        rawDate: new Date(d.due_date || d.created_at),
        dateStr: d.due_date || d.created_at,
        eventType: 'due_created',
        typeLabel: 'Due Created',
        originalDue: Number(d.original_amount || 0),
        recovered: null,
        paymentMode: '—',
        remarks: d.notes || 'Collection shortage due',
        status: d.status,
        amountChange: Number(d.original_amount || 0),
      });
    });

    empRecs.forEach((r) => {
      events.push({
        id: `rec-${r.id}`,
        rawDate: new Date(r.recovery_date || r.created_at),
        dateStr: r.recovery_date || r.created_at,
        eventType: 'recovery',
        typeLabel: 'Recovery',
        originalDue: null,
        recovered: Number(r.amount || 0),
        paymentMode: (r.payment_mode || 'cash').toUpperCase(),
        remarks: r.notes || (r.reference_number ? `Ref: ${r.reference_number}` : 'Recovery payment'),
        status: 'recovered',
        amountChange: -Number(r.amount || 0),
      });
    });

    events.sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());

    let running = 0;
    return events.map((evt) => {
      running += evt.amountChange;
      return {
        ...evt,
        runningBalance: Math.max(0, running),
      };
    });
  }, [selectedLedgerCollector, dues, recoveries]);

  const ledgerEmployeeMetrics = useMemo(() => {
    if (!selectedLedgerCollector) {
      return { totalDuesTaken: 0, totalRecovered: 0, currentOutstanding: 0, entriesCount: 0, recoveryRate: 0 };
    }
    const cid = selectedLedgerCollector.id;
    const empDues = dues.filter((d) => d.collector_id === cid || d.collector?.id === cid);
    const empRecs = recoveries.filter((r) => r.collector_id === cid || r.collector?.id === cid);

    const totalDuesTaken = empDues.reduce((s, d) => s + Number(d.original_amount || 0), 0);
    const totalRecovered = empRecs.reduce((s, r) => s + Number(r.amount || 0), 0);
    const currentOutstanding = empDues.reduce((s, d) => s + Number(d.remaining_amount || 0), 0);
    const entriesCount = empDues.length;
    const recoveryRate = totalDuesTaken > 0 ? Math.round((totalRecovered / totalDuesTaken) * 100) : 0;

    return { totalDuesTaken, totalRecovered, currentOutstanding, entriesCount, recoveryRate };
  }, [selectedLedgerCollector, dues, recoveries]);

  const filteredLedgerEvents = useMemo(() => {
    return rawLedgerEvents.filter((evt) => {
      if (ledgerStatusFilter === 'pending' && evt.eventType === 'due_created' && evt.status === 'fully_recovered') {
        return false;
      }
      if (ledgerStatusFilter === 'recovered' && evt.eventType !== 'recovery' && evt.status !== 'fully_recovered') {
        return false;
      }
      if (ledgerStatusFilter === 'partial' && evt.status !== 'partially_recovered') {
        return false;
      }

      const q = ledgerSearch.trim().toLowerCase();
      if (q) {
        const remarks = evt.remarks.toLowerCase();
        const typeLabel = evt.typeLabel.toLowerCase();
        const dateStr = formatDate(evt.dateStr).toLowerCase();
        const mode = evt.paymentMode.toLowerCase();
        if (!remarks.includes(q) && !typeLabel.includes(q) && !dateStr.includes(q) && !mode.includes(q)) {
          return false;
        }
      }

      if (ledgerStartDate && evt.dateStr < ledgerStartDate) return false;
      if (ledgerEndDate && evt.dateStr > ledgerEndDate) return false;

      return true;
    });
  }, [rawLedgerEvents, ledgerStatusFilter, ledgerSearch, ledgerStartDate, ledgerEndDate]);

  const handleExportLedgerExcel = () => {
    if (!selectedLedgerCollector || filteredLedgerEvents.length === 0) {
      toast.warning('No ledger events to export');
      return;
    }
    const rows = filteredLedgerEvents.map((evt) => ({
      Date: formatDate(evt.dateStr),
      Type: evt.typeLabel,
      'Original Due': evt.originalDue !== null ? evt.originalDue : '—',
      'Recovered Amount': evt.recovered !== null ? evt.recovered : '—',
      'Running Outstanding': evt.runningBalance,
      'Payment Mode': evt.paymentMode,
      Status: evt.eventType === 'recovery' ? 'Recovered' : DUE_STATUS_LABELS[evt.status as DueStatus] || evt.status,
      Remarks: evt.remarks,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employee Ledger');
    const fname = `Ledger_${selectedLedgerCollector.name.replace(/\s+/g, '_')}_${selectedLedgerCollector.employee_id}.xlsx`;
    XLSX.writeFile(wb, fname);
    toast.success('Ledger exported to Excel');
  };

  const handlePrintLedger = () => {
    window.print();
  };

  const handleRecovery = async () => {
    if (!recoveryForDue) return;
    const amount = Number(recoveryAmount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid recovery amount');
      return;
    }
    if (amount > Number(recoveryForDue.remaining_amount)) {
      toast.error('Recovery amount exceeds remaining due');
      return;
    }
    setSavingRecovery(true);
    try {
      const recoveryPayload = {
        collector_id: recoveryForDue.collector_id,
        hub_id: recoveryForDue.hub_id,
        due_id: recoveryForDue.id,
        recovery_date: new Date().toISOString().split('T')[0],
        amount,
        payment_mode: recoveryMode,
        reference_number: recoveryRef.trim() || null,
        notes: recoveryNotes.trim() || null,
        created_by: profile?.id ?? null,
      };

      const newRecovered = Number(recoveryForDue.recovered_amount) + amount;
      const newRemaining = Number(recoveryForDue.original_amount) - newRecovered;
      const newStatus: DueStatus = newRemaining <= 0 ? 'fully_recovered' : 'partially_recovered';

      const dueUpdate = {
          recovered_amount: newRecovered,
          remaining_amount: Math.max(0, newRemaining),
          status: newStatus,
          updated_at: new Date().toISOString(),
      };

      if (!navigator.onLine) {
         const recId = uuidv4();
         const offlineRecPayload = { ...recoveryPayload, id: recId, created_at: new Date().toISOString(), client_id: profile?.id, created_offline: true };
         await db.recoveries.add(offlineRecPayload as any);
         await addToQueue(profile?.id || '', recoveryForDue.hub_id, 'recoveries', 'INSERT', offlineRecPayload);

         const offlineDueUpdate = { ...dueUpdate, id: recoveryForDue.id, client_id: profile?.id };
         await db.dues.update(recoveryForDue.id, offlineDueUpdate);
         await addToQueue(profile?.id || '', recoveryForDue.hub_id, 'dues', 'UPDATE', offlineDueUpdate);
      } else {
          const { error: rpcErr } = await supabase.rpc('record_recovery_atomic', {
            p_collector_id: recoveryForDue.collector_id,
            p_hub_id: recoveryForDue.hub_id,
            p_due_id: recoveryForDue.id,
            p_recovery_date: recoveryPayload.recovery_date,
            p_amount: amount,
            p_payment_mode: recoveryMode,
            p_reference_number: recoveryRef.trim() || null,
            p_notes: recoveryNotes.trim() || null,
            p_created_by: profile?.id ?? null,
          });

          if (rpcErr) {
            const { error: recErr } = await supabase.from('recoveries').insert(recoveryPayload);
            if (recErr) throw recErr;

            const { error: dueErr } = await supabase
              .from('dues')
              .update(dueUpdate)
              .eq('id', recoveryForDue.id);
            if (dueErr) throw dueErr;
          }
      }

      toast.success(
        newStatus === 'fully_recovered'
          ? 'Recovery recorded — due fully recovered'
          : `Recovery of ${formatINR(amount)} recorded`
      );
      setRecoveryForDue(null);
      setRecoveryAmount('');
      setRecoveryNotes('');
      setRecoveryRef('');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record recovery');
    } finally {
      setSavingRecovery(false);
    }
  };

  const handleDeleteDue = async (due: Due) => {
    const ok = await confirm({
      title: 'Delete this due?',
      message: `This will permanently remove the due of ${formatINR(due.original_amount)} for ${due.collector?.name ?? 'this employee'}. All associated recovery records will also be deleted.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    if (!navigator.onLine) {
        await db.dues.delete(due.id);
        await addToQueue(profile?.id || '', due.hub_id, 'dues', 'DELETE', { id: due.id });
        toast.success('Due deleted offline');
    } else {
        const { error } = await supabase.from('dues').delete().eq('id', due.id);
        if (error) { toast.error(error.message); return; }
        toast.success('Due deleted');
    }
    load();
  };

  const kpiCards = [
    { label: 'Total Outstanding Dues', value: stats.totalOutstanding, icon: TrendingDown, accent: 'red', sub: `${stats.employeesWithDues} employees` },
    { label: 'Employees With Dues', value: stats.employeesWithDues, icon: UsersIcon, accent: 'amber', sub: 'have pending balances', isCount: true },
    { label: 'Recovered This Month', value: stats.recoveredThisMonth, icon: CheckCircle2, accent: 'brand', sub: 'total recovery payments' },
    { label: 'Total Dues Issued', value: stats.totalDuesIssued, icon: Clock, accent: 'slate', sub: 'across all records' },
  ];

  const accentMap: Record<string, string> = {
    red: 'bg-red-500/10 text-red-400 ring-red-100',
    amber: 'bg-amber-500/10 text-amber-400 ring-amber-100',
    brand: 'bg-brand-600/15 text-brand-600 ring-brand-600/30',
    slate: 'bg-neutral-100 dark:bg-neutral-900 text-neutral-500 ring-neutral-200 dark:ring-neutral-800',
  };

  const filterTabs: { key: 'all' | DueStatus; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: dues.length },
    { key: 'outstanding', label: 'Outstanding', count: dues.filter((d) => d.status === 'outstanding').length },
    { key: 'partially_recovered', label: 'Partial', count: dues.filter((d) => d.status === 'partially_recovered').length },
    { key: 'fully_recovered', label: 'Recovered', count: dues.filter((d) => d.status === 'fully_recovered').length },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Dues Management</h1>
          <p className="mt-1 text-sm text-neutral-500">Track outstanding employee balances and recovery progress.</p>
          <p className="mt-2 text-sm text-neutral-500 font-medium">{dues.length} due record{dues.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpiCards.map((c) => {
            const isOutstandingCard = c.label === 'Total Outstanding Dues';
            return (
              <Card
                key={c.label}
                hover
                onClick={
                  isOutstandingCard
                    ? () => {
                        setModalSearch('');
                        setSelectedEmployeeId(null);
                        setShowOutstandingModal(true);
                      }
                    : undefined
                }
                className={clsx(
                  'p-5 animate-fade-in',
                  isOutstandingCard &&
                    'cursor-pointer hover:border-red-500/50 dark:hover:border-red-500/50 hover:shadow-md transition-all group'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className={clsx('inline-flex h-11 w-11 items-center justify-center rounded-xl ring-1', accentMap[c.accent])}>
                    <c.icon className="h-5 w-5" />
                  </div>
                  {isOutstandingCard && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 group-hover:bg-red-500 group-hover:text-white transition-colors">
                      Click to view details <Eye className="w-3 h-3" />
                    </span>
                  )}
                </div>
                <p className="mt-3 text-sm font-medium text-neutral-500">{c.label}</p>
                <p className="mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">
                  {c.isCount ? c.value : formatINR(c.value)}
                </p>
                <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">{c.sub}</p>
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500 dark:text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by employee name, ID, or phone…"
            className="input-base pl-10"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          {filterTabs.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={clsx(
                'inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-all active:scale-95',
                statusFilter === f.key
                  ? 'text-[var(--neutral-200)] shadow-soft'
                  : 'bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700 hover:text-neutral-800 dark:hover:text-neutral-200'
              )}
            >
              {f.label}
              <span className={clsx(
                'rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                statusFilter === f.key ? 'bg-neutral-900/20 dark:bg-neutral-900/20 text-white' : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-500'
              )}>{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Card className="p-8 flex justify-center"><Spinner className="h-6 w-6" /></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<AlertCircle className="h-7 w-7" />}
            title="No dues found"
            message={search || statusFilter !== 'all' ? 'Try adjusting your search or filter.' : 'Outstanding employee balances will appear here automatically when collections fall short.'}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold">Employee</th>
                  <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Emp ID</th>
                  <th className="text-right px-4 py-3 font-semibold">Due Amount</th>
                  <th className="text-right px-4 py-3 font-semibold hidden md:table-cell">Recovered</th>
                  <th className="text-right px-4 py-3 font-semibold">Remaining</th>
                  <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Due Since</th>
                  <th className="text-center px-4 py-3 font-semibold">Status</th>
                  <th className="text-right px-5 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {filtered.map((d) => {
                  const sc = statusConfig[d.status];
                  return (
                    <tr key={d.id} className="group hover:bg-neutral-100 dark:hover:bg-neutral-950/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
                            {d.collector?.name?.charAt(0).toUpperCase() ?? '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-neutral-800 dark:text-neutral-200 truncate">{d.collector?.name ?? '—'}</p>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 sm:hidden font-mono">{d.collector?.employee_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-neutral-500 font-mono text-xs hidden sm:table-cell">{d.collector?.employee_id}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-neutral-700 dark:text-neutral-300">{formatINR(d.original_amount)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-brand-600 hidden md:table-cell">{formatINR(d.recovered_amount)}</td>
                      <td className={clsx('px-4 py-3.5 text-right tabular-nums font-bold', d.remaining_amount > 0 ? 'text-red-400' : 'text-brand-600')}>
                        {formatINR(d.remaining_amount)}
                      </td>
                      <td className="px-4 py-3.5 text-neutral-500 text-xs hidden lg:table-cell">{formatDate(d.due_date)}</td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={clsx('inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', sc.badge)}>
                          <span className={clsx('h-1.5 w-1.5 rounded-full', sc.dot)} />
                          {DUE_STATUS_LABELS[d.status]}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                          {d.collector && (
                            <button
                              onClick={() => {
                                setSelectedLedgerCollector(d.collector);
                                setLedgerSearch('');
                                setLedgerStatusFilter('all');
                                setLedgerStartDate('');
                                setLedgerEndDate('');
                              }}
                              title="View Employee Ledger"
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition active:scale-95 flex items-center gap-1 shrink-0"
                            >
                              <BookOpen className="h-3.5 w-3.5 text-neutral-500" />
                              <span>Ledger</span>
                            </button>
                          )}
                          {canManage && d.status !== 'fully_recovered' && (
                            <button
                              onClick={() => { setRecoveryForDue(d); setRecoveryAmount(''); setRecoveryNotes(''); setRecoveryRef(''); }}
                              title="Record Recovery"
                              className="p-1.5 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-blue-400 hover:bg-blue-500/10 transition active:scale-90"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                          )}
                          {canManage && (
                            <button
                              onClick={() => handleDeleteDue(d)}
                              title="Delete"
                              className="p-1.5 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition active:scale-90"
                            >
                              <Eye className="h-4 w-4" />
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

      <Modal
        open={!!recoveryForDue}
        onClose={() => setRecoveryForDue(null)}
        title="Record Recovery"
        subtitle={recoveryForDue ? `${recoveryForDue.collector?.name} · Due since ${formatDate(recoveryForDue.due_date)}` : ''}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setRecoveryForDue(null)} disabled={savingRecovery}>Cancel</Button>
            <Button onClick={handleRecovery} loading={savingRecovery}>Record Recovery</Button>
          </>
        }
      >
        {recoveryForDue && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800/70 p-3">
                <p className="text-xs text-neutral-500">Original Due</p>
                <p className="text-base font-bold text-neutral-800 dark:text-neutral-200 tabular-nums mt-0.5">{formatINR(recoveryForDue.original_amount)}</p>
              </div>
              <div className="rounded-xl bg-brand-50 dark:bg-brand-600/15 border border-brand-600/30 p-3">
                <p className="text-xs text-brand-600">Recovered</p>
                <p className="text-base font-bold text-brand-600 tabular-nums mt-0.5">{formatINR(recoveryForDue.recovered_amount)}</p>
              </div>
              <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3">
                <p className="text-xs text-red-400">Remaining</p>
                <p className="text-base font-bold text-red-400 tabular-nums mt-0.5">{formatINR(recoveryForDue.remaining_amount)}</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Recovery Amount</label>
              <input
                type="number"
                value={recoveryAmount}
                onChange={(e) => setRecoveryAmount(e.target.value)}
                placeholder={`Max: ${formatINR(recoveryForDue.remaining_amount)}`}
                className="input-base"
                autoFocus
              />
            </div>
            <Select
              label="Payment Mode"
              value={recoveryMode}
              onChange={(e) => setRecoveryMode(e.target.value)}
            >
              <option value="cash">Cash</option>
              <option value="online">Online</option>
              <option value="other">Other</option>
            </Select>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Reference Number (optional)</label>
              <input
                type="text"
                value={recoveryRef}
                onChange={(e) => setRecoveryRef(e.target.value)}
                placeholder="Transaction ID, receipt number…"
                className="input-base"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Notes (optional)</label>
              <textarea
                value={recoveryNotes}
                onChange={(e) => setRecoveryNotes(e.target.value)}
                rows={2}
                placeholder="Any notes about this recovery…"
                className="input-base resize-none"
              />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={showOutstandingModal}
        onClose={() => {
          setShowOutstandingModal(false);
          setSelectedEmployeeId(null);
        }}
        title={
          selectedEmployeeGroup
            ? `${selectedEmployeeGroup.collectorName} — Pending Dues`
            : 'Total Outstanding Dues — Employee Breakdown'
        }
        subtitle={
          selectedEmployeeGroup
            ? `Date-wise breakdown for Emp ID: ${selectedEmployeeGroup.employeeId}`
            : 'Employee-wise summary of all pending dues'
        }
        size="xl"
      >
        {selectedEmployeeGroup ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedEmployeeId(null)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition active:scale-95"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Summary
                </button>
                <button
                  onClick={() => {
                    const empId = selectedEmployeeGroup.collectorId;
                    const col = collectors.find(c => c.id === empId) || { id: empId, name: selectedEmployeeGroup.collectorName, employee_id: selectedEmployeeGroup.employeeId, phone: selectedEmployeeGroup.phone, is_active: true, created_at: '', updated_at: '' };
                    setSelectedLedgerCollector(col as Collector);
                    setLedgerSearch('');
                    setLedgerStatusFilter('all');
                    setLedgerStartDate('');
                    setLedgerEndDate('');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-brand-600/10 text-brand-600 hover:bg-brand-600/20 transition active:scale-95"
                >
                  <BookOpen className="h-4 w-4" /> View Ledger
                </button>
              </div>

              <div className="text-left sm:text-right">
                <p className="text-xs text-neutral-500">Employee Total Outstanding</p>
                <p className="text-base font-bold text-red-500 tabular-nums">
                  {formatINR(selectedEmployeeGroup.totalRemaining)}
                </p>
              </div>
            </div>

            {/* Mobile Date-wise Cards (< md) */}
            <div className="md:hidden space-y-2.5">
              {selectedEmployeeGroup.dueRecords.map((d) => (
                <div key={d.id} className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-[var(--card-bg)] space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-neutral-800 dark:text-neutral-200 text-sm">
                      {formatDate(d.due_date)}
                    </span>
                    <span className={clsx('inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', statusConfig[d.status]?.badge)}>
                      <span className={clsx('h-1.5 w-1.5 rounded-full', statusConfig[d.status]?.dot)} />
                      {DUE_STATUS_LABELS[d.status]}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1.5 border-t border-neutral-100 dark:border-neutral-800/60 font-mono">
                    <div>
                      <span className="text-neutral-500 text-[10px] block">Original</span>
                      <span className="text-neutral-700 dark:text-neutral-300 font-semibold">{formatINR(d.original_amount)}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 text-[10px] block">Recovered</span>
                      <span className="text-brand-600 font-semibold">{formatINR(d.recovered_amount)}</span>
                    </div>
                    <div>
                      <span className="text-red-500 text-[10px] font-bold block">Outstanding</span>
                      <span className="text-red-500 font-bold">{formatINR(d.remaining_amount)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Date-wise Table (>= md) */}
            <div className="hidden md:block rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-100 dark:bg-neutral-900 text-neutral-500 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold">Due Date</th>
                      <th className="text-right px-4 py-3 font-semibold">Original Due</th>
                      <th className="text-right px-4 py-3 font-semibold">Recovered</th>
                      <th className="text-right px-4 py-3 font-semibold">Outstanding</th>
                      <th className="text-center px-4 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {selectedEmployeeGroup.dueRecords.map((d) => (
                      <tr key={d.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition">
                        <td className="px-4 py-3 font-medium text-neutral-800 dark:text-neutral-200">
                          {formatDate(d.due_date)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-neutral-600 dark:text-neutral-400 font-mono">
                          {formatINR(d.original_amount)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-brand-600 font-mono">
                          {formatINR(d.recovered_amount)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-bold text-red-500 font-mono">
                          {formatINR(d.remaining_amount)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={clsx(
                              'inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
                              statusConfig[d.status]?.badge
                            )}
                          >
                            <span className={clsx('h-1.5 w-1.5 rounded-full', statusConfig[d.status]?.dot)} />
                            {DUE_STATUS_LABELS[d.status]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-between text-sm font-bold text-red-500">
              <span>{selectedEmployeeGroup.collectorName} Total Outstanding:</span>
              <span className="tabular-nums font-mono text-base">{formatINR(selectedEmployeeGroup.totalRemaining)}</span>
            </div>
          </div>
        ) : (
          /* MAIN EMPLOYEE-WISE SUMMARY VIEW */
          <div className="space-y-4">
            {/* Search Filter */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
                placeholder="Search employee by name, ID, or phone…"
                className="input-base pl-10"
              />
            </div>

            {filteredEmployeeSummary.length === 0 ? (
              <EmptyState
                icon={<AlertCircle className="h-7 w-7" />}
                title="No outstanding dues"
                message={modalSearch ? 'No employee matches your search query.' : 'There are currently no active employee outstanding dues.'}
              />
            ) : (
              <>
                {/* Mobile Employee Cards (< md) */}
                <div className="md:hidden space-y-3">
                  {filteredEmployeeSummary.map((emp) => (
                    <div
                      key={emp.collectorId}
                      onClick={() => setSelectedEmployeeId(emp.collectorId)}
                      className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-[var(--card-bg)] hover:border-red-500/40 dark:hover:border-red-500/40 transition cursor-pointer space-y-3 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-red-100 to-red-200 text-red-600 flex items-center justify-center font-bold text-sm shrink-0">
                            {emp.collectorName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-neutral-900 dark:text-neutral-100 text-base truncate">
                              {emp.collectorName}
                            </h3>
                            <p className="text-xs text-neutral-500 font-mono truncate">
                              ID: {emp.employeeId} · Phone: {emp.phone}
                            </p>
                          </div>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 shrink-0">
                          {emp.entriesCount} {emp.entriesCount === 1 ? 'Entry' : 'Entries'}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/60 dark:border-neutral-800/60 text-xs">
                        <div>
                          <span className="text-neutral-500 block text-[11px]">Original Due</span>
                          <span className="font-semibold text-neutral-700 dark:text-neutral-300 font-mono">
                            {formatINR(emp.totalOriginal)}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block text-[11px]">Recovered</span>
                          <span className="font-semibold text-brand-600 font-mono">
                            {formatINR(emp.totalRecovered)}
                          </span>
                        </div>
                        <div>
                          <span className="text-red-500 font-bold block text-[11px]">Outstanding</span>
                          <span className="font-bold text-red-500 text-sm font-mono block">
                            {formatINR(emp.totalRemaining)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEmployeeId(emp.collectorId);
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition active:scale-98"
                        >
                          <Eye className="w-3.5 h-3.5 text-neutral-500" /> View Details
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const col = collectors.find(c => c.id === emp.collectorId) || { id: emp.collectorId, name: emp.collectorName, employee_id: emp.employeeId, phone: emp.phone, is_active: true, created_at: '', updated_at: '' };
                            setSelectedLedgerCollector(col as Collector);
                            setLedgerSearch('');
                            setLedgerStatusFilter('all');
                            setLedgerStartDate('');
                            setLedgerEndDate('');
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold bg-brand-600/10 text-brand-600 hover:bg-brand-600/20 transition active:scale-98"
                        >
                          <BookOpen className="w-3.5 h-3.5" /> Ledger
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Employee Summary Table (>= md) */}
                <div className="hidden md:block rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-neutral-100 dark:bg-neutral-900 text-neutral-500 text-xs uppercase tracking-wide">
                        <tr>
                          <th className="text-left px-4 py-3 font-semibold">Employee</th>
                          <th className="text-left px-3 py-3 font-semibold">Emp ID</th>
                          <th className="text-left px-3 py-3 font-semibold">Phone</th>
                          <th className="text-right px-3 py-3 font-semibold">Entries</th>
                          <th className="text-right px-3 py-3 font-semibold">Original</th>
                          <th className="text-right px-3 py-3 font-semibold">Recovered</th>
                          <th className="text-right px-4 py-3 font-semibold">Outstanding</th>
                          <th className="text-center px-4 py-3 font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                        {filteredEmployeeSummary.map((emp) => (
                          <tr
                            key={emp.collectorId}
                            onClick={() => setSelectedEmployeeId(emp.collectorId)}
                            className="group hover:bg-neutral-50 dark:hover:bg-neutral-900/60 transition cursor-pointer"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-red-100 to-red-200 text-red-600 flex items-center justify-center font-bold text-xs shrink-0">
                                  {emp.collectorName.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-semibold text-neutral-800 dark:text-neutral-200 group-hover:text-red-500 transition-colors">
                                  {emp.collectorName}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-3 font-mono text-xs text-neutral-500">{emp.employeeId}</td>
                            <td className="px-3 py-3 font-mono text-xs text-neutral-500">{emp.phone}</td>
                            <td className="px-3 py-3 text-right font-medium tabular-nums text-neutral-700 dark:text-neutral-300">
                              {emp.entriesCount}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums text-neutral-600 dark:text-neutral-400 font-mono">
                              {formatINR(emp.totalOriginal)}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums text-brand-600 font-mono">
                              {formatINR(emp.totalRecovered)}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums font-bold text-red-500 font-mono">
                              {formatINR(emp.totalRemaining)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedEmployeeId(emp.collectorId);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition active:scale-95"
                                >
                                  <Eye className="w-3.5 h-3.5 text-neutral-500" /> View
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const col = collectors.find(c => c.id === emp.collectorId) || { id: emp.collectorId, name: emp.collectorName, employee_id: emp.employeeId, phone: emp.phone, is_active: true, created_at: '', updated_at: '' };
                                    setSelectedLedgerCollector(col as Collector);
                                    setLedgerSearch('');
                                    setLedgerStatusFilter('all');
                                    setLedgerStartDate('');
                                    setLedgerEndDate('');
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-brand-600/10 text-brand-600 hover:bg-brand-600/20 transition active:scale-95"
                                >
                                  <BookOpen className="w-3.5 h-3.5" /> Ledger
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-red-500">
              <div>
                <p className="text-xs uppercase tracking-wider font-semibold">Grand Total Outstanding Dues</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 font-normal">
                  Matches KPI Card Total Across {employeeOutstandingSummary.length} Employees
                </p>
              </div>
              <p className="text-xl font-bold tabular-nums font-mono">
                {formatINR(grandTotalOutstandingModal)}
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* EMPLOYEE LEDGER MODAL */}
      <Modal
        open={!!selectedLedgerCollector}
        onClose={() => setSelectedLedgerCollector(null)}
        title={`Employee Ledger — ${selectedLedgerCollector?.name ?? ''}`}
        subtitle={selectedLedgerCollector ? `Emp ID: ${selectedLedgerCollector.employee_id} · Phone: ${selectedLedgerCollector.phone || 'N/A'}` : ''}
        size="xl"
      >
        {selectedLedgerCollector && (
          <div className="space-y-5">
            {/* LEDGER HEADER SUMMARY CARDS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-1">
                <p className="text-xs text-neutral-500 font-medium">Total Dues Taken</p>
                <p className="text-lg font-bold text-neutral-900 dark:text-neutral-100 font-mono tabular-nums">
                  {formatINR(ledgerEmployeeMetrics.totalDuesTaken)}
                </p>
                <p className="text-[11px] text-neutral-400 font-mono">{ledgerEmployeeMetrics.entriesCount} due entries</p>
              </div>

              <div className="p-3.5 rounded-xl bg-brand-50 dark:bg-brand-600/10 border border-brand-600/20 space-y-1">
                <p className="text-xs text-brand-600 font-medium">Total Recovered</p>
                <p className="text-lg font-bold text-brand-600 font-mono tabular-nums">
                  {formatINR(ledgerEmployeeMetrics.totalRecovered)}
                </p>
                <p className="text-[11px] text-brand-500 font-mono">Recovery payments</p>
              </div>

              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 space-y-1">
                <p className="text-xs text-red-500 font-medium">Current Outstanding</p>
                <p className="text-lg font-bold text-red-500 font-mono tabular-nums">
                  {formatINR(ledgerEmployeeMetrics.currentOutstanding)}
                </p>
                <p className="text-[11px] text-neutral-400 font-mono">Running balance</p>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-1">
                <p className="text-xs text-blue-400 font-medium">Recovery %</p>
                <p className="text-lg font-bold text-blue-400 font-mono tabular-nums">
                  {ledgerEmployeeMetrics.recoveryRate}%
                </p>
                <p className="text-[11px] text-neutral-400 font-mono">Recovered / Total Due</p>
              </div>
            </div>

            {/* FILTERS & TOOLBAR */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <input
                    type="text"
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    placeholder="Search ledger by remarks, date, mode…"
                    className="input-base pl-10"
                  />
                </div>

                {/* Export Buttons */}
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" icon={<Printer className="h-4 w-4" />} onClick={handlePrintLedger}>
                    Print / PDF
                  </Button>
                  <Button variant="outline" size="sm" icon={<Download className="h-4 w-4" />} onClick={handleExportLedgerExcel}>
                    Excel
                  </Button>
                </div>
              </div>

              {/* Status Tabs & Date Range Filter */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-neutral-100 dark:border-neutral-800/60 pt-3">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  {(['all', 'pending', 'recovered', 'partial'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setLedgerStatusFilter(tab)}
                      className={clsx(
                        'px-3 py-1.5 rounded-xl text-xs font-semibold transition active:scale-95 shrink-0 capitalize',
                        ledgerStatusFilter === tab
                          ? 'bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-900 shadow-sm'
                          : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800'
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-neutral-500 font-medium shrink-0">Date:</span>
                  <input
                    type="date"
                    value={ledgerStartDate}
                    onChange={(e) => setLedgerStartDate(e.target.value)}
                    className="input-base py-1 px-2 text-xs"
                  />
                  <span className="text-neutral-400">to</span>
                  <input
                    type="date"
                    value={ledgerEndDate}
                    onChange={(e) => setLedgerEndDate(e.target.value)}
                    className="input-base py-1 px-2 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* LEDGER TRANSACTIONS TABLE / CARDS */}
            {filteredLedgerEvents.length === 0 ? (
              <EmptyState
                icon={<AlertCircle className="h-7 w-7" />}
                title="No ledger events found"
                message="No due or recovery transactions match the selected filters."
              />
            ) : (
              <>
                {/* Mobile Cards (< md) */}
                <div className="md:hidden space-y-3">
                  {filteredLedgerEvents.map((evt) => (
                    <div
                      key={evt.id}
                      className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-[var(--card-bg)] space-y-2 text-xs shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-neutral-800 dark:text-neutral-200 text-sm">
                          {formatDate(evt.dateStr)}
                        </span>
                        <span
                          className={clsx(
                            'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider',
                            evt.eventType === 'due_created'
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                              : 'bg-brand-600/10 text-brand-600 border border-brand-600/20'
                          )}
                        >
                          {evt.typeLabel}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800/60 font-mono text-[11px]">
                        <div>
                          <span className="text-neutral-500 text-[10px] block font-sans">Original Due</span>
                          <span className="text-neutral-700 dark:text-neutral-300 font-semibold">
                            {evt.originalDue !== null ? formatINR(evt.originalDue) : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-brand-600 text-[10px] font-bold block font-sans">Recovered</span>
                          <span className="text-brand-600 font-bold">
                            {evt.recovered !== null ? formatINR(evt.recovered) : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-red-500 text-[10px] font-bold block font-sans">Balance</span>
                          <span className="text-red-500 font-bold">
                            {formatINR(evt.runningBalance)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-1.5 text-neutral-500">
                        <span>Mode: <strong className="font-mono text-neutral-700 dark:text-neutral-300">{evt.paymentMode}</strong></span>
                        <span className="truncate max-w-[180px]">{evt.remarks}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table (>= md) */}
                <div className="hidden md:block rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-neutral-100 dark:bg-neutral-900 text-neutral-500 text-xs uppercase tracking-wide">
                        <tr>
                          <th className="text-left px-4 py-3 font-semibold">Date</th>
                          <th className="text-left px-3 py-3 font-semibold">Type</th>
                          <th className="text-right px-3 py-3 font-semibold">Original Due</th>
                          <th className="text-right px-3 py-3 font-semibold">Recovered</th>
                          <th className="text-right px-4 py-3 font-semibold">Outstanding Balance</th>
                          <th className="text-center px-3 py-3 font-semibold">Recovery Mode</th>
                          <th className="text-left px-4 py-3 font-semibold">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                        {filteredLedgerEvents.map((evt) => (
                          <tr key={evt.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition">
                            <td className="px-4 py-3 font-medium text-neutral-800 dark:text-neutral-200">
                              {formatDate(evt.dateStr)}
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={clsx(
                                  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
                                  evt.eventType === 'due_created'
                                    ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                    : 'bg-brand-600/10 text-brand-600 border border-brand-600/20'
                                )}
                              >
                                {evt.typeLabel}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-right font-mono text-neutral-700 dark:text-neutral-300">
                              {evt.originalDue !== null ? formatINR(evt.originalDue) : '—'}
                            </td>
                            <td className="px-3 py-3 text-right font-mono text-brand-600 font-semibold">
                              {evt.recovered !== null ? formatINR(evt.recovered) : '—'}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-red-500 tabular-nums">
                              {formatINR(evt.runningBalance)}
                            </td>
                            <td className="px-3 py-3 text-center font-mono text-xs text-neutral-500">
                              {evt.paymentMode}
                            </td>
                            <td className="px-4 py-3 text-xs text-neutral-600 dark:text-neutral-400 max-w-xs truncate">
                              {evt.remarks}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
