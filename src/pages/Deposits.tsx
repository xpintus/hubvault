import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Landmark, Search, Plus, Trash2, Banknote, TrendingDown,
  Wallet, Calendar, FileBarChart, Edit3, Eye, ArrowRight,
  X, CheckCircle2, RotateCcw, Clock, Building2,
  Download, AlertCircle, FileText, Smartphone, UserCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '@/lib/auth';
import { useHub } from '@/lib/hubContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { Button, Card, EmptyState, Skeleton, Spinner, Input, Select } from '@/components/ui/primitives';
import Modal from '@/components/ui/Modal';
import { confirm } from '@/lib/confirm';
import { CollectionEntry, CmsDeposit, Due, Recovery, Collector, STATUS_LABELS, DUE_STATUS_LABELS } from '@/types';
import { formatINR, formatDate, toISODate } from '@/lib/format';
import { subDays } from 'date-fns';
import { clsx } from 'clsx';
import { logAudit } from '@/lib/audit';

type DetailType =
  | 'total_expected_cod'
  | 'total_collection'
  | 'cash_collected'
  | 'online_collected'
  | 'collection_shortage'
  | 'total_expected_cms'
  | 'total_cms_submitted'
  | 'cms_pending_deposit'
  | 'deposit_count'
  | null;

const safeAmount = (val: any): number => {
  if (val === null || val === undefined) return 0;
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  return isNaN(num) ? 0 : num;
};

// Backward-compatible helper function to normalize total submitted amount from any CMS deposit record
export function getTotalCmsSubmitted(deposit: CmsDeposit): number {
  const splitTotal = safeAmount(deposit.cash_submitted) + safeAmount(deposit.online_submitted);
  if (splitTotal > 0) return splitTotal;
  return safeAmount(deposit.total_deposited ?? deposit.cash_deposited ?? (deposit as any).amount);
}

const SHORTAGE_REASONS = [
  'Cash not handed over',
  'Cash mismatch',
  'Wrong collection entry',
  'Employee pending',
  'Deposit not made',
  'Partial deposit',
  'Counting error',
  'Online payment mismatch',
  'Other',
];

// Employee CMS Ledger Row Schema
export interface EmployeeCmsLedgerRow {
  collectorId: string;
  collectorName: string;
  employeeId: string;
  collectionDate: string;
  hubId: string;
  hubName: string;
  cashReceived: number;
  onlineReceived: number;
  totalExpectedCms: number; // cashReceived + onlineReceived
  totalSubmitted: number; // sum of all valid CMS submissions
  cmsPending: number; // max(totalExpectedCms - totalSubmitted, 0)
  cmsExcess: number; // max(totalSubmitted - totalExpectedCms, 0)
  status: 'Fully Submitted' | 'Partially Submitted' | 'Not Submitted' | 'Over Submitted';
  lastSubmissionDate: string | null;
  submissionCount: number;
  remarks: string[];
}

// Daily Date Row Schema for main CMS table
export interface DailyCmsRow {
  date: string;
  hubId: string;
  hubName: string;
  expectedCod: number;
  cashReceived: number;
  onlineReceived: number;
  totalCollection: number; // cashReceived + onlineReceived
  collectionShortage: number; // max(expectedCod - totalCollection, 0)
  totalExpectedCms: number; // cashReceived + onlineReceived
  totalSubmitted: number; // sum of deposits
  cmsPending: number; // max(totalExpectedCms - totalSubmitted, 0)
  cmsExcess: number; // max(totalSubmitted - totalExpectedCms, 0)
  status: 'Fully Submitted' | 'Partially Submitted' | 'Not Submitted' | 'Over Submitted';
  depositCount: number;
  references: string[];
  remarks: string[];
}

interface FormState {
  deposit_date: string;
  hub_id: string;
  amount_submitted: string;
  reference_number: string;
  remarks: string;
}

const emptyForm: FormState = {
  deposit_date: toISODate(new Date()),
  hub_id: '',
  amount_submitted: '',
  reference_number: '',
  remarks: '',
};

interface EmpSubmissionFormState {
  collector_id: string;
  collection_date: string;
  submission_date: string;
  hub_id: string;
  amount_submitted: string;
  reference_number: string;
  bank_name: string;
  remarks: string;
}

const emptyEmpSubmissionForm: EmpSubmissionFormState = {
  collector_id: '',
  collection_date: toISODate(new Date()),
  submission_date: toISODate(new Date()),
  hub_id: '',
  amount_submitted: '',
  reference_number: '',
  bank_name: '',
  remarks: '',
};

interface ShortageFormState {
  shortage_date: string;
  hub_id: string;
  collector_id: string;
  expected_cod: string;
  cash_collected: string;
  online_amount: string;
  reason: string;
  remarks: string;
}

const emptyShortageForm: ShortageFormState = {
  shortage_date: toISODate(new Date()),
  hub_id: '',
  collector_id: '',
  expected_cod: '',
  cash_collected: '',
  online_amount: '',
  reason: 'Cash not handed over',
  remarks: '',
};

interface RecoveryFormState {
  recovery_date: string;
  amount: string;
  payment_mode: 'cash' | 'online' | 'other';
  reference_number: string;
  notes: string;
}

