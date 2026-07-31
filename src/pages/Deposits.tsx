import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Landmark, Search, Plus, Trash2, Banknote, TrendingDown, TrendingUp,
  Wallet, Calendar, FileBarChart, Edit3, AlertTriangle, Eye, ArrowRight,
  X, Filter, CheckCircle2, RotateCcw, ShieldAlert, Clock, User, Building2,
  Phone, BadgeCheck, Download, AlertCircle, FileText, Smartphone, Check, HelpCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '@/lib/auth';
import { useHub } from '@/lib/hubContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { Button, Card, EmptyState, Skeleton, Spinner, Input, Select } from '@/components/ui/primitives';
import StatusBadge from '@/components/StatusBadge';
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
  | 'expected_cms_cash'
  | 'total_deposited'
  | 'cms_pending_deposit'
  | 'deposit_count'
  | null;

const safeAmount = (val: any): number => {
  if (val === null || val === undefined) return 0;
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  return isNaN(num) ? 0 : num;
};

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

export interface DailyCmsRow {
  date: string;
  hubId: string;
  hubName: string;
  expectedCod: number;
  cashCollected: number;
  onlineCollected: number;
  totalCollection: number;
  collectionShortage: number;
  expectedCmsCash: number; // strictly equals cashCollected
  depositedAmount: number;
  cmsPending: number; // max(cashCollected - depositedAmount, 0)
  cmsExcess: number; // max(depositedAmount - cashCollected, 0)
  depositStatus: 'Not Deposited' | 'Partially Deposited' | 'Fully Deposited' | 'Over Deposited';
  depositCount: number;
  references: string[];
  remarks: string[];
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

  // CMS Deposit Form modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CmsDeposit | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [autoTotals, setAutoTotals] = useState<{ cash: number; online: number; expectedCod: number } | null>(null);
  const [fetchingTotals, setFetchingTotals] = useState(false);

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

  // Card Drill-Down Drawer / Sheet state
  const [activeDetail, setActiveDetail] = useState<DetailType>(null);
  const [detailSearch, setDetailSearch] = useState('');
  const [detailFilterStatus, setDetailFilterStatus] = useState('all');
  const [detailFilterReason, setDetailFilterReason] = useState('all');
  const [detailFilterRecovery, setDetailFilterRecovery] = useState('all');
  const [detailFilterEmployee, setDetailFilterEmployee] = useState('all');
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  const canManage = ['super_admin', 'hub_admin', 'supervisor'].includes(profile?.role ?? '');
  const isSuperAdmin = profile?.role === 'super_admin';
  const activeHubId = hubCtx.selectedHubId;

  // Load all required data (Deposits, Entries, Dues, Recoveries, Collectors)
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
        .select('*, hub: hubs(*)')
        .gte('deposit_date', from)
        .lte('deposit_date', to)
        .order('deposit_date', { ascending: false });
      if (effectiveHubId) depQ = depQ.eq('hub_id', effectiveHubId);
      const { data: depData, error: depErr } = await depQ;
      if (depErr) throw depErr;
      setDeposits(depData ?? []);

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

  // Shared Normalized Daily Dataset: Aggregates entries and deposits by date and hub
  const dailyRows = useMemo<DailyCmsRow[]>(() => {
    const map = new Map<string, { date: string; hubId: string; hubName: string }>();

    // Collect all dates from collection entries and deposits
    entries.forEach((e) => {
      const key = `${e.collection_date}_${e.hub_id}`;
      if (!map.has(key)) {
        map.set(key, { date: e.collection_date, hubId: e.hub_id, hubName: e.hub?.name ?? '—' });
      }
    });

    deposits.forEach((d) => {
      const key = `${d.deposit_date}_${d.hub_id}`;
      if (!map.has(key)) {
        map.set(key, { date: d.deposit_date, hubId: d.hub_id, hubName: d.hub?.name ?? '—' });
      }
    });

    const rows: DailyCmsRow[] = [];

    map.forEach(({ date, hubId, hubName }) => {
      const dateEntries = entries.filter((e) => e.collection_date === date && e.hub_id === hubId);
      const dateDeposits = deposits.filter((d) => d.deposit_date === date && d.hub_id === hubId);

      const cashCollected = dateEntries.reduce((s, e) => s + safeAmount(e.cash_amount), 0);
      const onlineCollected = dateEntries.reduce((s, e) => s + safeAmount(e.online_amount), 0);
      const expectedCod = dateEntries.reduce((s, e) => s + safeAmount(e.expected_cod), 0);
      const totalCollection = cashCollected + onlineCollected;

      const collectionShortage = Math.max(0, expectedCod - totalCollection);

      // Expected CMS Cash strictly equals physical cash collected!
      const expectedCmsCash = cashCollected;
      const depositedAmount = dateDeposits.reduce((s, d) => s + safeAmount(d.total_deposited ?? d.cash_deposited), 0);

      const cmsPending = Math.max(0, expectedCmsCash - depositedAmount);
      const cmsExcess = Math.max(0, depositedAmount - expectedCmsCash);

      let depositStatus: DailyCmsRow['depositStatus'] = 'Not Deposited';
      if (depositedAmount === 0 && cashCollected > 0) {
        depositStatus = 'Not Deposited';
      } else if (depositedAmount > 0 && depositedAmount < cashCollected) {
        depositStatus = 'Partially Deposited';
      } else if (cashCollected > 0 && depositedAmount === cashCollected) {
        depositStatus = 'Fully Deposited';
      } else if (depositedAmount > cashCollected) {
        depositStatus = 'Over Deposited';
      } else if (cashCollected === 0 && depositedAmount === 0) {
        depositStatus = 'Fully Deposited';
      }

      const references = dateDeposits.map(d => d.reference_number).filter(Boolean) as string[];
      const remarks = dateDeposits.map(d => d.remarks).filter(Boolean) as string[];

      rows.push({
        date,
        hubId,
        hubName,
        expectedCod,
        cashCollected,
        onlineCollected,
        totalCollection,
        collectionShortage,
        expectedCmsCash,
        depositedAmount,
        cmsPending,
        cmsExcess,
        depositStatus,
        depositCount: dateDeposits.length,
        references,
        remarks,
      });
    });

    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, deposits]);

