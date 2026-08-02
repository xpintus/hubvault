import { DailyClosing,DailyClosingHistory } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { db } from './offline/db';
import { addToQueue } from './offline/syncQueue';
import { supabase } from './supabase';

export interface ClosingVariances {
  cash: number;
  online: number;
  total: number;
  reconciled: boolean;
}

export const calculateClosingVariances = (
  expectedCash: number,
  expectedOnline: number,
  actualCash: number,
  actualOnline: number,
): ClosingVariances => {
  const cash = actualCash - expectedCash;
  const online = actualOnline - expectedOnline;
  return { cash, online, total: cash + online, reconciled: cash === 0 && online === 0 };
};

export const buildClosingVarianceRemark = (variances: ClosingVariances): string => {
  if (variances.reconciled) return '';
  const parts: string[] = [];
  if (variances.cash < 0) parts.push(`Cash shortage ₹${Math.abs(variances.cash).toLocaleString('en-IN')}`);
  if (variances.cash > 0) parts.push(`Cash excess ₹${variances.cash.toLocaleString('en-IN')}`);
  if (variances.online < 0) parts.push(`Online shortage ₹${Math.abs(variances.online).toLocaleString('en-IN')}`);
  if (variances.online > 0) parts.push(`Online excess ₹${variances.online.toLocaleString('en-IN')}`);
  return `Auto verification: ${parts.join('; ')}. Dues will be matched automatically.`;
};

export async function getDailyClosingSource(closingDate: string, collectorId: string, hubId: string) {
  if (!navigator.onLine) {
    const entries = (await db.collection_entries.toArray()).filter(
      (e) => e.collection_date === closingDate && e.collector_id === collectorId && e.hub_id === hubId,
    );
    return {
      expectedCash: entries.reduce((sum, e) => sum + Math.max(0, Number(e.expected_cod || 0) - Number(e.online_amount || 0)), 0),
      onlineAmount: entries.reduce((sum, e) => sum + Number(e.online_amount || 0), 0),
      entryCount: entries.length,
    };
  }
  const { data, error } = await supabase.from('collection_entries')
    .select('expected_cod, online_amount').eq('collection_date', closingDate)
    .eq('collector_id', collectorId).eq('hub_id', hubId);
  if (error) throw error;
  return {
    expectedCash: (data ?? []).reduce((sum, e) => sum + Math.max(0, Number(e.expected_cod || 0) - Number(e.online_amount || 0)), 0),
    onlineAmount: (data ?? []).reduce((sum, e) => sum + Number(e.online_amount || 0), 0),
    entryCount: data?.length ?? 0,
  };
}

interface SubmitClosingInput {
  closingId?: string | null;
  closingStatus?: DailyClosing['status'];
  closingDate: string;
  collectorId: string;
  hubId: string;
  actualCash: number;
  actualOnline: number;
  notes: string;
  userId: string;
}

export async function submitDailyClosing(input: SubmitClosingInput): Promise<DailyClosing> {
  if (navigator.onLine) {
    const rpcName = input.closingStatus === 'submitted'
      ? 'revise_submitted_daily_closing_amounts'
      : 'submit_daily_closing_amounts';
    const { data, error } = await supabase.rpc(rpcName, {
      p_closing_id: input.closingId ?? null,
      p_closing_date: input.closingDate,
      p_collector_id: input.collectorId,
      p_hub_id: input.hubId,
      p_actual_cash: input.actualCash,
      p_actual_online: input.actualOnline,
      p_notes: input.notes.trim() || null,
    }).single();
    if (error) throw error;
    return data as DailyClosing;
  }
  if (input.closingId) throw new Error('Rejected or reopened closings must be resubmitted online');
  const source = await getDailyClosingSource(input.closingDate, input.collectorId, input.hubId);
  const now = new Date().toISOString();
  const closing: DailyClosing = {
    id: uuidv4(), closing_date: input.closingDate, collector_id: input.collectorId, hub_id: input.hubId,
    expected_cash: source.expectedCash, expected_online_amount: source.onlineAmount,
    actual_cash: input.actualCash, online_amount: input.actualOnline,
    denomination_total: 0, shortage_excess: calculateClosingVariances(source.expectedCash, source.onlineAmount, input.actualCash, input.actualOnline).total,
    note_500: 0, note_200: 0, note_100: 0, note_50: 0, note_20: 0, note_10: 0, note_5: 0, note_2: 0, note_1: 0,
    denomination_verified: false,
    source_snapshot: { ...source, captured_at: now, offline: true }, notes: input.notes.trim() || null,
    rejection_reason: null, status: 'submitted', submitted_by: input.userId, submitted_at: now,
    reviewed_by: null, reviewed_at: null, reopened_by: null, reopened_at: null, created_at: now, updated_at: now,
  };
  await db.daily_closings.add({ ...closing, created_offline: true });
  await addToQueue(input.userId, input.hubId, 'daily_closings', 'INSERT', closing);
  return closing;
}

export async function reviewDailyClosing(id: string, decision: 'approved' | 'rejected', reason?: string) {
  if (!navigator.onLine) throw new Error('Approval and rejection require an internet connection');
  const { data, error } = await supabase.rpc('review_daily_closing', {
    p_closing_id: id, p_decision: decision, p_reason: reason?.trim() || null,
  }).single();
  if (error) throw error;
  return data as DailyClosing;
}

export async function reopenDailyClosing(id: string, reason: string) {
  if (!navigator.onLine) throw new Error('Reopening requires an internet connection');
  const { data, error } = await supabase.rpc('reopen_daily_closing', {
    p_closing_id: id, p_reason: reason.trim(),
  }).single();
  if (error) throw error;
  return data as DailyClosing;
}

export async function loadClosingHistory(id: string): Promise<DailyClosingHistory[]> {
  const { data, error } = await supabase.from('daily_closing_history')
    .select('*, performer:profiles!performed_by(*)').eq('daily_closing_id', id).order('created_at');
  if (error) throw error;
  return (data ?? []) as DailyClosingHistory[];
}
