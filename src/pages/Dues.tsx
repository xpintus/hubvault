import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, Search, RotateCcw, Eye, TrendingDown, Users as UsersIcon,
  CheckCircle2, Clock, ChevronDown, ChevronUp, ArrowLeft, BookOpen, Printer, Download, FileText,
  Plus, Edit3, Trash2, ShieldAlert, Tag, Filter, X, ArrowRight
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useHub } from '@/lib/hubContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { Button, Card, EmptyState, Select, Skeleton, Spinner, Input } from '@/components/ui/primitives';
import Modal from '@/components/ui/Modal';
import { confirm } from '@/lib/confirm';
import { Due, DueStatus, DUE_STATUS_LABELS, Collector, Recovery } from '@/types';
import { formatINR, formatDate, toISODate } from '@/lib/format';
import { db } from '@/lib/offline/db';
import { addToQueue } from '@/lib/offline/syncQueue';
import { v4 as uuidv4 } from 'uuid';
import { clsx } from 'clsx';
import * as XLSX from 'xlsx';
import { logAudit } from '@/lib/audit';

const statusConfig: Record<DueStatus, { color: string; dot: string; badge: string; label: string }> = {
  outstanding: {
    color: 'text-red-400',
    dot: 'bg-red-500',
    badge: 'bg-red-500/10 text-red-400 ring-red-500/30',
    label: 'Outstanding',
  },
  partially_recovered: {
    color: 'text-amber-400',
    dot: 'bg-amber-500',
    badge: 'bg-amber-500/10 text-amber-400 ring-amber-500/30',
    label: 'Partially Recovered',
  },
  fully_recovered: {
    color: 'text-brand-600',
    dot: 'bg-brand-500',
    badge: 'bg-brand-600/15 text-brand-600 ring-brand-600/30',
    label: 'Fully Recovered',
  },
  cancelled: {
    color: 'text-neutral-500',
    dot: 'bg-neutral-500',
    badge: 'bg-neutral-500/10 text-neutral-400 ring-neutral-500/30',
    label: 'Cancelled / Voided',
  },
};

const safeAmount = (val: any): number => {
  if (val === null || val === undefined) return 0;
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  return isNaN(num) ? 0 : num;
};

const DUE_REASONS = [
  'Old Due',
  'Cash Shortage',
  'Online Shortage',
  'Previous Balance',
  'Cash Not Handed Over',
  'Settlement Pending',
  'Damage / Penalty',
  'Advance Adjustment',
  'Other',
];

export interface EmployeeSummaryRow {
  collectorId: string;
  collectorName: string;
  employeeId: string;
  phone: string;
  collector: Collector | null;
  totalOriginalDue: number;
  totalRecovered: number;
  currentOutstanding: number;
  dueEntryCount: number;
  oldestDueDate: string;
  recoveryPercentage: number;
  status: 'Outstanding' | 'Partially Recovered' | 'Fully Recovered';
  dueRecords: Due[];
}

interface ManualFormState {
  due_date: string;
  collector_id: string;
  hub_id: string;
  original_amount: string;
  due_reason: string;
  reference_number: string;
  notes: string;
}

