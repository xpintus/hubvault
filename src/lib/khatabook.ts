import { supabase } from './supabase';
import {
  Party,
  PartyInput,
  PartyTransaction,
  PartyTransactionInput,
  PartyLedgerEntry,
  PartySummaryCardData,
  KhataBookSummary,
  PartyLedgerStatus,
} from '@/types';
import { db, SyncQueueItem } from './offline/db';
import { v4 as uuidv4 } from 'uuid';

/**
 * Formats a currency amount into standard INR notation
 */
export function formatINRNumber(val: number): string {
  const rounded = Math.abs(Math.round(val * 100) / 100);
  return '₹' + rounded.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/**
 * Computes running ledger entries and performs FIFO adjustments for a party.
 *
 * Rules:
 * 1. Opening Balance:
 *    - 'receivable' -> positive initial balance (Party owes us / payment pending)
 *    - 'payable' -> negative initial balance (We owe party / excess paid)
 * 2. Total Paid = Cash Paid + Online Paid
 * 3. Difference = Amount Received - Total Paid
 * 4. Running Balance = Prev Balance + Amount Received - Cash Paid - Online Paid
 * 5. FIFO Settlement Algorithm:
 *    - Tracks pending due buckets chronologically.
 *    - Settle oldest pending dues first when payments (paid > received) occur.
 */
export function calculateRunningLedger(
  party: Party,
  transactions: PartyTransaction[]
): PartyLedgerEntry[] {
  // Sort transactions chronologically
  const sortedTx = [...transactions].sort((a, b) => {
    const dateComp = a.transaction_date.localeCompare(b.transaction_date);
    if (dateComp !== 0) return dateComp;
    return (a.created_at || '').localeCompare(b.created_at || '');
  });

  // Determine initial balance from opening balance
  // If opening_balance_type is 'receivable' -> party owes us (+balance)
  // If opening_balance_type is 'payable' -> we owe party (-balance)
  const initBal = party.opening_balance_type === 'payable'
    ? -Math.abs(party.opening_balance || 0)
    : Math.abs(party.opening_balance || 0);

  let prevBalance = initBal;

  // Queue to track pending due amounts for FIFO settlement
  // Each element: { txId, originalDue, remainingDue, date }
  interface DueBucket {
    txId: string;
    originalDue: number;
    remainingDue: number;
  }

  const dueQueue: DueBucket[] = [];

  // If opening balance is receivable, add it as the first pending due bucket
  if (initBal > 0) {
    dueQueue.push({
      txId: 'opening_balance',
      originalDue: initBal,
      remainingDue: initBal,
    });
  }

  const ledgerEntries: PartyLedgerEntry[] = [];

  for (const tx of sortedTx) {
    const amountReceived = Number(tx.amount_received || 0);
    const cashPaid = Number(tx.cash_paid || 0);
    const onlinePaid = Number(tx.online_paid || 0);
    const totalPaid = cashPaid + onlinePaid;
    const difference = amountReceived - totalPaid;

    const runningBalance = prevBalance + difference;
    prevBalance = runningBalance;

    let adjustedAmount = 0;
    let remainingAmount = 0;

    if (difference > 0) {
      // Net positive transaction -> Adds to pending dues
      const newDue = difference;
      dueQueue.push({
        txId: tx.id,
        originalDue: newDue,
        remainingDue: newDue,
      });
      remainingAmount = newDue;
      adjustedAmount = 0;
    } else if (difference < 0) {
      // Net negative transaction (payment) -> Settles oldest pending dues using FIFO
      let paymentToApply = Math.abs(difference);

      for (const bucket of dueQueue) {
        if (paymentToApply <= 0) break;
        if (bucket.remainingDue <= 0) continue;

        const settle = Math.min(bucket.remainingDue, paymentToApply);
        bucket.remainingDue -= settle;
        paymentToApply -= settle;
        adjustedAmount += settle;
      }

      remainingAmount = 0;
    } else {
      // Difference == 0
      remainingAmount = 0;
      adjustedAmount = 0;
    }

    // Determine status badge
    let status: PartyLedgerStatus = 'settled';
    let statusLabel = 'Settled';

    if (runningBalance > 0) {
      if (adjustedAmount > 0 && remainingAmount > 0) {
        status = 'partial';
        statusLabel = 'Partial';
      } else {
        status = 'pending';
        statusLabel = 'Party Payment Pending (Dues)';
      }
    } else if (runningBalance < 0) {
      status = 'excess';
      statusLabel = 'Excess Paid';
    } else {
      status = 'settled';
      statusLabel = 'Settled';
    }

    ledgerEntries.push({
      ...tx,
      amount_received: amountReceived,
      cash_paid: cashPaid,
      online_paid: onlinePaid,
      total_paid: totalPaid,
      difference,
      running_balance: runningBalance,
      status,
      status_label: statusLabel,
      remaining_amount: remainingAmount,
      adjusted_amount: adjustedAmount,
    });
  }

  return ledgerEntries;
}

/**
 * Computes individual party card data for party dashboard grid
 */
export function calculatePartyCardData(
  party: Party,
  transactions: PartyTransaction[]
): PartySummaryCardData {
  const ledger = calculateRunningLedger(party, transactions);

  const totalReceived = transactions.reduce((sum, t) => sum + Number(t.amount_received || 0), 0);
  const cashPaid = transactions.reduce((sum, t) => sum + Number(t.cash_paid || 0), 0);
  const onlinePaid = transactions.reduce((sum, t) => sum + Number(t.online_paid || 0), 0);
  const totalPaid = cashPaid + onlinePaid;

  const currentBalance = ledger.length > 0
    ? ledger[ledger.length - 1].running_balance
    : (party.opening_balance_type === 'payable' ? -Math.abs(party.opening_balance || 0) : Math.abs(party.opening_balance || 0));

  const sortedTx = [...transactions].sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
  const lastTransactionDate = sortedTx.length > 0 ? sortedTx[0].transaction_date : null;

  let status: 'pending' | 'excess' | 'settled' = 'settled';
  let balanceText = 'Account Settled';

  if (currentBalance > 0) {
    status = 'pending';
    balanceText = `You need to pay ${formatINRNumber(currentBalance)}`;
  } else if (currentBalance < 0) {
    status = 'excess';
    balanceText = `You will receive ${formatINRNumber(Math.abs(currentBalance))}`;
  } else {
    status = 'settled';
    balanceText = 'Account Settled';
  }

  return {
    party,
    total_received: totalReceived,
    cash_paid: cashPaid,
    online_paid: onlinePaid,
    total_paid: totalPaid,
    current_balance: currentBalance,
    last_transaction_date: lastTransactionDate,
    status,
    balance_text: balanceText,
  };
}

/**
 * Computes summary metric metrics for KhataBook Dashboard cards
 */
export function calculateKhataBookSummary(
  parties: Party[],
  transactionsMap: Record<string, PartyTransaction[]>
): KhataBookSummary {
  let totalReceived = 0;
  let totalCashPaid = 0;
  let totalOnlinePaid = 0;
  let currentPending = 0;
  let currentExcess = 0;
  let settledParties = 0;
  let todayTxCount = 0;

  const todayStr = new Date().toISOString().split('T')[0];

  for (const party of parties) {
    const txs = transactionsMap[party.id] || [];
    const cardData = calculatePartyCardData(party, txs);

    totalReceived += cardData.total_received;
    totalCashPaid += cardData.cash_paid;
    totalOnlinePaid += cardData.online_paid;

    if (cardData.current_balance > 0) {
      currentPending += cardData.current_balance;
    } else if (cardData.current_balance < 0) {
      currentExcess += Math.abs(cardData.current_balance);
    } else {
      settledParties += 1;
    }

    for (const t of txs) {
      if (t.transaction_date === todayStr) {
        todayTxCount += 1;
      }
    }
  }

  return {
    total_parties: parties.length,
    total_received: totalReceived,
    total_cash_paid: totalCashPaid,
    total_online_paid: totalOnlinePaid,
    total_paid: totalCashPaid + totalOnlinePaid,
    current_pending: currentPending,
    current_excess: currentExcess,
    settled_parties: settledParties,
    today_transactions_count: todayTxCount,
  };
}

// ==========================================
// SUPABASE & OFFLINE DATA ACCESS SERVICE
// ==========================================

export async function fetchParties(hubId?: string | null): Promise<Party[]> {
  try {
    let query = supabase.from('parties').select('*, hub:hubs(*)').order('name');
    if (hubId) {
      query = query.eq('hub_id', hubId);
    }
    const { data, error } = await query;
    if (error) throw error;
    if (data) {
      // Store in Dexie offline cache
      try {
        for (const p of data) {
          await db.parties.put(p);
        }
      } catch (e) {
        // ignore offline cache write error
      }
      return data as Party[];
    }
  } catch (err) {
    console.warn('Fetching parties from Supabase failed, falling back to local database:', err);
  }

  // Offline fallback
  const localParties = await db.parties.toArray();
  if (hubId) {
    return localParties.filter((p) => p.hub_id === hubId);
  }
  return localParties;
}

export async function fetchPartyTransactions(partyId?: string, hubId?: string | null): Promise<PartyTransaction[]> {
  try {
    let query = supabase.from('party_transactions').select('*, party:parties(*), hub:hubs(*)').order('transaction_date', { ascending: true });
    if (partyId) {
      query = query.eq('party_id', partyId);
    }
    if (hubId) {
      query = query.eq('hub_id', hubId);
    }
    const { data, error } = await query;
    if (error) throw error;
    if (data) {
      // Store in Dexie offline cache
      try {
        for (const t of data) {
          await db.party_transactions.put(t);
        }
      } catch (e) {
        // ignore offline cache write error
      }
      return data as PartyTransaction[];
    }
  } catch (err) {
    console.warn('Fetching party transactions from Supabase failed, falling back to local database:', err);
  }

  // Offline fallback
  let localTx = await db.party_transactions.toArray();
  if (partyId) {
    localTx = localTx.filter((t) => t.party_id === partyId);
  }
  if (hubId) {
    localTx = localTx.filter((t) => t.hub_id === hubId);
  }
  return localTx;
}

export async function createParty(input: PartyInput, userId?: string): Promise<Party> {
  const newParty: Party = {
    id: uuidv4(),
    hub_id: input.hub_id || null,
    name: input.name.trim(),
    company_name: input.company_name?.trim() || null,
    mobile: input.mobile?.trim() || null,
    address: input.address?.trim() || null,
    gstin: input.gstin?.trim() || null,
    opening_balance: Number(input.opening_balance || 0),
    opening_balance_type: input.opening_balance_type || 'receivable',
    notes: input.notes?.trim() || null,
    created_by: userId || null,
    updated_by: userId || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase.from('parties').insert(newParty).select().single();
    if (error) throw error;
    await db.parties.put(data);
    return data as Party;
  } catch (err) {
    console.warn('Supabase party creation failed, saving to sync queue for offline sync:', err);
    await db.parties.put({ ...newParty, created_offline: true });
    if (userId && input.hub_id) {
      const queueItem: SyncQueueItem = {
        id: uuidv4(),
        user_id: userId,
        hub_id: input.hub_id,
        table_name: 'parties',
        operation: 'INSERT',
        payload: newParty,
        created_at: new Date().toISOString(),
        retry_count: 0,
        status: 'pending',
      };
      await db.sync_queue.put(queueItem);
    }
    return newParty;
  }
}

export async function updateParty(id: string, input: Partial<PartyInput>, userId?: string): Promise<void> {
  const updates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };
  if (input.name !== undefined) updates.name = input.name.trim();
  if (input.company_name !== undefined) updates.company_name = input.company_name?.trim() || null;
  if (input.mobile !== undefined) updates.mobile = input.mobile?.trim() || null;
  if (input.address !== undefined) updates.address = input.address?.trim() || null;
  if (input.gstin !== undefined) updates.gstin = input.gstin?.trim() || null;
  if (input.opening_balance !== undefined) updates.opening_balance = Number(input.opening_balance);
  if (input.opening_balance_type !== undefined) updates.opening_balance_type = input.opening_balance_type;
  if (input.notes !== undefined) updates.notes = input.notes?.trim() || null;
  if (userId) updates.updated_by = userId;

  try {
    const { error } = await supabase.from('parties').update(updates).eq('id', id);
    if (error) throw error;
    const existing = await db.parties.get(id);
    if (existing) {
      await db.parties.put({ ...existing, ...updates });
    }
  } catch (err) {
    console.warn('Supabase party update failed, queuing for offline sync:', err);
    const existing = await db.parties.get(id);
    if (existing) {
      await db.parties.put({ ...existing, ...updates });
      if (userId && existing.hub_id) {
        const queueItem: SyncQueueItem = {
          id: uuidv4(),
          user_id: userId,
          hub_id: existing.hub_id,
          table_name: 'parties',
          operation: 'UPDATE',
          payload: { id, ...updates },
          created_at: new Date().toISOString(),
          retry_count: 0,
          status: 'pending',
        };
        await db.sync_queue.put(queueItem);
      }
    }
  }
}

