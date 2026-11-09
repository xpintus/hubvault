import {
  generateChronologicalStatement,
  generateWhatsAppMessage,
  isDateOverdue,
  OVERDUE_THRESHOLD_DAYS,
} from '@/lib/riderDuesService';
import { Collector, RiderDue, RiderDueRecovery, RiderLedgerSummary } from '@/types';
import { describe, expect, it } from 'vitest';

describe('HubVault — Rider Dues Book & Recovery Business Logic', () => {
  const dummyCollector: Collector = {
    id: 'col-rahul',
    name: 'Rahul Kumar',
    employee_id: 'FE-1092',
    phone: '9876543210',
    hub_id: 'hub-bangalore',
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
  };

  it('correctly calculates the business balance formula: Outstanding Balance = Total Dues - Total Recovered', () => {
    // Exact user example:
    // Initial Dues: 5,000
    // Additional Dues: 2,000 -> Total Dues: 7,000
    // First Recovery: 2,000
    // Second Recovery: 1,000 -> Total Recovered: 3,000
    // Outstanding Balance = 4,000
    const initialDue: RiderDue = {
      id: 'due-1',
      rider_id: 'col-rahul',
      hub_id: 'hub-bangalore',
      dues_date: '2026-11-01',
      category: 'COD Short',
      amount: 5000,
      recovered_amount: 3000,
      remaining_amount: 2000,
      status: 'partially_recovered',
      created_at: '2026-11-01T10:00:00Z',
      updated_at: '2026-11-03T10:00:00Z',
    };

    const additionalDue: RiderDue = {
      id: 'due-2',
      rider_id: 'col-rahul',
      hub_id: 'hub-bangalore',
      dues_date: '2026-11-02',
      category: 'Penalty',
      amount: 2000,
      recovered_amount: 0,
      remaining_amount: 2000,
      status: 'pending',
      created_at: '2026-11-02T10:00:00Z',
      updated_at: '2026-11-02T10:00:00Z',
    };

    const firstRecovery: RiderDueRecovery = {
      id: 'rec-1',
      rider_id: 'col-rahul',
      hub_id: 'hub-bangalore',
      due_id: 'due-1',
      recovery_date: '2026-11-02',
      amount: 2000,
      payment_mode: 'Cash',
      is_reversed: false,
      created_at: '2026-11-02T18:00:00Z',
      updated_at: '2026-11-02T18:00:00Z',
    };

    const secondRecovery: RiderDueRecovery = {
      id: 'rec-2',
      rider_id: 'col-rahul',
      hub_id: 'hub-bangalore',
      due_id: 'due-1',
      recovery_date: '2026-11-03',
      amount: 1000,
      payment_mode: 'UPI',
      is_reversed: false,
      created_at: '2026-11-03T18:00:00Z',
      updated_at: '2026-11-03T18:00:00Z',
    };

    const dues = [initialDue, additionalDue];
    const recoveries = [firstRecovery, secondRecovery];

    const totalDues = dues.reduce((s, d) => s + d.amount, 0);
    const totalRecovered = recoveries.reduce((s, r) => s + (r.is_reversed ? 0 : r.amount), 0);
    const outstandingBalance = Math.max(0, totalDues - totalRecovered);

    expect(totalDues).toBe(7000);
    expect(totalRecovered).toBe(3000);
    expect(outstandingBalance).toBe(4000);
  });

  it('generates the date-wise chronological statement with accurate running balance', () => {
    const dues: RiderDue[] = [
      {
        id: 'due-1',
        rider_id: 'col-rahul',
        hub_id: 'hub-bangalore',
        dues_date: '2026-11-01',
        category: 'COD Short',
        amount: 5000,
        recovered_amount: 3000,
        remaining_amount: 2000,
        status: 'partially_recovered',
        created_at: '2026-11-01T10:00:00Z',
        updated_at: '2026-11-01T10:00:00Z',
      },
      {
        id: 'due-2',
        rider_id: 'col-rahul',
        hub_id: 'hub-bangalore',
        dues_date: '2026-11-03',
        category: 'Cash Short',
        amount: 2000,
        recovered_amount: 0,
        remaining_amount: 2000,
        status: 'pending',
        created_at: '2026-11-03T10:00:00Z',
        updated_at: '2026-11-03T10:00:00Z',
      },
    ];

    const recoveries: RiderDueRecovery[] = [
      {
        id: 'rec-1',
        rider_id: 'col-rahul',
        hub_id: 'hub-bangalore',
        due_id: 'due-1',
        recovery_date: '2026-11-02',
        amount: 2000,
        payment_mode: 'Cash',
        is_reversed: false,
        created_at: '2026-11-02T18:00:00Z',
        updated_at: '2026-11-02T18:00:00Z',
      },
      {
        id: 'rec-2',
        rider_id: 'col-rahul',
        hub_id: 'hub-bangalore',
        due_id: 'due-1',
        recovery_date: '2026-11-04',
        amount: 1000,
        payment_mode: 'UPI',
        is_reversed: false,
        created_at: '2026-11-04T18:00:00Z',
        updated_at: '2026-11-04T18:00:00Z',
      },
    ];

    const statement = generateChronologicalStatement(dues, recoveries);

    expect(statement.length).toBe(4);
    // Row 1: Nov 1 Due (+5000) -> balance 5000
    expect(statement[0].date).toBe('2026-11-01');
    expect(statement[0].type).toBe('Due');
    expect(statement[0].debit).toBe(5000);
    expect(statement[0].balance).toBe(5000);

    // Row 2: Nov 2 Recovery (-2000) -> balance 3000
    expect(statement[1].date).toBe('2026-11-02');
    expect(statement[1].type).toBe('Recovery');
    expect(statement[1].credit).toBe(2000);
    expect(statement[1].balance).toBe(3000);

    // Row 3: Nov 3 Due (+2000) -> balance 5000
    expect(statement[2].date).toBe('2026-11-03');
    expect(statement[2].type).toBe('Due');
    expect(statement[2].debit).toBe(2000);
    expect(statement[2].balance).toBe(5000);

    // Row 4: Nov 4 Recovery (-1000) -> balance 4000
    expect(statement[3].date).toBe('2026-11-04');
    expect(statement[3].type).toBe('Recovery');
    expect(statement[3].credit).toBe(1000);
    expect(statement[3].balance).toBe(4000);
  });

  it('correctly formats the WhatsApp reminder template matching specification', () => {
    const summary: RiderLedgerSummary = {
      riderId: 'col-rahul',
      riderName: 'Rahul Kumar',
      feId: 'FE-1092',
      phone: '9876543210',
      hubId: 'hub-bangalore',
      hubName: 'Bangalore South Hub',
      totalDues: 7000,
      totalRecovered: 3000,
      outstandingBalance: 4000,
      lastRecoveryDate: '2026-11-03',
      oldestDueDate: '2026-11-01',
      status: 'Partially Recovered',
      duesCount: 2,
      recoveriesCount: 2,
      dues: [],
      recoveries: [],
      messages: [],
      rider: dummyCollector,
    };

    const message = generateWhatsAppMessage('Dues Reminder', summary);

    expect(message).toContain('Hello Rahul Kumar,');
    expect(message).toContain('Rider ID: FE-1092');
    expect(message).toContain('Total Dues: ₹7,000');
    expect(message).toContain('Total Recovered: ₹3,000');
    expect(message).toContain('Pending Balance: ₹4,000');
    expect(message).toContain('Kindly clear your pending dues as soon as possible.');
    expect(message).toContain('HubVault – Accounts Team');
  });

  it('detects overdue dues beyond the 7-day threshold', () => {
    expect(OVERDUE_THRESHOLD_DAYS).toBe(7);

    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 10);
    const oldDateStr = oldDate.toISOString().slice(0, 10);
    expect(isDateOverdue(oldDateStr)).toBe(true);

    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 2);
    const recentDateStr = recentDate.toISOString().slice(0, 10);
    expect(isDateOverdue(recentDateStr)).toBe(false);
  });
});
