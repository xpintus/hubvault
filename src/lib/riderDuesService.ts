import { formatDate, formatINR, toISODate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import {
  Collector,
  RiderDue,
  RiderDueCategory,
  RiderDueMessage,
  RiderDueRecovery,
  RiderDuesKPIs,
  RiderLedgerSummary,
  RiderMessageType,
  RiderRecoveryPaymentMode,
} from '@/types';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';

export const safeAmount = (val: unknown): number => {
  if (val === null || val === undefined) return 0;
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  return isNaN(num) ? 0 : num;
};

export interface CreateRiderDueInput {
  rider_id: string;
  hub_id: string;
  dues_date: string;
  category: RiderDueCategory | string;
  amount: number;
  description?: string;
  reference_id?: string | null;
  remarks?: string | null;
  created_by?: string | null;
}

export interface RecordRiderRecoveryParams {
  rider_id: string;
  hub_id: string;
  recovery_date: string;
  amount: number;
  payment_mode: RiderRecoveryPaymentMode | string;
  transaction_id?: string | null;
  remarks?: string | null;
  collected_by?: string | null;
  created_by?: string | null;
  allow_over_recovery?: boolean;
}

export interface LogRiderMessageParams {
  rider_id: string;
  hub_id: string;
  message_type: RiderMessageType | string;
  recipient_phone: string;
  message_body: string;
  channel?: 'WhatsApp' | 'SMS' | 'Other' | string;
  status?: 'drafted' | 'sent_via_whatsapp' | 'sent_via_sms' | 'failed' | string;
  snapshot_dues: number;
  snapshot_recovered: number;
  snapshot_balance: number;
  created_by?: string | null;
}

export interface ChronologicalStatementRow {
  id: string;
  date: string;
  type: 'Due' | 'Recovery' | 'Reversal';
  categoryOrMode: string;
  reference: string;
  description: string;
  debit: number; // New Due
  credit: number; // Recovery
  balance: number; // Running Balance
  isReversed?: boolean;
}

/**
 * Days after which an unpaid due is flagged as Overdue
 */
export const OVERDUE_THRESHOLD_DAYS = 7;

/**
 * Checks if a given date string is overdue relative to today
 */
export const isDateOverdue = (dateStr: string, thresholdDays = OVERDUE_THRESHOLD_DAYS): boolean => {
  if (!dateStr) return false;
  const dueDate = new Date(dateStr);
  const now = new Date();
  const diffTime = now.getTime() - dueDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > thresholdDays;
};

/**
 * Fetches all rider dues, recoveries, messages and calculates live KPIs and rider ledger summaries.
 */
export async function fetchRiderDuesData(hubId?: string | null) {
  // 1. Fetch Collectors
  let colQuery = supabase
    .from('collectors')
    .select('*, hub: hubs(*)')
    .eq('status', 'active')
    .order('name', { ascending: true });

  if (hubId) {
    colQuery = colQuery.eq('hub_id', hubId);
  }

  const { data: collectorsData, error: colError } = await colQuery;
  if (colError) throw colError;
  const collectors: Collector[] = collectorsData || [];

  // 2. Fetch Rider Dues
  let duesQuery = supabase
    .from('rider_dues')
    .select('*, rider: collectors(*), hub: hubs(*)')
    .order('dues_date', { ascending: false });

  if (hubId) {
    duesQuery = duesQuery.eq('hub_id', hubId);
  }

  let dues: RiderDue[] = [];
  const { data: duesData, error: duesError } = await duesQuery;

  if (duesError) {
    // If table doesn't exist yet in Supabase, fallback to legacy dues table
    console.warn('rider_dues table query fallback to legacy dues:', duesError.message);
    let legacyDuesQuery = supabase
      .from('dues')
      .select('*, collector: collectors(*), hub: hubs(*)')
      .order('due_date', { ascending: false });

    if (hubId) legacyDuesQuery = legacyDuesQuery.eq('hub_id', hubId);
    const { data: legacyDuesData } = await legacyDuesQuery;

    dues = (legacyDuesData || []).map((d: any) => ({
      id: d.id,
      rider_id: d.collector_id,
      hub_id: d.hub_id,
      dues_date: d.due_date,
      category: d.due_reason || 'COD Short',
      amount: safeAmount(d.original_amount),
      recovered_amount: safeAmount(d.recovered_amount),
      remaining_amount: safeAmount(d.remaining_amount),
      status:
        d.status === 'outstanding'
          ? 'pending'
          : d.status === 'partially_recovered'
          ? 'partially_recovered'
          : d.status === 'fully_recovered'
          ? 'fully_recovered'
          : 'cancelled',
      description: d.notes,
      reference_id: d.reference_number,
      remarks: d.source,
      created_by: d.created_by,
      created_at: d.created_at,
      updated_at: d.updated_at,
      rider: d.collector,
      hub: d.hub,
    }));
  } else {
    dues = (duesData || []).map((d: any) => ({
      ...d,
      amount: safeAmount(d.amount),
      recovered_amount: safeAmount(d.recovered_amount),
      remaining_amount: safeAmount(d.remaining_amount),
    }));
  }

  // 3. Fetch Rider Dues Recoveries
  let recQuery = supabase
    .from('rider_dues_recoveries')
    .select('*, rider: collectors(*), hub: hubs(*)')
    .order('recovery_date', { ascending: false });

  if (hubId) {
    recQuery = recQuery.eq('hub_id', hubId);
  }

  let recoveries: RiderDueRecovery[] = [];
  const { data: recData, error: recError } = await recQuery;

  if (recError) {
    console.warn('rider_dues_recoveries table query fallback to legacy recoveries:', recError.message);
    let legacyRecQuery = supabase
      .from('recoveries')
      .select('*, collector: collectors(*), hub: hubs(*)')
      .order('recovery_date', { ascending: false });

    if (hubId) legacyRecQuery = legacyRecQuery.eq('hub_id', hubId);
    const { data: legacyRecData } = await legacyRecQuery;

    recoveries = (legacyRecData || []).map((r: any) => ({
      id: r.id,
      rider_id: r.collector_id,
      hub_id: r.hub_id,
      due_id: r.due_id,
      recovery_date: r.recovery_date,
      amount: safeAmount(r.amount),
      payment_mode: r.payment_mode === 'online' ? 'UPI' : 'Cash',
      transaction_id: r.reference_number,
      remarks: r.notes,
      collected_by: 'Cashier / Supervisor',
      is_reversed: false,
      reversal_reason: null,
      reversal_date: null,
      reversed_by: null,
      created_by: r.created_by,
      created_at: r.created_at,
      updated_at: r.created_at,
      rider: r.collector,
      hub: r.hub,
    }));
  } else {
    recoveries = (recData || []).map((r: any) => ({
      ...r,
      amount: safeAmount(r.amount),
      is_reversed: Boolean(r.is_reversed),
    }));
  }

  // 4. Fetch Rider Messages
  let messages: RiderDueMessage[] = [];
  let msgQuery = supabase
    .from('rider_dues_messages')
    .select('*, rider: collectors(*), hub: hubs(*)')
    .order('created_at', { ascending: false });

  if (hubId) {
    msgQuery = msgQuery.eq('hub_id', hubId);
  }

  const { data: msgData, error: msgError } = await msgQuery;
  if (!msgError && msgData) {
    messages = msgData.map((m: any) => ({
      ...m,
      snapshot_dues: safeAmount(m.snapshot_dues),
      snapshot_recovered: safeAmount(m.snapshot_recovered),
      snapshot_balance: safeAmount(m.snapshot_balance),
    }));
  }

  // Group dues, recoveries and messages by rider
  const duesByRider = new Map<string, RiderDue[]>();
  const recoveriesByRider = new Map<string, RiderDueRecovery[]>();
  const messagesByRider = new Map<string, RiderDueMessage[]>();

  for (const d of dues) {
    const list = duesByRider.get(d.rider_id) || [];
    list.push(d);
    duesByRider.set(d.rider_id, list);
  }

  for (const r of recoveries) {
    const list = recoveriesByRider.get(r.rider_id) || [];
    list.push(r);
    recoveriesByRider.set(r.rider_id, list);
  }

  for (const m of messages) {
    const list = messagesByRider.get(m.rider_id) || [];
    list.push(m);
    messagesByRider.set(m.rider_id, list);
  }

  // Build Rider Ledger Summaries
  const todayStr = toISODate(new Date());
  let totalDuesGenerated = 0;
  let totalAmountRecovered = 0;
  let todaysRecovery = 0;
  let totalOutstandingAmount = 0;
  let overdueAmount = 0;
  const ridersWithDuesSet = new Set<string>();

  const riderSummaries: RiderLedgerSummary[] = collectors.map((collector) => {
    const rDues = (duesByRider.get(collector.id) || []).filter((d) => d.status !== 'cancelled');
    const rRecoveries = (recoveriesByRider.get(collector.id) || []).filter((r) => !r.is_reversed);
    const rMessages = messagesByRider.get(collector.id) || [];

    const totalDues = rDues.reduce((sum, d) => sum + d.amount, 0);
    const totalRecovered = rRecoveries.reduce((sum, r) => sum + r.amount, 0);
    const outstandingBalance = Math.max(0, totalDues - totalRecovered);

    // Find last recovery date
    let lastRecoveryDate: string | null = null;
    if (rRecoveries.length > 0) {
      const sortedRecs = [...rRecoveries].sort((a, b) => b.recovery_date.localeCompare(a.recovery_date));
      lastRecoveryDate = sortedRecs[0].recovery_date;
    }

    // Find oldest active due date
    let oldestDueDate: string | null = null;
    const unpaidDues = rDues.filter((d) => d.remaining_amount > 0);
    if (unpaidDues.length > 0) {
      const sortedUnpaid = [...unpaidDues].sort((a, b) => a.dues_date.localeCompare(b.dues_date));
      oldestDueDate = sortedUnpaid[0].dues_date;
    }

    // Check overdue condition
    const isOverdue = oldestDueDate ? isDateOverdue(oldestDueDate) && outstandingBalance > 0 : false;

    let status: 'Pending' | 'Partially Recovered' | 'Fully Recovered' | 'Overdue' = 'Pending';
    if (totalDues > 0 && outstandingBalance === 0) {
      status = 'Fully Recovered';
    } else if (isOverdue) {
      status = 'Overdue';
    } else if (totalRecovered > 0 && outstandingBalance > 0) {
      status = 'Partially Recovered';
    } else {
      status = 'Pending';
    }

    // KPI Accumulations
    totalDuesGenerated += totalDues;
    totalAmountRecovered += totalRecovered;
    totalOutstandingAmount += outstandingBalance;

    if (outstandingBalance > 0) {
      ridersWithDuesSet.add(collector.id);
    }

    if (isOverdue) {
      overdueAmount += outstandingBalance;
    }

    return {
      riderId: collector.id,
      riderName: collector.name,
      feId: collector.employee_id,
      phone: collector.phone || 'N/A',
      hubId: collector.hub_id,
      hubName: (collector as any).hub?.name || 'Main Hub',
      totalDues,
      totalRecovered,
      outstandingBalance,
      lastRecoveryDate,
      oldestDueDate,
      status,
      duesCount: rDues.length,
      recoveriesCount: rRecoveries.length,
      dues: rDues,
      recoveries: rRecoveries,
      messages: rMessages,
      rider: collector,
    };
  });

  // Calculate Today's Recovery across all recoveries
  for (const r of recoveries) {
    if (!r.is_reversed && r.recovery_date === todayStr) {
      todaysRecovery += r.amount;
    }
  }

  const kpis: RiderDuesKPIs = {
    totalRidersWithDues: ridersWithDuesSet.size,
    totalOutstandingAmount,
    totalDuesGenerated,
    totalAmountRecovered,
    todaysRecovery,
    overdueAmount,
  };

  return {
    kpis,
    riderSummaries,
    collectors,
    allDues: dues,
    allRecoveries: recoveries,
    allMessages: messages,
  };
}

/**
 * Creates a new manual dues entry.
 */
export async function createManualRiderDue(params: CreateRiderDueInput): Promise<RiderDue> {
  const amount = safeAmount(params.amount);
  if (amount <= 0) {
    throw new Error('Dues amount must be greater than zero');
  }

  const newId = uuidv4();
  const payload = {
    id: newId,
    rider_id: params.rider_id,
    hub_id: params.hub_id,
    dues_date: params.dues_date || toISODate(new Date()),
    category: params.category || 'COD Short',
    amount,
    recovered_amount: 0,
    remaining_amount: amount,
    status: 'pending',
    description: params.description || '',
    reference_id: params.reference_id || null,
    remarks: params.remarks || null,
    created_by: params.created_by || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Try insert into rider_dues table
  const { data, error } = await supabase.from('rider_dues').insert(payload).select().single();

  if (error) {
    console.warn('Failed inserting to rider_dues, writing to legacy dues fallback:', error.message);
    // Legacy dues fallback
    const legacyPayload = {
      id: newId,
      collector_id: params.rider_id,
      hub_id: params.hub_id,
      due_date: payload.dues_date,
      original_amount: amount,
      recovered_amount: 0,
      remaining_amount: amount,
      status: 'outstanding',
      due_reason: payload.category,
      notes: payload.description,
      reference_number: payload.reference_id,
      source: payload.remarks || 'Manual Entry',
      created_by: params.created_by || null,
    };
    const { error: legError } = await supabase.from('dues').insert(legacyPayload);
    if (legError) throw legError;
    return payload as RiderDue;
  }

  // Also best-effort write to legacy dues so older tabs see the update
  try {
    await supabase.from('dues').insert({
      id: newId,
      collector_id: params.rider_id,
      hub_id: params.hub_id,
      due_date: payload.dues_date,
      original_amount: amount,
      recovered_amount: 0,
      remaining_amount: amount,
      status: 'outstanding',
      due_reason: payload.category,
      notes: payload.description,
      reference_number: payload.reference_id,
      source: payload.remarks || 'Dues Book Entry',
      created_by: params.created_by || null,
    });
  } catch {
    // ignore mirror failure
  }

  return data as RiderDue;
}

/**
 * Records a recovery payment against a rider using FIFO allocation across their unpaid dues.
 */
export async function recordRiderRecovery(params: RecordRiderRecoveryParams): Promise<RiderDueRecovery[]> {
  const recoveryAmount = safeAmount(params.amount);
  if (recoveryAmount <= 0) {
    throw new Error('Recovery amount must be greater than zero');
  }

  // 1. Try RPC record_rider_recovery_fifo
  try {
    const { data: rpcResult, error: rpcError } = await supabase.rpc('record_rider_recovery_fifo', {
      p_rider_id: params.rider_id,
      p_hub_id: params.hub_id,
      p_recovery_date: params.recovery_date || toISODate(new Date()),
      p_amount: recoveryAmount,
      p_payment_mode: params.payment_mode || 'Cash',
      p_transaction_id: params.transaction_id || null,
      p_remarks: params.remarks || null,
      p_collected_by: params.collected_by || null,
      p_created_by: params.created_by || null,
      p_allow_over_recovery: Boolean(params.allow_over_recovery),
    });

    if (!rpcError && rpcResult?.success) {
      // Re-fetch the newly created recoveries
      const { data: freshRecs } = await supabase
        .from('rider_dues_recoveries')
        .select('*')
        .eq('rider_id', params.rider_id)
        .eq('recovery_date', params.recovery_date)
        .order('created_at', { ascending: false })
        .limit(rpcResult.allocated_count || 1);

      return (freshRecs || []) as RiderDueRecovery[];
    }
  } catch (rpcErr) {
    console.warn('RPC record_rider_recovery_fifo failed or unavailable, executing client FIFO:', rpcErr);
  }

  // 2. Client FIFO Allocation Fallback
  // Fetch active unpaid dues for this rider
  const { data: activeDuesData } = await supabase
    .from('rider_dues')
    .select('*')
    .eq('rider_id', params.rider_id)
    .gt('remaining_amount', 0)
    .neq('status', 'cancelled')
    .order('dues_date', { ascending: true })
    .order('created_at', { ascending: true });

  let activeDues = (activeDuesData || []) as RiderDue[];

  // Fallback to legacy dues if rider_dues had no records
  if (activeDues.length === 0) {
    const { data: legDues } = await supabase
      .from('dues')
      .select('*')
      .eq('collector_id', params.rider_id)
      .gt('remaining_amount', 0)
      .neq('status', 'cancelled')
      .order('due_date', { ascending: true });

    activeDues = (legDues || []).map((d: any) => ({
      id: d.id,
      rider_id: d.collector_id,
      hub_id: d.hub_id,
      dues_date: d.due_date,
      category: d.due_reason || 'COD Short',
      amount: safeAmount(d.original_amount),
      recovered_amount: safeAmount(d.recovered_amount),
      remaining_amount: safeAmount(d.remaining_amount),
      status: d.status,
      description: d.notes,
      reference_id: d.reference_number,
      remarks: d.source,
      created_by: d.created_by,
      created_at: d.created_at,
      updated_at: d.updated_at,
    }));
  }

  const totalOutstanding = activeDues.reduce((s, d) => s + d.remaining_amount, 0);

  if (totalOutstanding <= 0 && !params.allow_over_recovery) {
    throw new Error('Rider has no active outstanding dues');
  }

  if (recoveryAmount > totalOutstanding && !params.allow_over_recovery) {
    throw new Error(`Recovery amount (₹${recoveryAmount}) exceeds total outstanding balance (₹${totalOutstanding})`);
  }

  let remToAllocate = recoveryAmount;
  const createdRecoveries: RiderDueRecovery[] = [];

  for (const due of activeDues) {
    if (remToAllocate <= 0) break;

    const alloc = Math.min(due.remaining_amount, remToAllocate);
    const newRecovered = due.recovered_amount + alloc;
    const newRemaining = Math.max(0, due.amount - newRecovered);
    const newStatus = newRemaining <= 0 ? 'fully_recovered' : 'partially_recovered';

    const recPayload = {
      id: uuidv4(),
      rider_id: params.rider_id,
      hub_id: due.hub_id || params.hub_id,
      due_id: due.id,
      recovery_date: params.recovery_date || toISODate(new Date()),
      amount: alloc,
      payment_mode: params.payment_mode || 'Cash',
      transaction_id: params.transaction_id || null,
      remarks: params.remarks || null,
      collected_by: params.collected_by || 'Cashier',
      is_reversed: false,
      created_by: params.created_by || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Insert recovery
    await supabase.from('rider_dues_recoveries').insert(recPayload);
    // Also mirror to legacy recoveries
    try {
      await supabase.from('recoveries').insert({
        id: recPayload.id,
        collector_id: params.rider_id,
        hub_id: recPayload.hub_id,
        due_id: due.id,
        recovery_date: recPayload.recovery_date,
        amount: alloc,
        payment_mode: params.payment_mode === 'Cash' ? 'cash' : 'online',
        reference_number: params.transaction_id,
        notes: params.remarks,
        created_by: params.created_by || null,
      });
    } catch {
      // ignore legacy mirror error
    }

    // Update rider_dues
    await supabase
      .from('rider_dues')
      .update({
        recovered_amount: newRecovered,
        remaining_amount: newRemaining,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', due.id);

    // Update legacy dues
    try {
      await supabase
        .from('dues')
        .update({
          recovered_amount: newRecovered,
          remaining_amount: newRemaining,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', due.id);
    } catch {
      // ignore legacy mirror error
    }

    createdRecoveries.push(recPayload as RiderDueRecovery);
    remToAllocate -= alloc;
  }

  // If excess was allowed and remaining
  if (remToAllocate > 0 && params.allow_over_recovery) {
    const advancePayload = {
      id: uuidv4(),
      rider_id: params.rider_id,
      hub_id: params.hub_id,
      due_id: null,
      recovery_date: params.recovery_date || toISODate(new Date()),
      amount: remToAllocate,
      payment_mode: params.payment_mode || 'Cash',
      transaction_id: params.transaction_id || null,
      remarks: params.remarks || 'Advance / Over-recovery adjustment',
      collected_by: params.collected_by || 'Cashier',
      is_reversed: false,
      created_by: params.created_by || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await supabase.from('rider_dues_recoveries').insert(advancePayload);
    createdRecoveries.push(advancePayload as RiderDueRecovery);
  }

  return createdRecoveries;
}

/**
 * Safely reverses a recovery transaction without deleting history.
 */
export async function reverseRiderRecovery(
  recoveryId: string,
  reversalReason: string,
  reversedBy?: string
): Promise<void> {
  if (!reversalReason || !reversalReason.trim()) {
    throw new Error('Reversal reason is required');
  }

  // Try stored procedure reverse_rider_recovery
  try {
    const { data, error } = await supabase.rpc('reverse_rider_recovery', {
      p_recovery_id: recoveryId,
      p_reversal_reason: reversalReason.trim(),
      p_reversed_by: reversedBy || null,
    });
    if (!error && data?.success) {
      return;
    }
  } catch (rpcErr) {
    console.warn('RPC reverse_rider_recovery fallback:', rpcErr);
  }

  // Client reversal fallback
  const { data: rec, error: recErr } = await supabase
    .from('rider_dues_recoveries')
    .select('*')
    .eq('id', recoveryId)
    .single();

  if (recErr || !rec) throw new Error('Recovery record not found');
  if (rec.is_reversed) throw new Error('Recovery has already been reversed');

  // Mark reversed
  await supabase
    .from('rider_dues_recoveries')
    .update({
      is_reversed: true,
      reversal_reason: reversalReason.trim(),
      reversal_date: new Date().toISOString(),
      reversed_by: reversedBy || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', recoveryId);

  // Rollback balance on linked due
  if (rec.due_id) {
    const { data: due } = await supabase.from('rider_dues').select('*').eq('id', rec.due_id).single();
    if (due) {
      const rolledRecovered = Math.max(0, safeAmount(due.recovered_amount) - safeAmount(rec.amount));
      const rolledRemaining = Math.max(0, safeAmount(due.amount) - rolledRecovered);
      const rolledStatus =
        rolledRecovered <= 0 ? 'pending' : rolledRemaining <= 0 ? 'fully_recovered' : 'partially_recovered';

      await supabase
        .from('rider_dues')
        .update({
          recovered_amount: rolledRecovered,
          remaining_amount: rolledRemaining,
          status: rolledStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', due.id);

      try {
        await supabase
          .from('dues')
          .update({
            recovered_amount: rolledRecovered,
            remaining_amount: rolledRemaining,
            status: rolledStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', due.id);
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Logs a message sent to a rider.
 */
export async function logRiderMessage(params: LogRiderMessageParams): Promise<RiderDueMessage> {
  const payload = {
    id: uuidv4(),
    rider_id: params.rider_id,
    hub_id: params.hub_id,
    message_type: params.message_type,
    recipient_phone: params.recipient_phone,
    message_body: params.message_body,
    channel: params.channel || 'WhatsApp',
    status: params.status || 'sent_via_whatsapp',
    snapshot_dues: safeAmount(params.snapshot_dues),
    snapshot_recovered: safeAmount(params.snapshot_recovered),
    snapshot_balance: safeAmount(params.snapshot_balance),
    created_by: params.created_by || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from('rider_dues_messages').insert(payload).select().single();

  if (error) {
    console.warn('Failed logging message to rider_dues_messages:', error.message);
    return payload as RiderDueMessage;
  }

  return data as RiderDueMessage;
}

/**
 * Generates formatted WhatsApp message template based on rider data and template type.
 */
export function generateWhatsAppMessage(
  templateType: RiderMessageType,
  summary: RiderLedgerSummary,
  customNote = ''
): string {
  const name = summary.riderName;
  const feId = summary.feId;
  const totalDues = formatINR(summary.totalDues);
  const recovered = formatINR(summary.totalRecovered);
  const balance = formatINR(summary.outstandingBalance);

  switch (templateType) {
    case 'Dues Reminder':
      return `Hello ${name},\n\nThis is a reminder regarding your pending dues.\n\nRider ID: ${feId}\nTotal Dues: ${totalDues}\nTotal Recovered: ${recovered}\nPending Balance: ${balance}\n\nKindly clear your pending dues as soon as possible.\n\nThank you,\nHubVault – Accounts Team`;

    case 'Payment Follow-up':
      return `Hello ${name},\n\nFollow-up regarding your outstanding settlement with HubVault.\n\nRider ID: ${feId}\nCurrent Outstanding: ${balance}\nLast Recovery: ${
        summary.lastRecoveryDate ? formatDate(summary.lastRecoveryDate) : 'None'
      }\n\nPlease submit the pending cash or share the online transaction UTR today during the evening shift closing.\n\nRegards,\nAccounts & Reconciliation Desk`;

    case 'Recovery Confirmation':
      return `Hello ${name},\n\nThank you! We have successfully recorded your recovery payment.\n\nRider ID: ${feId}\nTotal Dues: ${totalDues}\nTotal Recovered So Far: ${recovered}\nRemaining Balance: ${balance}\n\nYour updated dues ledger is available at the hub counter.\n\nThank you,\nHubVault Accounts`;

    case 'Final Payment Reminder':
      return `URGENT NOTICE\n\nDear ${name} (${feId}),\n\nYour dues balance of ${balance} is overdue. Please settle this amount immediately with the Hub Supervisor to avoid account suspension and hold on DRS load assignment.\n\nOutstanding: ${balance}\n\nHubVault Operations Team`;

    case 'Custom Message':
      return `Hello ${name} (${feId}),\n\n${customNote || 'Regarding your HubVault collection balance: ' + balance}\n\nHubVault Accounts Team`;

    default:
      return `Hello ${name},\n\nPending Balance: ${balance}. Please settle with hub accounts.`;
  }
}

/**
 * Builds a date-wise chronological statement with opening balance, new dues, recoveries and running closing balance.
 */
export function generateChronologicalStatement(
  dues: RiderDue[],
  recoveries: RiderDueRecovery[]
): ChronologicalStatementRow[] {
  type CombinedItem =
    | { kind: 'due'; date: string; createdAt: string; due: RiderDue }
    | { kind: 'recovery'; date: string; createdAt: string; rec: RiderDueRecovery };

  const combined: CombinedItem[] = [];

  for (const d of dues) {
    if (d.status !== 'cancelled') {
      combined.push({
        kind: 'due',
        date: d.dues_date || toISODate(new Date()),
        createdAt: d.created_at || '',
        due: d,
      });
    }
  }

  for (const r of recoveries) {
    combined.push({
      kind: 'recovery',
      date: r.recovery_date || toISODate(new Date()),
      createdAt: r.created_at || '',
      rec: r,
    });
  }

  // Sort chronological: oldest date first
  combined.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.createdAt.localeCompare(b.createdAt);
  });

  let runningBalance = 0;
  const rows: ChronologicalStatementRow[] = [];

  for (const item of combined) {
    if (item.kind === 'due') {
      const debit = safeAmount(item.due.amount);
      runningBalance += debit;
      rows.push({
        id: item.due.id,
        date: item.date,
        type: 'Due',
        categoryOrMode: item.due.category,
        reference: item.due.reference_id || `DUE-${item.due.id.slice(0, 8).toUpperCase()}`,
        description: item.due.description || item.due.remarks || 'Dues Entry',
        debit,
        credit: 0,
        balance: runningBalance,
      });
    } else {
      const rec = item.rec;
      const credit = rec.is_reversed ? 0 : safeAmount(rec.amount);
      if (!rec.is_reversed) {
        runningBalance = Math.max(0, runningBalance - credit);
      }
      rows.push({
        id: rec.id,
        date: item.date,
        type: rec.is_reversed ? 'Reversal' : 'Recovery',
        categoryOrMode: rec.payment_mode,
        reference: rec.transaction_id || `REC-${rec.id.slice(0, 8).toUpperCase()}`,
        description: rec.is_reversed
          ? `[REVERSED] ${rec.reversal_reason || 'Reversed'}`
          : rec.remarks || `Collected by ${rec.collected_by || 'Cashier'}`,
        debit: 0,
        credit,
        balance: runningBalance,
        isReversed: rec.is_reversed,
      });
    }
  }

  return rows;
}

/**
 * Exports single rider statement to Excel with multiple sheets (Summary & Detailed Statement).
 */
export function exportRiderStatementExcel(
  summary: RiderLedgerSummary,
  statementRows: ChronologicalStatementRow[]
) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Statement Rows
  const tableData = statementRows.map((r, i) => ({
    '#': i + 1,
    Date: formatDate(r.date),
    Type: r.type,
    'Category / Mode': r.categoryOrMode,
    'Reference / AWB': r.reference,
    Description: r.description,
    'Debit (New Due ₹)': r.debit || '',
    'Credit (Recovered ₹)': r.credit || '',
    'Running Balance (₹)': r.balance,
  }));

  const ws = XLSX.utils.json_to_sheet(tableData);

  // Sheet 2: Profile Summary
  const summaryData = [
    { Field: 'Rider Name', Value: summary.riderName },
    { Field: 'FE / Employee ID', Value: summary.feId },
    { Field: 'Mobile Number', Value: summary.phone },
    { Field: 'Hub Name', Value: summary.hubName },
    { Field: 'Total Dues Generated', Value: `₹${summary.totalDues}` },
    { Field: 'Total Amount Recovered', Value: `₹${summary.totalRecovered}` },
    { Field: 'Current Outstanding Balance', Value: `₹${summary.outstandingBalance}` },
    { Field: 'Recovery Status', Value: summary.status },
    { Field: 'Last Recovery Date', Value: summary.lastRecoveryDate ? formatDate(summary.lastRecoveryDate) : 'Never' },
    { Field: 'Generated Date', Value: formatDate(toISODate(new Date())) },
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryData);

  XLSX.utils.book_append_sheet(wb, wsSummary, 'Rider Summary');
  XLSX.utils.book_append_sheet(wb, ws, 'Dues Statement');

  const filename = `Rider_Statement_${summary.riderName.replace(/\s+/g, '_')}_${summary.feId}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/**
 * Exports complete Dues Ledger table to Excel (all records, not just visible page).
 */
export function exportAllRidersLedgerExcel(summaries: RiderLedgerSummary[], filename = 'HubVault_Rider_Dues_Book.xlsx') {
  const wb = XLSX.utils.book_new();

  const rows = summaries.map((s, idx) => ({
    'Sr. No': idx + 1,
    'Rider Name': s.riderName,
    'FE ID': s.feId,
    Mobile: s.phone,
    Hub: s.hubName,
    'Total Dues (₹)': s.totalDues,
    'Total Recovered (₹)': s.totalRecovered,
    'Outstanding Balance (₹)': s.outstandingBalance,
    'Last Recovery Date': s.lastRecoveryDate ? formatDate(s.lastRecoveryDate) : 'Never',
    Status: s.status,
    'Dues Count': s.duesCount,
    'Recoveries Count': s.recoveriesCount,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Rider Dues Ledger');
  XLSX.writeFile(wb, filename);
}

/**
 * Exports Recovery Reports to Excel across multiple sheets.
 */
export function exportRecoveryReportsExcel(
  reports: {
    daily: { date: string; amount: number; count: number }[];
    riderWise: { riderName: string; feId: string; recovered: number; outstanding: number }[];
    hubWise: { hubName: string; totalDues: number; recovered: number; outstanding: number }[];
    categoryWise: { category: string; count: number; totalAmount: number }[];
    overdueList: { riderName: string; feId: string; amount: number; oldestDueDate: string; daysOverdue: number }[];
  },
  filename = 'HubVault_Recovery_Reports.xlsx'
) {
  const wb = XLSX.utils.book_new();

  // Daily Sheet
  const dailyRows = reports.daily.map((d) => ({
    Date: formatDate(d.date),
    'Total Recovered (₹)': d.amount,
    'Transactions Count': d.count,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dailyRows), 'Daily Recovery');

  // Rider Wise Sheet
  const riderRows = reports.riderWise.map((r, i) => ({
    Rank: i + 1,
    Rider: r.riderName,
    'FE ID': r.feId,
    'Total Recovered (₹)': r.recovered,
    'Current Outstanding (₹)': r.outstanding,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(riderRows), 'Rider-Wise Recovery');

  // Hub Wise Sheet
  const hubRows = reports.hubWise.map((h) => ({
    Hub: h.hubName,
    'Total Dues (₹)': h.totalDues,
    'Recovered (₹)': h.recovered,
    'Outstanding (₹)': h.outstanding,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hubRows), 'Hub-Wise Recovery');

  // Category Dues Sheet
  const catRows = reports.categoryWise.map((c) => ({
    Category: c.category,
    'Dues Count': c.count,
    'Total Amount (₹)': c.totalAmount,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catRows), 'Category-Wise Dues');

  // Overdue Sheet
  const overdueRows = reports.overdueList.map((o) => ({
    Rider: o.riderName,
    'FE ID': o.feId,
    'Overdue Amount (₹)': o.amount,
    'Oldest Due Date': formatDate(o.oldestDueDate),
    'Days Past Due': o.daysOverdue,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(overdueRows), 'Overdue Dues');

  XLSX.writeFile(wb, filename);
}

/**
 * Exports single rider statement to PDF using jsPDF.
 */
export async function exportRiderStatementPDF(
  summary: RiderLedgerSummary,
  statementRows: ChronologicalStatementRow[]
) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 40;

  // Header Banner
  doc.setFillColor(15, 23, 42); // Navy blue #0F172A
  doc.rect(0, 0, pageWidth, 75, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('HUBVAULT — RIDER DUES STATEMENT', 40, 38);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225); // Slate 300
  doc.text('Collection Reconciliation Suite · Accounts & Dues Ledger', 40, 56);

  const printDate = formatDate(toISODate(new Date()));
  doc.text(`Generated: ${printDate}`, pageWidth - 160, 56);

  currentY = 100;

  // Rider Details Card
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.roundedRect(40, currentY, pageWidth - 80, 85, 6, 6, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`Rider: ${summary.riderName}`, 55, currentY + 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`FE / Employee ID: ${summary.feId}`, 55, currentY + 44);
  doc.text(`Mobile: ${summary.phone}`, 55, currentY + 62);
  doc.text(`Hub: ${summary.hubName}`, 220, currentY + 44);
  doc.text(`Status: ${summary.status}`, 220, currentY + 62);

  // Financial Highlights on right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Total Dues: ${formatINR(summary.totalDues)}`, 380, currentY + 24);

  doc.setTextColor(5, 150, 105); // Emerald 600
  doc.text(`Recovered: ${formatINR(summary.totalRecovered)}`, 380, currentY + 44);

  doc.setTextColor(225, 29, 72); // Rose 600
  doc.setFontSize(11);
  doc.text(`Outstanding: ${formatINR(summary.outstandingBalance)}`, 380, currentY + 64);

  currentY += 115;

  // Table Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Date-Wise Chronological Dues & Recovery Ledger', 40, currentY);

  currentY += 15;

  // Table Header
  doc.setFillColor(241, 245, 249);
  doc.rect(40, currentY, pageWidth - 80, 22, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);

  doc.text('Date', 45, currentY + 14);
  doc.text('Type', 105, currentY + 14);
  doc.text('Category / Mode', 160, currentY + 14);
  doc.text('Reference', 255, currentY + 14);
  doc.text('Debit (Due)', 340, currentY + 14);
  doc.text('Credit (Rec)', 410, currentY + 14);
  doc.text('Balance', 485, currentY + 14);

  currentY += 24;

  // Table Rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  for (const row of statementRows) {
    if (currentY > 780) {
      doc.addPage();
      currentY = 40;
      // Re-draw table header on new page
      doc.setFillColor(241, 245, 249);
      doc.rect(40, currentY, pageWidth - 80, 22, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      doc.text('Date', 45, currentY + 14);
      doc.text('Type', 105, currentY + 14);
      doc.text('Category / Mode', 160, currentY + 14);
      doc.text('Reference', 255, currentY + 14);
      doc.text('Debit (Due)', 340, currentY + 14);
      doc.text('Credit (Rec)', 410, currentY + 14);
      doc.text('Balance', 485, currentY + 14);
      currentY += 24;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
    }

    doc.setTextColor(71, 85, 105);
    doc.text(formatDate(row.date), 45, currentY + 10);

    if (row.type === 'Due') {
      doc.setTextColor(225, 29, 72); // Rose
    } else if (row.type === 'Recovery') {
      doc.setTextColor(5, 150, 105); // Emerald
    } else {
      doc.setTextColor(100, 116, 139); // Gray
    }
    doc.text(row.type, 105, currentY + 10);

    doc.setTextColor(71, 85, 105);
    doc.text(row.categoryOrMode.slice(0, 16), 160, currentY + 10);
    doc.text(row.reference.slice(0, 14), 255, currentY + 10);

    doc.setTextColor(row.debit ? 225 : 100, row.debit ? 29 : 116, row.debit ? 72 : 139);
    doc.text(row.debit ? `₹${row.debit}` : '-', 340, currentY + 10);

    doc.setTextColor(row.credit ? 5 : 100, row.credit ? 150 : 116, row.credit ? 105 : 139);
    doc.text(row.credit ? `₹${row.credit}` : '-', 410, currentY + 10);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(`₹${row.balance}`, 485, currentY + 10);
    doc.setFont('helvetica', 'normal');

    // Hairline divider
    doc.setDrawColor(241, 245, 249);
    doc.line(40, currentY + 15, pageWidth - 40, currentY + 15);

    currentY += 18;
  }

  // Footer Signature Lines
  if (currentY > 720) {
    doc.addPage();
    currentY = 60;
  } else {
    currentY += 40;
  }

  doc.setDrawColor(203, 213, 225);
  doc.line(60, currentY + 30, 200, currentY + 30);
  doc.line(pageWidth - 200, currentY + 30, pageWidth - 60, currentY + 30);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Rider Signature', 95, currentY + 45);
  doc.text('Authorized Hub Accounts Officer', pageWidth - 190, currentY + 45);

  const filename = `Statement_${summary.riderName.replace(/\s+/g, '_')}_${summary.feId}.pdf`;
  doc.save(filename);
}
