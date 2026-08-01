import { db } from '@/lib/offline/db';
import { addToQueue } from '@/lib/offline/syncQueue';
import { supabase } from '@/lib/supabase';
import { Due,DueStatus } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export const safeAmount = (val: any): number => {
  if (val === null || val === undefined) return 0;
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  return isNaN(num) ? 0 : num;
};

/**
 * Returns total outstanding remaining balance for an employee across active dues.
 */
export const getEmployeeOutstanding = (collectorId: string, dues: Due[]): number => {
  if (!collectorId) return 0;
  return dues
    .filter((d) => {
      const cid = d.collector_id || d.collector?.id;
      return cid === collectorId && d.status !== 'cancelled' && d.status !== 'fully_recovered';
    })
    .reduce((sum, d) => sum + safeAmount(d.remaining_amount), 0);
};

/**
 * Filters active dues for an employee and sorts in FIFO order (due_date ASC, created_at ASC, id ASC).
 */
export const getActiveEmployeeDues = (collectorId: string, dues: Due[]): Due[] => {
  if (!collectorId) return [];
  return dues
    .filter((d) => {
      const cid = d.collector_id || d.collector?.id;
      return cid === collectorId && d.status !== 'cancelled' && d.status !== 'fully_recovered' && safeAmount(d.remaining_amount) > 0;
    })
    .sort((a, b) => {
      const dateA = a.due_date || a.created_at || '';
      const dateB = b.due_date || b.created_at || '';
      if (dateA !== dateB) return dateA.localeCompare(dateB);

      const createdA = a.created_at || '';
      const createdB = b.created_at || '';
      if (createdA !== createdB) return createdA.localeCompare(createdB);

      return (a.id || '').localeCompare(b.id || '');
    });
};

export interface FIFOAllocationItem {
  due: Due;
  allocated: number;
  newRemaining: number;
  newStatus: DueStatus;
}

/**
 * Previews FIFO recovery allocation across active dues without mutating state.
 */
export const allocateRecoveryFIFO = (
  dues: Due[],
  collectorId: string,
  amount: number
): FIFOAllocationItem[] => {
  const activeDues = getActiveEmployeeDues(collectorId, dues);
  let rem = safeAmount(amount);
  const allocations: FIFOAllocationItem[] = [];

  for (const due of activeDues) {
    if (rem <= 0) break;

    const dueRem = safeAmount(due.remaining_amount);
    const alloc = Math.min(dueRem, rem);
    const newRecovered = safeAmount(due.recovered_amount) + alloc;
    const newRemaining = Math.max(0, safeAmount(due.original_amount) - newRecovered);
    const newStatus: DueStatus = newRemaining <= 0 ? 'fully_recovered' : 'partially_recovered';

    allocations.push({
      due,
      allocated: alloc,
      newRemaining,
      newStatus,
    });

    rem -= alloc;
  }

  return allocations;
};

export interface ExecuteRecoveryParams {
  collectorId: string;
  hubId: string;
  amount: number;
  paymentMode: string;
  recoveryDate: string;
  referenceNumber?: string | null;
  notes?: string | null;
  createdBy?: string | null;
  dues: Due[];
  isOnline: boolean;
}

/**
 * Executes employee-level recovery payment with FIFO allocation.
 * Supports both online atomic DB RPC and offline Dexie FIFO operations.
 */
export const executeEmployeeRecovery = async (params: ExecuteRecoveryParams) => {
  const {
    collectorId,
    hubId,
    amount,
    paymentMode,
    recoveryDate,
    referenceNumber,
    notes,
    createdBy,
    dues,
    isOnline,
  } = params;

  const totalOutstanding = getEmployeeOutstanding(collectorId, dues);
  if (amount <= 0) {
    throw new Error('Recovery amount must be greater than ₹0');
  }
  if (amount > totalOutstanding) {
    throw new Error(`Recovery amount (₹${amount.toLocaleString('en-IN')}) exceeds total employee outstanding (₹${totalOutstanding.toLocaleString('en-IN')})`);
  }

  const allocations = allocateRecoveryFIFO(dues, collectorId, amount);
  if (allocations.length === 0) {
    throw new Error('No active dues available for allocation');
  }

  if (!isOnline) {
    // Offline Dexie FIFO Allocation
    const batchId = uuidv4();
    for (const item of allocations) {
      const recId = uuidv4();
      const recPayload = {
        id: recId,
        collector_id: collectorId,
        hub_id: item.due.hub_id || hubId,
        due_id: item.due.id,
        recovery_date: recoveryDate,
        amount: item.allocated,
        payment_mode: paymentMode as any,
        reference_number: referenceNumber ? `[Batch ${batchId.slice(0, 8)}] ${referenceNumber}` : `Batch ${batchId.slice(0, 8)}`,
        notes: notes || null,
        created_by: createdBy || null,
        created_at: new Date().toISOString(),
      };

      await db.recoveries.put(recPayload as any);
      await addToQueue(createdBy || '', item.due.hub_id || hubId, 'recoveries', 'INSERT', recPayload);

      const dueUpdate = {
        recovered_amount: safeAmount(item.due.recovered_amount) + item.allocated,
        remaining_amount: item.newRemaining,
        status: item.newStatus,
        updated_at: new Date().toISOString(),
      };

      await db.dues.update(item.due.id, dueUpdate);
      await addToQueue(createdBy || '', item.due.hub_id || hubId, 'dues', 'UPDATE', { id: item.due.id, ...dueUpdate });
    }
    return { success: true, offline: true, count: allocations.length };
  } else {
    // Online Supabase RPC
    const { data, error } = await supabase.rpc('record_employee_recovery_fifo', {
      p_collector_id: collectorId,
      p_hub_id: hubId,
      p_recovery_date: recoveryDate,
      p_amount: amount,
      p_payment_mode: paymentMode,
      p_reference_number: referenceNumber || null,
      p_notes: notes || null,
      p_created_by: createdBy || null,
    });

    if (error) {
      // Fallback to sequential atomic RPC if single-standing RPC fails
      for (const item of allocations) {
        const { error: itemErr } = await supabase.rpc('record_recovery_atomic', {
          p_collector_id: collectorId,
          p_hub_id: item.due.hub_id || hubId,
          p_due_id: item.due.id,
          p_recovery_date: recoveryDate,
          p_amount: item.allocated,
          p_payment_mode: paymentMode,
          p_reference_number: referenceNumber || null,
          p_notes: notes || null,
          p_created_by: createdBy || null,
        });
        if (itemErr) throw itemErr;
      }
    }

    return { success: true, data };
  }
};