  // Main Table Search Filtered Rows
  const filteredDailyRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return dailyRows;
    return dailyRows.filter((r) => {
      const dateStr = r.date.toLowerCase();
      const hub = r.hubName.toLowerCase();
      const refs = r.references.join(' ').toLowerCase();
      const rems = r.remarks.join(' ').toLowerCase();
      return dateStr.includes(q) || hub.includes(q) || refs.includes(q) || rems.includes(q);
    });
  }, [dailyRows, search]);

  // Shared Summary Card Calculations (strictly derived from visible normalized rows)
  const collectionStats = useMemo(() => {
    const totalExpectedCod = filteredDailyRows.reduce((s, r) => s + r.expectedCod, 0);
    const totalCollection = filteredDailyRows.reduce((s, r) => s + r.totalCollection, 0);
    const totalCash = filteredDailyRows.reduce((s, r) => s + r.cashCollected, 0);
    const totalOnline = filteredDailyRows.reduce((s, r) => s + r.onlineCollected, 0);
    const collectionShortage = filteredDailyRows.reduce((s, r) => s + r.collectionShortage, 0);

    return {
      totalExpectedCod,
      totalCollection,
      totalCash,
      totalOnline,
      collectionShortage,
      entryCount: entries.length,
    };
  }, [filteredDailyRows, entries.length]);

  const cmsStats = useMemo(() => {
    // Expected CMS Cash = sum of cash collected across visible rows
    const expectedCmsCash = filteredDailyRows.reduce((s, r) => s + r.expectedCmsCash, 0);
    const totalDeposited = filteredDailyRows.reduce((s, r) => s + r.depositedAmount, 0);
    // CMS Pending Deposit summary total = sum of row-level pending amounts!
    const cmsPending = filteredDailyRows.reduce((s, r) => s + r.cmsPending, 0);

    return {
      expectedCmsCash,
      totalDeposited,
      cmsPending,
      count: deposits.length,
    };
  }, [filteredDailyRows, deposits.length]);

  // Auto-fetch collection totals when date/hub selected in CMS Deposit Modal
  const fetchAutoTotals = useCallback(async (dateStr: string, hubId: string, autoApply: boolean) => {
    if (!dateStr || !hubId) { setAutoTotals(null); return; }
    setFetchingTotals(true);
    try {
      const { data, error } = await supabase
        .from('collection_entries')
        .select('expected_cod, cash_amount, online_amount')
        .eq('collection_date', dateStr)
        .eq('hub_id', hubId);
      if (error) throw error;
      const cash = (data ?? []).reduce((s, r) => s + safeAmount(r.cash_amount), 0);
      const online = (data ?? []).reduce((s, r) => s + safeAmount(r.online_amount), 0);
      const expectedCod = (data ?? []).reduce((s, r) => s + safeAmount(r.expected_cod), 0);
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

  const openAddDeposit = () => {
    setEditing(null);
    const presetHub = activeHubId || (hubCtx.accessibleHubs[0]?.id ?? '');
    setForm({ ...emptyForm, hub_id: presetHub });
    setAutoTotals(null);
    setModalOpen(true);
    fetchAutoTotals(emptyForm.deposit_date, presetHub, true);
  };

  const openEditDeposit = (d: CmsDeposit) => {
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

  const handleDepositDateChange = (dStr: string) => {
    setForm((f) => ({ ...f, deposit_date: dStr }));
    fetchAutoTotals(dStr, form.hub_id, !editing);
  };

  const handleDepositHubChange = (hId: string) => {
    setForm((f) => ({ ...f, hub_id: hId }));
    fetchAutoTotals(form.deposit_date, hId, !editing);
  };

  const applyAutoTotals = () => {
    if (!autoTotals) return;
    setForm((f) => ({
      ...f,
      cash_collected: String(autoTotals.cash),
      online_amount: String(autoTotals.online),
    }));
    toast.success('Auto-filled cash collected');
  };

  const expectedCashForCmsModal = useMemo(() => autoTotals?.cash ?? safeAmount(form.cash_collected), [autoTotals, form.cash_collected]);

  const totalToCms = useMemo(() => {
    return safeAmount(form.cash_collected);
  }, [form.cash_collected]);

  useEffect(() => {
    setForm((f) => ({ ...f, total_deposited: String(totalToCms) }));
  }, [totalToCms]);

  const computedShortModal = useMemo(() => {
    return Math.max(0, expectedCashForCmsModal - totalToCms);
  }, [expectedCashForCmsModal, totalToCms]);

  const handleSaveDeposit = async () => {
    const hubId = form.hub_id || activeHubId;
    if (!hubId) { toast.error('Please select a hub first'); return; }
    const cash = safeAmount(form.cash_collected);
    const online = safeAmount(form.online_amount);
    const deposited = safeAmount(form.total_deposited);
    if (!form.deposit_date) { toast.error('Select a deposit date'); return; }
    if (cash < 0 || online < 0 || deposited < 0) { toast.error('Amounts cannot be negative'); return; }

    setSaving(true);
    try {
      const payload = {
        deposit_date: form.deposit_date,
        hub_id: hubId,
        total_cash_collected: cash,
        cash_deposited: deposited,
        online_amount: online,
        total_expected_cms: cash, // Expected CMS is physical cash collected
        total_deposited: deposited,
        short_amount: Math.max(0, cash - deposited),
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

  const handleDeleteDeposit = async (d: CmsDeposit) => {
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

      await logAudit('shortage_entry_create', profile?.id ?? null, `Created shortage entry of ${formatINR(calculatedShortageAmount)} for ${formatDate(shortageForm.shortage_date)}`, null, hubId);
      toast.success('Shortage entry recorded successfully');
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
    if (amt > safeAmount(recoveryTargetDue.remaining_amount)) {
      toast.error(`Recovery amount cannot exceed remaining backlog of ${formatINR(recoveryTargetDue.remaining_amount)}`);
      return;
    }

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

      const { error: dueErr } = await supabase.from('dues').update({
        recovered_amount: newRecovered,
        remaining_amount: newRemaining,
        status: newStatus,
        updated_at: new Date().toISOString(),
      }).eq('id', recoveryTargetDue.id);
      if (dueErr) throw dueErr;

      await logAudit('shortage_recovery_create', profile?.id ?? null, `Recovered ${formatINR(amt)} against shortage due dated ${formatDate(recoveryTargetDue.due_date)}`, null, recoveryTargetDue.hub_id);
      toast.success('Recovery recorded successfully');
      setRecoveryModalOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record recovery');
    } finally {
      setRecoverySaving(false);
    }
  };

  // Mark Written Off handler
  const handleMarkWrittenOff = async (due: Due) => {
    const ok = await confirm({
      title: 'Mark shortage as Written Off?',
      message: `This will clear the remaining shortage of ${formatINR(due.remaining_amount)} for ${due.collector?.name ?? 'employee'} as written off.`,
      confirmLabel: 'Mark Written Off',
      danger: true,
    });
    if (!ok) return;

    try {
      const { error } = await supabase.from('dues').update({
        status: 'fully_recovered',
        remaining_amount: 0,
        notes: `${due.notes ? `${due.notes} | ` : ''}[Written Off by ${profile?.name ?? 'Admin'}]`,
        updated_at: new Date().toISOString(),
      }).eq('id', due.id);
      if (error) throw error;
      toast.success('Shortage marked as written off');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update shortage status');
    }
  };

  // Open detail drawer
  const openDetailDrawer = (type: DetailType) => {
    setActiveDetail(type);
    setDetailSearch('');
    setDetailFilterStatus('all');
    setDetailFilterReason('all');
    setDetailFilterRecovery('all');
    setDetailFilterEmployee('all');
  };

  // Export current detail view to Excel
  const handleExportDetail = () => {
    if (!activeDetail) return;

    let filename = `cms_detail_${activeDetail}_${from}_to_${to}.xlsx`;
    let rows: any[] = [];

    if (activeDetail === 'total_expected_cod' || activeDetail === 'total_collection' || activeDetail === 'cash_collected' || activeDetail === 'online_collected') {
      rows = entries.map(e => ({
        Date: e.collection_date,
        Employee: e.collector?.name ?? '—',
        'Emp ID': e.collector?.employee_id ?? '—',
        'Expected COD': Number(e.expected_cod),
        Cash: Number(e.cash_amount),
        Online: Number(e.online_amount),
        Total: Number(e.total_collection),
        Gap: Number(e.gap),
        Status: STATUS_LABELS[e.status],
        Remarks: e.remarks ?? '',
      }));
    } else if (activeDetail === 'collection_shortage') {
      const shortageEntries = entries.filter(e => safeAmount(e.total_collection) < safeAmount(e.expected_cod));
      rows = shortageEntries.map(e => {
        const linkedDue = dues.find(d => d.collection_entry_id === e.id || (d.collector_id === e.collector_id && d.due_date === e.collection_date));
        return {
          'Shortage Date': e.collection_date,
          Employee: e.collector?.name ?? '—',
          'Emp ID': e.collector?.employee_id ?? '—',
          'Expected COD': Number(e.expected_cod),
          'Total Collected': Number(e.total_collection),
          'Shortage Amount': safeAmount(e.expected_cod) - safeAmount(e.total_collection),
          Reason: e.remarks ?? '—',
          'Recovery Status': linkedDue ? DUE_STATUS_LABELS[linkedDue.status] : 'Outstanding',
          'Recovered Amount': linkedDue ? Number(linkedDue.recovered_amount) : 0,
          'Remaining Amount': linkedDue ? Number(linkedDue.remaining_amount) : safeAmount(e.expected_cod) - safeAmount(e.total_collection),
        };
      });
    } else if (activeDetail === 'expected_cms_cash' || activeDetail === 'total_deposited' || activeDetail === 'cms_pending_deposit' || activeDetail === 'deposit_count') {
      rows = filteredDailyRows.map(r => ({
        Date: r.date,
        Hub: r.hubName,
        'Expected CMS Cash': r.cashCollected,
        'Deposited Amount': r.depositedAmount,
        'CMS Pending': r.cmsPending,
        'CMS Status': r.depositStatus,
        'Collection Shortage': r.collectionShortage,
        References: r.references.join(', ') || '—',
      }));
    }

    if (rows.length === 0) {
      toast.warning('No detail records to export');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Detail');
    XLSX.writeFile(wb, filename);
    toast.success(`Exported ${rows.length} detail records`);
  };

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            CMS Deposition & Shortage Investigation
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-neutral-500">
            Track bank cash deposits, investigate collection shortages, and manage recovery workflows.
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

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {canManage && (
            <Button
              variant="outline"
              icon={<Plus className="h-4 w-4 text-amber-500" />}
              onClick={openAddShortage}
              className="min-h-[44px] px-3.5 text-xs sm:text-sm font-semibold border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
            >
              + Add Shortage Entry
            </Button>
          )}
          {canManage && (
            <Button
              icon={<Plus className="h-4 w-4" />}
              onClick={openAddDeposit}
              className="min-h-[44px] px-4 text-xs sm:text-sm font-semibold shadow-glow"
            >
              Record Deposit
            </Button>
          )}
        </div>
      </div>

      {/* SECTION 1: Collection Summary (from collection entries) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Collection Summary
          </p>
          <span className="text-[11px] text-neutral-500">Click card for itemized drill-down</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {/* 1. Total Expected COD */}
            <Card
              hover
              onClick={() => openDetailDrawer('total_expected_cod')}
              className="p-4 cursor-pointer transition-all duration-300 hover:-translate-y-0.5 group w-full min-w-0"
              role="button"
              tabIndex={0}
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800/80 ring-1 ring-neutral-200 dark:ring-neutral-700">
                <Wallet className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
              </div>
              <p className="mt-3 text-xs font-medium text-neutral-500 truncate">Total Expected COD</p>
              <p className="mt-0.5 text-lg sm:text-xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums truncate">
                {formatINR(collectionStats.totalExpectedCod)}
              </p>
              <div className="mt-1 flex items-center justify-between text-[11px] text-neutral-500">
                <span>{collectionStats.entryCount} entries</span>
                <ArrowRight className="h-3 w-3 text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Card>

            {/* 2. Total Collection */}
            <Card
              hover
              onClick={() => openDetailDrawer('total_collection')}
              className="p-4 cursor-pointer transition-all duration-300 hover:-translate-y-0.5 group w-full min-w-0"
              role="button"
              tabIndex={0}
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 ring-1 ring-blue-500/30">
                <Landmark className="h-5 w-5 text-blue-500 dark:text-blue-400" />
              </div>
              <p className="mt-3 text-xs font-medium text-neutral-500 truncate">Total Collection</p>
              <p className="mt-0.5 text-lg sm:text-xl font-bold text-blue-600 dark:text-blue-400 tabular-nums truncate">
                {formatINR(collectionStats.totalCollection)}
              </p>
              <div className="mt-1 flex items-center justify-between text-[11px] text-blue-500/80">
                <span>{collectionStats.entryCount} entries</span>
                <ArrowRight className="h-3 w-3 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Card>

            {/* 3. Cash Collected */}
            <Card
              hover
              onClick={() => openDetailDrawer('cash_collected')}
              className="p-4 cursor-pointer transition-all duration-300 hover:-translate-y-0.5 group w-full min-w-0"
              role="button"
              tabIndex={0}
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/30">
                <Banknote className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
              </div>
              <p className="mt-3 text-xs font-medium text-neutral-500 truncate">Cash Collected</p>
              <p className="mt-0.5 text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums truncate">
                {formatINR(collectionStats.totalCash)}
              </p>
              <div className="mt-1 flex items-center justify-between text-[11px] text-neutral-500">
                <span>
                  {collectionStats.totalCollection > 0
                    ? Math.round((collectionStats.totalCash / collectionStats.totalCollection) * 100)
                    : 0}% of total
                </span>
                <ArrowRight className="h-3 w-3 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Card>

            {/* 4. Online Collected */}
            <Card
              hover
              onClick={() => openDetailDrawer('online_collected')}
              className="p-4 cursor-pointer transition-all duration-300 hover:-translate-y-0.5 group w-full min-w-0"
              role="button"
              tabIndex={0}
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 ring-1 ring-blue-500/30">
                <Smartphone className="h-5 w-5 text-blue-500 dark:text-blue-400" />
              </div>
              <p className="mt-3 text-xs font-medium text-neutral-500 truncate">Online Collected</p>
              <p className="mt-0.5 text-lg sm:text-xl font-bold text-blue-600 dark:text-blue-400 tabular-nums truncate">
                {formatINR(collectionStats.totalOnline)}
              </p>
              <div className="mt-1 flex items-center justify-between text-[11px] text-neutral-500">
                <span>
                  {collectionStats.totalCollection > 0
                    ? Math.round((collectionStats.totalOnline / collectionStats.totalCollection) * 100)
                    : 0}% of total
                </span>
                <ArrowRight className="h-3 w-3 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Card>

            {/* 5. Collection Shortage */}
            <Card
              hover
              onClick={() => openDetailDrawer('collection_shortage')}
              className="p-4 cursor-pointer transition-all duration-300 hover:-translate-y-0.5 group col-span-2 sm:col-span-1 w-full min-w-0 border-red-500/20"
              role="button"
              tabIndex={0}
            >
              <div className="flex items-start justify-between">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 ring-1 ring-red-500/30">
                  <TrendingDown className="h-5 w-5 text-red-500 dark:text-red-400" />
                </div>
                {collectionStats.collectionShortage > 0 && (
                  <span className="text-[10px] font-extrabold tracking-wider text-red-500 dark:text-red-400 bg-red-500/10 border border-red-500/30 px-2 py-0.5 rounded-full uppercase">
                    SHORTAGE
                  </span>
                )}
              </div>
              <p className="mt-3 text-xs font-medium text-neutral-500 truncate">Collection Shortage</p>
              <p className={clsx('mt-0.5 text-lg sm:text-xl font-bold tabular-nums truncate', collectionStats.collectionShortage > 0 ? 'text-red-500 dark:text-red-400' : 'text-emerald-500')}>
                {formatINR(collectionStats.collectionShortage)}
              </p>
              <div className="mt-1 flex items-center justify-between text-[11px] text-neutral-500">
                <span>Expected COD − Collection</span>
                <ArrowRight className="h-3 w-3 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* SECTION 2: CMS Summary (CMS Cash Deposition) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            CMS Summary
          </p>
          <span className="text-[11px] text-neutral-500">Click card for bank deposition details</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* 6. Expected CMS Cash */}
            <Card
              hover
              onClick={() => openDetailDrawer('expected_cms_cash')}
              className="p-5 cursor-pointer transition-all duration-300 hover:-translate-y-0.5 group w-full min-w-0"
              role="button"
              tabIndex={0}
            >
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-600/15 text-brand-600 ring-1 ring-brand-600/30">
                <Banknote className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-medium text-neutral-500 truncate">Expected CMS Cash</p>
              <p className="mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums truncate">
                {formatINR(cmsStats.expectedCmsCash)}
              </p>
              <div className="mt-1.5 flex items-center justify-between text-xs text-neutral-500">
                <span>Physical cash collected</span>
                <ArrowRight className="h-3.5 w-3.5 text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Card>

            {/* 7. Total Deposited */}
            <Card
              hover
              onClick={() => openDetailDrawer('total_deposited')}
              className="p-5 cursor-pointer transition-all duration-300 hover:-translate-y-0.5 group w-full min-w-0"
              role="button"
              tabIndex={0}
            >
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 ring-1 ring-emerald-500/30">
                <Landmark className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-medium text-neutral-500 truncate">Total Deposited</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums truncate">
                {formatINR(cmsStats.totalDeposited)}
              </p>
              <div className="mt-1.5 flex items-center justify-between text-xs text-neutral-500">
                <span>Actual bank cash deposits</span>
                <ArrowRight className="h-3.5 w-3.5 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Card>

            {/* 8. CMS Pending Deposit */}
            <Card
              hover
              onClick={() => openDetailDrawer('cms_pending_deposit')}
              className="p-5 cursor-pointer transition-all duration-300 hover:-translate-y-0.5 group w-full min-w-0 border-red-500/20"
              role="button"
              tabIndex={0}
            >
              <div className="flex items-start justify-between">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/10 text-red-500 dark:text-red-400 ring-1 ring-red-500/30">
                  <AlertCircle className="h-5 w-5" />
                </div>
                {cmsStats.cmsPending > 0 && (
                  <span className="text-[10px] font-extrabold tracking-wider text-red-500 bg-red-500/10 border border-red-500/30 px-2.5 py-0.5 rounded-full uppercase">
                    PENDING
                  </span>
                )}
              </div>
              <p className="mt-3 text-sm font-medium text-neutral-500 truncate">CMS Pending Deposit</p>
              <p className={clsx('mt-1 text-2xl font-bold tabular-nums truncate', cmsStats.cmsPending > 0 ? 'text-red-500 dark:text-red-400' : 'text-emerald-500')}>
                {formatINR(cmsStats.cmsPending)}
              </p>
              <div className="mt-1.5 flex items-center justify-between text-xs text-neutral-500">
                <span>Cash Collected − Deposited</span>
                <ArrowRight className="h-3.5 w-3.5 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Card>

            {/* 9. Deposit Count */}
            <Card
              hover
              onClick={() => openDetailDrawer('deposit_count')}
              className="p-5 cursor-pointer transition-all duration-300 hover:-translate-y-0.5 group w-full min-w-0"
              role="button"
              tabIndex={0}
            >
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 dark:text-blue-400 ring-1 ring-blue-500/30">
                <FileBarChart className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-medium text-neutral-500 truncate">Deposit Count</p>
              <p className="mt-1 text-2xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums truncate">
                {cmsStats.count}
              </p>
              <div className="mt-1.5 flex items-center justify-between text-xs text-neutral-500">
                <span>Total bank deposit records</span>
                <ArrowRight className="h-3.5 w-3.5 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* SECTION 3: Main Page Filters Bar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5">From Date</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="input-base py-2 text-sm min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5">To Date</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="input-base py-2 text-sm min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5">Search Records</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Date, hub, reference, remarks..."
                className="input-base pl-9 py-2 text-sm min-h-[44px]"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* SECTION 4: Main CMS Deposition Records Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
            CMS Deposition Records
          </h2>
          <span className="text-xs text-neutral-500">{filteredDailyRows.length} visible dates</span>
        </div>

        {loading ? (
          <Card className="p-8 flex justify-center"><Spinner className="h-6 w-6" /></Card>
        ) : filteredDailyRows.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Landmark className="h-8 w-8" />}
              title="No CMS deposition records found"
              message={search ? 'Try adjusting your search or date range filters.' : 'Record your first cash deposit at the bank counter.'}
              action={canManage ? <Button icon={<Plus className="h-4 w-4" />} onClick={openAddDeposit}>Record Deposit</Button> : undefined}
            />
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 dark:bg-neutral-950/80 text-neutral-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold">Collection Date</th>
                    {isSuperAdmin && <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Hub</th>}
                    <th className="text-right px-4 py-3 font-semibold">Expected CMS (Cash)</th>
                    <th className="text-right px-4 py-3 font-semibold">Deposited</th>
                    <th className="text-right px-4 py-3 font-semibold">CMS Pending</th>
                    <th className="text-right px-4 py-3 font-semibold">Collection Shortage</th>
                    <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Reference</th>
                    <th className="text-center px-4 py-3 font-semibold">Status</th>
                    <th className="text-right px-5 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {filteredDailyRows.map((r) => {
                    const status = r.depositStatus;
                    const dateDeposits = deposits.filter((d) => d.deposit_date === r.date && d.hub_id === r.hubId);

                    return (
                      <tr
                        key={`${r.date}_${r.hubId}`}
                        onClick={() => openDetailDrawer('cms_pending_deposit')}
                        className="group hover:bg-neutral-50 dark:hover:bg-neutral-950/70 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-3.5 text-neutral-800 dark:text-neutral-200 font-semibold tabular-nums">
                          {formatDate(r.date)}
                        </td>
                        {isSuperAdmin && (
                          <td className="px-4 py-3.5 text-neutral-500 dark:text-neutral-400 hidden md:table-cell">
                            {r.hubName}
                          </td>
                        )}
                        <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-neutral-800 dark:text-neutral-200">
                          {formatINR(r.expectedCmsCash)}
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums font-bold text-emerald-500">
                          {formatINR(r.depositedAmount)}
                        </td>
                        <td className={clsx('px-4 py-3.5 text-right tabular-nums font-semibold', r.cmsPending > 0 ? 'text-red-500' : 'text-neutral-500')}>
                          {formatINR(r.cmsPending)}
                        </td>
                        <td className={clsx('px-4 py-3.5 text-right tabular-nums font-semibold', r.collectionShortage > 0 ? 'text-amber-500' : 'text-neutral-500')}>
                          {formatINR(r.collectionShortage)}
                        </td>
                        <td className="px-4 py-3.5 text-neutral-500 font-mono text-xs hidden lg:table-cell">
                          {r.references.length > 0 ? r.references.join(', ') : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={clsx(
                            'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold',
                            status === 'Fully Deposited'
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : status === 'Partially Deposited'
                              ? 'bg-amber-500/10 text-amber-500'
                              : status === 'Over Deposited'
                              ? 'bg-blue-500/10 text-blue-500'
                              : 'bg-red-500/10 text-red-500'
                          )}>
                            {status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            {canManage && dateDeposits.length > 0 && (
                              <>
                                <button
                                  onClick={() => openEditDeposit(dateDeposits[0])}
                                  title="Edit"
                                  className="p-2 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-600/15 transition active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center"
                                >
                                  <Edit3 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteDeposit(dateDeposits[0])}
                                  title="Delete"
                                  className="p-2 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-red-500 hover:bg-red-500/10 transition active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                            {canManage && dateDeposits.length === 0 && (
                              <button
                                onClick={openAddDeposit}
                                title="Record Deposit"
                                className="p-2 rounded-lg text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-600/15 transition active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center"
                              >
                                <Plus className="h-4 w-4" />
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
      </div>

      {/* SECTION 5: Interactive Card Drill-Down Drawer / Modal */}
      {activeDetail && (
        <DetailDrawer
          type={activeDetail}
          onClose={() => setActiveDetail(null)}
          entries={entries}
          deposits={deposits}
          dues={dues}
          recoveries={recoveries}
          collectors={collectors}
          dailyRows={filteredDailyRows}
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
          onExport={handleExportDetail}
          openAddShortage={openAddShortage}
          openRecoveryModal={openRecoveryModal}
          onMarkWrittenOff={handleMarkWrittenOff}
          canManage={canManage}
        />
      )}

      {/* SECTION 6: Record / Edit CMS Deposit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit CMS Deposit' : 'Record CMS Deposit'}
        subtitle="Deposit collected physical cash to bank / CMS counter"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving} className="min-h-[44px]">Cancel</Button>
            <Button onClick={handleSaveDeposit} loading={saving} className="min-h-[44px]">{editing ? 'Update Deposit' : 'Record Deposit'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Deposit Date"
            type="date"
            value={form.deposit_date}
            onChange={(e) => handleDepositDateChange(e.target.value)}
          />

          {(isSuperAdmin || hubCtx.isAllHubs) && hubCtx.accessibleHubs.length > 0 && (
            <Select
              label="Hub"
              value={form.hub_id}
              onChange={(e) => handleDepositHubChange(e.target.value)}
            >
              {hubCtx.accessibleHubs.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </Select>
          )}

          {autoTotals && !editing && (
            <div className="rounded-xl bg-brand-50 dark:bg-brand-600/10 border border-brand-600/30 p-4 animate-fade-in">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-brand-600">Physical Cash Collected for this Date</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Cash {formatINR(autoTotals.cash)} · Online {formatINR(autoTotals.online)} (Online is excluded)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={applyAutoTotals}
                  className="shrink-0 rounded-lg bg-brand-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-brand-700 transition active:scale-95 min-h-[44px]"
                >
                  Auto-fill Cash
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Cash Collected (Physical Cash)"
              type="number"
              value={form.cash_collected}
              onChange={(e) => setForm((f) => ({ ...f, cash_collected: e.target.value }))}
              placeholder="0"
            />
            <Input
              label="Online Amount (Reference Only)"
              type="number"
              value={form.online_amount}
              onChange={(e) => setForm((f) => ({ ...f, online_amount: e.target.value }))}
              placeholder="0"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl bg-brand-50 dark:bg-brand-600/10 border border-brand-600/30 p-4">
              <p className="text-xs font-semibold text-brand-600">Expected CMS Cash Baseline</p>
              <p className="text-xl font-bold text-brand-600 tabular-nums mt-1">{formatINR(expectedCashForCmsModal)}</p>
            </div>
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4">
              <p className="text-xs font-semibold text-emerald-500">Total Cash Depositing</p>
              <p className="text-xl font-bold text-emerald-500 tabular-nums mt-1">{formatINR(totalToCms)}</p>
            </div>
          </div>

          <div className={clsx('rounded-xl border p-4', computedShortModal > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-emerald-500/10 border-emerald-500/30')}>
            <div className="flex items-center justify-between gap-3">
              <p className={clsx('text-sm font-semibold', computedShortModal > 0 ? 'text-red-500' : 'text-emerald-500')}>
                {computedShortModal > 0 ? 'CMS Pending Amount' : 'Fully Deposited'}
              </p>
              <p className={clsx('text-xl font-bold tabular-nums', computedShortModal > 0 ? 'text-red-500' : 'text-emerald-500')}>
                {formatINR(computedShortModal)}
              </p>
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Expected CMS Cash {formatINR(expectedCashForCmsModal)} − Deposited {formatINR(totalToCms)} = Pending {formatINR(computedShortModal)}
            </p>
          </div>

          <Input
            label="Reference Number / Bank Slip (optional)"
            value={form.reference_number}
            onChange={(e) => setForm({ ...form, reference_number: e.target.value })}
            placeholder="Bank slip or CMS receipt ID…"
          />

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Remarks (optional)</label>
            <textarea
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              rows={2}
              placeholder="Notes regarding this bank deposit…"
              className="input-base resize-none"
            />
          </div>
        </div>
      </Modal>

      {/* SECTION 7: Add Shortage Entry Modal */}
      <Modal
        open={shortageModalOpen}
        onClose={() => setShortageModalOpen(false)}
        title="Add Shortage Entry"
        subtitle="Record an employee collection shortfall with reason tagging"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setShortageModalOpen(false)} disabled={shortageSaving} className="min-h-[44px]">Cancel</Button>
            <Button onClick={handleSaveShortage} loading={shortageSaving} className="min-h-[44px]">+ Save Shortage Entry</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Shortage Date"
            type="date"
            value={shortageForm.shortage_date}
            onChange={(e) => setShortageForm((f) => ({ ...f, shortage_date: e.target.value }))}
          />

          {(isSuperAdmin || hubCtx.isAllHubs) && hubCtx.accessibleHubs.length > 0 && (
            <Select
              label="Hub"
              value={shortageForm.hub_id}
              onChange={(e) => setShortageForm((f) => ({ ...f, hub_id: e.target.value }))}
            >
              {hubCtx.accessibleHubs.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </Select>
          )}

          <Select
            label="Employee (Collector)"
            value={shortageForm.collector_id}
            onChange={(e) => handleShortageCollectorChange(e.target.value)}
          >
            <option value="">Select Employee…</option>
            {collectors.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.employee_id})</option>
            ))}
          </Select>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Expected COD"
              type="number"
              value={shortageForm.expected_cod}
              onChange={(e) => setShortageForm((f) => ({ ...f, expected_cod: e.target.value }))}
              placeholder="0"
            />
            <Input
              label="Cash Collected"
              type="number"
              value={shortageForm.cash_collected}
              onChange={(e) => setShortageForm((f) => ({ ...f, cash_collected: e.target.value }))}
              placeholder="0"
            />
            <Input
              label="Online Collected"
              type="number"
              value={shortageForm.online_amount}
              onChange={(e) => setShortageForm((f) => ({ ...f, online_amount: e.target.value }))}
              placeholder="0"
            />
          </div>

          <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-red-500">Auto-Calculated Shortage</span>
              <span className="text-xl font-bold text-red-500 tabular-nums">{formatINR(calculatedShortageAmount)}</span>
            </div>
            <p className="text-xs text-red-500/70 mt-1">
              Shortage = Expected COD − (Cash + Online)
            </p>
          </div>

          <Select
            label="Shortage Reason"
            value={shortageForm.reason}
            onChange={(e) => setShortageForm((f) => ({ ...f, reason: e.target.value }))}
          >
            {SHORTAGE_REASONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </Select>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
              Remarks {shortageForm.reason === 'Other' && <span className="text-red-500">* (Required)</span>}
            </label>
            <textarea
              value={shortageForm.remarks}
              onChange={(e) => setShortageForm({ ...shortageForm, remarks: e.target.value })}
              rows={2}
              placeholder="Provide investigation notes or explanation…"
              className="input-base resize-none"
            />
          </div>
        </div>
      </Modal>

      {/* SECTION 8: Record Recovery Modal */}
      {recoveryTargetDue && (
        <Modal
          open={recoveryModalOpen}
          onClose={() => setRecoveryModalOpen(false)}
          title="Record Shortage Recovery"
          subtitle={`Recovering shortage for ${recoveryTargetDue.collector?.name ?? 'Employee'}`}
          size="md"
          footer={
            <>
              <Button variant="outline" onClick={() => setRecoveryModalOpen(false)} disabled={recoverySaving} className="min-h-[44px]">Cancel</Button>
              <Button onClick={handleSaveRecovery} loading={recoverySaving} className="min-h-[44px]">Record Recovery</Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="rounded-xl bg-neutral-100 dark:bg-neutral-900 p-4 space-y-1">
              <p className="text-xs text-neutral-500">Original Shortage: <strong>{formatINR(recoveryTargetDue.original_amount)}</strong></p>
              <p className="text-xs text-neutral-500">Already Recovered: <strong>{formatINR(recoveryTargetDue.recovered_amount)}</strong></p>
              <p className="text-sm font-bold text-red-500">Remaining Backlog: {formatINR(recoveryTargetDue.remaining_amount)}</p>
            </div>

            <Input
              label="Recovery Date"
              type="date"
              value={recoveryForm.recovery_date}
              onChange={(e) => setRecoveryForm((f) => ({ ...f, recovery_date: e.target.value }))}
            />

            <Input
              label="Recovery Amount"
              type="number"
              value={recoveryForm.amount}
              onChange={(e) => setRecoveryForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="0"
            />

            <Select
              label="Payment Mode"
              value={recoveryForm.payment_mode}
              onChange={(e) => setRecoveryForm((f) => ({ ...f, payment_mode: e.target.value as any }))}
            >
              <option value="cash">Cash</option>
              <option value="online">Online / UPI</option>
              <option value="other">Other / Salary Deduction</option>
            </Select>

            <Input
              label="Reference Number (optional)"
              value={recoveryForm.reference_number}
              onChange={(e) => setRecoveryForm((f) => ({ ...f, reference_number: e.target.value }))}
              placeholder="Transaction or receipt reference…"
            />

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Notes (optional)</label>
              <textarea
                value={recoveryForm.notes}
                onChange={(e) => setRecoveryForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="Additional notes about this recovery…"
                className="input-base resize-none"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Drawer Component for Interactive Card Drill-Downs
function DetailDrawer({
  type, onClose, entries, deposits, dues, recoveries, collectors, dailyRows,
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
  dailyRows: DailyCmsRow[];
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
    expected_cms_cash: 'Expected CMS Cash Details',
    total_deposited: 'Bank Cash Deposit Transactions',
    cms_pending_deposit: 'CMS Pending Deposit Audit',
    deposit_count: 'Deposit Transaction Log',
  };

  const icons: Record<string, any> = {
    total_expected_cod: Wallet,
    total_collection: Landmark,
    cash_collected: Banknote,
    online_collected: Smartphone,
    collection_shortage: TrendingDown,
    expected_cms_cash: Banknote,
    total_deposited: Landmark,
    cms_pending_deposit: AlertCircle,
    deposit_count: FileBarChart,
  };

  const IconComp = icons[type ?? ''] || FileText;
  const q = detailSearch.trim().toLowerCase();

  // Filtered rows calculation depending on drawer type
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (detailFilterEmployee !== 'all' && e.collector_id !== detailFilterEmployee) return false;
      if (type === 'cash_collected' && safeAmount(e.cash_amount) <= 0) return false;
      if (type === 'online_collected' && safeAmount(e.online_amount) <= 0) return false;
      if (detailFilterStatus === 'cash' && safeAmount(e.cash_amount) <= 0) return false;
      if (detailFilterStatus === 'online' && safeAmount(e.online_amount) <= 0) return false;
      if (detailFilterStatus !== 'all' && detailFilterStatus !== 'cash' && detailFilterStatus !== 'online' && e.status !== detailFilterStatus) return false;
      if (!q) return true;
      const name = e.collector?.name?.toLowerCase() ?? '';
      const empId = e.collector?.employee_id?.toLowerCase() ?? '';
      const rem = e.remarks?.toLowerCase() ?? '';
      return name.includes(q) || empId.includes(q) || rem.includes(q);
    });
  }, [entries, type, detailFilterEmployee, detailFilterStatus, q]);

  // Shortage Entries & Dues for Shortage Investigation
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

  // Daily CMS Pending Rows for CMS Pending Drawer
  const pendingCmsRows = useMemo(() => {
    return dailyRows.filter(r => r.cmsPending > 0);
  }, [dailyRows]);

  // Deposits Filtered
  const filteredDeposits = useMemo(() => {
    return deposits.filter((d) => {
      if (!q) return true;
      const ref = d.reference_number?.toLowerCase() ?? '';
      const rem = d.remarks?.toLowerCase() ?? '';
      return ref.includes(q) || rem.includes(q);
    });
  }, [deposits, q]);

  // Dynamic Total calculation in Drawer
  const drawerTotalAmount = useMemo(() => {
    if (type === 'total_expected_cod') {
      return filteredEntries.reduce((s, e) => s + safeAmount(e.expected_cod), 0);
    }
    if (type === 'total_collection') {
      return filteredEntries.reduce((s, e) => s + safeAmount(e.total_collection), 0);
    }
    if (type === 'cash_collected' || type === 'expected_cms_cash') {
      return filteredEntries.reduce((s, e) => s + safeAmount(e.cash_amount), 0);
    }
    if (type === 'online_collected') {
      return filteredEntries.reduce((s, e) => s + safeAmount(e.online_amount), 0);
    }
    if (type === 'collection_shortage') {
      return shortageRecords.reduce((s, e) => s + (safeAmount(e.expected_cod) - safeAmount(e.total_collection)), 0);
    }
    if (type === 'total_deposited') {
      return filteredDeposits.reduce((s, d) => s + safeAmount(d.total_deposited ?? d.cash_deposited), 0);
    }
    if (type === 'cms_pending_deposit') {
      return pendingCmsRows.reduce((s, r) => s + r.cmsPending, 0);
    }
    return filteredDeposits.length;
  }, [type, filteredEntries, shortageRecords, filteredDeposits, pendingCmsRows]);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-4xl bg-[var(--card-bg)] shadow-2xl h-full flex flex-col min-w-0 border-l border-neutral-200 dark:border-neutral-800 animate-slide-in">
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0 bg-neutral-50 dark:bg-neutral-950">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-600/15 text-brand-600 ring-1 ring-brand-600/30 shrink-0">
              <IconComp className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100 truncate">
                {titles[type ?? '']}
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500 mt-0.5">
                <span>{formatDate(from)} — {formatDate(to)}</span>
                {selectedHubName && <span>· {selectedHubName}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              icon={<Download className="h-4 w-4" />}
              onClick={onExport}
              className="min-h-[44px] text-xs font-semibold"
            >
              Export
            </Button>
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Total Summary Highlight Banner inside Drawer */}
        <div className="p-4 bg-brand-50/50 dark:bg-brand-600/10 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Filtered Total Amount</p>
            <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">
              {type === 'deposit_count' ? drawerTotalAmount : formatINR(drawerTotalAmount)}
            </p>
          </div>
          {type === 'collection_shortage' && canManage && (
            <Button
              icon={<Plus className="h-4 w-4" />}
              onClick={openAddShortage}
              className="min-h-[44px] px-3.5 text-xs font-semibold shadow-glow"
            >
              + Add Shortage Entry
            </Button>
          )}
        </div>

        {/* Filter Toolbar inside Drawer */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 space-y-3 shrink-0">
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                value={detailSearch}
                onChange={(e) => setDetailSearch(e.target.value)}
                placeholder="Search by employee name, employee ID, or notes…"
                className="input-base pl-9 py-2 text-sm min-h-[44px]"
              />
            </div>
            {collectors.length > 0 && (
              <Select
                value={detailFilterEmployee}
                onChange={(e) => setDetailFilterEmployee(e.target.value)}
                className="w-full sm:w-48 min-h-[44px] text-xs"
              >
                <option value="all">All Employees</option>
                {collectors.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.employee_id})</option>
                ))}
              </Select>
            )}
          </div>

          {/* Conditional Secondary Filters */}
          {type === 'total_collection' && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
              {['all', 'cash', 'online', 'reconciled', 'shortage', 'excess'].map((st) => (
                <button
                  key={st}
                  onClick={() => setDetailFilterStatus(st)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-medium capitalize shrink-0 transition min-h-[36px]',
                    detailFilterStatus === st ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                  )}
                >
                  {st}
                </button>
              ))}
            </div>
          )}

          {type === 'collection_shortage' && (
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={detailFilterRecovery}
                onChange={(e) => setDetailFilterRecovery(e.target.value)}
                className="min-h-[40px] text-xs"
              >
                <option value="all">All Recovery Statuses</option>
                <option value="outstanding">Outstanding</option>
                <option value="partially_recovered">Partially Recovered</option>
                <option value="fully_recovered">Fully Recovered</option>
              </Select>
              <Select
                value={detailFilterReason}
                onChange={(e) => setDetailFilterReason(e.target.value)}
                className="min-h-[40px] text-xs"
              >
                <option value="all">All Reasons</option>
                {SHORTAGE_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </Select>
            </div>
          )}
        </div>

        {/* Drawer Body List / Table */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Online Collected Notice */}
          {type === 'online_collected' && (
            <div className="rounded-xl bg-blue-500/10 border border-blue-500/30 p-3.5 flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-blue-500 shrink-0" />
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                Online payments are digital transactions directly received into bank accounts. They are excluded from physical CMS cash deposits.
              </p>
            </div>
          )}

          {/* 1. Shortage Investigation View */}
          {type === 'collection_shortage' ? (
            shortageRecords.length === 0 ? (
              <EmptyState icon={<CheckCircle2 className="h-8 w-8 text-emerald-500" />} title="No shortage records found" message="All collection entries in this view match expected COD." />
            ) : (
              <div className="space-y-3">
                {shortageRecords.map((e) => {
                  const shortageAmt = safeAmount(e.expected_cod) - safeAmount(e.total_collection);
                  const linkedDue = dues.find(d => d.collection_entry_id === e.id || (d.collector_id === e.collector_id && d.due_date === e.collection_date));
                  const status = linkedDue?.status ?? 'outstanding';
                  const recovered = safeAmount(linkedDue?.recovered_amount);
                  const remaining = safeAmount(linkedDue?.remaining_amount ?? shortageAmt);
                  const linkedRecs = recoveries.filter(r => r.due_id === linkedDue?.id);
                  const isExpanded = expandedHistoryId === e.id;

                  return (
                    <Card key={e.id} className="p-4 space-y-3 border-red-500/20">
                      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center font-bold text-sm shrink-0">
                            {e.collector?.name?.charAt(0).toUpperCase() ?? '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-neutral-900 dark:text-neutral-100 truncate text-sm">{e.collector?.name ?? '—'}</p>
                            <p className="text-xs text-neutral-500 font-mono">Emp ID: {e.collector?.employee_id ?? '—'} · Date: {formatDate(e.collection_date)}</p>
                          </div>
                        </div>

                        <span className={clsx(
                          'rounded-full px-2.5 py-0.5 text-[11px] font-bold',
                          status === 'fully_recovered' ? 'bg-emerald-500/10 text-emerald-500' : status === 'partially_recovered' ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'
                        )}>
                          {DUE_STATUS_LABELS[status]}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="rounded-lg bg-neutral-100 dark:bg-neutral-900 p-2 text-center">
                          <p className="text-neutral-500">Expected COD</p>
                          <p className="font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">{formatINR(e.expected_cod)}</p>
                        </div>
                        <div className="rounded-lg bg-neutral-100 dark:bg-neutral-900 p-2 text-center">
                          <p className="text-neutral-500">Total Collected</p>
                          <p className="font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">{formatINR(e.total_collection)}</p>
                        </div>
                        <div className="rounded-lg bg-red-500/10 p-2 text-center">
                          <p className="text-red-500">Original Shortage</p>
                          <p className="font-bold text-red-500 tabular-nums">{formatINR(shortageAmt)}</p>
                        </div>
                        <div className="rounded-lg bg-emerald-500/10 p-2 text-center">
                          <p className="text-emerald-500">Remaining Backlog</p>
                          <p className="font-bold text-emerald-500 tabular-nums">{formatINR(remaining)}</p>
                        </div>
                      </div>

                      {e.remarks && (
                        <div className="text-xs bg-neutral-50 dark:bg-neutral-950 p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800">
                          <span className="font-semibold text-neutral-700 dark:text-neutral-300">Investigation Notes: </span>
                          <span className="text-neutral-600 dark:text-neutral-400">{e.remarks}</span>
                        </div>
                      )}

                      {linkedRecs.length > 0 && (
                        <div className="text-xs">
                          <button
                            onClick={() => setExpandedHistoryId(isExpanded ? null : e.id)}
                            className="text-brand-600 font-semibold flex items-center gap-1 hover:underline min-h-[36px]"
                          >
                            <Clock className="h-3.5 w-3.5" />
                            {isExpanded ? 'Hide Recovery History' : `View ${linkedRecs.length} Recovery Transactions`}
                          </button>
                          {isExpanded && (
                            <div className="mt-2 space-y-1.5 pl-3 border-l-2 border-brand-500/30">
                              {linkedRecs.map((r) => (
                                <div key={r.id} className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
                                  <span>{formatDate(r.recovery_date)} ({r.payment_mode})</span>
                                  <span className="font-bold text-emerald-500 tabular-nums">+{formatINR(r.amount)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                        {canManage && status !== 'fully_recovered' && linkedDue && (
                          <Button
                            size="sm"
                            icon={<RotateCcw className="h-3.5 w-3.5" />}
                            onClick={() => openRecoveryModal(linkedDue)}
                            className="min-h-[44px] text-xs font-semibold"
                          >
                            Record Recovery
                          </Button>
                        )}
                        {canManage && status !== 'fully_recovered' && linkedDue && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onMarkWrittenOff(linkedDue)}
                            className="min-h-[44px] text-xs text-red-500 border-red-500/30 hover:bg-red-500/10"
                          >
                            Mark Written Off
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )

          /* 2. CMS Pending Deposit Specific View */
          ) : type === 'cms_pending_deposit' ? (
            pendingCmsRows.length === 0 ? (
              <EmptyState icon={<CheckCircle2 className="h-8 w-8 text-emerald-500" />} title="No pending CMS deposits" message="All physical cash collected across visible dates has been fully deposited." />
            ) : (
              <div className="space-y-3">
                {pendingCmsRows.map((r) => (
                  <Card key={`${r.date}_${r.hubId}`} className="p-4 space-y-3 border-red-500/20">
                    <div className="flex items-center justify-between text-xs border-b border-neutral-200 dark:border-neutral-800 pb-2">
                      <span className="font-bold text-neutral-900 dark:text-neutral-100">{formatDate(r.date)}</span>
                      <span className="font-semibold text-neutral-500">{r.hubName}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-lg bg-neutral-100 dark:bg-neutral-900 p-2">
                        <p className="text-neutral-500">Cash Collected</p>
                        <p className="font-bold text-neutral-800 dark:text-neutral-200 tabular-nums">{formatINR(r.cashCollected)}</p>
                      </div>
                      <div className="rounded-lg bg-emerald-500/10 p-2">
                        <p className="text-emerald-500">Deposited Amount</p>
                        <p className="font-bold text-emerald-500 tabular-nums">{formatINR(r.depositedAmount)}</p>
                      </div>
                      <div className="rounded-lg bg-red-500/10 p-2">
                        <p className="text-red-500">CMS Pending</p>
                        <p className="font-bold text-red-500 tabular-nums">{formatINR(r.cmsPending)}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-neutral-500">Deposit Status:</span>
                      <span className="font-bold text-amber-500">{r.depositStatus}</span>
                    </div>
                    {r.references.length > 0 && (
                      <p className="text-xs text-neutral-500 font-mono">Reference Slip: {r.references.join(', ')}</p>
                    )}
                  </Card>
                ))}
              </div>
            )

          /* 3. CMS Deposits / Deposits Count View */
          ) : type === 'total_deposited' || type === 'deposit_count' || type === 'expected_cms_cash' ? (
            filteredDeposits.length === 0 ? (
              <EmptyState icon={<Landmark className="h-8 w-8" />} title="No deposit records found" message="No bank deposit transactions match your active filters." />
            ) : (
              <div className="space-y-3">
                {filteredDeposits.map((d) => {
                  const expectedCms = safeAmount(d.total_expected_cms ?? d.total_cash_collected);
                  const deposited = safeAmount(d.total_deposited ?? d.cash_deposited);
                  const pending = Math.max(0, expectedCms - deposited);

                  return (
                    <Card key={d.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-neutral-900 dark:text-neutral-100">{formatDate(d.deposit_date)}</span>
                        <span className="font-mono text-neutral-500">Ref: {d.reference_number ?? '—'}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-lg bg-neutral-100 dark:bg-neutral-900 p-2">
                          <p className="text-neutral-500">Cash Collected</p>
                          <p className="font-bold text-neutral-800 dark:text-neutral-200 tabular-nums">{formatINR(expectedCms)}</p>
                        </div>
                        <div className="rounded-lg bg-emerald-500/10 p-2">
                          <p className="text-emerald-500">Deposited</p>
                          <p className="font-bold text-emerald-500 tabular-nums">{formatINR(deposited)}</p>
                        </div>
                        <div className="rounded-lg bg-red-500/10 p-2">
                          <p className="text-red-500">CMS Pending</p>
                          <p className="font-bold text-red-500 tabular-nums">{formatINR(pending)}</p>
                        </div>
                      </div>
                      {d.remarks && <p className="text-xs text-neutral-500 italic">"{d.remarks}"</p>}
                    </Card>
                  );
                })}
              </div>
            )

          /* 4. General Collection Entries Detail View */
          ) : (
            filteredEntries.length === 0 ? (
              <EmptyState icon={<Inbox className="h-8 w-8" />} title="No entries found" message="No collection entries match your active filters." />
            ) : (
              <div className="space-y-3">
                {filteredEntries.map((e) => {
                  const diff = safeAmount(e.total_collection) - safeAmount(e.expected_cod);
                  return (
                    <Card key={e.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-neutral-900 dark:text-neutral-100">{e.collector?.name ?? '—'}</p>
                          <p className="text-neutral-500 font-mono">Emp ID: {e.collector?.employee_id ?? '—'} · Date: {formatDate(e.collection_date)}</p>
                        </div>
                        <StatusBadge status={e.status} size="sm" />
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center text-xs">
                        <div className="rounded-lg bg-neutral-100 dark:bg-neutral-900 p-2">
                          <p className="text-neutral-500">Expected COD</p>
                          <p className="font-bold text-neutral-800 dark:text-neutral-200 tabular-nums">{formatINR(e.expected_cod)}</p>
                        </div>
                        <div className="rounded-lg bg-emerald-500/10 p-2">
                          <p className="text-emerald-500">Cash</p>
                          <p className="font-bold text-emerald-500 tabular-nums">{formatINR(e.cash_amount)}</p>
                        </div>
                        <div className="rounded-lg bg-blue-500/10 p-2">
                          <p className="text-blue-500">Online</p>
                          <p className="font-bold text-blue-500 tabular-nums">{formatINR(e.online_amount)}</p>
                        </div>
                        <div className="rounded-lg bg-neutral-100 dark:bg-neutral-900 p-2">
                          <p className="text-neutral-500">Total</p>
                          <p className="font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">{formatINR(e.total_collection)}</p>
                        </div>
                      </div>
                      {diff !== 0 && (
                        <div className="text-xs flex items-center justify-between pt-1">
                          <span className="text-neutral-500">Reconciliation Gap:</span>
                          <span className={clsx('font-bold tabular-nums', diff < 0 ? 'text-red-500' : 'text-amber-500')}>
                            {diff < 0 ? '-' : '+'}{formatINR(Math.abs(diff))}
                          </span>
                        </div>
                      )}
                      {e.remarks && <p className="text-xs text-neutral-500 italic">"{e.remarks}"</p>}
                    </Card>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 flex justify-end shrink-0">
          <Button variant="outline" onClick={onClose} className="min-h-[44px] px-5 font-semibold">
            Close Panel
          </Button>
        </div>
      </div>
    </div>
  );
}
