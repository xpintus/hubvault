import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { Button,Card,EmptyState,Input,Select,Skeleton,Spinner } from '@/components/ui/primitives';
import { logAudit } from '@/lib/audit';
import { useAuth } from '@/lib/auth';
import { confirm } from '@/lib/confirm';
import { formatDate,formatINR,toISODate } from '@/lib/format';
import { useHub } from '@/lib/hubContext';
import { db } from '@/lib/offline/db';
import { addToQueue } from '@/lib/offline/syncQueue';
import {
allocateRecoveryFIFO,
executeEmployeeRecovery,
getActiveEmployeeDues,
getEmployeeOutstanding,
safeAmount,
} from '@/lib/recoveryService';
import { supabase } from '@/lib/supabase';
import {
Collector,
Due,
DueStatus,
Recovery,RecoveryPaymentMode
} from '@/types';
import { clsx } from 'clsx';
import { subDays } from 'date-fns';
import {
Banknote,
BookOpen,
Calendar,
Download,
FileBarChart,
Plus,
RotateCcw,Search,
Smartphone,
Trash2,
TrendingUp,
Users,
Wallet
} from 'lucide-react';
import { useCallback,useEffect,useMemo,useState } from 'react';
import * as XLSX from 'xlsx';

const _modeConfig: Record<RecoveryPaymentMode, { icon: typeof Banknote; color: string; badge: string }> = {
  cash: { icon: Banknote, color: 'text-brand-600', badge: 'bg-brand-600/15 text-brand-600 ring-brand-600/30' },
  online: { icon: Smartphone, color: 'text-blue-400', badge: 'bg-blue-500/10 text-blue-400 ring-blue-200/60' },
  other: { icon: Wallet, color: 'text-neutral-500 dark:text-neutral-400', badge: 'bg-neutral-100 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 ring-neutral-200 dark:ring-neutral-700/60' },
};