export async function deleteParty(id: string, userId?: string, hubId?: string): Promise<void> {
  try {
    const { error } = await supabase.from('parties').delete().eq('id', id);
    if (error) throw error;
    await db.parties.delete(id);
  } catch (err) {
    console.warn('Supabase party deletion failed, queuing for offline sync:', err);
    await db.parties.delete(id);
    if (userId && hubId) {
      const queueItem: SyncQueueItem = {
        id: uuidv4(),
        user_id: userId,
        hub_id: hubId,
        table_name: 'parties',
        operation: 'DELETE',
        payload: { id },
        created_at: new Date().toISOString(),
        retry_count: 0,
        status: 'pending',
      };
      await db.sync_queue.put(queueItem);
    }
  }
}

export async function createPartyTransaction(input: PartyTransactionInput, userId?: string): Promise<PartyTransaction> {
  const newTx: PartyTransaction = {
    id: uuidv4(),
    party_id: input.party_id,
    hub_id: input.hub_id || null,
    transaction_date: input.transaction_date,
    amount_received: Number(input.amount_received || 0),
    cash_paid: Number(input.cash_paid || 0),
    online_paid: Number(input.online_paid || 0),
    payment_reference: input.payment_reference?.trim() || null,
    remarks: input.remarks?.trim() || null,
    attachment_url: input.attachment_url || null,
    created_by: userId || null,
    updated_by: userId || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase.from('party_transactions').insert(newTx).select('*, party:parties(*), hub:hubs(*)').single();
    if (error) throw error;
    await db.party_transactions.put(data);
    return data as PartyTransaction;
  } catch (err) {
    console.warn('Supabase party transaction creation failed, saving offline:', err);
    await db.party_transactions.put({ ...newTx, created_offline: true });
    if (userId && input.hub_id) {
      const queueItem: SyncQueueItem = {
        id: uuidv4(),
        user_id: userId,
        hub_id: input.hub_id,
        table_name: 'party_transactions',
        operation: 'INSERT',
        payload: newTx,
        created_at: new Date().toISOString(),
        retry_count: 0,
        status: 'pending',
      };
      await db.sync_queue.put(queueItem);
    }
    return newTx;
  }
}