export default function DepositsPage() {
  const { profile } = useAuth();
  const hubCtx = useHub();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [deposits, setDeposits] = useState<CmsDeposit[]>([]);
  const [entries, setEntries] = useState<CollectionEntry[]>([]);
  const [dues, setDues] = useState<Due[]>([]);
  const [recoveries, setRecoveries] = useState<Recovery[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);

  const [search, setSearch] = useState('');
  const [from, setFrom] = useState(toISODate(subDays(new Date(), 29)));
  const [to, setTo] = useState(toISODate(new Date()));
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState<string>('all');

  // Record CMS Submission Modal
  const [empSubmissionModalOpen, setEmpSubmissionModalOpen] = useState(false);
  const [empSubmissionForm, setEmpSubmissionForm] = useState<EmpSubmissionFormState>(emptyEmpSubmissionForm);
  const [empSubmissionSaving, setEmpSubmissionSaving] = useState(false);

  // General Deposit Form modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CmsDeposit | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Shortage Entry Modal
  const [shortageModalOpen, setShortageModalOpen] = useState(false);
  const [shortageForm, setShortageForm] = useState<ShortageFormState>(emptyShortageForm);
  const [shortageSaving, setShortageSaving] = useState(false);

  // Recovery Modal
  const [recoveryModalOpen, setRecoveryModalOpen] = useState(false);
  const [recoveryTargetDue, setRecoveryTargetDue] = useState<Due | null>(null);
  const [recoveryForm, setRecoveryForm] = useState<RecoveryFormState>({
    recovery_date: toISODate(new Date()),
    amount: '',
    payment_mode: 'cash',
    reference_number: '',
    notes: '',
  });
  const [recoverySaving, setRecoverySaving] = useState(false);

  // Card & Employee Detail Drawer
  const [activeDetail, setActiveDetail] = useState<DetailType>(null);
  const [selectedLedgerRow, setSelectedLedgerRow] = useState<EmployeeCmsLedgerRow | null>(null);
  const [detailSearch, setDetailSearch] = useState('');
  const [detailFilterStatus, setDetailFilterStatus] = useState('all');
  const [detailFilterReason, setDetailFilterReason] = useState('all');
  const [detailFilterRecovery, setDetailFilterRecovery] = useState('all');
  const [detailFilterEmployee, setDetailFilterEmployee] = useState('all');
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  const canManage = ['super_admin', 'hub_admin', 'supervisor'].includes(profile?.role ?? '');
  const isSuperAdmin = profile?.role === 'super_admin';
  const activeHubId = hubCtx.selectedHubId;

  // Load all required data
  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const effectiveHubId = hubCtx.selectedHubId;

    try {
      // 1. Fetch collectors
      let colQ = supabase.from('collectors').select('*').order('name');
      if (effectiveHubId) colQ = colQ.eq('hub_id', effectiveHubId);
      const { data: cols } = await colQ;
      setCollectors(cols ?? []);

      // 2. Fetch CMS Deposits
      let depQ = supabase
        .from('cms_deposits')
        .select('*, hub: hubs(*), collector: collectors(*)')
        .gte('deposit_date', from)
        .lte('deposit_date', to)
        .order('created_at', { ascending: false });
      if (effectiveHubId) depQ = depQ.eq('hub_id', effectiveHubId);
      const { data: depData, error: depErr } = await depQ;
      if (depErr) throw depErr;
      setDeposits((depData ?? []) as CmsDeposit[]);

      // 3. Fetch Collection Entries
      let entQ = supabase
        .from('collection_entries')
        .select('*, collector: collectors(*), hub: hubs(*)')
        .gte('collection_date', from)
        .lte('collection_date', to)
        .order('collection_date', { ascending: false });
      if (effectiveHubId) entQ = entQ.eq('hub_id', effectiveHubId);
      const { data: entData, error: entErr } = await entQ;
      if (entErr) throw entErr;
      setEntries((entData ?? []) as CollectionEntry[]);

      // 4. Fetch Dues
      let dueQ = supabase
        .from('dues')
        .select('*, collector: collectors(*), hub: hubs(*)')
        .order('due_date', { ascending: false });
      if (effectiveHubId) dueQ = dueQ.eq('hub_id', effectiveHubId);
      const { data: dueData, error: dueErr } = await dueQ;
      if (dueErr) throw dueErr;
      setDues(dueData ?? []);

      // 5. Fetch Recoveries
      let recQ = supabase
        .from('recoveries')
        .select('*, collector: collectors(*), hub: hubs(*)')
        .gte('recovery_date', from)
        .lte('recovery_date', to)
        .order('recovery_date', { ascending: false });
      if (effectiveHubId) recQ = recQ.eq('hub_id', effectiveHubId);
      const { data: recData, error: recErr } = await recQ;
      if (recErr) throw recErr;
      setRecoveries(recData ?? []);

    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load deposition data');
    } finally {
      setLoading(false);
    }
  }, [profile, hubCtx.selectedHubId, from, to, toast]);

  useEffect(() => { load(); }, [load]);

  // Section 1: Field Collection Summary Metrics
  const collectionStats = useMemo(() => {
    const totalExpectedCod = entries.reduce((s, e) => s + safeAmount(e.expected_cod), 0);
    const totalCollection = entries.reduce((s, e) => s + safeAmount(e.total_collection), 0);
    const totalCash = entries.reduce((s, e) => s + safeAmount(e.cash_amount), 0);
    const totalOnline = entries.reduce((s, e) => s + safeAmount(e.online_amount), 0);
    
    // Collection Shortage = expected_cod - (cash + online)
    const collectionShortage = entries
      .filter((e) => safeAmount(e.total_collection) < safeAmount(e.expected_cod))
      .reduce((s, e) => s + (safeAmount(e.expected_cod) - safeAmount(e.total_collection)), 0);

    return {
      totalExpectedCod,
      totalCollection,
      totalCash,
      totalOnline,
      collectionShortage,
      entryCount: entries.length,
    };
  }, [entries]);

  // Section 3: Employee CMS Ledger Aggregation
  // Groups entries and deposits by Employee ID (`collector_id`) and `collection_date`
  const employeeLedgerRows = useMemo<EmployeeCmsLedgerRow[]>(() => {
    const map = new Map<string, { collectorId: string; collectionDate: string; hubId: string }>();

    entries.forEach((e) => {
      if (e.collector_id) {
        const key = `${e.collector_id}_${e.collection_date}`;
        if (!map.has(key)) {
          map.set(key, { collectorId: e.collector_id, collectionDate: e.collection_date, hubId: e.hub_id });
        }
      }
    });

    deposits.forEach((d) => {
      if (d.collector_id) {
        const cDate = d.collection_date || d.deposit_date;
        const key = `${d.collector_id}_${cDate}`;
        if (!map.has(key)) {
          map.set(key, { collectorId: d.collector_id, collectionDate: cDate, hubId: d.hub_id });
        }
      }
    });

    const rows: EmployeeCmsLedgerRow[] = [];

    map.forEach(({ collectorId, collectionDate, hubId }) => {
      const collector = collectors.find(c => c.id === collectorId);
      const empName = collector?.name ?? '—';
      const empId = collector?.employee_id ?? '—';
      const hubObj = collector?.hub;
      const hubName = hubObj?.name ?? '—';

      const empEntries = entries.filter(e => e.collector_id === collectorId && e.collection_date === collectionDate);
      const cashReceived = empEntries.reduce((s, e) => s + safeAmount(e.cash_amount), 0);
      const onlineReceived = empEntries.reduce((s, e) => s + safeAmount(e.online_amount), 0);

      // Total Expected CMS = Cash Received + Online Received
      const totalExpectedCms = cashReceived + onlineReceived;

      // Total CMS Submitted = sum of all valid submissions for this employee and date
      const empDeposits = deposits.filter(d => (d.collector_id === collectorId || !d.collector_id) && (d.collection_date === collectionDate || d.deposit_date === collectionDate));
      const totalSubmitted = empDeposits.reduce((s, d) => s + getTotalCmsSubmitted(d), 0);

      // Unified CMS Pending formula: max(Total Expected CMS - Total Submitted, 0)
      const cmsPending = Math.max(0, totalExpectedCms - totalSubmitted);
      const cmsExcess = Math.max(0, totalSubmitted - totalExpectedCms);

      // Status determination
      let status: EmployeeCmsLedgerRow['status'] = 'Not Submitted';
      if (totalSubmitted > totalExpectedCms) {
        status = 'Over Submitted';
      } else if (totalSubmitted === 0 && totalExpectedCms > 0) {
        status = 'Not Submitted';
      } else if (totalSubmitted > 0 && totalSubmitted < totalExpectedCms) {
        status = 'Partially Submitted';
      } else if (totalSubmitted === totalExpectedCms) {
        status = 'Fully Submitted';
      } else if (totalExpectedCms === 0 && totalSubmitted === 0) {
        status = 'Fully Submitted';
      }

      const remarksList = empDeposits.map(d => d.remarks).filter(Boolean) as string[];
      const lastSubmissionDate = empDeposits.length > 0 ? empDeposits[0].deposit_date : null;

      rows.push({
        collectorId,
        collectorName: empName,
        employeeId: empId,
        collectionDate,
        hubId,
        hubName,
        cashReceived,
        onlineReceived,
        totalExpectedCms,
        totalSubmitted,
        cmsPending,
        cmsExcess,
        status,
        lastSubmissionDate,
        submissionCount: empDeposits.length,
        remarks: remarksList,
      });
    });

    return rows.sort((a, b) => b.collectionDate.localeCompare(a.collectionDate));
  }, [entries, deposits, collectors]);

  // Main Page Daily Date Rows Aggregation
  const dailyRows = useMemo<DailyCmsRow[]>(() => {
    const map = new Map<string, { date: string; hubId: string; hubName: string }>();

    entries.forEach((e) => {
      const key = `${e.collection_date}_${e.hub_id}`;
      if (!map.has(key)) {
        map.set(key, { date: e.collection_date, hubId: e.hub_id, hubName: e.hub?.name ?? '—' });
      }
    });

    deposits.forEach((d) => {
      const cDate = d.collection_date || d.deposit_date;
      const key = `${cDate}_${d.hub_id}`;
      if (!map.has(key)) {
        map.set(key, { date: cDate, hubId: d.hub_id, hubName: d.hub?.name ?? '—' });
      }
    });

    const rows: DailyCmsRow[] = [];

    map.forEach(({ date, hubId, hubName }) => {
      const dateEntries = entries.filter((e) => e.collection_date === date && e.hub_id === hubId);
      const dateDeposits = deposits.filter((d) => (d.collection_date === date || d.deposit_date === date) && d.hub_id === hubId);

      const cashReceived = dateEntries.reduce((s, e) => s + safeAmount(e.cash_amount), 0);
      const onlineReceived = dateEntries.reduce((s, e) => s + safeAmount(e.online_amount), 0);
      const expectedCod = dateEntries.reduce((s, e) => s + safeAmount(e.expected_cod), 0);
      const totalCollection = cashReceived + onlineReceived;

      const collectionShortage = Math.max(0, expectedCod - totalCollection);

      // Total Expected CMS = Cash Received + Online Received
      const totalExpectedCms = cashReceived + onlineReceived;
      const totalSubmitted = dateDeposits.reduce((s, d) => s + getTotalCmsSubmitted(d), 0);

      const cmsPending = Math.max(0, totalExpectedCms - totalSubmitted);
      const cmsExcess = Math.max(0, totalSubmitted - totalExpectedCms);

      let status: DailyCmsRow['status'] = 'Not Submitted';
      if (totalSubmitted > totalExpectedCms) {
        status = 'Over Submitted';
      } else if (totalSubmitted === 0 && totalExpectedCms > 0) {
        status = 'Not Submitted';
      } else if (totalSubmitted > 0 && totalSubmitted < totalExpectedCms) {
        status = 'Partially Submitted';
      } else if (totalSubmitted === totalExpectedCms) {
        status = 'Fully Submitted';
      } else if (totalExpectedCms === 0 && totalSubmitted === 0) {
        status = 'Fully Submitted';
      }

      const references = dateDeposits.map(d => d.reference_number || d.cash_reference || d.online_reference).filter(Boolean) as string[];
      const remarks = dateDeposits.map(d => d.remarks).filter(Boolean) as string[];

      rows.push({
        date,
        hubId,
        hubName,
        expectedCod,
        cashReceived,
        onlineReceived,
        totalCollection,
        collectionShortage,
        totalExpectedCms,
        totalSubmitted,
        cmsPending,
        cmsExcess,
        status,
        depositCount: dateDeposits.length,
        references,
        remarks,
      });
    });

    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, deposits]);

  // Main Page Ledger Search & Status Filtering
  const filteredLedgerRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employeeLedgerRows.filter((r) => {
      if (ledgerStatusFilter === 'cms_pending' && r.cmsPending <= 0) return false;
      if (ledgerStatusFilter === 'submitted' && r.totalSubmitted <= 0) return false;
      if (ledgerStatusFilter === 'fully_submitted' && r.status !== 'Fully Submitted') return false;
      if (ledgerStatusFilter === 'partially_submitted' && r.status !== 'Partially Submitted') return false;
      if (ledgerStatusFilter === 'not_submitted' && r.status !== 'Not Submitted') return false;
      if (ledgerStatusFilter === 'over_submitted' && r.status !== 'Over Submitted') return false;

      if (!q) return true;
      const name = r.collectorName.toLowerCase();
      const empId = r.employeeId.toLowerCase();
      const date = r.collectionDate.toLowerCase();
      return name.includes(q) || empId.includes(q) || date.includes(q);
    });
  }, [employeeLedgerRows, ledgerStatusFilter, search]);

  // Main Table Search Filtered Daily Rows
  const filteredDailyRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return dailyRows;
    return dailyRows.filter((r) => {
      const dateStr = r.date.toLowerCase();
      const hub = r.hubName.toLowerCase();
      const refs = r.references.join(' ').toLowerCase();
      return dateStr.includes(q) || hub.includes(q) || refs.includes(q);
    });
  }, [dailyRows, search]);

  // Section 2: CMS Submission Summary Cards (derived directly from visible employee ledger rows)
  const cmsSubmissionStats = useMemo(() => {
    const totalExpectedCms = filteredLedgerRows.reduce((s, r) => s + r.totalExpectedCms, 0);
    const totalCmsSubmitted = filteredLedgerRows.reduce((s, r) => s + r.totalSubmitted, 0);
    // CMS Pending Deposit summary card = sum of row-level CMS pending amounts
    const cmsPending = filteredLedgerRows.reduce((s, r) => s + Math.max(0, r.totalExpectedCms - r.totalSubmitted), 0);

    return {
      totalExpectedCms,
      totalCmsSubmitted,
      cmsPending,
      depositCount: deposits.length,
    };
  }, [filteredLedgerRows, deposits.length]);

  // Record CMS Submission Modal Actions
  const openAddEmpSubmission = (prefillRow?: EmployeeCmsLedgerRow) => {
    const presetHub = prefillRow?.hubId || activeHubId || (hubCtx.accessibleHubs[0]?.id ?? '');
    const defaultCol = prefillRow?.collectorId || (collectors[0]?.id ?? '');
    const defaultDate = prefillRow?.collectionDate || toISODate(new Date());

    setEmpSubmissionForm({
      collector_id: defaultCol,
      collection_date: defaultDate,
      submission_date: toISODate(new Date()),
      hub_id: presetHub,
      amount_submitted: prefillRow ? String(prefillRow.cmsPending) : '',
      reference_number: '',
      bank_name: '',
      remarks: '',
    });
    setEmpSubmissionModalOpen(true);
  };

  // Live calculation preview for Record CMS Submission
  const empSubmissionPreview = useMemo(() => {
    const colId = empSubmissionForm.collector_id;
    const cDate = empSubmissionForm.collection_date;
    if (!colId || !cDate) return null;

    const matchedEntries = entries.filter(e => e.collector_id === colId && e.collection_date === cDate);
    const cashReceived = matchedEntries.reduce((s, e) => s + safeAmount(e.cash_amount), 0);
    const onlineReceived = matchedEntries.reduce((s, e) => s + safeAmount(e.online_amount), 0);
    const totalExpectedCms = cashReceived + onlineReceived;

    const priorDeposits = deposits.filter(d => (d.collector_id === colId || !d.collector_id) && (d.collection_date === cDate || d.deposit_date === cDate));
    const alreadySubmitted = priorDeposits.reduce((s, d) => s + getTotalCmsSubmitted(d), 0);

    const newSubmission = safeAmount(empSubmissionForm.amount_submitted);
    const totalAfterSubmission = alreadySubmitted + newSubmission;

    const remainingPending = Math.max(0, totalExpectedCms - totalAfterSubmission);
    const isOverSubmission = totalAfterSubmission > totalExpectedCms;

    return {
      cashReceived,
      onlineReceived,
      totalExpectedCms,
      alreadySubmitted,
      newSubmission,
      totalAfterSubmission,
      remainingPending,
      isOverSubmission,
    };
  }, [empSubmissionForm, entries, deposits]);

  const handleSaveEmpSubmission = async () => {
    const hubId = empSubmissionForm.hub_id || activeHubId;
    if (!hubId) { toast.error('Please select a hub first'); return; }
    if (!empSubmissionForm.collector_id) { toast.error('Please select an employee'); return; }
    if (!empSubmissionForm.collection_date) { toast.error('Select a collection date'); return; }

    const newSubmission = safeAmount(empSubmissionForm.amount_submitted);

    if (newSubmission <= 0) { toast.error('CMS Submitted Amount must be greater than ₹0'); return; }

    if (empSubmissionPreview?.isOverSubmission && !empSubmissionForm.remarks.trim()) {
      toast.error('Over-submission detected. Mandatory remarks are required.');
      return;
    }

    setEmpSubmissionSaving(true);
    try {
      const collectorObj = collectors.find(c => c.id === empSubmissionForm.collector_id);

      const payload = {
        deposit_date: empSubmissionForm.submission_date,
        collection_date: empSubmissionForm.collection_date,
        collector_id: empSubmissionForm.collector_id,
        hub_id: hubId,
        total_cash_collected: empSubmissionPreview?.cashReceived ?? 0,
        cash_deposited: newSubmission,
        online_amount: empSubmissionPreview?.onlineReceived ?? 0,
        total_expected_cms: empSubmissionPreview?.totalExpectedCms ?? newSubmission,
        total_deposited: newSubmission,
        cash_submitted: newSubmission,
        online_submitted: 0,
        total_submitted: newSubmission,
        reference_number: empSubmissionForm.reference_number.trim() || null,
        bank_name: empSubmissionForm.bank_name.trim() || null,
        remarks: empSubmissionForm.remarks.trim() || null,
        status: empSubmissionPreview?.isOverSubmission ? 'over_submitted' : 'submitted',
        created_by: profile?.id ?? null,
      };

      const { error } = await supabase.from('cms_deposits').insert(payload);
      if (error) throw error;

      await logAudit(
        'employee_cms_submission_create',
        profile?.id ?? null,
        `Recorded CMS submission of ${formatINR(newSubmission)} for ${collectorObj?.name ?? 'Employee'} for date ${formatDate(empSubmissionForm.collection_date)}`,
        null,
        hubId
      );

      toast.success('CMS submission recorded');
      setEmpSubmissionModalOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save submission');
    } finally {
      setEmpSubmissionSaving(false);
    }
  };

  // General Deposit Form Modal Actions
  const openAddDeposit = () => {
    const presetHub = activeHubId || (hubCtx.accessibleHubs[0]?.id ?? '');
    setForm({ ...emptyForm, hub_id: presetHub });
    setEditing(null);
    setModalOpen(true);
  };

  const openEditDeposit = (d: CmsDeposit) => {
    setEditing(d);
    setForm({
      deposit_date: d.deposit_date,
      hub_id: d.hub_id,
      amount_submitted: String(getTotalCmsSubmitted(d)),
      reference_number: d.reference_number ?? '',
      remarks: d.remarks ?? '',
    });
    setModalOpen(true);
  };

  const handleSaveGeneralDeposit = async () => {
    const hubId = form.hub_id || activeHubId;
    if (!hubId) { toast.error('Please select a hub first'); return; }
    const submitted = safeAmount(form.amount_submitted);
    if (!form.deposit_date) { toast.error('Select a deposit date'); return; }
    if (submitted <= 0) { toast.error('Submitted amount must be greater than ₹0'); return; }

    setSaving(true);
    try {
      const payload = {
        deposit_date: form.deposit_date,
        collection_date: form.deposit_date,
        hub_id: hubId,
        total_cash_collected: submitted,
        cash_deposited: submitted,
        online_amount: 0,
        total_expected_cms: submitted,
        total_deposited: submitted,
        cash_submitted: submitted,
        online_submitted: 0,
        total_submitted: submitted,
        short_amount: 0,
        reference_number: form.reference_number.trim() || null,
        remarks: form.remarks.trim() || null,
      };

      if (editing) {
        const { error } = await supabase.from('cms_deposits').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast.success('Deposit updated');
      } else {
        const { error } = await supabase.from('cms_deposits').insert({ ...payload, created_by: profile?.id ?? null });
        if (error) throw error;
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

  const handleDeleteDeposit = async (d: CmsDeposit) => {
    const ok = await confirm({
      title: 'Delete this submission record?',
      message: `This will remove the CMS deposit record dated ${formatDate(d.deposit_date)}.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      const { error } = await supabase.from('cms_deposits').delete().eq('id', d.id);
      if (error) throw error;
      toast.success('Deposit record deleted');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete deposit');
    }
  };

  // Add Shortage Entry Handlers
  const openAddShortage = () => {
    const presetHub = activeHubId || (hubCtx.accessibleHubs[0]?.id ?? '');
    setShortageForm({ ...emptyShortageForm, hub_id: presetHub });
    setShortageModalOpen(true);
  };

  const handleShortageCollectorChange = (colId: string) => {
    setShortageForm((f) => {
      const match = entries.find(e => e.collector_id === colId && e.collection_date === f.shortage_date);
      if (match) {
        return {
          ...f,
          collector_id: colId,
          expected_cod: String(match.expected_cod),
          cash_collected: String(match.cash_amount),
          online_amount: String(match.online_amount),
        };
      }
      return { ...f, collector_id: colId };
    });
  };

  const calculatedShortageAmount = useMemo(() => {
    const exp = safeAmount(shortageForm.expected_cod);
    const cash = safeAmount(shortageForm.cash_collected);
    const online = safeAmount(shortageForm.online_amount);
    const total = cash + online;
    return exp > total ? exp - total : 0;
  }, [shortageForm.expected_cod, shortageForm.cash_collected, shortageForm.online_amount]);

  const handleSaveShortage = async () => {
    const hubId = shortageForm.hub_id || activeHubId;
    if (!hubId) { toast.error('Please select a hub first'); return; }
    if (!shortageForm.collector_id) { toast.error('Please select an employee'); return; }
    if (!shortageForm.shortage_date) { toast.error('Select a shortage date'); return; }
    if (shortageForm.reason === 'Other' && !shortageForm.remarks.trim()) {
      toast.error('Remarks are required when reason is Other');
      return;
    }
    if (calculatedShortageAmount <= 0) {
      toast.error('Calculated shortage must be greater than 0');
      return;
    }

    setShortageSaving(true);
    try {
      const exp = safeAmount(shortageForm.expected_cod);
      const cash = safeAmount(shortageForm.cash_collected);
      const online = safeAmount(shortageForm.online_amount);
      const total = cash + online;
      const gap = total - exp;

      const existingEntry = entries.find(e => e.collector_id === shortageForm.collector_id && e.collection_date === shortageForm.shortage_date);
      let entryId = existingEntry?.id;
      const reasonNote = `Reason: ${shortageForm.reason}${shortageForm.remarks ? ` | ${shortageForm.remarks.trim()}` : ''}`;

      if (existingEntry) {
        const { error } = await supabase.from('collection_entries').update({
          expected_cod: exp,
          cash_amount: cash,
          online_amount: online,
          total_collection: total,
          gap,
          status: 'shortage',
          remarks: reasonNote,
        }).eq('id', existingEntry.id);
        if (error) throw error;
      } else {
        const { data: newEntry, error } = await supabase.from('collection_entries').insert({
          collection_date: shortageForm.shortage_date,
          collector_id: shortageForm.collector_id,
          hub_id: hubId,
          expected_cod: exp,
          cash_amount: cash,
          online_amount: online,
          total_collection: total,
          gap,
          status: 'shortage',
          remarks: reasonNote,
          created_by: profile?.id ?? null,
        }).select().single();
        if (error) throw error;
        entryId = newEntry.id;
      }

      const { data: existingDue } = await supabase
        .from('dues')
        .select('id, recovered_amount')
        .eq('collector_id', shortageForm.collector_id)
        .eq('due_date', shortageForm.shortage_date)
        .maybeSingle();

      if (existingDue) {
        const rec = safeAmount(existingDue.recovered_amount);
        const rem = Math.max(0, calculatedShortageAmount - rec);
        await supabase.from('dues').update({
          original_amount: calculatedShortageAmount,
          remaining_amount: rem,
          notes: reasonNote,
          status: rem === 0 ? 'fully_recovered' : rec > 0 ? 'partially_recovered' : 'outstanding',
        }).eq('id', existingDue.id);
      } else {
        await supabase.from('dues').insert({
          collector_id: shortageForm.collector_id,
          hub_id: hubId,
          collection_entry_id: entryId,
          original_amount: calculatedShortageAmount,
          remaining_amount: calculatedShortageAmount,
          recovered_amount: 0,
          due_date: shortageForm.shortage_date,
          status: 'outstanding',
          notes: reasonNote,
          created_by: profile?.id ?? null,
        });
      }

      toast.success('Shortage entry recorded');
      setShortageModalOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record shortage entry');
    } finally {
      setShortageSaving(false);
    }
  };

  // Recovery Handler
  const openRecoveryModal = (due: Due) => {
    setRecoveryTargetDue(due);
    setRecoveryForm({
      recovery_date: toISODate(new Date()),
      amount: String(due.remaining_amount),
      payment_mode: 'cash',
      reference_number: '',
      notes: '',
    });
    setRecoveryModalOpen(true);
  };

  const handleSaveRecovery = async () => {
    if (!recoveryTargetDue) return;
    const amt = safeAmount(recoveryForm.amount);
    if (amt <= 0) { toast.error('Recovery amount must be greater than 0'); return; }

    setRecoverySaving(true);
    try {
      const { error: recErr } = await supabase.from('recoveries').insert({
        collector_id: recoveryTargetDue.collector_id,
        hub_id: recoveryTargetDue.hub_id,
        due_id: recoveryTargetDue.id,
        recovery_date: recoveryForm.recovery_date,
        amount: amt,
        payment_mode: recoveryForm.payment_mode,
        reference_number: recoveryForm.reference_number.trim() || null,
        notes: recoveryForm.notes.trim() || null,
        created_by: profile?.id ?? null,
      });
      if (recErr) throw recErr;

      const newRecovered = safeAmount(recoveryTargetDue.recovered_amount) + amt;
      const newRemaining = Math.max(0, safeAmount(recoveryTargetDue.original_amount) - newRecovered);
      const newStatus = newRemaining === 0 ? 'fully_recovered' : 'partially_recovered';

      await supabase.from('dues').update({
        recovered_amount: newRecovered,
        remaining_amount: newRemaining,
        status: newStatus,
        updated_at: new Date().toISOString(),
      }).eq('id', recoveryTargetDue.id);

      toast.success('Recovery recorded');
      setRecoveryModalOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record recovery');
    } finally {
      setRecoverySaving(false);
    }
  };

  const handleMarkWrittenOff = async (due: Due) => {
    const ok = await confirm({
      title: 'Mark shortage as Written Off?',
      message: `This will clear remaining backlog of ${formatINR(due.remaining_amount)} for ${due.collector?.name ?? 'Employee'}.`,
      confirmLabel: 'Mark Written Off',
      danger: true,
    });
    if (!ok) return;

    try {
      await supabase.from('dues').update({
        status: 'fully_recovered',
        remaining_amount: 0,
        notes: `${due.notes ? `${due.notes} | ` : ''}[Written Off by ${profile?.name ?? 'Admin'}]`,
        updated_at: new Date().toISOString(),
      }).eq('id', due.id);
      toast.success('Shortage marked as written off');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  // Card Drill-Down Handlers
  const handleCardClick = (type: DetailType) => {
    setActiveDetail(type);
    if (type === 'cms_pending_deposit') setLedgerStatusFilter('cms_pending');
    else if (type === 'total_cms_submitted') setLedgerStatusFilter('submitted');
  };

  // Export Ledger Rows to Excel
  const handleExportLedger = () => {
    const rows = filteredLedgerRows.map(r => ({
      Date: r.collectionDate,
      Hub: r.hubName,
      Employee: r.collectorName,
      'Emp ID': r.employeeId,
      'Cash Received': r.cashReceived,
      'Online Received': r.onlineReceived,
      'Total Expected CMS': r.totalExpectedCms,
      'Total CMS Submitted': r.totalSubmitted,
      'CMS Pending': r.cmsPending,
      'CMS Excess': r.cmsExcess,
      Status: r.status,
    }));

    if (rows.length === 0) {
      toast.warning('No ledger rows to export');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employee CMS Ledger');
    XLSX.writeFile(wb, `employee_cms_ledger_${from}_to_${to}.xlsx`);
    toast.success(`Exported ${rows.length} employee ledger rows`);
  };

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            CMS Deposition & Employee Ledger
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-neutral-500">
            Track bank cash & online CMS submissions, manage employee CMS ledgers, and resolve deposition backlogs.
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs sm:text-sm text-neutral-500">
            <Calendar className="h-4 w-4 text-neutral-500" />
            <span>{formatDate(from)} — {formatDate(to)}</span>
            {hubCtx.selectedHub && (
              <>
                <span>·</span>
                <Building2 className="h-4 w-4 text-neutral-500" />
                <span className="font-semibold text-neutral-800 dark:text-neutral-200">{hubCtx.selectedHub.name}</span>
              </>
            )}
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <Button
              icon={<UserCheck className="h-4 w-4" />}
              onClick={() => openAddEmpSubmission()}
              className="min-h-[44px] px-3.5 text-xs sm:text-sm font-semibold shadow-glow"
            >
              Record CMS Submission
            </Button>
          )}
          {canManage && (
            <Button
              variant="outline"
              icon={<Plus className="h-4 w-4 text-amber-500" />}
              onClick={openAddShortage}
              className="min-h-[44px] px-3 text-xs sm:text-sm font-semibold border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
            >
              + Shortage Entry
            </Button>
          )}
          {canManage && (
            <Button
              variant="outline"
              icon={<Landmark className="h-4 w-4" />}
              onClick={openAddDeposit}
              className="min-h-[44px] px-3 text-xs sm:text-sm font-semibold"
            >
              Record Deposit
            </Button>
          )}
        </div>
      </div>

      {/* SECTION 1: Collection Summary (Field Collection Totals) */}
      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          Collection Summary (Field Collection Totals)
        </p>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            <Card hover onClick={() => handleCardClick('total_expected_cod')} className="p-4 cursor-pointer min-w-0">
              <p className="text-xs text-neutral-500 truncate">Total Expected COD</p>
              <p className="mt-1 text-lg sm:text-xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums truncate">
                {formatINR(collectionStats.totalExpectedCod)}
              </p>
              <p className="mt-1 text-[11px] text-neutral-500">{collectionStats.entryCount} entries</p>
            </Card>

            <Card hover onClick={() => handleCardClick('total_collection')} className="p-4 cursor-pointer min-w-0">
              <p className="text-xs text-neutral-500 truncate">Total Collection</p>
              <p className="mt-1 text-lg sm:text-xl font-bold text-blue-600 dark:text-blue-400 tabular-nums truncate">
                {formatINR(collectionStats.totalCollection)}
              </p>
              <p className="mt-1 text-[11px] text-blue-500/80">{collectionStats.entryCount} entries</p>
            </Card>

            <Card hover onClick={() => handleCardClick('cash_collected')} className="p-4 cursor-pointer min-w-0">
              <p className="text-xs text-neutral-500 truncate">Cash Collected</p>
              <p className="mt-1 text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums truncate">
                {formatINR(collectionStats.totalCash)}
              </p>
              <p className="mt-1 text-[11px] text-neutral-500">Physical cash</p>
            </Card>

            <Card hover onClick={() => handleCardClick('online_collected')} className="p-4 cursor-pointer min-w-0">
              <p className="text-xs text-neutral-500 truncate">Online Collected</p>
              <p className="mt-1 text-lg sm:text-xl font-bold text-blue-600 dark:text-blue-400 tabular-nums truncate">
                {formatINR(collectionStats.totalOnline)}
              </p>
              <p className="mt-1 text-[11px] text-neutral-500">Digital payments</p>
            </Card>

            <Card hover onClick={() => handleCardClick('collection_shortage')} className="p-4 cursor-pointer col-span-2 sm:col-span-1 min-w-0 border-red-500/20">
              <div className="flex items-center justify-between">
                <p className="text-xs text-neutral-500 truncate">Collection Shortage</p>
                {collectionStats.collectionShortage > 0 && (
                  <span className="text-[10px] font-extrabold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded">SHORT</span>
                )}
              </div>
              <p className={clsx('mt-1 text-lg sm:text-xl font-bold tabular-nums truncate', collectionStats.collectionShortage > 0 ? 'text-red-500' : 'text-emerald-500')}>
                {formatINR(collectionStats.collectionShortage)}
              </p>
              <p className="mt-1 text-[11px] text-neutral-500">Expected COD − Collection</p>
            </Card>
          </div>
        )}
      </div>

      {/* SECTION 2: CMS Submission Summary (Both Cash & Online) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            CMS Summary (Combined Cash + Online CMS Submissions)
          </p>
          <span className="text-[11px] text-neutral-500">Click cards to filter Employee CMS Ledger</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-4">
            {/* Total Expected CMS */}
            <Card hover onClick={() => handleCardClick('total_expected_cms')} className="p-4 cursor-pointer min-w-0">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-brand-500/10 text-brand-600 flex items-center justify-center font-bold">
                  <Banknote className="h-5 w-5" />
                </div>
                <p className="text-xs font-medium text-neutral-500 truncate">Total Expected CMS</p>
              </div>
              <p className="mt-2 text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums truncate">
                {formatINR(cmsSubmissionStats.totalExpectedCms)}
              </p>
              <p className="mt-1 text-xs text-neutral-400">Cash + Online collected</p>
            </Card>

            {/* Total CMS Submitted */}
            <Card hover onClick={() => handleCardClick('total_cms_submitted')} className="p-4 cursor-pointer min-w-0">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
                  <Landmark className="h-5 w-5" />
                </div>
                <p className="text-xs font-medium text-neutral-500 truncate">Total CMS Submitted</p>
              </div>
              <p className="mt-2 text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums truncate">
                {formatINR(cmsSubmissionStats.totalCmsSubmitted)}
              </p>
              <p className="mt-1 text-xs text-neutral-400">Actual bank/CMS deposits</p>
            </Card>

            {/* CMS Pending Deposit */}
            <Card hover onClick={() => handleCardClick('cms_pending_deposit')} className={clsx('p-4 cursor-pointer min-w-0 border-red-500/20', cmsSubmissionStats.cmsPending > 0 && 'bg-red-500/5')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center font-bold">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-semibold text-red-500 truncate">CMS Pending Deposit</p>
                </div>
                {cmsSubmissionStats.cmsPending > 0 && (
                  <span className="text-[10px] font-extrabold text-red-500 bg-red-500/10 px-2 py-0.5 rounded uppercase">PENDING</span>
                )}
              </div>
              <p className={clsx('mt-2 text-xl sm:text-2xl font-bold tabular-nums truncate', cmsSubmissionStats.cmsPending > 0 ? 'text-red-500 dark:text-red-400' : 'text-emerald-500')}>
                {formatINR(cmsSubmissionStats.cmsPending)}
              </p>
              <p className="mt-1 text-xs text-neutral-400">Total Expected CMS − Submitted</p>
            </Card>

            {/* Deposit Count */}
            <Card hover onClick={() => handleCardClick('deposit_count')} className="p-4 cursor-pointer min-w-0">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
                  <FileBarChart className="h-5 w-5" />
                </div>
                <p className="text-xs font-medium text-neutral-500 truncate">Deposit Count</p>
              </div>
              <p className="mt-2 text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums truncate">
                {cmsSubmissionStats.depositCount}
              </p>
              <p className="mt-1 text-xs text-neutral-400">Valid submission records</p>
            </Card>
          </div>
        )}
      </div>

      {/* SECTION 3: Filters & Search Toolbar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">From Date</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input-base py-2 text-sm min-h-[44px]" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">To Date</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input-base py-2 text-sm min-h-[44px]" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">Ledger Status Filter</label>
            <Select
              value={ledgerStatusFilter}
              onChange={(e) => setLedgerStatusFilter(e.target.value)}
              className="min-h-[44px] text-xs"
            >
              <option value="all">All Ledger Statuses</option>
              <option value="cms_pending">CMS Pending (&gt; ₹0)</option>
              <option value="submitted">Has Submissions</option>
              <option value="fully_submitted">Fully Submitted</option>
              <option value="partially_submitted">Partially Submitted</option>
              <option value="not_submitted">Not Submitted</option>
              <option value="over_submitted">Over Submitted</option>
            </Select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">Search Employee / Date</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, Emp ID, Date..."
                className="input-base pl-9 py-2 text-sm min-h-[44px]"
              />
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between pt-3 border-t border-neutral-200 dark:border-neutral-800">
          <Button variant="outline" size="sm" icon={<Download className="h-4 w-4" />} onClick={handleExportLedger} className="min-h-[44px] text-xs font-semibold">
            Export Employee Ledger Excel
          </Button>
          <span className="text-xs text-neutral-500">{filteredLedgerRows.length} employee-date rows shown</span>
        </div>
      </Card>

      {/* SECTION 4: Dedicated Employee CMS Ledger */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-brand-600" />
            Employee CMS Ledger
          </h2>
          <span className="text-xs text-neutral-500">Grouped by Employee ID & Collection Date</span>
        </div>

        {loading ? (
          <Card className="p-8 flex justify-center"><Spinner className="h-6 w-6" /></Card>
        ) : filteredLedgerRows.length === 0 ? (
          <Card>
            <EmptyState
              icon={<UserCheck className="h-8 w-8" />}
              title="No employee ledger rows found"
              message={search || ledgerStatusFilter !== 'all' ? 'Try clearing active filters.' : 'Collection entries will populate employee ledger rows.'}
            />
          </Card>
        ) : (
          <Card className="overflow-hidden">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 dark:bg-neutral-950/80 text-neutral-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold">Employee</th>
                    <th className="text-left px-4 py-3 font-semibold">Date</th>
                    <th className="text-right px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">Cash Received</th>
                    <th className="text-right px-4 py-3 font-semibold text-blue-600 dark:text-blue-400">Online Received</th>
                    <th className="text-right px-4 py-3 font-semibold">Total Expected CMS</th>
                    <th className="text-right px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">Total CMS Submitted</th>
                    <th className="text-right px-4 py-3 font-semibold text-red-500">CMS Pending</th>
                    <th className="text-right px-4 py-3 font-semibold text-blue-500">CMS Excess</th>
                    <th className="text-center px-4 py-3 font-semibold">Status</th>
                    <th className="text-right px-5 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {filteredLedgerRows.map((r) => (
                    <tr
                      key={`${r.collectorId}_${r.collectionDate}`}
                      onClick={() => setSelectedLedgerRow(r)}
                      className="group hover:bg-neutral-50 dark:hover:bg-neutral-950/70 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-neutral-900 dark:text-neutral-100">{r.collectorName}</div>
                        <div className="text-xs text-neutral-500 font-mono">{r.employeeId}</div>
                      </td>
                      <td className="px-4 py-3.5 text-neutral-600 dark:text-neutral-400 tabular-nums">{formatDate(r.collectionDate)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">{formatINR(r.cashReceived)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-blue-600 dark:text-blue-400 font-medium">{formatINR(r.onlineReceived)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-bold text-neutral-800 dark:text-neutral-200">{formatINR(r.totalExpectedCms)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{formatINR(r.totalSubmitted)}</td>
                      <td className={clsx('px-4 py-3.5 text-right tabular-nums font-bold', r.cmsPending > 0 ? 'text-red-500 dark:text-red-400' : 'text-emerald-500')}>{formatINR(r.cmsPending)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-blue-500">{formatINR(r.cmsExcess)}</td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={clsx(
                          'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold',
                          r.status === 'Fully Submitted' ? 'bg-emerald-500/10 text-emerald-500' :
                          r.status === 'Partially Submitted' ? 'bg-amber-500/10 text-amber-500' :
                          r.status === 'Over Submitted' ? 'bg-blue-500/10 text-blue-500' :
                          'bg-red-500/10 text-red-500'
                        )}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {canManage && r.cmsPending > 0 && (
                            <Button
                              size="sm"
                              onClick={() => openAddEmpSubmission(r)}
                              className="min-h-[44px] text-xs font-semibold px-3"
                            >
                              + Record Submission
                            </Button>
                          )}
                          <button
                            onClick={() => setSelectedLedgerRow(r)}
                            className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 min-h-[44px] min-w-[44px] flex items-center justify-center"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Card View */}
            <div className="divide-y divide-neutral-200 dark:divide-neutral-800 md:hidden">
              {filteredLedgerRows.map((r) => (
                <div
                  key={`${r.collectorId}_${r.collectionDate}`}
                  onClick={() => setSelectedLedgerRow(r)}
                  className="p-4 space-y-3 hover:bg-neutral-50 dark:hover:bg-neutral-950/70 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-neutral-900 dark:text-neutral-100 text-sm">{r.collectorName}</p>
                      <p className="text-xs text-neutral-500 font-mono">Emp ID: {r.employeeId} · {formatDate(r.collectionDate)}</p>
                    </div>
                    <span className={clsx(
                      'rounded-full px-2 py-0.5 text-[10px] font-bold',
                      r.status === 'Fully Submitted' ? 'bg-emerald-500/10 text-emerald-500' :
                      r.status === 'Partially Submitted' ? 'bg-amber-500/10 text-amber-500' :
                      'bg-red-500/10 text-red-500'
                    )}>
                      {r.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-neutral-100 dark:bg-neutral-900 p-2 text-center">
                      <p className="text-neutral-500">Total Expected CMS</p>
                      <p className="font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">
                        {formatINR(r.totalExpectedCms)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-emerald-500/10 p-2 text-center">
                      <p className="text-emerald-500">Total CMS Submitted</p>
                      <p className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatINR(r.totalSubmitted)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="text-neutral-500">CMS Pending:</span>
                    <span className={clsx('font-bold tabular-nums', r.cmsPending > 0 ? 'text-red-500' : 'text-emerald-500')}>
                      {formatINR(r.cmsPending)}
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800" onClick={(e) => e.stopPropagation()}>
                    {canManage && r.cmsPending > 0 && (
                      <Button size="sm" onClick={() => openAddEmpSubmission(r)} className="min-h-[44px] text-xs font-semibold px-3">
                        + Record Submission
                      </Button>
                    )}
                    <button onClick={() => setSelectedLedgerRow(r)} className="p-2 rounded-lg text-neutral-500 min-h-[44px] min-w-[44px] flex items-center justify-center">
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* SECTION 5: Main CMS Deposition Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
            CMS Deposition Records (Daily Summary)
          </h2>
          <span className="text-xs text-neutral-500">{filteredDailyRows.length} visible dates</span>
        </div>

        {loading ? (
          <Card className="p-8 flex justify-center"><Spinner className="h-6 w-6" /></Card>
        ) : filteredDailyRows.length === 0 ? (
          <Card>
            <EmptyState icon={<Landmark className="h-8 w-8" />} title="No CMS deposition records" message="No records found in this date range." />
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 dark:bg-neutral-950/80 text-neutral-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold">Collection Date</th>
                    <th className="text-right px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">Cash Received</th>
                    <th className="text-right px-4 py-3 font-semibold text-blue-600 dark:text-blue-400">Online Received</th>
                    <th className="text-right px-4 py-3 font-semibold">Total Expected CMS</th>
                    <th className="text-right px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">Total CMS Submitted</th>
                    <th className="text-right px-4 py-3 font-semibold text-red-500">CMS Pending</th>
                    <th className="text-right px-4 py-3 font-semibold text-blue-500">CMS Excess</th>
                    <th className="text-right px-4 py-3 font-semibold text-amber-500">Collection Shortage</th>
                    <th className="text-center px-4 py-3 font-semibold">Status</th>
                    <th className="text-right px-5 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {filteredDailyRows.map((r) => (
                    <tr key={`${r.date}_${r.hubId}`} className="group hover:bg-neutral-50 dark:hover:bg-neutral-950/70 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-neutral-800 dark:text-neutral-200 tabular-nums">{formatDate(r.date)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-emerald-600 font-medium">{formatINR(r.cashReceived)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-blue-600 font-medium">{formatINR(r.onlineReceived)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-bold text-neutral-900 dark:text-neutral-100">{formatINR(r.totalExpectedCms)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-emerald-500">{formatINR(r.totalSubmitted)}</td>
                      <td className={clsx('px-4 py-3.5 text-right tabular-nums font-bold', r.cmsPending > 0 ? 'text-red-500' : 'text-neutral-400')}>{formatINR(r.cmsPending)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-blue-500">{formatINR(r.cmsExcess)}</td>
                      <td className={clsx('px-4 py-3.5 text-right tabular-nums font-semibold', r.collectionShortage > 0 ? 'text-amber-500' : 'text-neutral-400')}>{formatINR(r.collectionShortage)}</td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={clsx(
                          'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold',
                          r.status === 'Fully Submitted' ? 'bg-emerald-500/10 text-emerald-500' :
                          r.status === 'Partially Submitted' ? 'bg-amber-500/10 text-amber-500' :
                          'bg-red-500/10 text-red-500'
                        )}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {canManage && (
                          <Button size="sm" variant="outline" onClick={openAddDeposit} className="min-h-[44px] text-xs">
                            Record Deposit
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* SECTION 6: Record CMS Submission Modal */}
      <Modal
        open={empSubmissionModalOpen}
        onClose={() => setEmpSubmissionModalOpen(false)}
        title="Record CMS Submission"
        subtitle="Submit collected amount to bank / CMS"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setEmpSubmissionModalOpen(false)} disabled={empSubmissionSaving} className="min-h-[44px]">Cancel</Button>
            <Button onClick={handleSaveEmpSubmission} loading={empSubmissionSaving} className="min-h-[44px]">Record Submission</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Employee (Collector)"
            value={empSubmissionForm.collector_id}
            onChange={(e) => setEmpSubmissionForm((f) => ({ ...f, collector_id: e.target.value }))}
          >
            <option value="">Select Employee…</option>
            {collectors.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.employee_id})</option>
            ))}
          </Select>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Collection Date"
              type="date"
              value={empSubmissionForm.collection_date}
              onChange={(e) => setEmpSubmissionForm((f) => ({ ...f, collection_date: e.target.value }))}
            />
            <Input
              label="Submission Date"
              type="date"
              value={empSubmissionForm.submission_date}
              onChange={(e) => setEmpSubmissionForm((f) => ({ ...f, submission_date: e.target.value }))}
            />
          </div>

          {(isSuperAdmin || hubCtx.isAllHubs) && hubCtx.accessibleHubs.length > 0 && (
            <Select
              label="Hub"
              value={empSubmissionForm.hub_id}
              onChange={(e) => setEmpSubmissionForm((f) => ({ ...f, hub_id: e.target.value }))}
            >
              {hubCtx.accessibleHubs.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </Select>
          )}

          {/* Live Submission Preview */}
          {empSubmissionPreview && (
            <div className={clsx('rounded-xl border p-4 space-y-2', empSubmissionPreview.isOverSubmission ? 'bg-blue-500/10 border-blue-500/30' : 'bg-neutral-100 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800')}>
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Live Submission Preview</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-neutral-500">Cash Received: <strong>{formatINR(empSubmissionPreview.cashReceived)}</strong></p>
                  <p className="text-neutral-500">Online Received: <strong>{formatINR(empSubmissionPreview.onlineReceived)}</strong></p>
                  <p className="text-brand-600 font-bold">Total Expected CMS: {formatINR(empSubmissionPreview.totalExpectedCms)}</p>
                </div>
                <div>
                  <p className="text-neutral-500">Already Submitted: <strong>{formatINR(empSubmissionPreview.alreadySubmitted)}</strong></p>
                  <p className="text-emerald-500 font-bold">New Submission: {formatINR(empSubmissionPreview.newSubmission)}</p>
                  <p className={clsx('font-bold', empSubmissionPreview.remainingPending > 0 ? 'text-red-500' : 'text-emerald-500')}>
                    Remaining Pending: {formatINR(empSubmissionPreview.remainingPending)}
                  </p>
                </div>
              </div>
            </div>
          )}

          <Input
            label="CMS Amount Submitted (₹)"
            type="number"
            value={empSubmissionForm.amount_submitted}
            onChange={(e) => setEmpSubmissionForm((f) => ({ ...f, amount_submitted: e.target.value }))}
            placeholder="Enter CMS deposit amount…"
          />

          <Input
            label="Reference Number / Bank Slip (optional)"
            value={empSubmissionForm.reference_number}
            onChange={(e) => setEmpSubmissionForm((f) => ({ ...f, reference_number: e.target.value }))}
            placeholder="Bank slip or CMS receipt number…"
          />

          <Input
            label="Bank / CMS Name (optional)"
            value={empSubmissionForm.bank_name}
            onChange={(e) => setEmpSubmissionForm((f) => ({ ...f, bank_name: e.target.value }))}
            placeholder="e.g. HDFC Bank, ICICI CMS…"
          />

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
              Remarks {empSubmissionPreview?.isOverSubmission && <span className="text-blue-500">* Required for over-submission</span>}
            </label>
            <textarea
              value={empSubmissionForm.remarks}
              onChange={(e) => setEmpSubmissionForm((f) => ({ ...f, remarks: e.target.value }))}
              rows={2}
              placeholder="Notes regarding this deposit…"
              className="input-base resize-none"
            />
          </div>
        </div>
      </Modal>

      {/* SECTION 7: General Deposit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Deposit Record' : 'Record Deposit'}
        subtitle="Record general CMS deposit transaction"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving} className="min-h-[44px]">Cancel</Button>
            <Button onClick={handleSaveGeneralDeposit} loading={saving} className="min-h-[44px]">Save Deposit</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Deposit Date" type="date" value={form.deposit_date} onChange={(e) => setForm((f) => ({ ...f, deposit_date: e.target.value }))} />
          <Input label="CMS Amount Submitted" type="number" value={form.amount_submitted} onChange={(e) => setForm((f) => ({ ...f, amount_submitted: e.target.value }))} placeholder="0" />
          <Input label="Reference Number" value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} placeholder="Reference slip..." />
          <textarea value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} rows={2} placeholder="Remarks..." className="input-base resize-none" />
        </div>
      </Modal>

      {/* SECTION 8: Shortage & Recovery Modals */}
      <Modal
        open={shortageModalOpen}
        onClose={() => setShortageModalOpen(false)}
        title="Add Shortage Entry"
        subtitle="Record collection shortfall with reason tagging"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setShortageModalOpen(false)} disabled={shortageSaving} className="min-h-[44px]">Cancel</Button>
            <Button onClick={handleSaveShortage} loading={shortageSaving} className="min-h-[44px]">+ Save Shortage Entry</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Shortage Date" type="date" value={shortageForm.shortage_date} onChange={(e) => setShortageForm((f) => ({ ...f, shortage_date: e.target.value }))} />
          <Select label="Employee" value={shortageForm.collector_id} onChange={(e) => handleShortageCollectorChange(e.target.value)}>
            <option value="">Select Employee…</option>
            {collectors.map((c) => (<option key={c.id} value={c.id}>{c.name} ({c.employee_id})</option>))}
          </Select>
          <div className="grid grid-cols-3 gap-2">
            <Input label="Expected COD" type="number" value={shortageForm.expected_cod} onChange={(e) => setShortageForm((f) => ({ ...f, expected_cod: e.target.value }))} />
            <Input label="Cash Collected" type="number" value={shortageForm.cash_collected} onChange={(e) => setShortageForm((f) => ({ ...f, cash_collected: e.target.value }))} />
            <Input label="Online Collected" type="number" value={shortageForm.online_amount} onChange={(e) => setShortageForm((f) => ({ ...f, online_amount: e.target.value }))} />
          </div>
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 flex items-center justify-between">
            <span className="text-sm font-semibold text-red-500">Calculated Shortage</span>
            <span className="text-xl font-bold text-red-500 tabular-nums">{formatINR(calculatedShortageAmount)}</span>
          </div>
          <Select label="Reason" value={shortageForm.reason} onChange={(e) => setShortageForm((f) => ({ ...f, reason: e.target.value }))}>
            {SHORTAGE_REASONS.map((r) => (<option key={r} value={r}>{r}</option>))}
          </Select>
          <textarea value={shortageForm.remarks} onChange={(e) => setShortageForm({ ...shortageForm, remarks: e.target.value })} rows={2} placeholder="Investigation notes..." className="input-base resize-none" />
        </div>
      </Modal>

      {recoveryTargetDue && (
        <Modal open={recoveryModalOpen} onClose={() => setRecoveryModalOpen(false)} title="Record Shortage Recovery" subtitle={`Recovering for ${recoveryTargetDue.collector?.name ?? 'Employee'}`} size="md" footer={
          <>
            <Button variant="outline" onClick={() => setRecoveryModalOpen(false)} disabled={recoverySaving} className="min-h-[44px]">Cancel</Button>
            <Button onClick={handleSaveRecovery} loading={recoverySaving} className="min-h-[44px]">Record Recovery</Button>
          </>
        }>
          <div className="space-y-4">
            <div className="rounded-xl bg-neutral-100 dark:bg-neutral-900 p-4 space-y-1">
              <p className="text-xs text-neutral-500">Original Shortage: {formatINR(recoveryTargetDue.original_amount)}</p>
              <p className="text-sm font-bold text-red-500">Remaining Backlog: {formatINR(recoveryTargetDue.remaining_amount)}</p>
            </div>
            <Input label="Recovery Date" type="date" value={recoveryForm.recovery_date} onChange={(e) => setRecoveryForm((f) => ({ ...f, recovery_date: e.target.value }))} />
            <Input label="Recovery Amount" type="number" value={recoveryForm.amount} onChange={(e) => setRecoveryForm((f) => ({ ...f, amount: e.target.value }))} />
            <Select label="Payment Mode" value={recoveryForm.payment_mode} onChange={(e) => setRecoveryForm((f) => ({ ...f, payment_mode: e.target.value as any }))}>
              <option value="cash">Cash</option><option value="online">Online / UPI</option><option value="other">Other / Salary</option>
            </Select>
            <Input label="Reference" value={recoveryForm.reference_number} onChange={(e) => setRecoveryForm((f) => ({ ...f, reference_number: e.target.value }))} />
            <textarea value={recoveryForm.notes} onChange={(e) => setRecoveryForm((f) => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Notes..." className="input-base resize-none" />
          </div>
        </Modal>
      )}

      {/* Employee Detail Drawer */}
      {selectedLedgerRow && (
        <EmployeeLedgerDrawer
          row={selectedLedgerRow}
          onClose={() => setSelectedLedgerRow(null)}
          entries={entries.filter(e => e.collector_id === selectedLedgerRow.collectorId && e.collection_date === selectedLedgerRow.collectionDate)}
          deposits={deposits.filter(d => (d.collector_id === selectedLedgerRow.collectorId || !d.collector_id) && (d.collection_date === selectedLedgerRow.collectionDate || d.deposit_date === selectedLedgerRow.collectionDate))}
          openAddEmpSubmission={() => { const r = selectedLedgerRow; setSelectedLedgerRow(null); openAddEmpSubmission(r); }}
          canManage={canManage}
        />
      )}

      {/* Card Drill-Down Drawer */}
      {activeDetail && (
        <DetailDrawer
          type={activeDetail}
          onClose={() => setActiveDetail(null)}
          entries={entries}
          deposits={deposits}
          dues={dues}
          recoveries={recoveries}
          collectors={collectors}
          ledgerRows={filteredLedgerRows}
          from={from}
          to={to}
          selectedHubName={hubCtx.selectedHub?.name}
          detailSearch={detailSearch}
          setDetailSearch={setDetailSearch}
          detailFilterStatus={detailFilterStatus}
          setDetailFilterStatus={setDetailFilterStatus}
          detailFilterReason={detailFilterReason}
          setDetailFilterReason={setDetailFilterReason}
          detailFilterRecovery={detailFilterRecovery}
          setDetailFilterRecovery={setDetailFilterRecovery}
          detailFilterEmployee={detailFilterEmployee}
          setDetailFilterEmployee={setDetailFilterEmployee}
          expandedHistoryId={expandedHistoryId}
          setExpandedHistoryId={setExpandedHistoryId}
          onExport={handleExportLedger}
          openAddShortage={openAddShortage}
          openRecoveryModal={openRecoveryModal}
          onMarkWrittenOff={handleMarkWrittenOff}
          canManage={canManage}
        />
      )}
    </div>
  );
}

// Drawer Component for Employee Ledger Row Detail
function EmployeeLedgerDrawer({
  row, onClose, entries, deposits, openAddEmpSubmission, canManage
}: {
  row: EmployeeCmsLedgerRow;
  onClose: () => void;
  entries: CollectionEntry[];
  deposits: CmsDeposit[];
  openAddEmpSubmission: () => void;
  canManage: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-2xl bg-[var(--card-bg)] shadow-2xl h-full flex flex-col min-w-0 border-l border-neutral-200 dark:border-neutral-800 animate-slide-in">
        <div className="p-4 sm:p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-50 dark:bg-neutral-950">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-brand-600/15 text-brand-600 flex items-center justify-center font-bold text-base">
              {row.collectorName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100">{row.collectorName}</h2>
              <p className="text-xs text-neutral-500 font-mono">Emp ID: {row.employeeId} · Date: {formatDate(row.collectionDate)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 rounded-xl text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-500">Submission Status</p>
            <span className="font-bold text-sm">{row.status}</span>
          </div>
          {canManage && row.cmsPending > 0 && (
            <Button size="sm" onClick={openAddEmpSubmission} className="min-h-[44px] font-semibold px-4">
              + Record Submission
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-3 space-y-1">
              <p className="font-semibold text-neutral-500 uppercase">Collection Received</p>
              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Cash: {formatINR(row.cashReceived)}</p>
              <p className="text-sm font-bold text-blue-600 dark:text-blue-400">Online: {formatINR(row.onlineReceived)}</p>
              <p className="text-base font-extrabold text-neutral-900 dark:text-neutral-100 pt-1 border-t border-neutral-200 dark:border-neutral-800">Total Expected: {formatINR(row.totalExpectedCms)}</p>
            </div>
            <div className="rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-3 space-y-1">
              <p className="font-semibold text-neutral-500 uppercase">Submitted to CMS</p>
              <p className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">Total Submitted: {formatINR(row.totalSubmitted)}</p>
              <p className="text-xs text-neutral-500">{row.submissionCount} submission records</p>
            </div>
          </div>

          <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-red-500">CMS Pending Deposition</p>
            <div className="flex justify-between text-base font-extrabold pt-1 text-red-600 dark:text-red-400">
              <span>CMS Pending Amount:</span>
              <span className="tabular-nums">{formatINR(row.cmsPending)}</span>
            </div>
            <p className="text-xs text-red-500/70 mt-1">Total Expected CMS ({formatINR(row.totalExpectedCms)}) − Total Submitted ({formatINR(row.totalSubmitted)}) = Pending ({formatINR(row.cmsPending)})</p>
          </div>

          {/* Submission History */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">CMS Submission History ({deposits.length})</h3>
            {deposits.length === 0 ? (
              <p className="text-xs text-neutral-500">No CMS submissions recorded yet for this date.</p>
            ) : (
              <div className="space-y-2">
                {deposits.map((d) => (
                  <Card key={d.id} className="p-3 text-xs space-y-1">
                    <div className="flex justify-between font-semibold">
                      <span>Submission Date: {formatDate(d.deposit_date)}</span>
                      <span className="font-bold text-emerald-500">+{formatINR(getTotalCmsSubmitted(d))}</span>
                    </div>
                    {d.reference_number && <p className="text-neutral-500 font-mono">Ref: {d.reference_number}</p>}
                    {d.remarks && <p className="text-neutral-500 italic">"{d.remarks}"</p>}
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 flex justify-end shrink-0">
          <Button variant="outline" onClick={onClose} className="min-h-[44px] px-5 font-semibold">Close</Button>
        </div>
      </div>
    </div>
  );
}

// Drawer Component for Interactive Card Drill-Downs
function DetailDrawer({
  type, onClose, entries, deposits, dues, recoveries, collectors, ledgerRows,
  from, to, selectedHubName, detailSearch, setDetailSearch,
  detailFilterStatus, setDetailFilterStatus, detailFilterReason, setDetailFilterReason,
  detailFilterRecovery, setDetailFilterRecovery, detailFilterEmployee, setDetailFilterEmployee,
  expandedHistoryId, setExpandedHistoryId, onExport, openAddShortage, openRecoveryModal,
  onMarkWrittenOff, canManage
}: {
  type: DetailType;
  onClose: () => void;
  entries: CollectionEntry[];
  deposits: CmsDeposit[];
  dues: Due[];
  recoveries: Recovery[];
  collectors: Collector[];
  ledgerRows: EmployeeCmsLedgerRow[];
  from: string;
  to: string;
  selectedHubName?: string;
  detailSearch: string;
  setDetailSearch: (s: string) => void;
  detailFilterStatus: string;
  setDetailFilterStatus: (s: string) => void;
  detailFilterReason: string;
  setDetailFilterReason: (s: string) => void;
  detailFilterRecovery: string;
  setDetailFilterRecovery: (s: string) => void;
  detailFilterEmployee: string;
  setDetailFilterEmployee: (s: string) => void;
  expandedHistoryId: string | null;
  setExpandedHistoryId: (id: string | null) => void;
  onExport: () => void;
  openAddShortage: () => void;
  openRecoveryModal: (due: Due) => void;
  onMarkWrittenOff: (due: Due) => void;
  canManage: boolean;
}) {
  const titles: Record<string, string> = {
    total_expected_cod: 'Total Expected COD Transactions',
    total_collection: 'Total Collection Transactions',
    cash_collected: 'Cash Collection Entries',
    online_collected: 'Online Collection Entries',
    collection_shortage: 'Collection Shortage Investigation',
    total_expected_cms: 'Total Expected CMS Details',
    total_cms_submitted: 'Total CMS Submitted Transactions',
    cms_pending_deposit: 'CMS Pending Deposition Audit',
    deposit_count: 'Deposit Transaction Log',
  };

  const icons: Record<string, any> = {
    total_expected_cod: Wallet,
    total_collection: Landmark,
    cash_collected: Banknote,
    online_collected: Smartphone,
    collection_shortage: TrendingDown,
    total_expected_cms: Wallet,
    total_cms_submitted: Landmark,
    cms_pending_deposit: AlertCircle,
    deposit_count: FileBarChart,
  };

  const IconComp = icons[type ?? ''] || FileText;
  const q = detailSearch.trim().toLowerCase();

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (detailFilterEmployee !== 'all' && e.collector_id !== detailFilterEmployee) return false;
      if (type === 'cash_collected' && safeAmount(e.cash_amount) <= 0) return false;
      if (type === 'online_collected' && safeAmount(e.online_amount) <= 0) return false;
      if (!q) return true;
      const name = e.collector?.name?.toLowerCase() ?? '';
      const empId = e.collector?.employee_id?.toLowerCase() ?? '';
      const rem = e.remarks?.toLowerCase() ?? '';
      return name.includes(q) || empId.includes(q) || rem.includes(q);
    });
  }, [entries, type, detailFilterEmployee, q]);

  const shortageRecords = useMemo(() => {
    const shortageEnts = entries.filter((e) => safeAmount(e.total_collection) < safeAmount(e.expected_cod));
    return shortageEnts.filter((e) => {
      if (detailFilterEmployee !== 'all' && e.collector_id !== detailFilterEmployee) return false;
      const linkedDue = dues.find(d => d.collection_entry_id === e.id || (d.collector_id === e.collector_id && d.due_date === e.collection_date));
      if (detailFilterRecovery !== 'all' && linkedDue?.status !== detailFilterRecovery) return false;
      if (detailFilterReason !== 'all' && !(e.remarks ?? '').includes(detailFilterReason)) return false;
      if (!q) return true;
      const name = e.collector?.name?.toLowerCase() ?? '';
      const empId = e.collector?.employee_id?.toLowerCase() ?? '';
      const rem = e.remarks?.toLowerCase() ?? '';
      return name.includes(q) || empId.includes(q) || rem.includes(q);
    });
  }, [entries, dues, detailFilterEmployee, detailFilterRecovery, detailFilterReason, q]);

  const filteredLedger = useMemo(() => {
    return ledgerRows.filter((r) => {
      if (type === 'cms_pending_deposit' && r.cmsPending <= 0) return false;
      if (type === 'total_cms_submitted' && r.totalSubmitted <= 0) return false;
      if (!q) return true;
      return r.collectorName.toLowerCase().includes(q) || r.employeeId.toLowerCase().includes(q);
    });
  }, [ledgerRows, type, q]);

  const drawerTotalAmount = useMemo(() => {
    if (type === 'total_expected_cod') return filteredEntries.reduce((s, e) => s + safeAmount(e.expected_cod), 0);
    if (type === 'total_collection') return filteredEntries.reduce((s, e) => s + safeAmount(e.total_collection), 0);
    if (type === 'cash_collected') return filteredEntries.reduce((s, e) => s + safeAmount(e.cash_amount), 0);
    if (type === 'online_collected') return filteredEntries.reduce((s, e) => s + safeAmount(e.online_amount), 0);
    if (type === 'collection_shortage') return shortageRecords.reduce((s, e) => s + (safeAmount(e.expected_cod) - safeAmount(e.total_collection)), 0);
    if (type === 'total_expected_cms') return filteredLedger.reduce((s, r) => s + r.totalExpectedCms, 0);
    if (type === 'total_cms_submitted') return filteredLedger.reduce((s, r) => s + r.totalSubmitted, 0);
    if (type === 'cms_pending_deposit') return filteredLedger.reduce((s, r) => s + r.cmsPending, 0);
    return deposits.length;
  }, [type, filteredEntries, shortageRecords, filteredLedger, deposits]);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-4xl bg-[var(--card-bg)] shadow-2xl h-full flex flex-col min-w-0 border-l border-neutral-200 dark:border-neutral-800 animate-slide-in">
        <div className="p-4 sm:p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-50 dark:bg-neutral-950">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-600/15 text-brand-600 ring-1 ring-brand-600/30 shrink-0">
              <IconComp className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100 truncate">{titles[type ?? '']}</h2>
              <p className="text-xs text-neutral-500">{formatDate(from)} — {formatDate(to)} {selectedHubName && `· ${selectedHubName}`}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" icon={<Download className="h-4 w-4" />} onClick={onExport} className="min-h-[44px] text-xs font-semibold">Export</Button>
            <button onClick={onClose} className="p-2.5 rounded-xl text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 min-h-[44px] min-w-[44px] flex items-center justify-center"><X className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="p-4 bg-brand-50/50 dark:bg-brand-600/10 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase">Filtered Total Amount</p>
            <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">{type === 'deposit_count' ? drawerTotalAmount : formatINR(drawerTotalAmount)}</p>
          </div>
          {type === 'collection_shortage' && canManage && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={openAddShortage} className="min-h-[44px] px-3.5 text-xs font-semibold shadow-glow">+ Add Shortage Entry</Button>
          )}
        </div>

        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 space-y-3 shrink-0">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input value={detailSearch} onChange={(e) => setDetailSearch(e.target.value)} placeholder="Search employee, ID, notes..." className="input-base pl-9 py-2 text-sm min-h-[44px]" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {type === 'collection_shortage' ? (
            shortageRecords.map((e) => {
              const shortageAmt = safeAmount(e.expected_cod) - safeAmount(e.total_collection);
              const linkedDue = dues.find(d => d.collection_entry_id === e.id || (d.collector_id === e.collector_id && d.due_date === e.collection_date));
              const remaining = safeAmount(linkedDue?.remaining_amount ?? shortageAmt);

              return (
                <Card key={e.id} className="p-4 space-y-3 border-red-500/20">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-neutral-900 dark:text-neutral-100">{e.collector?.name ?? '—'}</p>
                      <p className="text-xs text-neutral-500 font-mono">Emp ID: {e.collector?.employee_id} · Date: {formatDate(e.collection_date)}</p>
                    </div>
                    <span className="text-xs font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded">{linkedDue ? DUE_STATUS_LABELS[linkedDue.status] : 'Outstanding'}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-neutral-100 dark:bg-neutral-900 p-2"><p className="text-neutral-500">Expected COD</p><p className="font-bold tabular-nums">{formatINR(e.expected_cod)}</p></div>
                    <div className="rounded-lg bg-neutral-100 dark:bg-neutral-900 p-2"><p className="text-neutral-500">Total Collected</p><p className="font-bold tabular-nums">{formatINR(e.total_collection)}</p></div>
                    <div className="rounded-lg bg-red-500/10 p-2"><p className="text-red-500">Shortage</p><p className="font-bold text-red-500 tabular-nums">{formatINR(shortageAmt)}</p></div>
                  </div>
                  {e.remarks && <p className="text-xs text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-950 p-2.5 rounded-lg border">Notes: {e.remarks}</p>}
                  {canManage && linkedDue && linkedDue.status !== 'fully_recovered' && (
                    <div className="flex justify-end gap-2 pt-2 border-t">
                      <Button size="sm" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={() => openRecoveryModal(linkedDue)} className="min-h-[44px] text-xs">Record Recovery</Button>
                      <Button size="sm" variant="outline" onClick={() => onMarkWrittenOff(linkedDue)} className="min-h-[44px] text-xs text-red-500">Mark Written Off</Button>
                    </div>
                  )}
                </Card>
              );
            })
          ) : (
            filteredLedger.map((r) => (
              <Card key={`${r.collectorId}_${r.collectionDate}`} className="p-4 space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span>{r.collectorName} ({r.employeeId})</span>
                  <span>{formatDate(r.collectionDate)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-neutral-100 dark:bg-neutral-900 p-2"><p className="text-neutral-500">Total Expected CMS</p><p className="font-bold tabular-nums">{formatINR(r.totalExpectedCms)}</p></div>
                  <div className="rounded-lg bg-emerald-500/10 p-2"><p className="text-emerald-500">Submitted</p><p className="font-bold text-emerald-500 tabular-nums">{formatINR(r.totalSubmitted)}</p></div>
                  <div className="rounded-lg bg-red-500/10 p-2"><p className="text-red-500">Pending</p><p className="font-bold text-red-500 tabular-nums">{formatINR(r.cmsPending)}</p></div>
                </div>
              </Card>
            ))
          )}
        </div>

        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 flex justify-end shrink-0">
          <Button variant="outline" onClick={onClose} className="min-h-[44px] px-5 font-semibold">Close</Button>
        </div>
      </div>
    </div>
  );
}
