import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { Button,Card,EmptyState,Input,Select,Skeleton,Spinner } from '@/components/ui/primitives';
import { logAudit } from '@/lib/audit';
import { useAuth } from '@/lib/auth';
import { confirm } from '@/lib/confirm';
import { formatDate,formatINR,toISODate } from '@/lib/format';
import { useHub } from '@/lib/hubContext';
import { supabase } from '@/lib/supabase';
import { CmsDeposit,CollectionEntry,Collector,Due,Recovery } from '@/types';
import { clsx } from 'clsx';
import { subDays } from 'date-fns';
import {
AlertCircle,
Banknote,
Building2,
Calendar,
Download,
Edit3,
FileBarChart,
FileText,
Landmark,
Plus,
Search,
Trash2,
TrendingUp,
X
} from 'lucide-react';
import { useCallback,useEffect,useMemo,useState } from 'react';
import * as XLSX from 'xlsx';

type DetailType = 'expected' | 'deposited' | 'pending' | 'count' | null;

const safeAmount = (val: any): number => {
  if (val === null || val === undefined) return 0;
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  return isNaN(num) ? 0 : num;
};

// Helper for date key normalization (every deposit belongs to EXACTLY ONE date)
export function getDepositDate(d: CmsDeposit): string {
  return d.collection_date || d.deposit_date;
}

// Authoritative deposit amount helper
export function getDepositAmount(d: CmsDeposit): number {
  const total = safeAmount(d.total_deposited);
  const split = safeAmount(d.cash_submitted) + safeAmount(d.online_submitted);
  if (total > 0) return total;
  if (split > 0) return split;
  return safeAmount(d.cash_deposited);
}

// Helpers for Cash and Online submitted amounts
export function getCashSubmittedAmount(d: CmsDeposit): number {
  const total = getDepositAmount(d);
  const cash = safeAmount(d.cash_submitted);
  const online = safeAmount(d.online_submitted);
  if (cash > 0) return cash;
  if (online > 0) return Math.max(0, total - online);
  return total;
}

