import { DailyClosing,DailyClosingHistory,DenominationInput } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { db } from './offline/db';
import { addToQueue } from './offline/syncQueue';
import { supabase } from './supabase';

export const closingDenominationTotal = (d: DenominationInput) =>
  d.note_500 * 500 + d.note_200 * 200 + d.note_100 * 100 + d.note_50 * 50 +
  d.note_20 * 20 + d.note_10 * 10 + d.note_5 * 5 + d.note_2 * 2 + d.note_1;

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
  closingDate: string;
  collectorId: string;
  hubId: string;
  denominations: DenominationInput;
  notes: string;
  userId: string;
}

export async function submitDailyClosing(input: SubmitClosingInput): Promise<DailyClosing> {
  if (navigator.onLine) {
    const { data, error } = await supabase.rpc('submit_daily_closing', {
      p_closing_id: input.closingId ?? null,
      p_closing_date: input.closingDate,
      p_collector_id: input.collectorId,
      p_hub_id: input.hubId,
      p_denominations: input.denominations,
      p_notes: input.notes.trim() || null,
    }).single();
    if (error) throw error;
    return data as DailyClosing;
  }
  if (input.closingId) throw new Error('Rejected or reopened closings must be resubmitted online');
  const source = await getDailyClosingSource(input.closingDate, input.collectorId, input.hubId);
  const actualCash = closingDenominationTotal(input.denominations);
  const now = new Date().toISOString();
  const closing: DailyClosing = {
    id: uuidv4(), closing_date: input.closingDate, collector_id: input.collectorId, hub_id: input.hubId,
    expected_cash: source.expectedCash, actual_cash: actualCash, online_amount: source.onlineAmount,
    denomination_total: actualCash, shortage_excess: actualCash - source.expectedCash,
    ...input.denominations, denomination_verified: true,
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