export async function updatePartyTransaction(id: string, input: Partial<PartyTransactionInput>, userId?: string): Promise<void> {
  const updates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };
  if (input.transaction_date !== undefined) updates.transaction_date = input.transaction_date;
  if (input.amount_received !== undefined) updates.amount_received = Number(input.amount_received);
  if (input.cash_paid !== undefined) updates.cash_paid = Number(input.cash_paid);
  if (input.online_paid !== undefined) updates.online_paid = Number(input.online_paid);
  if (input.payment_reference !== undefined) updates.payment_reference = input.payment_reference?.trim() || null;
  if (input.remarks !== undefined) updates.remarks = input.remarks?.trim() || null;
  if (input.attachment_url !== undefined) updates.attachment_url = input.attachment_url || null;
  if (userId) updates.updated_by = userId;

  try {
    const { error } = await supabase.from('party_transactions').update(updates).eq('id', id);
    if (error) throw error;
    const existing = await db.party_transactions.get(id);
    if (existing) {
      await db.party_transactions.put({ ...existing, ...updates });
    }
  } catch (err) {
    console.warn('Supabase party transaction update failed, queuing offline:', err);
    const existing = await db.party_transactions.get(id);
    if (existing) {
      await db.party_transactions.put({ ...existing, ...updates });
      if (userId && existing.hub_id) {
        const queueItem: SyncQueueItem = {
          id: uuidv4(),
          user_id: userId,
          hub_id: existing.hub_id,
          table_name: 'party_transactions',
          operation: 'UPDATE',
          payload: { id, ...updates },
          created_at: new Date().toISOString(),
          retry_count: 0,
          status: 'pending',
        };
        await db.sync_queue.put(queueItem);
      }
    }
  }
}

export async function deletePartyTransaction(id: string, userId?: string, hubId?: string): Promise<void> {
  try {
    const { error } = await supabase.from('party_transactions').delete().eq('id', id);
    if (error) throw error;
    await db.party_transactions.delete(id);
  } catch (err) {
    console.warn('Supabase party transaction deletion failed, queuing offline:', err);
    await db.party_transactions.delete(id);
    if (userId && hubId) {
      const queueItem: SyncQueueItem = {
        id: uuidv4(),
        user_id: userId,
        hub_id: hubId,
        table_name: 'party_transactions',
        operation: 'DELETE',
        payload: { id },
        created_at: new Date().toISOString(),
        retry_count: 0,
        status: 'pending',
      };
      await db.sync_queue.put(queueItem);
    }
  }
}