export function getOnlineSubmittedAmount(d: CmsDeposit): number {
  return safeAmount(d.online_submitted);
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

// Daily Date Row Schema for Hub/Date-level CMS deposition
export interface DailyCmsRow {
  date: string;
  hubId: string;
  hubName: string;
  expectedCod: number;
  cashCollected: number;
  onlineCollected: number;
  totalCollection: number; // cashCollected + onlineCollected
  collectionShortage: number; // max(expectedCod - totalCollection, 0)
  totalExpectedCms: number; // strictly equals expectedCod
  cashSubmitted: number; // sum of getCashSubmittedAmount(deposit)
  onlineSubmitted: number; // sum of getOnlineSubmittedAmount(deposit)
  totalDeposited: number; // sum of getDepositAmount(deposit)
  cmsPending: number; // max(totalExpectedCms - totalDeposited, 0)
  cmsExcess: number; // max(totalDeposited - totalExpectedCms, 0)
  status: 'Fully Deposited' | 'Partially Deposited' | 'Not Deposited' | 'Over Deposited';
  depositCount: number;
  references: string[];
  depositDates: string[];
  remarks: string[];
}

interface FormState {
  collection_date: string;
  deposit_date: string;
  hub_id: string;
  cash_submitted: string;
  online_submitted: string;
  reference_number: string;
  bank_name: string;
  remarks: string;
}

const emptyForm: FormState = {
  collection_date: toISODate(new Date()),
  deposit_date: toISODate(new Date()),
  hub_id: '',
  cash_submitted: '',
  online_submitted: '',
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
  const [_dues, setDues] = useState<Due[]>([]);
  const [_recoveries, setRecoveries] = useState<Recovery[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);

  const [search, setSearch] = useState('');
  const [from, setFrom] = useState(toISODate(subDays(new Date(), 29)));
  const [to, setTo] = useState(toISODate(new Date()));

  // General Record Deposit Form Modal
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

  // Card Detail Modal state
  const [activeDetail, setActiveDetail] = useState<DetailType>(null);
  const [detailSearch, setDetailSearch] = useState('');

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
        .select('*, hub: hubs(*)')
        .gte('deposit_date', from)
        .lte('deposit_date', to)
        .order('created_at', { ascending: false });
      if (effectiveHubId) depQ = depQ.eq('hub_id', effectiveHubId);
      const { data: depData, error: depErr } = await depQ;
      if (depErr) throw depErr;
      const fetchedDeposits = (depData ?? []) as CmsDeposit[];
      setDeposits(fetchedDeposits);

      // Temporary debug log in development
      if (import.meta.env.DEV) {
        console.table(fetchedDeposits.map(d => ({
          id: d.id,
          relatedDate: getDepositDate(d),
          cashSubmitted: d.cash_submitted,
          onlineSubmitted: d.online_submitted,
          totalDeposited: d.total_deposited,
          normalizedAmount: getDepositAmount(d)
        })));
      }

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
      console.error('Failed to load deposition data:', err);
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
    
    // Collection Shortage = max(expected_cod - total_collection, 0)
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

  // Daily Normalized Rows Aggregation (CMS is Hub/Date level, each deposit attached to EXACTLY ONE date)
  const dailyRows = useMemo<DailyCmsRow[]>(() => {
    const map = new Map<string, { date: string; hubId: string; hubName: string }>();

    entries.forEach((e) => {
      const key = `${e.collection_date}_${e.hub_id}`;
      if (!map.has(key)) {
        map.set(key, { date: e.collection_date, hubId: e.hub_id, hubName: e.hub?.name ?? '—' });
      }
    });

    deposits.forEach((d) => {
      const cDate = getDepositDate(d);
      const key = `${cDate}_${d.hub_id}`;
      if (!map.has(key)) {
        map.set(key, { date: cDate, hubId: d.hub_id, hubName: d.hub?.name ?? '—' });
      }
    });

    const rows: DailyCmsRow[] = [];

    map.forEach(({ date, hubId, hubName }) => {
      const dateEntries = entries.filter((e) => e.collection_date === date && e.hub_id === hubId);
      // Strictly filter deposits where getDepositDate(d) === date so each deposit belongs to EXACTLY ONE date row
      const dateDeposits = deposits.filter((d) => getDepositDate(d) === date && d.hub_id === hubId);

      const expectedCod = dateEntries.reduce((s, e) => s + safeAmount(e.expected_cod), 0);
      const cashCollected = dateEntries.reduce((s, e) => s + safeAmount(e.cash_amount), 0);
      const onlineCollected = dateEntries.reduce((s, e) => s + safeAmount(e.online_amount), 0);
      const totalCollection = cashCollected + onlineCollected;

      const collectionShortage = Math.max(0, expectedCod - totalCollection);

      // Total Expected CMS strictly equals Total Expected COD!
      const totalExpectedCms = expectedCod;
      const cashSubmitted = dateDeposits.reduce((s, d) => s + getCashSubmittedAmount(d), 0);
      const onlineSubmitted = dateDeposits.reduce((s, d) => s + getOnlineSubmittedAmount(d), 0);
      const totalDeposited = dateDeposits.reduce((s, d) => s + getDepositAmount(d), 0);

      const cmsPending = Math.max(0, totalExpectedCms - totalDeposited);
      const cmsExcess = Math.max(0, totalDeposited - totalExpectedCms);

      let status: DailyCmsRow['status'] = 'Not Deposited';
      if (totalDeposited > totalExpectedCms) {
        status = 'Over Deposited';
      } else if (totalDeposited === 0 && totalExpectedCms > 0) {
        status = 'Not Deposited';
      } else if (totalDeposited > 0 && totalDeposited < totalExpectedCms) {
        status = 'Partially Deposited';
      } else if (totalDeposited === totalExpectedCms) {
        status = 'Fully Deposited';
      } else if (totalExpectedCms === 0 && totalDeposited === 0) {
        status = 'Fully Deposited';
      }

      const references = dateDeposits.map(d => d.reference_number || d.cash_reference || d.online_reference).filter(Boolean) as string[];
      const depositDates = dateDeposits.map(d => d.deposit_date);
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
        totalExpectedCms,
        cashSubmitted,
        onlineSubmitted,
        totalDeposited,
        cmsPending,
        cmsExcess,
        status,
        depositCount: dateDeposits.length,
        references,
        depositDates,
        remarks,
      });
    });

    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, deposits]);

  // Search Filtered Daily Rows
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

  // Individual Deposit Transactions (filtered)
  const depositTransactions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return deposits;
    return deposits.filter((d) => {
      const dateStr = getDepositDate(d).toLowerCase();
      const hub = (d.hub?.name ?? '').toLowerCase();
      const ref = (d.reference_number ?? '').toLowerCase();
      const bank = (d.bank_name ?? '').toLowerCase();
      const rem = (d.remarks ?? '').toLowerCase();
      return dateStr.includes(q) || hub.includes(q) || ref.includes(q) || bank.includes(q) || rem.includes(q);
    });
  }, [deposits, search]);

  // Section 2: CMS Summary Cards (strictly derived from visible normalized date rows)
  const cmsSummaryStats = useMemo(() => {
    // Total Expected CMS card = sum of expectedCod once per visible collection date
    const totalExpectedCms = filteredDailyRows.reduce((s, r) => s + r.totalExpectedCms, 0);
    // Total Deposited card = sum of all valid deposit transaction amounts
    const totalDeposited = depositTransactions.reduce((s, d) => s + getDepositAmount(d), 0);
    // CMS Pending Deposit card = sum of max(expectedCod - totalDeposited, 0) across dates
    const cmsPending = filteredDailyRows.reduce((s, r) => s + Math.max(0, r.totalExpectedCms - r.totalDeposited), 0);
    // CMS Excess card = sum of max(totalDeposited - expectedCod, 0) across dates
    const cmsExcess = filteredDailyRows.reduce((s, r) => s + Math.max(0, r.totalDeposited - r.totalExpectedCms), 0);

    return {
      totalExpectedCms,
      totalDeposited,
      cmsPending,
      cmsExcess,
      depositCount: depositTransactions.length,
    };
  }, [filteredDailyRows, depositTransactions]);

  // Record CMS Deposit Form Modal Actions
  const openAddDeposit = (prefillRow?: DailyCmsRow) => {
    const presetHub = prefillRow?.hubId || activeHubId || (hubCtx.accessibleHubs[0]?.id ?? '');
    const defaultDate = prefillRow?.date || toISODate(new Date());

    setForm({
      collection_date: defaultDate,
      deposit_date: toISODate(new Date()),
      hub_id: presetHub,
      cash_submitted: '',
      online_submitted: '',
      reference_number: '',
      bank_name: '',
      remarks: '',
    });
    setEditing(null);
    setModalOpen(true);
  };

  const openEditDeposit = (d: CmsDeposit) => {
    setEditing(d);
    const cashSub = safeAmount(d.cash_submitted) > 0
      ? String(d.cash_submitted)
      : String(safeAmount(d.cash_deposited ?? d.total_deposited));
    const onlineSub = safeAmount(d.online_submitted) > 0
      ? String(d.online_submitted)
      : String(safeAmount((d as any).online_amount));

    setForm({
      collection_date: d.collection_date || d.deposit_date,
      deposit_date: d.deposit_date,
      hub_id: d.hub_id,
      cash_submitted: cashSub,
      online_submitted: onlineSub,
      reference_number: d.reference_number ?? '',
      bank_name: d.bank_name ?? '',
      remarks: d.remarks ?? '',
    });
    setModalOpen(true);
  };

  // Live calculation preview for Record CMS Deposit Form
  const depositPreview = useMemo(() => {
    const cDate = form.collection_date;
    if (!cDate) return null;

    const matchedEntries = entries.filter(e => e.collection_date === cDate);
    const expectedCod = matchedEntries.reduce((s, e) => s + safeAmount(e.expected_cod), 0);
    const cashCollected = matchedEntries.reduce((s, e) => s + safeAmount(e.cash_amount), 0);
    const onlineCollected = matchedEntries.reduce((s, e) => s + safeAmount(e.online_amount), 0);
    const totalCollection = cashCollected + onlineCollected;
    const totalExpectedCms = expectedCod;

    // Sum prior deposits excluding current editing record to avoid double counting
    const priorDeposits = deposits.filter(d => getDepositDate(d) === cDate && (!editing || d.id !== editing.id));
    const alreadySubmitted = priorDeposits.reduce((s, d) => s + getDepositAmount(d), 0);

    const newCashSubmitted = safeAmount(form.cash_submitted);
    const newOnlineSubmitted = safeAmount(form.online_submitted);
    const submittedNow = newCashSubmitted + newOnlineSubmitted;

    const totalAfterDeposit = alreadySubmitted + submittedNow;
    const remainingPending = Math.max(0, totalExpectedCms - totalAfterDeposit);
    const remainingExcess = Math.max(0, totalAfterDeposit - totalExpectedCms);

    return {
      expectedCod,
      cashCollected,
      onlineCollected,
      totalCollection,
      totalExpectedCms,
      alreadySubmitted,
      newCashSubmitted,
      newOnlineSubmitted,
      submittedNow,
      totalAfterDeposit,
      remainingPending,
      remainingExcess,
      isOverDeposit: totalAfterDeposit > totalExpectedCms,
    };
  }, [form.collection_date, form.cash_submitted, form.online_submitted, entries, deposits, editing]);

  const handleSaveGeneralDeposit = async () => {
    if (saving) return;

    const hubId = form.hub_id || activeHubId;
    if (!hubId) { toast.error('Please select a hub first'); return; }
    if (!form.collection_date) { toast.error('Select a collection date'); return; }
    if (!form.deposit_date) { toast.error('Select a deposit date'); return; }

    const cashSubmitted = safeAmount(form.cash_submitted);
    const onlineSubmitted = safeAmount(form.online_submitted);
    const totalDeposited = cashSubmitted + onlineSubmitted;

    if (totalDeposited <= 0) {
      toast.error('At least one submitted amount (Cash or Online) must be greater than ₹0');
      return;
    }

    setSaving(true);
    try {
      const expectedCod = safeAmount(depositPreview?.expectedCod);

      const payload = {
        deposit_date: form.deposit_date,
        collection_date: form.collection_date || form.deposit_date,
        hub_id: hubId,
        total_cash_collected: expectedCod,
        cash_deposited: cashSubmitted,
        online_amount: onlineSubmitted,
        total_expected_cms: expectedCod,
        total_deposited: totalDeposited,
        cash_submitted: cashSubmitted,
        online_submitted: onlineSubmitted,
        short_amount: Math.max(0, expectedCod - totalDeposited),
        reference_number: form.reference_number.trim() || null,
        bank_name: form.bank_name.trim() || null,
        remarks: form.remarks.trim() || null,
        status:
          totalDeposited < expectedCod
            ? 'partially_submitted'
            : totalDeposited === expectedCod
              ? 'fully_submitted'
              : 'over_submitted',
      };

      if (editing) {
        const { error } = await supabase.from('cms_deposits').update(payload).eq('id', editing.id);
        if (error) {
          console.error('Save deposit error:', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          });
          throw error;
        }
        toast.success('Deposit transaction updated successfully');
      } else {
        const { error } = await supabase.from('cms_deposits').insert({ ...payload, created_by: profile?.id ?? null });
        if (error) {
          console.error('Save deposit error:', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          });
          throw error;
        }
        await logAudit('cms_deposit_create', profile?.id ?? null, `Recorded CMS deposit of ${formatINR(totalDeposited)} (Cash: ${formatINR(cashSubmitted)}, Online: ${formatINR(onlineSubmitted)}) for collection date ${formatDate(form.collection_date)}`, null, hubId);
        toast.success('CMS deposit recorded successfully');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save deposit transaction');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDeposit = async (d: CmsDeposit) => {
    const amountStr = formatINR(getDepositAmount(d));
    const dateStr = formatDate(d.deposit_date);
    const refStr = d.reference_number ? ` (Ref: ${d.reference_number})` : '';

    const ok = await confirm({
      title: 'Delete deposit transaction?',
      message: `This deposit transaction of ${amountStr} dated ${dateStr}${refStr} will be permanently deleted and CMS totals will be recalculated.`,
      confirmLabel: 'Delete Transaction',
      danger: true,
    });
    if (!ok) return;

    try {
      const { error } = await supabase.from('cms_deposits').delete().eq('id', d.id);
      if (error) throw error;
      toast.success('Deposit transaction deleted');
      load();
    } catch (err) {
      console.error('Delete deposit error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to delete deposit transaction');
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
      const reasonNote = `Reason: ${shortageForm.reason}${shortageForm.remarks ? ` | ${shortageForm.remarks.trim()}` : ''}`;

      const { error } = await supabase.rpc('record_shortage_atomic', {
        p_entry: {
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
        },
        p_notes: reasonNote,
        p_entry_id: existingEntry?.id ?? null,
      });
      if (error) throw error;

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
  const _openRecoveryModal = (due: Due) => {
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
      const { error } = await supabase.rpc('record_recovery_atomic', {
        p_collector_id: recoveryTargetDue.collector_id,
        p_hub_id: recoveryTargetDue.hub_id,
        p_due_id: recoveryTargetDue.id,
        p_recovery_date: recoveryForm.recovery_date,
        p_amount: amt,
        p_payment_mode: recoveryForm.payment_mode,
        p_reference_number: recoveryForm.reference_number.trim() || null,
        p_notes: recoveryForm.notes.trim() || null,
        p_created_by: profile?.id ?? null,
      });
      if (error) throw error;

      toast.success('Recovery recorded');
      setRecoveryModalOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record recovery');
    } finally {
      setRecoverySaving(false);
    }
  };

  const _handleMarkWrittenOff = async (due: Due) => {
    const ok = await confirm({
      title: 'Mark shortage as Written Off?',
      message: `This will clear remaining backlog of ${formatINR(due.remaining_amount)} for ${due.collector?.name ?? 'Employee'}.`,
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
      toast.error(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  // Card Click Handler
  const handleCardClick = (type: DetailType) => {
    setActiveDetail(type);
  };

  // Export CMS Rows to Excel
  const handleExportRows = () => {
    const rows = filteredDailyRows.map(r => ({
      Date: r.date,
      Hub: r.hubName,
      'Expected COD': r.expectedCod,
      'Cash Collected': r.cashCollected,
      'Online Collected': r.onlineCollected,
      'Total Collection': r.totalCollection,
      'Collection Shortage': r.collectionShortage,
      'Total Expected CMS': r.totalExpectedCms,
      'Cash Submitted': r.cashSubmitted,
      'Online Submitted': r.onlineSubmitted,
      'Total Deposited': r.totalDeposited,
      'CMS Pending': r.cmsPending,
      'CMS Excess': r.cmsExcess,
      Status: r.status,
      References: r.references.join(', ') || '—',
    }));

    if (rows.length === 0) {
      toast.warning('No records to export');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'CMS Deposition');
    XLSX.writeFile(wb, `cms_deposition_${from}_to_${to}.xlsx`);
    toast.success(`Exported ${rows.length} CMS deposition rows`);
  };

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            CMS Deposition Dashboard
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-neutral-500">
            Total Expected COD amount ko CMS me record aur reconcile karein.
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
        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <Button
              variant="outline"
              icon={<Plus className="h-4 w-4 text-amber-500" />}
              onClick={openAddShortage}
              className="min-h-[44px] px-3.5 text-xs sm:text-sm font-semibold border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
            >
              + Shortage Entry
            </Button>
          )}
          {canManage && (
            <Button
              icon={<Landmark className="h-4 w-4" />}
              onClick={() => openAddDeposit()}
              className="min-h-[44px] px-4 text-xs sm:text-sm font-semibold shadow-glow"
            >
              Record CMS Deposit
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
            <Card className="p-4 min-w-0">
              <p className="text-xs text-neutral-500 truncate">Total Expected COD</p>
              <p className="mt-1 text-lg sm:text-xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums truncate">
                {formatINR(collectionStats.totalExpectedCod)}
              </p>
              <p className="mt-1 text-[11px] text-neutral-500">{collectionStats.entryCount} entries</p>
            </Card>

            <Card className="p-4 min-w-0">
              <p className="text-xs text-neutral-500 truncate">Total Collection</p>
              <p className="mt-1 text-lg sm:text-xl font-bold text-blue-600 dark:text-blue-400 tabular-nums truncate">
                {formatINR(collectionStats.totalCollection)}
              </p>
              <p className="mt-1 text-[11px] text-blue-500/80">{collectionStats.entryCount} entries</p>
            </Card>

            <Card className="p-4 min-w-0">
              <p className="text-xs text-neutral-500 truncate">Cash Collected</p>
              <p className="mt-1 text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums truncate">
                {formatINR(collectionStats.totalCash)}
              </p>
              <p className="mt-1 text-[11px] text-neutral-500">Physical cash</p>
            </Card>

            <Card className="p-4 min-w-0">
              <p className="text-xs text-neutral-500 truncate">Online Collected</p>
              <p className="mt-1 text-lg sm:text-xl font-bold text-blue-600 dark:text-blue-400 tabular-nums truncate">
                {formatINR(collectionStats.totalOnline)}
              </p>
              <p className="mt-1 text-[11px] text-neutral-500">Digital payments</p>
            </Card>

            <Card className="p-4 col-span-2 sm:col-span-1 min-w-0 border-red-500/20">
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

      {/* SECTION 2: CMS Summary (Hub/Date-Level Deposition) - Genuine Clickable Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            CMS Summary (Bank Deposition)
          </p>
          <span className="text-[11px] text-neutral-500">Click cards for itemized data details</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-4">
            {/* Total Expected CMS (strictly equals Total Expected COD) */}
            <Card
              hover
              role="button"
              tabIndex={0}
              onClick={() => handleCardClick('expected')}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleCardClick('expected')}
              className="p-4 cursor-pointer min-w-0 transition-transform active:scale-[0.98]"
              aria-label="View Total Expected CMS Details"
            >
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-brand-500/10 text-brand-600 flex items-center justify-center font-bold">
                  <Banknote className="h-5 w-5" />
                </div>
                <p className="text-xs font-medium text-neutral-500 truncate">Total Expected CMS</p>
              </div>
              <p className="mt-2 text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums truncate">
                {formatINR(cmsSummaryStats.totalExpectedCms)}
              </p>
              <p className="mt-1 text-xs text-neutral-400">Total Expected COD</p>
            </Card>

            {/* Total Deposited */}
            <Card
              hover
              role="button"
              tabIndex={0}
              onClick={() => handleCardClick('deposited')}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleCardClick('deposited')}
              className="p-4 cursor-pointer min-w-0 transition-transform active:scale-[0.98]"
              aria-label="View Total Deposited Transactions"
            >
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
                  <Landmark className="h-5 w-5" />
                </div>
                <p className="text-xs font-medium text-neutral-500 truncate">Total Deposited</p>
              </div>
              <p className="mt-2 text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums truncate">
                {formatINR(cmsSummaryStats.totalDeposited)}
              </p>
              <p className="mt-1 text-xs text-neutral-400">Total bank/CMS deposits</p>
            </Card>

            {/* CMS Pending & Excess Dynamic Card */}
            <Card
              hover
              role="button"
              tabIndex={0}
              onClick={() => handleCardClick('pending')}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleCardClick('pending')}
              className={clsx(
                'p-4 cursor-pointer min-w-0 transition-transform active:scale-[0.98]',
                cmsSummaryStats.cmsPending > 0 ? 'border-red-500/20 bg-red-500/5' : 'border-blue-500/20 bg-blue-500/5'
              )}
              aria-label="View CMS Pending and Excess Audit"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={clsx(
                    'h-9 w-9 rounded-xl flex items-center justify-center font-bold',
                    cmsSummaryStats.cmsPending > 0 ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'
                  )}>
                    {cmsSummaryStats.cmsPending > 0 ? <AlertCircle className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}
                  </div>
                  <p className={clsx('text-xs font-semibold truncate', cmsSummaryStats.cmsPending > 0 ? 'text-red-500' : 'text-blue-500')}>
                    {cmsSummaryStats.cmsPending > 0 && cmsSummaryStats.cmsExcess > 0 ? 'CMS Pending & Excess' : cmsSummaryStats.cmsPending > 0 ? 'CMS Pending Deposit' : 'CMS Excess Deposit'}
                  </p>
                </div>
                {cmsSummaryStats.cmsPending > 0 && (
                  <span className="text-[10px] font-extrabold text-red-500 bg-red-500/10 px-2 py-0.5 rounded uppercase">PENDING</span>
                )}
              </div>

              {cmsSummaryStats.cmsPending > 0 && cmsSummaryStats.cmsExcess > 0 ? (
                <div className="mt-2 space-y-0.5">
                  <div className="flex justify-between items-baseline text-sm font-bold">
                    <span className="text-xs text-red-500">Pending:</span>
                    <span className="text-red-500 font-bold tabular-nums">{formatINR(cmsSummaryStats.cmsPending)}</span>
                  </div>
                  <div className="flex justify-between items-baseline text-sm font-bold">
                    <span className="text-xs text-blue-500">Excess:</span>
                    <span className="text-blue-500 font-bold tabular-nums">{formatINR(cmsSummaryStats.cmsExcess)}</span>
                  </div>
                </div>
              ) : (
                <p className={clsx('mt-2 text-xl sm:text-2xl font-bold tabular-nums truncate', cmsSummaryStats.cmsPending > 0 ? 'text-red-500 dark:text-red-400' : 'text-blue-600 dark:text-blue-400')}>
                  {cmsSummaryStats.cmsPending > 0 ? formatINR(cmsSummaryStats.cmsPending) : formatINR(cmsSummaryStats.cmsExcess)}
                </p>
              )}

              <p className="mt-1 text-xs text-neutral-400">Total Expected CMS vs Deposited</p>
            </Card>

            {/* Deposit Count */}
            <Card
              hover
              role="button"
              tabIndex={0}
              onClick={() => handleCardClick('count')}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleCardClick('count')}
              className="p-4 cursor-pointer min-w-0 transition-transform active:scale-[0.98]"
              aria-label="View Deposit Transactions Log"
            >
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
                  <FileBarChart className="h-5 w-5" />
                </div>
                <p className="text-xs font-medium text-neutral-500 truncate">Deposit Count</p>
              </div>
              <p className="mt-2 text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums truncate">
                {cmsSummaryStats.depositCount}
              </p>
              <p className="mt-1 text-xs text-neutral-400">Valid deposit transactions</p>
            </Card>
          </div>
        )}
      </div>

      {/* SECTION 3: Filters & Search Toolbar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">From Date</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input-base py-2 text-sm min-h-[44px]" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">To Date</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input-base py-2 text-sm min-h-[44px]" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">Search Records</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Date, hub, reference..."
                className="input-base pl-9 py-2 text-sm min-h-[44px]"
              />
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between pt-3 border-t border-neutral-200 dark:border-neutral-800">
          <Button variant="outline" size="sm" icon={<Download className="h-4 w-4" />} onClick={handleExportRows} className="min-h-[44px] text-xs font-semibold">
            Export CMS Deposition Excel
          </Button>
          <span className="text-xs text-neutral-500">{filteredDailyRows.length} collection dates shown</span>
        </div>
      </Card>

      {/* SECTION 4: CMS Deposition Records Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
            CMS Deposition Records
          </h2>
          <span className="text-xs text-neutral-500">{filteredDailyRows.length} visible date rows</span>
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
                    {isSuperAdmin && <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Hub</th>}
                    <th className="text-right px-4 py-3 font-semibold">Expected CMS</th>
                    <th className="text-right px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">Cash Submitted</th>
                    <th className="text-right px-4 py-3 font-semibold text-blue-600 dark:text-blue-400">Online Submitted</th>
                    <th className="text-right px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">Total Submitted</th>
                    <th className="text-right px-4 py-3 font-semibold text-red-500">CMS Pending</th>
                    <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Reference</th>
                    <th className="text-center px-4 py-3 font-semibold">Status</th>
                    <th className="text-right px-5 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {filteredDailyRows.map((r) => (
                    <tr key={`${r.date}_${r.hubId}`} className="group hover:bg-neutral-50 dark:hover:bg-neutral-950/70 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-neutral-800 dark:text-neutral-200 tabular-nums">{formatDate(r.date)}</td>
                      {isSuperAdmin && <td className="px-4 py-3.5 text-neutral-500 hidden md:table-cell">{r.hubName}</td>}
                      <td className="px-4 py-3.5 text-right tabular-nums font-bold text-neutral-900 dark:text-neutral-100">{formatINR(r.totalExpectedCms)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-emerald-600 font-medium">{formatINR(r.cashSubmitted)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-blue-600 font-medium">{formatINR(r.onlineSubmitted)}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{formatINR(r.totalDeposited)}</td>
                      <td className={clsx('px-4 py-3.5 text-right tabular-nums font-bold', r.cmsPending > 0 ? 'text-red-500 dark:text-red-400' : 'text-neutral-400')}>{formatINR(r.cmsPending)}</td>
                      <td className="px-4 py-3.5 text-neutral-500 font-mono text-xs hidden lg:table-cell">
                        {r.references.length > 0 ? r.references.join(', ') : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={clsx(
                          'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold',
                          r.status === 'Fully Deposited' ? 'bg-emerald-500/10 text-emerald-500' :
                          r.status === 'Partially Deposited' ? 'bg-amber-500/10 text-amber-500' :
                          r.status === 'Over Deposited' ? 'bg-blue-500/10 text-blue-500' :
                          'bg-red-500/10 text-red-500'
                        )}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {canManage && (
                          <Button size="sm" onClick={() => openAddDeposit(r)} className="min-h-[44px] text-xs font-semibold px-3">
                            + Deposit
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

      {/* SECTION 5: Record CMS Deposit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit CMS Deposit Record' : 'Record CMS Deposit'}
        subtitle="Cash aur online source se alag, CMS me jama ki gayi total amount record karein."
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving} className="min-h-[44px]">Cancel</Button>
            <Button onClick={handleSaveGeneralDeposit} loading={saving} disabled={saving} className="min-h-[44px]">{editing ? 'Update Deposit' : 'Record Deposit'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Collection Date"
              type="date"
              value={form.collection_date}
              onChange={(e) => setForm((f) => ({ ...f, collection_date: e.target.value }))}
            />
            <Input
              label="Deposit Date"
              type="date"
              value={form.deposit_date}
              onChange={(e) => setForm((f) => ({ ...f, deposit_date: e.target.value }))}
            />
          </div>

          {(isSuperAdmin || hubCtx.isAllHubs) && hubCtx.accessibleHubs.length > 0 && (
            <Select
              label="Hub"
              value={form.hub_id}
              onChange={(e) => setForm((f) => ({ ...f, hub_id: e.target.value }))}
            >
              {hubCtx.accessibleHubs.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </Select>
          )}

          {/* Read-Only Info Box for Collection Reference */}
          {depositPreview && (
            <div className="rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Collection Reference Information (Read-Only)</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-center">
                <div className="bg-neutral-200/50 dark:bg-neutral-800/50 p-2 rounded-lg">
                  <p className="text-neutral-500">Expected COD</p>
                  <p className="font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">{formatINR(depositPreview.expectedCod)}</p>
                </div>
                <div className="bg-emerald-500/10 p-2 rounded-lg">
                  <p className="text-emerald-500">Cash Collected</p>
                  <p className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatINR(depositPreview.cashCollected)}</p>
                </div>
                <div className="bg-blue-500/10 p-2 rounded-lg">
                  <p className="text-blue-500">Online Collected</p>
                  <p className="font-bold text-blue-600 dark:text-blue-400 tabular-nums">{formatINR(depositPreview.onlineCollected)}</p>
                </div>
                <div className="bg-brand-500/10 p-2 rounded-lg">
                  <p className="text-brand-600">Total Collection</p>
                  <p className="font-bold text-brand-600 tabular-nums">{formatINR(depositPreview.totalCollection)}</p>
                </div>
              </div>

              {/* Live Deposit Calculation Preview */}
              <div className="border-t border-neutral-200 dark:border-neutral-800 pt-2 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-neutral-500">Expected CMS: <strong className="text-neutral-900 dark:text-neutral-100">{formatINR(depositPreview.totalExpectedCms)}</strong></p>
                  <p className="text-neutral-500">Already Submitted: <strong>{formatINR(depositPreview.alreadySubmitted)}</strong></p>
                </div>
                <div>
                  <p className="text-emerald-500 font-bold">New Cash Submission: {formatINR(depositPreview.newCashSubmitted)}</p>
                  <p className="text-blue-500 font-bold">New Online Submission: {formatINR(depositPreview.newOnlineSubmitted)}</p>
                  <p className="text-brand-600 font-bold">Total CMS Submitted Now: {formatINR(depositPreview.submittedNow)}</p>
                  <p className={clsx('font-bold mt-0.5', depositPreview.remainingPending > 0 ? 'text-red-500' : 'text-emerald-500')}>
                    Remaining CMS Pending: {formatINR(depositPreview.remainingPending)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Separate Editable Inputs for Cash and Online Submission */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Cash Submitted to CMS (₹)"
              type="number"
              value={form.cash_submitted}
              onChange={(e) => setForm((f) => ({ ...f, cash_submitted: e.target.value }))}
              placeholder="0"
            />
            <Input
              label="Online Submitted to CMS (₹)"
              type="number"
              value={form.online_submitted}
              onChange={(e) => setForm((f) => ({ ...f, online_submitted: e.target.value }))}
              placeholder="0"
            />
          </div>

          <Input
            label="Reference Number / Bank Slip (optional)"
            value={form.reference_number}
            onChange={(e) => setForm((f) => ({ ...f, reference_number: e.target.value }))}
            placeholder="Bank slip or receipt number…"
          />

          <Input
            label="Bank / CMS Name (optional)"
            value={form.bank_name}
            onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))}
            placeholder="e.g. HDFC Bank, ICICI CMS…"
          />

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Remarks (optional)</label>
            <textarea
              value={form.remarks}
              onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
              rows={2}
              placeholder="Notes regarding this bank deposit…"
              className="input-base resize-none"
            />
          </div>
        </div>
      </Modal>

      {/* SECTION 6: Shortage Entry & Recovery Modals */}
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

      {/* Card Detail Modal */}
      {activeDetail && (
        <DetailDrawer
          type={activeDetail}
          onClose={() => setActiveDetail(null)}
          deposits={depositTransactions}
          dailyRows={filteredDailyRows}
          from={from}
          to={to}
          selectedHubName={hubCtx.selectedHub?.name}
          detailSearch={detailSearch}
          setDetailSearch={setDetailSearch}
          onExport={handleExportRows}
          openAddDeposit={openAddDeposit}
          openEditDeposit={openEditDeposit}
          handleDeleteDeposit={handleDeleteDeposit}
          canManage={canManage}
        />
      )}
    </div>
  );
}