const emptyManualForm: ManualFormState = {
  due_date: toISODate(new Date()),
  collector_id: '',
  hub_id: '',
  original_amount: '',
  due_reason: 'Old Due',
  reference_number: '',
  notes: '',
};

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
  const [sourceFilter, setSourceFilter] = useState<'all' | 'collection_shortage' | 'manual_old_due'>('all');

  const [expandedDue, setExpandedDue] = useState<string | null>(null);
  const [detailDue, setDetailDue] = useState<Due | null>(null);

  // Collapsible state for Individual Dues Records (Default: collapsed)
  const [isIndividualDuesExpanded, setIsIndividualDuesExpanded] = useState(false);

  // Recovery State
  const [recoveryForDue, setRecoveryForDue] = useState<Due | null>(null);
  const [recoveryAmount, setRecoveryAmount] = useState('');
  const [recoveryMode, setRecoveryMode] = useState('cash');
  const [recoveryNotes, setRecoveryNotes] = useState('');
  const [recoveryRef, setRecoveryRef] = useState('');
  const [savingRecovery, setSavingRecovery] = useState(false);

  // Manual Old Due Modal State
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [editingManualDue, setEditingManualDue] = useState<Due | null>(null);
  const [manualForm, setManualForm] = useState<ManualFormState>(emptyManualForm);
  const [savingManualDue, setSavingManualDue] = useState(false);

  // Outstanding Employee Modal State
  const [showOutstandingModal, setShowOutstandingModal] = useState(false);
  const [modalSearch, setModalSearch] = useState('');

  // Employee Ledger Drawer State
  const [selectedLedgerCollector, setSelectedLedgerCollector] = useState<Collector | null>(null);
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState<'all' | 'pending' | 'recovered' | 'partial'>('all');
  const [ledgerStartDate, setLedgerStartDate] = useState('');
  const [ledgerEndDate, setLedgerEndDate] = useState('');

  const isSuperAdmin = profile?.role === 'super_admin';
  const canManage = ['super_admin', 'hub_admin', 'supervisor'].includes(profile?.role ?? '');
  const activeHubId = hubCtx.selectedHubId;

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

  // Main Filtered Dues List
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dues.filter((d) => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      
      const isManual = d.source === 'manual_old_due' || d.collection_entry_id === null;
      if (sourceFilter === 'manual_old_due' && !isManual) return false;
      if (sourceFilter === 'collection_shortage' && isManual) return false;

      if (!q) return true;
      const name = d.collector?.name?.toLowerCase() ?? '';
      const empId = d.collector?.employee_id?.toLowerCase() ?? '';
      const phone = d.collector?.phone?.toLowerCase() ?? '';
      const reason = (d.due_reason || d.notes || '').toLowerCase();
      const ref = (d.reference_number || '').toLowerCase();
      return name.includes(q) || empId.includes(q) || phone.includes(q) || reason.includes(q) || ref.includes(q);
    });
  }, [dues, search, statusFilter, sourceFilter]);

  // Summary Metrics
  const stats = useMemo(() => {
    const activeDues = dues.filter((d) => d.status !== 'cancelled');
    const outstandingDues = activeDues.filter((d) => d.status !== 'fully_recovered');
    const totalOutstanding = outstandingDues.reduce((s, d) => s + safeAmount(d.remaining_amount), 0);
    const employeesWithDues = new Set(outstandingDues.map((d) => d.collector_id)).size;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const recoveredThisMonth = activeDues.reduce((s, d) => {
      if (new Date(d.updated_at) >= monthStart) return s + safeAmount(d.recovered_amount);
      return s;
    }, 0);
    const totalDuesIssued = activeDues.reduce((s, d) => s + safeAmount(d.original_amount), 0);
    const manualDuesCount = activeDues.filter(d => d.source === 'manual_old_due' || d.collection_entry_id === null).length;

    return { totalOutstanding, employeesWithDues, recoveredThisMonth, totalDuesIssued, manualDuesCount };
  }, [dues]);

  // SECTION 4: Derived Employee Summary Aggregation (Always Visible)
  const employeeSummaryRows = useMemo<EmployeeSummaryRow[]>(() => {
    const map = new Map<string, {
      collectorId: string;
      collectorName: string;
      employeeId: string;
      phone: string;
      collector: Collector | null;
      dues: Due[];
    }>();

    for (const due of dues) {
      if (due.status === 'cancelled') continue;

      const isManual = due.source === 'manual_old_due' || due.collection_entry_id === null;
      if (sourceFilter === 'manual_old_due' && !isManual) continue;
      if (sourceFilter === 'collection_shortage' && isManual) continue;

      const cid = due.collector_id || due.collector?.id || 'unknown';
      const cName = due.collector?.name || 'Unknown Employee';
      const empCode = due.collector?.employee_id || 'N/A';
      const phone = due.collector?.phone || 'N/A';

      if (!map.has(cid)) {
        map.set(cid, {
          collectorId: cid,
          collectorName: cName,
          employeeId: empCode,
          phone,
          collector: due.collector ?? null,
          dues: [due],
        });
      } else {
        map.get(cid)!.dues.push(due);
      }
    }

    const rows: EmployeeSummaryRow[] = [];
    const q = search.trim().toLowerCase();

    map.forEach(({ collectorId, collectorName, employeeId, phone, collector, dues: empDues }) => {
      if (q) {
        const matchName = collectorName.toLowerCase().includes(q);
        const matchId = employeeId.toLowerCase().includes(q);
        const matchPhone = phone.toLowerCase().includes(q);
        if (!matchName && !matchId && !matchPhone) return;
      }

      const totalOriginalDue = empDues.reduce((s, d) => s + safeAmount(d.original_amount), 0);
      const totalRecovered = empDues.reduce((s, d) => s + safeAmount(d.recovered_amount), 0);
      const currentOutstanding = empDues.reduce((s, d) => s + safeAmount(d.remaining_amount), 0);
      const dueEntryCount = empDues.length;

      const pendingDues = empDues.filter(d => safeAmount(d.remaining_amount) > 0);
      const sortedDates = (pendingDues.length > 0 ? pendingDues : empDues)
        .map(d => d.due_date)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
      const oldestDueDate = sortedDates[0] || '—';

      const recoveryPercentage = totalOriginalDue > 0
        ? Math.round((totalRecovered / totalOriginalDue) * 100)
        : 0;

      let status: EmployeeSummaryRow['status'] = 'Fully Recovered';
      if (currentOutstanding > 0 && totalRecovered === 0) {
        status = 'Outstanding';
      } else if (currentOutstanding > 0 && totalRecovered > 0) {
        status = 'Partially Recovered';
      } else if (currentOutstanding === 0 && totalOriginalDue > 0) {
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
        totalOriginalDue,
        totalRecovered,
        currentOutstanding,
        dueEntryCount,
        oldestDueDate,
        recoveryPercentage,
        status,
        dueRecords: empDues,
      });
    });

    return rows.sort((a, b) => b.currentOutstanding - a.currentOutstanding || a.collectorName.localeCompare(b.collectorName));
  }, [dues, search, statusFilter, sourceFilter]);

  // Outstanding Employee Modal Search Filter
  const filteredModalSummary = useMemo(() => {
    const q = modalSearch.trim().toLowerCase();
    if (!q) return employeeSummaryRows;
    return employeeSummaryRows.filter((group) => {
      const name = group.collectorName.toLowerCase();
      const empId = group.employeeId.toLowerCase();
      const phone = group.phone.toLowerCase();
      return name.includes(q) || empId.includes(q) || phone.includes(q);
    });
  }, [employeeSummaryRows, modalSearch]);

  // Employee Ledger Event Calculations
  const rawLedgerEvents = useMemo(() => {
    if (!selectedLedgerCollector) return [];

    const cid = selectedLedgerCollector.id;
    const empDues = dues.filter((d) => (d.collector_id === cid || d.collector?.id === cid) && d.status !== 'cancelled');
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
        typeLabel: d.source === 'manual_old_due' || d.collection_entry_id === null ? 'Manual Old Due' : 'Collection Shortage Due',
        originalDue: safeAmount(d.original_amount),
        recovered: null,
        paymentMode: '—',
        remarks: d.due_reason ? `${d.due_reason}${d.notes ? ` | ${d.notes}` : ''}` : d.notes || 'Due created',
        status: d.status,
        amountChange: safeAmount(d.original_amount),
      });
    });

    empRecs.forEach((r) => {
      events.push({
        id: `rec-${r.id}`,
        rawDate: new Date(r.recovery_date || r.created_at),
        dateStr: r.recovery_date || r.created_at,
        eventType: 'recovery',
        typeLabel: 'Recovery Payment',
        originalDue: null,
        recovered: safeAmount(r.amount),
        paymentMode: (r.payment_mode || 'cash').toUpperCase(),
        remarks: r.notes || (r.reference_number ? `Ref: ${r.reference_number}` : 'Recovery payment'),
        status: 'recovered',
        amountChange: -safeAmount(r.amount),
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

  const filteredLedgerEvents = useMemo(() => {
    return rawLedgerEvents.filter((evt) => {
      if (ledgerStatusFilter === 'pending' && evt.eventType === 'due_created' && evt.status === 'fully_recovered') return false;
      if (ledgerStatusFilter === 'recovered' && evt.eventType !== 'recovery' && evt.status !== 'fully_recovered') return false;
      if (ledgerStatusFilter === 'partial' && evt.status !== 'partially_recovered') return false;

      const q = ledgerSearch.trim().toLowerCase();
      if (q) {
        const remarks = evt.remarks.toLowerCase();
        const typeLabel = evt.typeLabel.toLowerCase();
        const dateStr = formatDate(evt.dateStr).toLowerCase();
        const mode = evt.paymentMode.toLowerCase();
        if (!remarks.includes(q) && !typeLabel.includes(q) && !dateStr.includes(q) && !mode.includes(q)) return false;
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

  const openAddManualDue = () => {
    const presetHub = activeHubId || (hubCtx.accessibleHubs[0]?.id ?? '');
    setEditingManualDue(null);
    setManualForm({
      ...emptyManualForm,
      hub_id: presetHub,
      due_date: toISODate(new Date()),
    });
    setManualModalOpen(true);
  };

  const openEditManualDue = (d: Due) => {
    setEditingManualDue(d);
    setManualForm({
      due_date: d.due_date,
      collector_id: d.collector_id,
      hub_id: d.hub_id,
      original_amount: String(d.original_amount),
      due_reason: d.due_reason || 'Old Due',
      reference_number: d.reference_number || '',
      notes: d.notes || '',
    });
    setManualModalOpen(true);
  };

  const handleSaveManualDue = async () => {
    if (savingManualDue) return;

    if (!manualForm.collector_id) { toast.error('Please select an employee'); return; }
    if (!manualForm.due_date) { toast.error('Please select a due date'); return; }
    const amount = safeAmount(manualForm.original_amount);
    if (amount <= 0) { toast.error('Due amount must be greater than ₹0'); return; }
    if (manualForm.due_reason === 'Other' && !manualForm.notes.trim()) {
      toast.error('Remarks are required when reason is Other');
      return;
    }

    const hubId = manualForm.hub_id || activeHubId || (hubCtx.accessibleHubs[0]?.id ?? '');
    if (!hubId) { toast.error('Please select a hub'); return; }

    // Duplicate check
    const existingMatch = dues.find(d => 
      d.hub_id === hubId &&
      d.collector_id === manualForm.collector_id &&
      d.due_date === manualForm.due_date &&
      safeAmount(d.original_amount) === amount &&
      (d.source === 'manual_old_due' || d.collection_entry_id === null) &&
      (!editingManualDue || d.id !== editingManualDue.id) &&
      d.status !== 'cancelled'
    );

    if (existingMatch) {
      const collectorObj = collectors.find(c => c.id === manualForm.collector_id);
      const empName = collectorObj ? `${collectorObj.name} (${collectorObj.employee_id})` : 'this employee';
      const ok = await confirm({
        title: 'Possible Duplicate Manual Due',
        message: `A manual due of ${formatINR(amount)} for ${empName} dated ${formatDate(manualForm.due_date)} already exists. Continue anyway?`,
        confirmLabel: 'Yes, Save Manual Due',
      });
      if (!ok) return;
    }

    setSavingManualDue(true);
    try {
      if (editingManualDue) {
        const currentRecovered = safeAmount(editingManualDue.recovered_amount);
        if (currentRecovered > 0 && amount < currentRecovered) {
          toast.error(`Cannot reduce due amount below total recovered amount (${formatINR(currentRecovered)})`);
          setSavingManualDue(false);
          return;
        }

        const newRemaining = Math.max(0, amount - currentRecovered);
        const newStatus: DueStatus = newRemaining === 0 ? 'fully_recovered' : currentRecovered > 0 ? 'partially_recovered' : 'outstanding';

        const payload = {
          collector_id: manualForm.collector_id,
          hub_id: hubId,
          due_date: manualForm.due_date,
          original_amount: amount,
          remaining_amount: newRemaining,
          status: newStatus,
          due_reason: manualForm.due_reason,
          reference_number: manualForm.reference_number.trim() || null,
          notes: manualForm.notes.trim() || null,
          updated_at: new Date().toISOString(),
        };

        if (navigator.onLine) {
          const { error } = await supabase.from('dues').update(payload).eq('id', editingManualDue.id);
          if (error) throw error;
        }

        await db.dues.update(editingManualDue.id, payload as any);
        await addToQueue(profile?.id || '', hubId, 'dues', 'UPDATE', { id: editingManualDue.id, ...payload });

        await logAudit(
          'due_update',
          profile?.id ?? null,
          `Updated manual old due of ${formatINR(amount)} for employee ${manualForm.collector_id}`,
          null,
          hubId
        );

        toast.success('Manual due updated successfully');
      } else {
        const newId = uuidv4();
        const payload = {
          id: newId,
          collector_id: manualForm.collector_id,
          hub_id: hubId,
          collection_entry_id: null,
          original_amount: amount,
          recovered_amount: 0,
          remaining_amount: amount,
          due_date: manualForm.due_date,
          status: 'outstanding' as DueStatus,
          source: 'manual_old_due',
          due_reason: manualForm.due_reason,
          reference_number: manualForm.reference_number.trim() || null,
          notes: manualForm.notes.trim() || null,
          created_by: profile?.id ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        if (navigator.onLine) {
          const { error } = await supabase.from('dues').insert(payload);
          if (error) throw error;
        }

        await db.dues.put(payload as any);
        await addToQueue(profile?.id || '', hubId, 'dues', 'INSERT', payload);

        await logAudit(
          'due_create',
          profile?.id ?? null,
          `Created manual old due of ${formatINR(amount)} for employee ${manualForm.collector_id} (Reason: ${manualForm.due_reason})`,
          null,
          hubId
        );

        toast.success('Manual old due recorded successfully');
      }

      setManualModalOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save manual due');
    } finally {
      setSavingManualDue(false);
    }
  };

  const handleDeleteOrCancelDue = async (d: Due) => {
    const recAmt = safeAmount(d.recovered_amount);
    const empName = d.collector?.name ?? 'Employee';
    const amountStr = formatINR(d.original_amount);

    if (recAmt > 0) {
      const ok = await confirm({
        title: 'Cancel / Void Due?',
        message: `This due record has existing recoveries of ${formatINR(recAmt)}. Cancelling it will void the remaining backlog of ${formatINR(d.remaining_amount)} without deleting historical recovery transactions.`,
        confirmLabel: 'Cancel Due',
        danger: true,
      });
      if (!ok) return;

      try {
        const payload = {
          status: 'cancelled' as DueStatus,
          remaining_amount: 0,
          notes: `${d.notes ? `${d.notes} | ` : ''}[Cancelled by ${profile?.name ?? 'Admin'}]`,
          updated_at: new Date().toISOString(),
        };

        if (navigator.onLine) {
          const { error } = await supabase.from('dues').update(payload).eq('id', d.id);
          if (error) throw error;
        }
        await db.dues.update(d.id, payload as any);
        await addToQueue(profile?.id || '', d.hub_id, 'dues', 'UPDATE', { id: d.id, ...payload });

        toast.success('Due marked as cancelled');
        load();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to cancel due');
      }
    } else {
      const ok = await confirm({
        title: 'Delete Due Record?',
        message: `Permanently delete ${amountStr} due record for ${empName}?`,
        confirmLabel: 'Delete Record',
        danger: true,
      });
      if (!ok) return;

      try {
        if (navigator.onLine) {
          const { error } = await supabase.from('dues').delete().eq('id', d.id);
          if (error) throw error;
        }
        await db.dues.delete(d.id);
        await addToQueue(profile?.id || '', d.hub_id, 'dues', 'DELETE', { id: d.id });

        toast.success('Due record deleted');
        load();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to delete due');
      }
    }
  };

  const handleRecovery = async () => {
    if (!recoveryForDue) return;
    const amount = safeAmount(recoveryAmount);
    if (amount <= 0) { toast.error('Enter a valid recovery amount'); return; }
    if (amount > safeAmount(recoveryForDue.remaining_amount)) {
      toast.error('Recovery amount exceeds remaining due');
      return;
    }

    setSavingRecovery(true);
    try {
      const recId = uuidv4();
      const payload = {
        id: recId,
        collector_id: recoveryForDue.collector_id,
        hub_id: recoveryForDue.hub_id,
        due_id: recoveryForDue.id,
        recovery_date: toISODate(new Date()),
        amount,
        payment_mode: recoveryMode as any,
        reference_number: recoveryRef.trim() || null,
        notes: recoveryNotes.trim() || null,
        created_by: profile?.id ?? null,
        created_at: new Date().toISOString(),
      };

      if (!navigator.onLine) {
        await db.recoveries.put(payload as any);
        const newRecovered = safeAmount(recoveryForDue.recovered_amount) + amount;
        const newRemaining = Math.max(0, safeAmount(recoveryForDue.original_amount) - newRecovered);
        const newStatus: DueStatus = newRemaining === 0 ? 'fully_recovered' : 'partially_recovered';

        await db.dues.update(recoveryForDue.id, {
          recovered_amount: newRecovered,
          remaining_amount: newRemaining,
          status: newStatus,
          updated_at: new Date().toISOString(),
        });

        await addToQueue(profile?.id || '', recoveryForDue.hub_id, 'recoveries', 'INSERT', payload);
      } else {
        const { error } = await supabase.rpc('record_recovery_transaction', {
          p_due_id: recoveryForDue.id,
          p_collector_id: recoveryForDue.collector_id,
          p_hub_id: recoveryForDue.hub_id,
          p_amount: amount,
          p_payment_mode: recoveryMode,
          p_reference_number: recoveryRef.trim() || null,
          p_notes: recoveryNotes.trim() || null,
          p_user_id: profile?.id ?? null,
          p_recovery_date: toISODate(new Date()),
        });
        if (error) throw error;
      }

      await logAudit(
        'recovery_record',
        profile?.id ?? null,
        `Recorded recovery of ${formatINR(amount)} for due ${recoveryForDue.id}`,
        null,
        recoveryForDue.hub_id
      );

      toast.success(`Recovery of ${formatINR(amount)} recorded`);
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

  const handleExportDuesExcel = () => {
    const rows = filtered.map(d => ({
      'Due Date': formatDate(d.due_date),
      'Employee Name': d.collector?.name || '—',
      'Employee ID': d.collector?.employee_id || '—',
      Source: d.source === 'manual_old_due' || d.collection_entry_id === null ? 'Manual Old Due' : 'Collection Shortage',
      Reason: d.due_reason || (d.collection_entry_id ? 'Collection Shortage' : 'Old Due'),
      'Original Due': safeAmount(d.original_amount),
      Recovered: safeAmount(d.recovered_amount),
      Remaining: safeAmount(d.remaining_amount),
      Status: statusConfig[d.status]?.label || d.status,
      Reference: d.reference_number || '—',
      Remarks: d.notes || '—',
    }));

    if (rows.length === 0) {
      toast.warning('No dues to export');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dues Management');
    XLSX.writeFile(wb, `dues_export_${toISODate(new Date())}.xlsx`);
    toast.success('Dues exported to Excel');
  };

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      {/* 1. Header & Main Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Dues & Recovery Management
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-neutral-500">
            Track collection shortages, old manual dues, and employee recovery transactions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <Button
              variant="outline"
              icon={<Plus className="h-4 w-4 text-amber-500" />}
              onClick={openAddManualDue}
              className="min-h-[44px] px-3.5 text-xs sm:text-sm font-semibold border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
            >
              + Add Old Due
            </Button>
          )}

          <Button
            variant="outline"
            icon={<Download className="h-4 w-4" />}
            onClick={handleExportDuesExcel}
            className="min-h-[44px] text-xs font-semibold"
          >
            Export Dues
          </Button>

          <Button
            icon={<UsersIcon className="h-4 w-4" />}
            onClick={() => setShowOutstandingModal(true)}
            className="min-h-[44px] px-4 text-xs sm:text-sm font-semibold"
          >
            Outstanding Summary
          </Button>
        </div>
      </div>

      {/* 2. Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-4">
        <Card className="p-4 border-red-500/20 bg-red-500/5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-neutral-500 truncate">Total Outstanding</p>
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-bold text-red-500 tabular-nums truncate">
            {formatINR(stats.totalOutstanding)}
          </p>
          <p className="mt-1 text-xs text-neutral-400">{stats.employeesWithDues} employees pending</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-neutral-500 truncate">Total Dues Issued</p>
            <TrendingDown className="h-4 w-4 text-amber-500 shrink-0" />
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums truncate">
            {formatINR(stats.totalDuesIssued)}
          </p>
          <p className="mt-1 text-xs text-neutral-400">{stats.manualDuesCount} manual old dues</p>
        </Card>

        <Card className="p-4 border-brand-500/20 bg-brand-500/5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-neutral-500 truncate">Recovered This Month</p>
            <CheckCircle2 className="h-4 w-4 text-brand-600 shrink-0" />
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-bold text-brand-600 dark:text-brand-400 tabular-nums truncate">
            {formatINR(stats.recoveredThisMonth)}
          </p>
          <p className="mt-1 text-xs text-neutral-400">Total recoveries month-to-date</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-neutral-500 truncate">Active Due Records</p>
            <Clock className="h-4 w-4 text-blue-500 shrink-0" />
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums truncate">
            {dues.filter(d => d.status !== 'cancelled').length}
          </p>
          <p className="mt-1 text-xs text-neutral-400">Shortages + Old Dues</p>
        </Card>
      </div>

      {/* 3. Filters Toolbar */}
      <Card className="p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-neutral-500 mb-1">Search Employee / Details</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, Employee ID, reason, reference..."
                className="input-base pl-9 py-2 text-sm min-h-[44px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-500 mb-1">Status Filter</label>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
              <option value="all">All Statuses</option>
              <option value="outstanding">Outstanding</option>
              <option value="partially_recovered">Partially Recovered</option>
              <option value="fully_recovered">Fully Recovered</option>
              <option value="cancelled">Cancelled / Voided</option>
            </Select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-500 mb-1">Source Filter</label>
            <Select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as any)}>
              <option value="all">All Sources</option>
              <option value="collection_shortage">Collection Shortage</option>
              <option value="manual_old_due">Manual Old Due</option>
            </Select>
          </div>
        </div>

        {/* Quick Filter Pills */}
        <div className="flex items-center gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
          <span className="text-xs font-semibold text-neutral-500">Quick Filters:</span>
          <button
            onClick={() => setSourceFilter(sourceFilter === 'manual_old_due' ? 'all' : 'manual_old_due')}
            className={clsx(
              'px-3 py-1 rounded-full text-xs font-bold transition-colors min-h-[32px] flex items-center gap-1',
              sourceFilter === 'manual_old_due'
                ? 'bg-amber-500 text-neutral-950 font-extrabold'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
            )}
          >
            <Tag className="h-3 w-3" /> Old Dues Only
          </button>
          <button
            onClick={() => setStatusFilter(statusFilter === 'outstanding' ? 'all' : 'outstanding')}
            className={clsx(
              'px-3 py-1 rounded-full text-xs font-bold transition-colors min-h-[32px] flex items-center gap-1',
              statusFilter === 'outstanding'
                ? 'bg-red-500 text-white font-extrabold'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
            )}
          >
            <AlertCircle className="h-3 w-3" /> Outstanding Only
          </button>
        </div>
      </Card>

      {/* 4. SECTION 4: Derived Employee Summary (Always Visible) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <UsersIcon className="h-4 w-4 text-brand-600" />
            Employee Dues Summary ({employeeSummaryRows.length} Employees)
          </h2>
          <span className="text-xs text-neutral-500">Click Ledger button for itemized employee timeline</span>
        </div>

        {loading ? (
          <Card className="p-6 flex justify-center"><Spinner className="h-6 w-6" /></Card>
        ) : employeeSummaryRows.length === 0 ? (
          <Card className="p-6">
            <EmptyState icon={<UsersIcon className="h-8 w-8" />} title="No employee summary records" message="No matching employee dues found." />
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 dark:bg-neutral-950/80 text-neutral-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold">Employee</th>
                    <th className="text-right px-4 py-3 font-semibold">Entries</th>
                    <th className="text-right px-4 py-3 font-semibold">Total Original</th>
                    <th className="text-right px-4 py-3 font-semibold text-emerald-600">Total Recovered</th>
                    <th className="text-right px-4 py-3 font-semibold text-red-500">Outstanding</th>
                    <th className="text-center px-4 py-3 font-semibold">Recovery %</th>
                    <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Oldest Due</th>
                    <th className="text-center px-4 py-3 font-semibold">Status</th>
                    <th className="text-right px-5 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {employeeSummaryRows.map((emp) => (
                    <tr key={emp.collectorId} className="group hover:bg-neutral-50 dark:hover:bg-neutral-950/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-bold text-neutral-900 dark:text-neutral-100">{emp.collectorName}</p>
                        <p className="text-xs text-neutral-400 font-mono">{emp.employeeId} · {emp.phone}</p>
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium tabular-nums">{emp.dueEntryCount}</td>
                      <td className="px-4 py-3.5 text-right font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">{formatINR(emp.totalOriginalDue)}</td>
                      <td className="px-4 py-3.5 text-right font-medium text-emerald-600 tabular-nums">{formatINR(emp.totalRecovered)}</td>
                      <td className={clsx('px-4 py-3.5 text-right font-bold tabular-nums', emp.currentOutstanding > 0 ? 'text-red-500' : 'text-neutral-400')}>
                        {formatINR(emp.currentOutstanding)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <div className="inline-flex items-center gap-1">
                          <div className="w-12 bg-neutral-200 dark:bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-brand-600 h-1.5 rounded-full" style={{ width: `${Math.min(100, emp.recoveryPercentage)}%` }} />
                          </div>
                          <span className="text-xs font-bold tabular-nums">{emp.recoveryPercentage}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-neutral-500 text-xs hidden lg:table-cell">{formatDate(emp.oldestDueDate)}</td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={clsx(
                          'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold',
                          emp.status === 'Fully Recovered' ? 'bg-brand-500/10 text-brand-600 ring-brand-500/30' :
                          emp.status === 'Partially Recovered' ? 'bg-amber-500/10 text-amber-500 ring-amber-500/30' :
                          'bg-red-500/10 text-red-500 ring-red-500/30'
                        )}>
                          {emp.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canManage && emp.currentOutstanding > 0 && emp.dueRecords[0] && (
                            <Button size="sm" onClick={() => setRecoveryForDue(emp.dueRecords[0])} className="min-h-[36px] px-2.5 text-xs font-semibold">
                              + Recover
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => setSearch(emp.employeeId)} className="min-h-[36px] px-2.5 text-xs" title="Filter individual dues for this employee">
                            View Dues
                          </Button>
                          {emp.collector && (
                            <Button size="sm" variant="outline" icon={<BookOpen className="h-3.5 w-3.5 text-brand-600" />} onClick={() => setSelectedLedgerCollector(emp.collector)} className="min-h-[36px] px-2.5 text-xs font-semibold border-brand-500/30 text-brand-600 hover:bg-brand-500/10" title="Open employee ledger timeline">
                              Ledger
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
        )}
      </div>

      {/* 5. SECTION 5: Individual Dues Records (Collapsible Panel with Mobile Cards) */}
      <div className="space-y-3">
        {/* Collapsible Header */}
        <div
          role="button"
          tabIndex={0}
          aria-expanded={isIndividualDuesExpanded}
          aria-controls="individual-dues-panel"
          onClick={() => setIsIndividualDuesExpanded(prev => !prev)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsIndividualDuesExpanded(prev => !prev);
            }
          }}
          className="flex items-center justify-between p-4 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-200/70 dark:hover:bg-neutral-800/80 cursor-pointer select-none transition-colors"
        >
          <div>
            <h2 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              Individual Dues Records ({filtered.length} Records)
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">{filtered.length} matching dues</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-neutral-500 hidden sm:inline">
              {isIndividualDuesExpanded ? 'Collapse' : 'Expand'}
            </span>
            <div className={clsx('h-8 w-8 rounded-lg bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center transition-transform duration-300', isIndividualDuesExpanded && 'rotate-180')}>
              <ChevronDown className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
            </div>
          </div>
        </div>

        {/* Collapsible Panel Body */}
        {isIndividualDuesExpanded && (
          <div id="individual-dues-panel" className="space-y-3">
            {loading ? (
              <Card className="p-8 flex justify-center"><Spinner className="h-6 w-6" /></Card>
            ) : filtered.length === 0 ? (
              <Card>
                <EmptyState icon={<AlertCircle className="h-8 w-8" />} title="No individual dues found" message="No matching due records found." />
              </Card>
            ) : (
              <>
                {/* Mobile View: Cards (Strictly visible on screens < 768px / md:hidden) */}
                <div className="grid grid-cols-1 gap-3 md:hidden w-full max-w-full">
                  {filtered.map((d) => {
                    const isManual = d.source === 'manual_old_due' || d.collection_entry_id === null;
                    const cfg = statusConfig[d.status] || statusConfig.outstanding;

                    return (
                      <Card key={d.id} className="p-4 space-y-3 border border-neutral-200 dark:border-neutral-800 w-full min-w-0">
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-2.5">
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-neutral-900 dark:text-neutral-100 truncate">{d.collector?.name ?? '—'}</p>
                            <p className="text-xs text-neutral-400 font-mono mt-0.5">{d.collector?.employee_id ?? 'N/A'}</p>
                          </div>
                          <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 shrink-0', cfg.badge)}>
                            {cfg.label}
                          </span>
                        </div>

                        {/* Card Body Details */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <p className="text-neutral-500">Due Date</p>
                            <p className="font-semibold text-neutral-800 dark:text-neutral-200 tabular-nums">{formatDate(d.due_date)}</p>
                          </div>
                          <div>
                            <p className="text-neutral-500">Source</p>
                            {isManual ? (
                              <span className="inline-flex items-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-amber-500/30">
                                MANUAL OLD DUE
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-md bg-neutral-500/10 text-neutral-500 px-1.5 py-0.5 text-[10px] font-medium">
                                SHORTAGE
                              </span>
                            )}
                          </div>
                          <div className="col-span-2">
                            <p className="text-neutral-500">Reason</p>
                            <p className="font-medium text-neutral-800 dark:text-neutral-200 truncate">
                              {d.due_reason || (isManual ? 'Old Due' : 'Collection Shortage')}
                            </p>
                          </div>
                        </div>

                        {/* Amount Grid */}
                        <div className="grid grid-cols-3 gap-1.5 p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-950 text-center text-xs border border-neutral-200/60 dark:border-neutral-800/60">
                          <div>
                            <p className="text-neutral-500 text-[11px]">Original</p>
                            <p className="font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">{formatINR(d.original_amount)}</p>
                          </div>
                          <div>
                            <p className="text-emerald-600 text-[11px]">Recovered</p>
                            <p className="font-bold text-emerald-600 tabular-nums">{formatINR(d.recovered_amount)}</p>
                          </div>
                          <div>
                            <p className="text-red-500 text-[11px]">Remaining</p>
                            <p className={clsx('font-bold tabular-nums', safeAmount(d.remaining_amount) > 0 ? 'text-red-500' : 'text-neutral-400')}>
                              {formatINR(d.remaining_amount)}
                            </p>
                          </div>
                        </div>

                        {/* Card Footer Actions (Minimum 44px touch targets) */}
                        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                          <Button size="sm" variant="outline" onClick={() => setDetailDue(d)} className="min-h-[44px] text-xs font-semibold px-3 flex-1 sm:flex-initial">
                            View
                          </Button>

                          {canManage && d.status !== 'fully_recovered' && d.status !== 'cancelled' && (
                            <Button size="sm" onClick={() => setRecoveryForDue(d)} className="min-h-[44px] text-xs font-semibold px-3 flex-1 sm:flex-initial">
                              + Recover
                            </Button>
                          )}

                          {canManage && isManual && (
                            <Button size="sm" variant="outline" onClick={() => openEditManualDue(d)} className="min-h-[44px] text-xs font-semibold px-3 flex-1 sm:flex-initial" title="Edit manual due">
                              Edit
                            </Button>
                          )}

                          {canManage && (
                            <Button size="sm" variant="outline" onClick={() => handleDeleteOrCancelDue(d)} className="min-h-[44px] text-xs font-semibold px-3 flex-1 sm:flex-initial text-red-500 border-red-500/20 hover:bg-red-500/10" title="Delete or cancel due">
                              Delete
                            </Button>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>

                {/* Desktop View: Table (Strictly visible on screens >= 768px / hidden md:block) */}
                <Card className="hidden md:block overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-neutral-50 dark:bg-neutral-950/80 text-neutral-500 text-xs uppercase tracking-wide">
                        <tr>
                          <th className="text-left px-5 py-3 font-semibold">Due Date</th>
                          <th className="text-left px-4 py-3 font-semibold">Employee</th>
                          <th className="text-left px-4 py-3 font-semibold">Source</th>
                          <th className="text-left px-4 py-3 font-semibold">Reason</th>
                          <th className="text-right px-4 py-3 font-semibold">Original</th>
                          <th className="text-right px-4 py-3 font-semibold text-emerald-600">Recovered</th>
                          <th className="text-right px-4 py-3 font-semibold text-red-500">Remaining</th>
                          <th className="text-center px-4 py-3 font-semibold">Status</th>
                          <th className="text-right px-5 py-3 font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                        {filtered.map((d) => {
                          const isManual = d.source === 'manual_old_due' || d.collection_entry_id === null;
                          const cfg = statusConfig[d.status] || statusConfig.outstanding;

                          return (
                            <tr key={d.id} className="group hover:bg-neutral-50 dark:hover:bg-neutral-950/70 transition-colors">
                              <td className="px-5 py-3.5 font-semibold text-neutral-800 dark:text-neutral-200 tabular-nums">
                                {formatDate(d.due_date)}
                              </td>
                              <td className="px-4 py-3.5">
                                <p className="font-bold text-neutral-900 dark:text-neutral-100">{d.collector?.name ?? '—'}</p>
                                <p className="text-xs text-neutral-400 font-mono">{d.collector?.employee_id ?? 'N/A'}</p>
                              </td>
                              <td className="px-4 py-3.5">
                                {isManual ? (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 text-[11px] font-bold ring-1 ring-amber-500/30">
                                    MANUAL OLD DUE
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-neutral-500/10 text-neutral-500 px-2 py-0.5 text-[11px] font-medium">
                                    SHORTAGE
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-neutral-700 dark:text-neutral-300 font-medium text-xs">
                                {d.due_reason || (isManual ? 'Old Due' : 'Collection Shortage')}
                              </td>
                              <td className="px-4 py-3.5 text-right tabular-nums font-bold text-neutral-900 dark:text-neutral-100">
                                {formatINR(d.original_amount)}
                              </td>
                              <td className="px-4 py-3.5 text-right tabular-nums text-emerald-600 font-medium">
                                {formatINR(d.recovered_amount)}
                              </td>
                              <td className={clsx('px-4 py-3.5 text-right tabular-nums font-bold', safeAmount(d.remaining_amount) > 0 ? 'text-red-500' : 'text-neutral-400')}>
                                {formatINR(d.remaining_amount)}
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1', cfg.badge)}>
                                  {cfg.label}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button size="sm" variant="outline" onClick={() => setDetailDue(d)} className="min-h-[36px] px-2.5 text-xs">
                                    <Eye className="h-3.5 w-3.5 text-neutral-500" />
                                  </Button>

                                  {canManage && d.status !== 'fully_recovered' && d.status !== 'cancelled' && (
                                    <Button size="sm" onClick={() => setRecoveryForDue(d)} className="min-h-[36px] px-3 text-xs font-semibold">
                                      + Recover
                                    </Button>
                                  )}

                                  {canManage && isManual && (
                                    <Button size="sm" variant="outline" onClick={() => openEditManualDue(d)} className="min-h-[36px] px-2.5 text-xs" title="Edit manual due">
                                      <Edit3 className="h-3.5 w-3.5 text-blue-500" />
                                    </Button>
                                  )}

                                  {canManage && (
                                    <Button size="sm" variant="outline" onClick={() => handleDeleteOrCancelDue(d)} className="min-h-[36px] px-2.5 text-xs text-red-500 hover:bg-red-500/10" title="Delete or cancel due">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
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
              </>
            )}
          </div>
        )}
      </div>

      {/* 6. MODALS & DRAWERS */}

      {/* Manual Old Due Entry / Edit Modal */}
      <Modal
        open={manualModalOpen}
        onClose={() => setManualModalOpen(false)}
        title={editingManualDue ? 'Edit Manual Due' : '+ Record Manual / Old Due Entry'}
        subtitle="Historical ya purana due record karein. Yeh Dashboard collection totals ko affect nahi karega."
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setManualModalOpen(false)} disabled={savingManualDue} className="min-h-[44px]">Cancel</Button>
            <Button onClick={handleSaveManualDue} loading={savingManualDue} disabled={savingManualDue} className="min-h-[44px]">
              {editingManualDue ? 'Update Due' : 'Save Old Due Entry'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Due Date"
            type="date"
            value={manualForm.due_date}
            onChange={(e) => setManualForm((f) => ({ ...f, due_date: e.target.value }))}
          />

          <Select
            label="Employee / Collector"
            value={manualForm.collector_id}
            onChange={(e) => setManualForm((f) => ({ ...f, collector_id: e.target.value }))}
          >
            <option value="">Select Employee…</option>
            {collectors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.employee_id}
              </option>
            ))}
          </Select>

          {(isSuperAdmin || hubCtx.isAllHubs) && hubCtx.accessibleHubs.length > 0 && (
            <Select
              label="Hub"
              value={manualForm.hub_id}
              onChange={(e) => setManualForm((f) => ({ ...f, hub_id: e.target.value }))}
            >
              {hubCtx.accessibleHubs.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </Select>
          )}

          <Input
            label="Due Amount (₹)"
            type="number"
            value={manualForm.original_amount}
            onChange={(e) => setManualForm((f) => ({ ...f, original_amount: e.target.value }))}
            placeholder="e.g. 5000"
          />

          <Select
            label="Due Reason"
            value={manualForm.due_reason}
            onChange={(e) => setManualForm((f) => ({ ...f, due_reason: e.target.value }))}
          >
            {DUE_REASONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </Select>

          <Input
            label="Reference Number / Slip (optional)"
            value={manualForm.reference_number}
            onChange={(e) => setManualForm((f) => ({ ...f, reference_number: e.target.value }))}
            placeholder="e.g. REF-2026-001"
          />

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
              Remarks {manualForm.due_reason === 'Other' && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={manualForm.notes}
              onChange={(e) => setManualForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="Notes regarding this old due entry..."
              className="input-base resize-none"
            />
          </div>
        </div>
      </Modal>

      {/* Record Recovery Modal */}
      {recoveryForDue && (
        <Modal
          open={!!recoveryForDue}
          onClose={() => setRecoveryForDue(null)}
          title="Record Recovery Payment"
          subtitle={`Recovering due for ${recoveryForDue.collector?.name ?? 'Employee'}`}
          size="md"
          footer={
            <>
              <Button variant="outline" onClick={() => setRecoveryForDue(null)} disabled={savingRecovery} className="min-h-[44px]">Cancel</Button>
              <Button onClick={handleRecovery} loading={savingRecovery} disabled={savingRecovery} className="min-h-[44px]">Record Recovery</Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="rounded-xl bg-neutral-100 dark:bg-neutral-900 p-4 space-y-1">
              <p className="text-xs text-neutral-500">Original Due: {formatINR(recoveryForDue.original_amount)}</p>
              <p className="text-sm font-bold text-red-500">Remaining Backlog: {formatINR(recoveryForDue.remaining_amount)}</p>
            </div>

            <Input
              label="Recovery Amount (₹)"
              type="number"
              value={recoveryAmount}
              onChange={(e) => setRecoveryAmount(e.target.value)}
              placeholder="Amount recovered"
            />

            <Select
              label="Payment Mode"
              value={recoveryMode}
              onChange={(e) => setRecoveryMode(e.target.value)}
            >
              <option value="cash">Cash</option>
              <option value="online">Online / UPI</option>
              <option value="other">Other / Salary Adjustment</option>
            </Select>

            <Input
              label="Reference Number (optional)"
              value={recoveryRef}
              onChange={(e) => setRecoveryRef(e.target.value)}
              placeholder="Transaction ID / Slip No."
            />

            <textarea
              value={recoveryNotes}
              onChange={(e) => setRecoveryNotes(e.target.value)}
              rows={2}
              placeholder="Recovery notes..."
              className="input-base resize-none"
            />
          </div>
        </Modal>
      )}

      {/* Due Detail Drawer / Modal */}
      {detailDue && (
        <Modal
          open={!!detailDue}
          onClose={() => setDetailDue(null)}
          title="Due Record Itemized Details"
          subtitle={`Due ID: ${detailDue.id}`}
          size="md"
          footer={
            <Button variant="outline" onClick={() => setDetailDue(null)} className="min-h-[44px] px-5">Close</Button>
          }
        >
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3 bg-neutral-50 dark:bg-neutral-950 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
              <div>
                <p className="text-xs text-neutral-500">Employee Name</p>
                <p className="font-bold text-neutral-900 dark:text-neutral-100">{detailDue.collector?.name ?? '—'}</p>
                <p className="text-xs text-neutral-400 font-mono">{detailDue.collector?.employee_id ?? 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Hub</p>
                <p className="font-semibold text-neutral-800 dark:text-neutral-200">{detailDue.hub?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Due Date</p>
                <p className="font-semibold">{formatDate(detailDue.due_date)}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Source</p>
                <p className="font-bold text-amber-500">
                  {detailDue.source === 'manual_old_due' || detailDue.collection_entry_id === null ? 'MANUAL OLD DUE' : 'COLLECTION SHORTAGE'}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Due Reason</p>
                <p className="font-semibold">{detailDue.due_reason || 'Collection Shortage'}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Reference Number</p>
                <p className="font-mono">{detailDue.reference_number || '—'}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-neutral-100 dark:bg-neutral-900 p-3 rounded-lg">
                <p className="text-xs text-neutral-500">Original Amount</p>
                <p className="font-bold text-neutral-900 dark:text-neutral-100">{formatINR(detailDue.original_amount)}</p>
              </div>
              <div className="bg-emerald-500/10 p-3 rounded-lg">
                <p className="text-xs text-emerald-500">Recovered</p>
                <p className="font-bold text-emerald-600">{formatINR(detailDue.recovered_amount)}</p>
              </div>
              <div className="bg-red-500/10 p-3 rounded-lg">
                <p className="text-xs text-red-500">Remaining</p>
                <p className="font-bold text-red-500">{formatINR(detailDue.remaining_amount)}</p>
              </div>
            </div>

            {detailDue.notes && (
              <div className="p-3 bg-neutral-100 dark:bg-neutral-900 rounded-lg">
                <p className="text-xs font-semibold text-neutral-500 mb-1">Remarks / Notes</p>
                <p className="text-xs text-neutral-700 dark:text-neutral-300 italic">{detailDue.notes}</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Outstanding Summary Modal */}
      <Modal
        open={showOutstandingModal}
        onClose={() => setShowOutstandingModal(false)}
        title="Outstanding Dues Summary"
        subtitle="Employee-wise total pending dues backlog"
        size="lg"
        footer={<Button variant="outline" onClick={() => setShowOutstandingModal(false)} className="min-h-[44px]">Close</Button>}
      >
        <div className="space-y-4">
          <Input placeholder="Search employee..." value={modalSearch} onChange={(e) => setModalSearch(e.target.value)} />
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredModalSummary.map((group) => (
              <Card key={group.collectorId} className="p-3 flex justify-between items-center hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors">
                <div>
                  <p className="font-bold text-neutral-900 dark:text-neutral-100">{group.collectorName} ({group.employeeId})</p>
                  <p className="text-xs text-neutral-500">{group.dueEntryCount} due records · Phone: {group.phone}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-red-500 tabular-nums">{formatINR(group.currentOutstanding)}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </Modal>

      {/* 7. SECTION 7: Employee Ledger Drawer/Modal */}
      {selectedLedgerCollector && (
        <Modal
          open={!!selectedLedgerCollector}
          onClose={() => setSelectedLedgerCollector(null)}
          title={`Employee Ledger — ${selectedLedgerCollector.name}`}
          subtitle={`Employee ID: ${selectedLedgerCollector.employee_id} · Phone: ${selectedLedgerCollector.phone || 'N/A'}`}
          size="lg"
          footer={
            <div className="flex items-center justify-between w-full">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" icon={<Download className="h-4 w-4" />} onClick={handleExportLedgerExcel} className="min-h-[44px]">Export Excel</Button>
              </div>
              <Button variant="outline" onClick={() => setSelectedLedgerCollector(null)} className="min-h-[44px] px-5">Close Ledger</Button>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Ledger Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-neutral-50 dark:bg-neutral-950 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800">
              <Input
                placeholder="Search ledger entries..."
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
              />
              <Input
                type="date"
                label="Start Date"
                value={ledgerStartDate}
                onChange={(e) => setLedgerStartDate(e.target.value)}
              />
              <Input
                type="date"
                label="End Date"
                value={ledgerEndDate}
                onChange={(e) => setLedgerEndDate(e.target.value)}
              />
            </div>

            {/* Ledger Timeline Table */}
            <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-neutral-100 dark:bg-neutral-900 text-neutral-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Date</th>
                    <th className="text-left px-4 py-3 font-semibold">Type</th>
                    <th className="text-right px-4 py-3 font-semibold">Original Due</th>
                    <th className="text-right px-4 py-3 font-semibold text-emerald-600">Recovered</th>
                    <th className="text-right px-4 py-3 font-semibold text-red-500">Running Balance</th>
                    <th className="text-left px-4 py-3 font-semibold">Mode</th>
                    <th className="text-left px-4 py-3 font-semibold">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {filteredLedgerEvents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-6 text-neutral-500">No ledger transactions found.</td>
                    </tr>
                  ) : (
                    filteredLedgerEvents.map((evt) => (
                      <tr key={evt.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-950/70 transition-colors">
                        <td className="px-4 py-3 font-medium tabular-nums">{formatDate(evt.dateStr)}</td>
                        <td className="px-4 py-3">
                          <span className={clsx(
                            'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold',
                            evt.eventType === 'recovery' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                          )}>
                            {evt.typeLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums">
                          {evt.originalDue !== null ? formatINR(evt.originalDue) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600 tabular-nums">
                          {evt.recovered !== null ? formatINR(evt.recovered) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-red-500 tabular-nums">
                          {formatINR(evt.runningBalance)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{evt.paymentMode}</td>
                        <td className="px-4 py-3 text-xs text-neutral-600 dark:text-neutral-400 italic">{evt.remarks}</td>
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
