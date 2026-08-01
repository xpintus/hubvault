import { describe, it, expect } from 'vitest';
import { allocateRecoveryFIFO } from '../lib/recoveryService';
import { Due } from '../types';

describe('FIFO Recovery Allocation', () => {
  const sampleDues: Due[] = [
    {
      id: 'due-1',
      due_date: '2025-01-01',
      collector_id: 'col-1',
      hub_id: 'hub-1',
      source: 'collection_shortage',
      collection_entry_id: 'ent-1',
      original_amount: 1000,
      recovered_amount: 0,
      remaining_amount: 1000,
      status: 'outstanding',
      due_reason: 'Shortage',
      reference_number: null,
      notes: null,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    {
      id: 'due-2',
      due_date: '2025-01-05',
      collector_id: 'col-1',
      hub_id: 'hub-1',
      source: 'manual_old_due',
      collection_entry_id: null,
      original_amount: 2000,
      recovered_amount: 0,
      remaining_amount: 2000,
      status: 'outstanding',
      due_reason: 'Old Due',
      reference_number: null,
      notes: null,
      created_at: '2025-01-05T00:00:00Z',
      updated_at: '2025-01-05T00:00:00Z',
    },
  ];

  it('allocates partial recovery to oldest due first', () => {
    const allocations = allocateRecoveryFIFO(sampleDues, 'col-1', 500);
    expect(allocations.length).toBe(1);
    expect(allocations[0].due.id).toBe('due-1');
    expect(allocations[0].allocated).toBe(500);
    expect(allocations[0].newRemaining).toBe(500);
    expect(allocations[0].newStatus).toBe('partially_recovered');
  });

  it('allocates exact full recovery to oldest due', () => {
    const allocations = allocateRecoveryFIFO(sampleDues, 'col-1', 1000);
    expect(allocations.length).toBe(1);
    expect(allocations[0].due.id).toBe('due-1');
    expect(allocations[0].allocated).toBe(1000);
    expect(allocations[0].newRemaining).toBe(0);
    expect(allocations[0].newStatus).toBe('fully_recovered');
  });

  it('spills over recovery to second due when payment exceeds first due', () => {
    const allocations = allocateRecoveryFIFO(sampleDues, 'col-1', 2500);
    expect(allocations.length).toBe(2);
    expect(allocations[0].due.id).toBe('due-1');
    expect(allocations[0].allocated).toBe(1000);
    expect(allocations[0].newRemaining).toBe(0);
    expect(allocations[0].newStatus).toBe('fully_recovered');

    expect(allocations[1].due.id).toBe('due-2');
    expect(allocations[1].allocated).toBe(1500);
    expect(allocations[1].newRemaining).toBe(500);
    expect(allocations[1].newStatus).toBe('partially_recovered');
  });

  it('returns empty array when payment amount is <= 0', () => {
    expect(allocateRecoveryFIFO(sampleDues, 'col-1', 0)).toEqual([]);
    expect(allocateRecoveryFIFO(sampleDues, 'col-1', -100)).toEqual([]);
  });
});