// Detail Drawer/Modal Component for Clickable CMS Summary Cards
function DetailDrawer({
  type, onClose, deposits, dailyRows,
  from, to, selectedHubName, detailSearch, setDetailSearch,
  onExport, openAddDeposit, openEditDeposit, handleDeleteDeposit, canManage
}: {
  type: DetailType;
  onClose: () => void;
  deposits: CmsDeposit[];
  dailyRows: DailyCmsRow[];
  from: string;
  to: string;
  selectedHubName?: string;
  detailSearch: string;
  setDetailSearch: (s: string) => void;
  onExport: () => void;
  openAddDeposit: (row?: DailyCmsRow) => void;
  openEditDeposit: (d: CmsDeposit) => void;
  handleDeleteDeposit: (d: CmsDeposit) => void;
  canManage: boolean;
}) {
  const titles: Record<string, string> = {
    expected: 'Total Expected CMS Details',
    deposited: 'Total Deposited Transactions',
    pending: 'CMS Pending & Excess Audit',
    count: 'Deposit Transactions Log',
  };

  const icons: Record<string, any> = {
    expected: Banknote,
    deposited: Landmark,
    pending: AlertCircle,
    count: FileBarChart,
  };

  const IconComp = icons[type ?? ''] || FileText;
  const q = detailSearch.trim().toLowerCase();

  // Date-level rows for 'expected' and 'pending'
  const filteredDaily = useMemo(() => {
    return dailyRows.filter((r) => {
      if (type === 'pending' && r.cmsPending <= 0 && r.cmsExcess <= 0) return false;
      if (!q) return true;
      return r.date.toLowerCase().includes(q) || r.hubName.toLowerCase().includes(q) || r.references.join(' ').toLowerCase().includes(q);
    });
  }, [dailyRows, type, q]);

  // Individual deposit records for 'deposited' and 'count'
  const filteredDeposits = useMemo(() => {
    return deposits.filter((d) => {
      if (!q) return true;
      const dateStr = getDepositDate(d).toLowerCase();
      const hub = (d.hub?.name ?? '').toLowerCase();
      const ref = (d.reference_number ?? '').toLowerCase();
      const bank = (d.bank_name ?? '').toLowerCase();
      const rem = (d.remarks ?? '').toLowerCase();
      return dateStr.includes(q) || hub.includes(q) || ref.includes(q) || bank.includes(q) || rem.includes(q);
    });
  }, [deposits, q]);

  const drawerTotalAmount = useMemo(() => {
    if (type === 'expected') return filteredDaily.reduce((s, r) => s + r.totalExpectedCms, 0);
    if (type === 'deposited') return filteredDeposits.reduce((s, d) => s + getDepositAmount(d), 0);
    if (type === 'pending') return filteredDaily.reduce((s, r) => s + r.cmsPending, 0);
    return filteredDeposits.length;
  }, [type, filteredDaily, filteredDeposits]);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-4xl bg-[var(--card-bg)] shadow-2xl h-full flex flex-col min-w-0 border-l border-neutral-200 dark:border-neutral-800 animate-slide-in">
        {/* Header */}
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

        {/* Total Amount Banner */}
        <div className="p-4 bg-brand-50/50 dark:bg-brand-600/10 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase">Filtered Total Amount</p>
            <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">
              {type === 'count' ? drawerTotalAmount : formatINR(drawerTotalAmount)}
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 space-y-3 shrink-0">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input value={detailSearch} onChange={(e) => setDetailSearch(e.target.value)} placeholder="Search date, hub, reference, bank..." className="input-base pl-9 py-2 text-sm min-h-[44px]" />
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {type === 'deposited' || type === 'count' ? (
            filteredDeposits.length === 0 ? (
              <EmptyState icon={<Landmark className="h-8 w-8" />} title="No deposit transactions" message="No deposit transactions found." />
            ) : (
              filteredDeposits.map((d) => {
                const totalAmt = getDepositAmount(d);
                const cashAmt = getCashSubmittedAmount(d);
                const onlineAmt = getOnlineSubmittedAmount(d);
                const cDate = getDepositDate(d);

                return (
                  <Card key={d.id} className="p-4 space-y-3">
                    <div className="flex flex-wrap justify-between items-start gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-neutral-900 dark:text-neutral-100">{formatDate(d.deposit_date)}</span>
                          {d.hub?.name && <span className="text-xs text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded">{d.hub.name}</span>}
                        </div>
                        <p className="text-xs text-neutral-500 mt-0.5">Collection Date: <strong>{formatDate(cDate)}</strong></p>
                      </div>
                      <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatINR(totalAmt)}</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-neutral-50 dark:bg-neutral-950 p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800">
                      <div><p className="text-neutral-500">Cash Submitted:</p><p className="font-bold text-emerald-600">{formatINR(cashAmt)}</p></div>
                      <div><p className="text-neutral-500">Online Submitted:</p><p className="font-bold text-blue-600">{formatINR(onlineAmt)}</p></div>
                      <div><p className="text-neutral-500">Reference:</p><p className="font-mono font-medium">{d.reference_number || '—'}</p></div>
                      <div><p className="text-neutral-500">Bank/CMS:</p><p className="font-medium">{d.bank_name || '—'}</p></div>
                    </div>

                    {d.remarks && <p className="text-xs text-neutral-600 dark:text-neutral-400 italic">Remarks: {d.remarks}</p>}

                    {canManage && (
                      <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                        <Button
                          size="sm"
                          variant="outline"
                          icon={<Edit3 className="h-3.5 w-3.5 text-blue-500" />}
                          onClick={() => { onClose(); openEditDeposit(d); }}
                          className="min-h-[44px] text-xs font-semibold px-3"
                          title="Edit this deposit record"
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          icon={<Trash2 className="h-3.5 w-3.5 text-red-500" />}
                          onClick={() => handleDeleteDeposit(d)}
                          className="min-h-[44px] text-xs font-semibold px-3 text-red-500 border-red-500/20 hover:bg-red-500/10"
                          title="Delete this deposit record"
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                  </Card>
                );
              })
            )
          ) : (
            filteredDaily.length === 0 ? (
              <EmptyState icon={<Landmark className="h-8 w-8" />} title="No daily rows" message="No matching date rows." />
            ) : (
              filteredDaily.map((r) => (
                <Card key={`${r.date}_${r.hubId}`} className="p-4 space-y-3">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span className="font-bold text-neutral-900 dark:text-neutral-100">{formatDate(r.date)}</span>
                    <span className="text-neutral-500">{r.hubName}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-neutral-100 dark:bg-neutral-900 p-2">
                      <p className="text-neutral-500">Expected CMS</p>
                      <p className="font-bold tabular-nums">{formatINR(r.totalExpectedCms)}</p>
                    </div>
                    <div className="rounded-lg bg-emerald-500/10 p-2">
                      <p className="text-emerald-500">Cash Submitted</p>
                      <p className="font-bold text-emerald-600 tabular-nums">{formatINR(r.cashSubmitted)}</p>
                    </div>
                    <div className="rounded-lg bg-blue-500/10 p-2">
                      <p className="text-blue-500">Online Submitted</p>
                      <p className="font-bold text-blue-600 tabular-nums">{formatINR(r.onlineSubmitted)}</p>
                    </div>
                    <div className="rounded-lg bg-red-500/10 p-2">
                      <p className="text-red-500">{r.cmsExcess > 0 ? 'CMS Excess' : 'CMS Pending'}</p>
                      <p className={clsx('font-bold tabular-nums', r.cmsExcess > 0 ? 'text-blue-600' : 'text-red-500')}>
                        {r.cmsExcess > 0 ? formatINR(r.cmsExcess) : formatINR(r.cmsPending)}
                      </p>
                    </div>
                  </div>
                  {r.references.length > 0 && <p className="text-xs text-neutral-500 font-mono">Ref: {r.references.join(', ')}</p>}
                  {canManage && r.cmsPending > 0 && (
                    <div className="flex justify-end pt-1">
                      <Button size="sm" onClick={() => { onClose(); openAddDeposit(r); }} className="min-h-[44px] text-xs px-3">+ Record Deposit</Button>
                    </div>
                  )}
                </Card>
              ))
            )
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 flex justify-end shrink-0">
          <Button variant="outline" onClick={onClose} className="min-h-[44px] px-5 font-semibold">Close</Button>
        </div>
      </div>
    </div>
  );
}
