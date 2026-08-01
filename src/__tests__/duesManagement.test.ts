import { describe, it, expect } from 'vitest';
import { calculateOutstanding } from '../lib/financeCalculations';
import { Due } from '../types';

describe('Dues Management Calculations', () => {
  const duesList: Due[] = [
    {
      id: 'd-1',
      due_date: '2025-01-01',
      collector_id: 'col-1',
      hub_id: 'h-1',
      source: 'manual_old_due',
      collection_entry_id: null,
      original_amount: 5000,
      recovered_amount: 1000,
      remaining_amount: 4000,
      status: 'partially_recovered',
      due_reason: 'Old Due',
      reference_number: null,
      notes: null,
      created_by: 'user-1',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    {
      id: 'd-2',
      due_date: '2025-01-02',
      collector_id: 'col-1',
      hub_id: 'h-1',
      source: 'collection_shortage',
      collection_entry_id: 'entry-1',
      original_amount: 3000,
      recovered_amount: 0,
      remaining_amount: 3000,
      status: 'outstanding',
      due_reason: 'Shortage',
      reference_number: null,
      notes: null,
      created_by: 'user-1',
      created_at: '2025-01-02T00:00:00Z',
      updated_at: '2025-01-02T00:00:00Z',
    },
    {
      id: 'd-3',
      due_date: '2025-01-03',
      collector_id: 'col-1',
      hub_id: 'h-1',
      source: 'manual_old_due',
      collection_entry_id: null,
      original_amount: 2000,
      recovered_amount: 2000,
      remaining_amount: 0,
      status: 'fully_recovered',
      due_reason: 'Resolved',
      reference_number: null,
      notes: null,
      created_by: 'user-1',
      created_at: '2025-01-03T00:00:00Z',
      updated_at: '2025-01-03T00:00:00Z',
    },
  ];

  it('calculates total outstanding remaining dues excluding fully recovered entries', () => {
    const totalOutstanding = calculateOutstanding(duesList);
    expect(totalOutstanding).toBe(7000);
  });

  it('returns 0 when array is empty or invalid', () => {
    expect(calculateOutstanding([])).toBe(0);
    expect(calculateOutstanding(null as any)).toBe(0);
  });
});