export interface EmployeeRecoveryGroup {
  collectorId: string;
  collectorName: string;
  employeeId: string;
  phone: string;
  collector: Collector | null;
  totalOriginal: number;
  totalRecovered: number;
  currentOutstanding: number;
  activeDueCount: number;
  oldestDueDate: string;
  lastRecoveryDate: string;
  status: 'Outstanding' | 'Partially Recovered' | 'Fully Recovered';
  recoveries: Recovery[];
}

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

  // Employee-Level Recovery Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCollectorId, setSelectedCollectorId] = useState('');
  const [recoveryAmount, setRecoveryAmount] = useState('');
  const [recoveryDate, setRecoveryDate] = useState(toISODate(new Date()));
  const [recoveryMode, setRecoveryMode] = useState<RecoveryPaymentMode>('cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // History Drawer State
  const [historyCollector, setHistoryCollector] = useState<Collector | null>(null);

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

        let dueQ = supabase
          .from('dues')
          .select('*, collector: collectors(*)')
          .order('due_date', { ascending: false });
        if (effectiveHub) dueQ = dueQ.eq('hub_id', effectiveHub);
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

  // Overall KPI Stats
  const stats = useMemo(() => {
    const totalRecovered = recoveries.reduce((s, r) => s + safeAmount(r.amount), 0);
    const todayStr = toISODate(new Date());
    const recoveredToday = recoveries.filter((r) => r.recovery_date === todayStr).reduce((s, r) => s + safeAmount(r.amount), 0);
    const cashRecoveries = recoveries.filter((r) => r.payment_mode === 'cash').reduce((s, r) => s + safeAmount(r.amount), 0);
    const onlineRecoveries = recoveries.filter((r) => r.payment_mode === 'online').reduce((s, r) => s + safeAmount(r.amount), 0);
    return { totalRecovered, recoveredToday, cashRecoveries, onlineRecoveries, count: recoveries.length };
  }, [recoveries]);

  // Grouped Employee Recovery Summaries
  const employeeGroups = useMemo<EmployeeRecoveryGroup[]>(() => {
    const map = new Map<string, {
      collectorId: string;
      collectorName: string;
      employeeId: string;
      phone: string;
      collector: Collector | null;
      empDues: Due[];
      empRecs: Recovery[];
    }>();

    // Map all collectors with dues or recoveries
    for (const d of dues) {
      if (d.status === 'cancelled') continue;
      const cid = d.collector_id || d.collector?.id || 'unknown';
      if (!map.has(cid)) {
        map.set(cid, {
          collectorId: cid,
          collectorName: d.collector?.name || 'Unknown Employee',
          employeeId: d.collector?.employee_id || 'N/A',
          phone: d.collector?.phone || 'N/A',
          collector: d.collector ?? null,
          empDues: [d],
          empRecs: [],
        });
      } else {
        map.get(cid)!.empDues.push(d);
      }
    }

    for (const r of recoveries) {
      const cid = r.collector_id || r.collector?.id || 'unknown';
      if (map.has(cid)) {
        map.get(cid)!.empRecs.push(r);
      } else if (r.collector) {
        map.set(cid, {
          collectorId: cid,
          collectorName: r.collector.name,
          employeeId: r.collector.employee_id,
          phone: r.collector.phone || 'N/A',
          collector: r.collector,
          empDues: [],
          empRecs: [r],
        });
      }
    }

    const rows: EmployeeRecoveryGroup[] = [];
    const q = search.trim().toLowerCase();

    map.forEach(({ collectorId, collectorName, employeeId, phone, collector, empDues, empRecs }) => {
      if (collectorFilter !== 'all' && collectorId !== collectorFilter) return;

      if (q) {
        const matchName = collectorName.toLowerCase().includes(q);
        const matchId = employeeId.toLowerCase().includes(q);
        const matchPhone = phone.toLowerCase().includes(q);
        if (!matchName && !matchId && !matchPhone) return;
      }

      const totalOriginal = empDues.reduce((s, d) => s + safeAmount(d.original_amount), 0);
      const totalRecovered = empRecs.reduce((s, r) => s + safeAmount(r.amount), 0);
      const currentOutstanding = empDues.reduce((s, d) => s + safeAmount(d.remaining_amount), 0);

      const activeDues = empDues.filter(d => safeAmount(d.remaining_amount) > 0);
      const activeDueCount = activeDues.length;

      const sortedDueDates = activeDues.map(d => d.due_date).filter(Boolean).sort();
      const oldestDueDate = sortedDueDates[0] || '—';

      const sortedRecDates = empRecs.map(r => r.recovery_date).filter(Boolean).sort().reverse();
      const lastRecoveryDate = sortedRecDates[0] || '—';

      let status: EmployeeRecoveryGroup['status'] = 'Fully Recovered';
      if (currentOutstanding > 0 && totalRecovered === 0) {
        status = 'Outstanding';
      } else if (currentOutstanding > 0 && totalRecovered > 0) {
        status = 'Partially Recovered';
      } else if (currentOutstanding === 0 && totalOriginal > 0) {
        status = 'Fully Recovered';
      }

      if (statusFilter !== 'all') {
        if (statusFilter === 'outstanding' && status !== 'Outstanding') return;
        if (statusFilter === 'partially_recovered' && status !== 'Partially Recovered') return;
        if (statusFilter === 'fully_recovered' && status !== 'Fully Recovered') return;
      }

      rows.push({
        collectorId,
        collectorName,
        employeeId,
        phone,
        collector,
        totalOriginal,
        totalRecovered,
        currentOutstanding,
        activeDueCount,
        oldestDueDate,
        lastRecoveryDate,
        status,
        recoveries: empRecs,
      });
    });

    return rows.sort((a, b) => b.currentOutstanding - a.currentOutstanding || a.collectorName.localeCompare(b.collectorName));
  }, [dues, recoveries, search, collectorFilter, statusFilter]);

  // Selected Employee Details for Recovery Modal
  const selectedCollector = useMemo(() => {
    return collectors.find(c => c.id === selectedCollectorId) ?? null;
  }, [collectors, selectedCollectorId]);

  const modalEmployeeOutstanding = useMemo(() => {
    if (!selectedCollectorId) return 0;
    return getEmployeeOutstanding(selectedCollectorId, dues);
  }, [selectedCollectorId, dues]);

  const modalActiveDues = useMemo(() => {
    if (!selectedCollectorId) return [];
    return getActiveEmployeeDues(selectedCollectorId, dues);
  }, [selectedCollectorId, dues]);

  const modalFIFOPreview = useMemo(() => {
    if (!selectedCollectorId) return [];
    const amt = safeAmount(recoveryAmount);
    if (amt <= 0) return [];
    return allocateRecoveryFIFO(dues, selectedCollectorId, amt);
  }, [selectedCollectorId, recoveryAmount, dues]);

  const openAdd = (presetCollectorId?: string) => {
    setSelectedCollectorId(presetCollectorId || '');
    setRecoveryAmount('');
    setRecoveryDate(toISODate(new Date()));
    setRecoveryMode('cash');
    setReferenceNumber('');
    setNotes('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!selectedCollectorId) { toast.error('Select an employee'); return; }
    const amount = safeAmount(recoveryAmount);
    if (amount <= 0) { toast.error('Enter a valid recovery amount'); return; }
    if (amount > modalEmployeeOutstanding) {
      toast.error(`Recovery amount cannot exceed employee total outstanding (₹${modalEmployeeOutstanding.toLocaleString('en-IN')})`);
      return;
    }

    const firstActiveDue = modalActiveDues[0];
    const targetHubId = firstActiveDue?.hub_id || hubCtx.selectedHubId || (hubCtx.accessibleHubs[0]?.id ?? '');

    setSaving(true);
    try {
      await executeEmployeeRecovery({
        collectorId: selectedCollectorId,
        hubId: targetHubId,
        amount,
        paymentMode: recoveryMode,
        recoveryDate,
        referenceNumber: referenceNumber.trim() || null,
        notes: notes.trim() || null,
        createdBy: profile?.id ?? null,
        dues,
        isOnline: navigator.onLine,
      });

      await logAudit(
        'recovery_record',
        profile?.id ?? null,
        `Recorded employee recovery of ${formatINR(amount)} for employee ${selectedCollectorId}`,
        null,
        targetHubId
      );

      toast.success(`Recovery of ${formatINR(amount)} recorded successfully`);
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save recovery');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRecoveryItem = async (rec: Recovery) => {
    const ok = await confirm({
      title: 'Delete this recovery transaction?',
      message: `Remove recovery transaction of ${formatINR(rec.amount)}? The due balance will be recalculated.`,
      confirmLabel: 'Delete Transaction',
      danger: true,
    });
    if (!ok) return;

    try {
      const due = rec.due || dues.find(d => d.id === rec.due_id);
      let dueUpdate: any = null;

      if (due) {
        const newRecovered = Math.max(0, safeAmount(due.recovered_amount) - safeAmount(rec.amount));
        const newRemaining = Math.max(0, safeAmount(due.original_amount) - newRecovered);
        const newStatus: DueStatus = newRemaining <= 0 ? 'fully_recovered' : newRecovered > 0 ? 'partially_recovered' : 'outstanding';
        dueUpdate = {
          recovered_amount: newRecovered,
          remaining_amount: newRemaining,
          status: newStatus,
          updated_at: new Date().toISOString(),
        };
      }

      if (!navigator.onLine) {
        await db.recoveries.delete(rec.id);
        await addToQueue(profile?.id || '', rec.hub_id, 'recoveries', 'DELETE', { id: rec.id });
        if (dueUpdate && due) {
          await db.dues.update(due.id, dueUpdate);
          await addToQueue(profile?.id || '', rec.hub_id, 'dues', 'UPDATE', { id: due.id, ...dueUpdate });
        }
        toast.success('Recovery transaction deleted offline');
      } else {
        const { error } = await supabase.rpc('delete_recovery_atomic', {
          p_recovery_id: rec.id,
        });
        if (error) throw error;
        toast.success('Recovery transaction deleted');
      }
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete recovery');
    }
  };

  const handleExportRecoveryExcel = () => {
    const rows: any[] = [];
    employeeGroups.forEach(emp => {
      emp.recoveries.forEach(r => {
        rows.push({
          'Recovery Date': formatDate(r.recovery_date),
          'Employee Name': emp.collectorName,
          'Employee ID': emp.employeeId,
          'Phone': emp.phone,
          'Amount': safeAmount(r.amount),
          'Payment Mode': (r.payment_mode || 'cash').toUpperCase(),
          'Reference': r.reference_number || '—',
          'Remarks': r.notes || '—',
        });
      });
    });

    if (rows.length === 0) {
      toast.warning('No recovery history to export');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Recovery History');
    XLSX.writeFile(wb, `recovery_history_${toISODate(new Date())}.xlsx`);
    toast.success('Recovery history exported to Excel');
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
    <div className="space-y-6 max-w-full overflow-x-hidden">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Recovery Management</h1>
          <p className="mt-1 text-xs sm:text-sm text-neutral-500">Record and track employee-level payments collected against outstanding dues.</p>
          <div className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
            <Calendar className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
            {formatDate(from)} — {formatDate(to)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={handleExportRecoveryExcel} className="min-h-[44px] text-xs font-semibold">
            Export History
          </Button>

          {canManage && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => openAdd()} className="min-h-[44px] px-4 text-xs sm:text-sm font-semibold shadow-glow">
              + Record Recovery
            </Button>
          )}
        </div>
      </div>

      {/* KPI cards */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kpiCards.map((c) => (
            <Card key={c.label} hover className="p-4 animate-fade-in">
              <div className={clsx('inline-flex h-9 w-9 items-center justify-center rounded-xl ring-1', accentMap[c.accent])}>
                <c.icon className="h-4 w-4" />
              </div>
              <p className="mt-2 text-xs font-medium text-neutral-500">{c.label}</p>
              <p className="mt-1 text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">{formatINR(c.value)}</p>
              <p className="mt-1 text-[11px] text-neutral-400">{c.sub}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Filters Toolbar */}
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-semibold text-neutral-500 mb-1">From Date</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input-base py-2 text-xs min-h-[44px]" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-500 mb-1">To Date</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input-base py-2 text-xs min-h-[44px]" />
          </div>
          <Select label="Employee" value={collectorFilter} onChange={(e) => setCollectorFilter(e.target.value)}>
            <option value="all">All Employees</option>
            {collectors.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.employee_id})</option>)}
          </Select>
          <Select label="Payment Mode" value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}>
            <option value="all">All Modes</option>
            <option value="cash">Cash</option>
            <option value="online">Online</option>
            <option value="other">Other</option>
          </Select>
          <Select label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
            <option value="all">All Statuses</option>
            <option value="outstanding">Outstanding</option>
            <option value="partially_recovered">Partially Recovered</option>
            <option value="fully_recovered">Fully Recovered</option>
          </Select>
        </div>

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee by name, ID, or phone..."
            className="input-base pl-10 min-h-[44px] text-sm"
          />
        </div>
      </Card>

      {/* Employee-Level Recovery Summary Table & Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Users className="h-4 w-4 text-brand-600" />
            Employee Recovery Overview ({employeeGroups.length} Employees)
          </h2>
          <span className="text-xs text-neutral-500 hidden sm:inline">Calculated from employee active dues & recovery transactions</span>
        </div>

        {loading ? (
          <Card className="p-8 flex justify-center"><Spinner className="h-6 w-6" /></Card>
        ) : employeeGroups.length === 0 ? (
          <Card>
            <EmptyState
              icon={<FileBarChart className="h-7 w-7" />}
              title="No recovery records found"
              message={search || collectorFilter !== 'all' || modeFilter !== 'all' ? 'Try adjusting your filters.' : 'Employee recoveries will appear here once you record payments against outstanding dues.'}
              action={canManage ? <Button icon={<Plus className="h-4 w-4" />} onClick={() => openAdd()}>+ Record Recovery</Button> : undefined}
            />
          </Card>
        ) : (
          <>
            {/* Desktop Table View (>= 768px / md:table) */}
            <Card className="hidden md:block overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 dark:bg-neutral-950/80 text-neutral-500 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-5 py-3 font-semibold">Employee</th>
                      <th className="text-right px-4 py-3 font-semibold">Active Dues</th>
                      <th className="text-right px-4 py-3 font-semibold">Total Original</th>
                      <th className="text-right px-4 py-3 font-semibold text-emerald-600">Total Recovered</th>
                      <th className="text-right px-4 py-3 font-semibold text-red-500">Current Outstanding</th>
                      <th className="text-left px-4 py-3 font-semibold">Oldest Due</th>
                      <th className="text-left px-4 py-3 font-semibold">Last Recovery</th>
                      <th className="text-center px-4 py-3 font-semibold">Status</th>
                      <th className="text-right px-5 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {employeeGroups.map((emp) => (
                      <tr key={emp.collectorId} className="group hover:bg-neutral-50 dark:hover:bg-neutral-950/70 transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="font-bold text-neutral-900 dark:text-neutral-100">{emp.collectorName}</p>
                          <p className="text-xs text-neutral-400 font-mono">{emp.employeeId} · {emp.phone}</p>
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium tabular-nums">{emp.activeDueCount}</td>
                        <td className="px-4 py-3.5 text-right font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">{formatINR(emp.totalOriginal)}</td>
                        <td className="px-4 py-3.5 text-right font-medium text-emerald-600 tabular-nums">{formatINR(emp.totalRecovered)}</td>
                        <td className={clsx('px-4 py-3.5 text-right font-bold tabular-nums', emp.currentOutstanding > 0 ? 'text-red-500' : 'text-neutral-400')}>
                          {formatINR(emp.currentOutstanding)}
                        </td>
                        <td className="px-4 py-3.5 text-neutral-500 text-xs">{formatDate(emp.oldestDueDate)}</td>
                        <td className="px-4 py-3.5 text-neutral-500 text-xs">{formatDate(emp.lastRecoveryDate)}</td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={clsx(
                            'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1',
                            emp.status === 'Fully Recovered' ? 'bg-brand-500/10 text-brand-600 ring-brand-500/30' :
                            emp.status === 'Partially Recovered' ? 'bg-amber-500/10 text-amber-500 ring-amber-500/30' :
                            'bg-red-500/10 text-red-500 ring-red-500/30'
                          )}>
                            {emp.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {canManage && emp.currentOutstanding > 0 && (
                              <Button
                                size="sm"
                                onClick={() => openAdd(emp.collectorId)}
                                className="min-h-[36px] px-2.5 text-xs font-semibold"
                              >
                                + Recover
                              </Button>
                            )}
                            {emp.collector && (
                              <Button
                                size="sm"
                                variant="outline"
                                icon={<BookOpen className="h-3.5 w-3.5 text-brand-600" />}
                                onClick={() => setHistoryCollector(emp.collector)}
                                className="min-h-[36px] px-2.5 text-xs font-semibold border-brand-500/30 text-brand-600 hover:bg-brand-500/10"
                                title="View itemized recovery history"
                              >
                                History
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Mobile View: Gallery Cards (< 768px / md:hidden) */}
            <div className="grid grid-cols-1 gap-3 md:hidden w-full max-w-full">
              {employeeGroups.map((emp) => (
                <Card key={emp.collectorId} className="p-4 space-y-3 border border-neutral-200 dark:border-neutral-800 w-full min-w-0 shadow-sm">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-2.5">
                    <div className="min-w-0">
                      <p className="font-bold text-base text-neutral-900 dark:text-neutral-100 truncate">{emp.collectorName}</p>
                      <p className="text-xs text-neutral-400 font-mono mt-0.5">{emp.employeeId}</p>
                      <p className="text-xs text-neutral-500 font-mono mt-0.5">Phone: {emp.phone}</p>
                    </div>
                    <span className={clsx(
                      'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold shrink-0',
                      emp.status === 'Fully Recovered' ? 'bg-brand-500/10 text-brand-600 ring-1 ring-brand-500/30' :
                      emp.status === 'Partially Recovered' ? 'bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/30' :
                      'bg-red-500/10 text-red-500 ring-1 ring-red-500/30'
                    )}>
                      {emp.status}
                    </span>
                  </div>

                  {/* Summary Metric Grid */}
                  <div className="grid grid-cols-3 gap-1.5 p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-950 text-center text-xs border border-neutral-200/60 dark:border-neutral-800/60">
                    <div>
                      <p className="text-neutral-500 text-[11px]">Original</p>
                      <p className="font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">{formatINR(emp.totalOriginal)}</p>
                    </div>
                    <div>
                      <p className="text-emerald-600 text-[11px]">Recovered</p>
                      <p className="font-bold text-emerald-600 tabular-nums">{formatINR(emp.totalRecovered)}</p>
                    </div>
                    <div>
                      <p className="text-red-500 text-[11px]">Outstanding</p>
                      <p className={clsx('font-bold tabular-nums', emp.currentOutstanding > 0 ? 'text-red-500' : 'text-neutral-400')}>
                        {formatINR(emp.currentOutstanding)}
                      </p>
                    </div>
                  </div>

                  {/* Dates & Dues Details */}
                  <div className="grid grid-cols-2 gap-2 text-xs text-neutral-600 dark:text-neutral-400 px-1">
                    <div>
                      <span className="text-neutral-500">Active Dues: </span>
                      <span className="font-bold text-neutral-900 dark:text-neutral-100">{emp.activeDueCount} entries</span>
                    </div>
                    <div>
                      <span className="text-neutral-500">Oldest Due: </span>
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200">{formatDate(emp.oldestDueDate)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                    {canManage && emp.currentOutstanding > 0 && (
                      <Button
                        size="sm"
                        onClick={() => openAdd(emp.collectorId)}
                        className="min-h-[44px] text-xs font-semibold px-3 flex-1"
                      >
                        + Recover
                      </Button>
                    )}

                    {emp.collector && (
                      <Button
                        size="sm"
                        variant="outline"
                        icon={<BookOpen className="h-3.5 w-3.5 text-brand-600" />}
                        onClick={() => setHistoryCollector(emp.collector)}
                        className="min-h-[44px] text-xs font-semibold px-3 flex-1 border-brand-500/30 text-brand-600 hover:bg-brand-500/10"
                      >
                        History
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Record Employee Recovery Modal */}
      {modalOpen && (
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Record Employee Recovery"
          subtitle="Record payment against an employee's total outstanding dues (FIFO auto-allocated)."
          size="lg"
          footer={
            <>
              <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving} className="min-h-[44px]">Cancel</Button>
              <Button onClick={handleSave} loading={saving} disabled={saving} className="min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                Record Employee Recovery
              </Button>
            </>
          }
        >
          <div className="space-y-4 text-sm">
            <Select
              label="Select Employee"
              value={selectedCollectorId}
              onChange={(e) => setSelectedCollectorId(e.target.value)}
            >
              <option value="">Select employee…</option>
              {collectors
                .filter((c) => getEmployeeOutstanding(c.id, dues) > 0)
                .map((c) => {
                  const out = getEmployeeOutstanding(c.id, dues);
                  return (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.employee_id}) — Total Pending: {formatINR(out)}
                    </option>
                  );
                })}
            </Select>

            {selectedCollector && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-neutral-50 dark:bg-neutral-950 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800">
                <div>
                  <p className="text-xs text-neutral-500">Employee Name</p>
                  <p className="font-bold text-neutral-900 dark:text-neutral-100">{selectedCollector.name}</p>
                  <p className="text-xs text-neutral-400 font-mono">{selectedCollector.employee_id}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Active Dues Count</p>
                  <p className="font-bold text-neutral-900 dark:text-neutral-100">{modalActiveDues.length} entries</p>
                </div>
                <div>
                  <p className="text-xs text-red-500 font-semibold">Total Outstanding</p>
                  <p className="font-bold text-red-500 text-base tabular-nums">{formatINR(modalEmployeeOutstanding)}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Recovery Amount (₹)"
                type="number"
                value={recoveryAmount}
                onChange={(e) => setRecoveryAmount(e.target.value)}
                placeholder={modalEmployeeOutstanding > 0 ? `Max: ₹${modalEmployeeOutstanding}` : '0'}
              />

              <Input
                label="Recovery Date"
                type="date"
                value={recoveryDate}
                onChange={(e) => setRecoveryDate(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Payment Mode"
                value={recoveryMode}
                onChange={(e) => setRecoveryMode(e.target.value as RecoveryPaymentMode)}
              >
                <option value="cash">Cash</option>
                <option value="online">Online / UPI</option>
                <option value="other">Other / Salary Adjustment</option>
              </Select>

              <Input
                label="Reference Number (optional)"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="Transaction ID / Slip No."
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-500 mb-1">Notes / Remarks (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Notes regarding this recovery payment..."
                className="input-base resize-none"
              />
            </div>

            {/* FIFO Allocation Preview */}
            {safeAmount(recoveryAmount) > 0 && selectedCollectorId && (
              <div className="space-y-2 border-t border-neutral-200 dark:border-neutral-800 pt-3">
                <div className="flex items-center justify-between text-xs font-bold text-neutral-800 dark:text-neutral-200">
                  <span>Live Outstanding Impact:</span>
                  <span className="tabular-nums">
                    ₹{modalEmployeeOutstanding.toLocaleString('en-IN')} $\rightarrow$ ₹{Math.max(0, modalEmployeeOutstanding - safeAmount(recoveryAmount)).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden text-xs">
                  <div className="bg-neutral-100 dark:bg-neutral-900 px-3 py-2 font-bold text-neutral-600 dark:text-neutral-400">
                    FIFO Allocation Preview (Oldest Dues First):
                  </div>
                  <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {modalFIFOPreview.map((item) => (
                      <div key={item.due.id} className="p-3 flex justify-between items-center bg-neutral-50/50 dark:bg-neutral-950/50">
                        <div>
                          <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                            {item.due.source === 'manual_old_due' || item.due.collection_entry_id === null ? 'Manual Old Due' : 'Collection Shortage'} ({formatDate(item.due.due_date)})
                          </p>
                          <p className="text-[11px] text-neutral-500">
                            Original: {formatINR(item.due.original_amount)} · Was Remaining: {formatINR(item.due.remaining_amount)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-emerald-600 tabular-nums">+ {formatINR(item.allocated)}</p>
                          <p className="text-[11px] text-neutral-400 font-semibold">New Rem: {formatINR(item.newRemaining)} ({item.newStatus})</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Employee Recovery History Drawer / Modal */}
      {historyCollector && (
        <Modal
          open={!!historyCollector}
          onClose={() => setHistoryCollector(null)}
          title={`Recovery Transactions History — ${historyCollector.name}`}
          subtitle={`Employee ID: ${historyCollector.employee_id}`}
          size="lg"
          footer={<Button variant="outline" onClick={() => setHistoryCollector(null)} className="min-h-[44px]">Close History</Button>}
        >
          <div className="space-y-4">
            <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-neutral-100 dark:bg-neutral-900 text-neutral-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Date</th>
                    <th className="text-right px-4 py-3 font-semibold text-emerald-600">Recovery Amount</th>
                    <th className="text-left px-4 py-3 font-semibold">Mode</th>
                    <th className="text-left px-4 py-3 font-semibold">Reference</th>
                    <th className="text-left px-4 py-3 font-semibold">Remarks</th>
                    <th className="text-right px-4 py-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {recoveries.filter(r => (r.collector_id === historyCollector.id || r.collector?.id === historyCollector.id)).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-neutral-500">No recovery history transactions found.</td>
                    </tr>
                  ) : (
                    recoveries
                      .filter(r => (r.collector_id === historyCollector.id || r.collector?.id === historyCollector.id))
                      .map((r) => (
                        <tr key={r.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-950/70 transition-colors">
                          <td className="px-4 py-3 font-medium tabular-nums">{formatDate(r.recovery_date)}</td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-600 tabular-nums">{formatINR(r.amount)}</td>
                          <td className="px-4 py-3 font-mono text-xs">{(r.payment_mode || 'cash').toUpperCase()}</td>
                          <td className="px-4 py-3 font-mono text-xs">{r.reference_number || '—'}</td>
                          <td className="px-4 py-3 text-xs text-neutral-600 dark:text-neutral-400 italic">{r.notes || '—'}</td>
                          <td className="px-4 py-3 text-right">
                            {canManage && (
                              <button
                                onClick={() => handleDeleteRecoveryItem(r)}
                                className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-500/10 transition"
                                title="Delete transaction"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
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
