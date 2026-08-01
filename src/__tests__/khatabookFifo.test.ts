import { describe, it, expect } from 'vitest';
import { Party, PartyTransaction } from '@/types';
import {
  calculateRunningLedger,
  calculatePartyCardData,
  calculateKhataBookSummary,
} from '@/lib/khatabook';

describe('KhataBook FIFO Settlement & Running Balance Logic', () => {
  const sampleParty: Party = {
    id: 'party-1',
    hub_id: 'hub-1',
    name: 'Reliable Traders',
    company_name: 'Reliable Logistics',
    mobile: '9876543210',
    address: 'Mumbai',
    gstin: '27AAAAA0000A1Z5',
    opening_balance: 0,
    opening_balance_type: 'receivable',
    notes: 'Test party',
    created_by: 'user-1',
    updated_by: 'user-1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it('correctly calculates the exact FIFO example from objective requirements', () => {
    // Day 1: Received = 50,000, Paid = 40,000 -> Pending = 10,000
    // Day 2: Received = 30,000, Paid = 25,000 -> Pending = 5,000 (Total Pending = 15,000)
    // Day 3: Paid = 12,000 (Cash 12,000, Received 0) -> FIFO adjusts Day 1 (10,000) completely to 0, and Day 2 (5,000) by 2,000 leaving 3,000 pending.
    const transactions: PartyTransaction[] = [
      {
        id: 'tx-day1',
        party_id: 'party-1',
        hub_id: 'hub-1',
        transaction_date: '2026-08-01',
        amount_received: 50000,
        cash_paid: 40000,
        online_paid: 0,
        payment_reference: 'REF-1',
        remarks: 'Day 1 entry',
        attachment_url: null,
        created_by: 'user-1',
        updated_by: 'user-1',
        created_at: '2026-08-01T10:00:00Z',
        updated_at: '2026-08-01T10:00:00Z',
      },
      {
        id: 'tx-day2',
        party_id: 'party-1',
        hub_id: 'hub-1',
        transaction_date: '2026-08-02',
        amount_received: 30000,
        cash_paid: 25000,
        online_paid: 0,
        payment_reference: 'REF-2',
        remarks: 'Day 2 entry',
        attachment_url: null,
        created_by: 'user-1',
        updated_by: 'user-1',
        created_at: '2026-08-02T10:00:00Z',
        updated_at: '2026-08-02T10:00:00Z',
      },
      {
        id: 'tx-day3',
        party_id: 'party-1',
        hub_id: 'hub-1',
        transaction_date: '2026-08-03',
        amount_received: 0,
        cash_paid: 12000,
        online_paid: 0,
        payment_reference: 'REF-3',
        remarks: 'Day 3 payment of 12,000',
        attachment_url: null,
        created_by: 'user-1',
        updated_by: 'user-1',
        created_at: '2026-08-03T10:00:00Z',
        updated_at: '2026-08-03T10:00:00Z',
      },
    ];

    const ledger = calculateRunningLedger(sampleParty, transactions);

    expect(ledger).toHaveLength(3);

    // Day 1 assertions
    expect(ledger[0].running_balance).toBe(10000);
    expect(ledger[0].remaining_amount).toBe(10000);

    // Day 2 assertions
    expect(ledger[1].running_balance).toBe(15000);
    expect(ledger[1].remaining_amount).toBe(5000);

    // Day 3 payment of 12,000 -> Running balance becomes 15,000 - 12,000 = 3,000
    expect(ledger[2].running_balance).toBe(30000 + 50000 - (40000 + 25000 + 12000));
    expect(ledger[2].running_balance).toBe(3000);
    expect(ledger[2].adjusted_amount).toBe(12000);
  });

  it('handles party opening balance receivable and payable types', () => {
    const receivableParty: Party = { ...sampleParty, opening_balance: 5000, opening_balance_type: 'receivable' };
    const payableParty: Party = { ...sampleParty, opening_balance: 2000, opening_balance_type: 'payable' };

    const ledgerRec = calculateRunningLedger(receivableParty, []);
    expect(ledgerRec).toHaveLength(0);

    const cardRec = calculatePartyCardData(receivableParty, []);
    expect(cardRec.current_balance).toBe(5000);
    expect(cardRec.status).toBe('pending');
    expect(cardRec.balance_text).toContain('You need to pay');

    const cardPay = calculatePartyCardData(payableParty, []);
    expect(cardPay.current_balance).toBe(-2000);
    expect(cardPay.status).toBe('excess');
    expect(cardPay.balance_text).toContain('You will receive');
  });

  it('correctly assigns status badges (settled, pending, excess)', () => {
    const txSettled: PartyTransaction[] = [
      {
        id: 't1',
        party_id: 'party-1',
        hub_id: 'hub-1',
        transaction_date: '2026-08-01',
        amount_received: 10000,
        cash_paid: 5000,
        online_paid: 5000,
        payment_reference: null,
        remarks: null,
        attachment_url: null,
        created_by: null,
        updated_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const cardData = calculatePartyCardData(sampleParty, txSettled);
    expect(cardData.current_balance).toBe(0);
    expect(cardData.status).toBe('settled');
    expect(cardData.balance_text).toBe('Account Settled');
  });

  it('correctly aggregates KhataBook summary metrics across parties', () => {
    const p1 = { ...sampleParty, id: 'p1', name: 'Party 1' };
    const p2 = { ...sampleParty, id: 'p2', name: 'Party 2' };

    const txMap: Record<string, PartyTransaction[]> = {
      p1: [
        {
          id: 't1',
          party_id: 'p1',
          hub_id: 'h1',
          transaction_date: new Date().toISOString().split('T')[0],
          amount_received: 20000,
          cash_paid: 5000,
          online_paid: 5000,
          payment_reference: null,
          remarks: null,
          attachment_url: null,
          created_by: null,
          updated_by: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      p2: [
        {
          id: 't2',
          party_id: 'p2',
          hub_id: 'h1',
          transaction_date: new Date().toISOString().split('T')[0],
          amount_received: 0,
          cash_paid: 10000,
          online_paid: 5000,
          payment_reference: null,
          remarks: null,
          attachment_url: null,
          created_by: null,
          updated_by: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    };

    const summary = calculateKhataBookSummary([p1, p2], txMap);

    expect(summary.total_parties).toBe(2);
    expect(summary.total_received).toBe(20000);
    expect(summary.total_cash_paid).toBe(15000);
    expect(summary.total_online_paid).toBe(10000);
    expect(summary.total_paid).toBe(25000);
    expect(summary.current_pending).toBe(10000);
    expect(summary.current_excess).toBe(15000);
    expect(summary.today_transactions_count).toBe(2);
  });

  it('recalculates all subsequent running balances and FIFO adjustments when an old transaction is edited', () => {
    const transactions: PartyTransaction[] = [
      {
        id: 'tx-1',
        party_id: 'party-1',
        hub_id: 'hub-1',
        transaction_date: '2026-08-01',
        amount_received: 50000,
        cash_paid: 40000,
        online_paid: 0,
        payment_reference: null,
        remarks: null,
        attachment_url: null,
        created_by: null,
        updated_by: null,
        created_at: '2026-08-01T10:00:00Z',
        updated_at: '2026-08-01T10:00:00Z',
      },
      {
        id: 'tx-2',
        party_id: 'party-1',
        hub_id: 'hub-1',
        transaction_date: '2026-08-02',
        amount_received: 30000,
        cash_paid: 25000,
        online_paid: 0,
        payment_reference: null,
        remarks: null,
        attachment_url: null,
        created_by: null,
        updated_by: null,
        created_at: '2026-08-02T10:00:00Z',
        updated_at: '2026-08-02T10:00:00Z',
      },
      {
        id: 'tx-3',
        party_id: 'party-1',
        hub_id: 'hub-1',
        transaction_date: '2026-08-03',
        amount_received: 0,
        cash_paid: 12000,
        online_paid: 0,
        payment_reference: null,
        remarks: null,
        attachment_url: null,
        created_by: null,
        updated_by: null,
        created_at: '2026-08-03T10:00:00Z',
        updated_at: '2026-08-03T10:00:00Z',
      },
    ];

    const initialLedger = calculateRunningLedger(sampleParty, transactions);
    expect(initialLedger[2].running_balance).toBe(3000);

    // Edit old transaction tx-1: change amount_received from 50,000 to 60,000 (diff increases by 10,000)
    const editedTransactions = transactions.map((t) =>
      t.id === 'tx-1' ? { ...t, amount_received: 60000 } : t
    );

    const recalculatedLedger = calculateRunningLedger(sampleParty, editedTransactions);

    // Day 1 running balance: 60000 - 40000 = 20000
    expect(recalculatedLedger[0].running_balance).toBe(20000);
    // Day 2 running balance: 20000 + (30000 - 25000) = 25000
    expect(recalculatedLedger[1].running_balance).toBe(25000);
    // Day 3 running balance: 25000 - 12000 = 13000
    expect(recalculatedLedger[2].running_balance).toBe(13000);
  });

  it('recalculates all subsequent running balances and FIFO adjustments when an old transaction is deleted', () => {
    const transactions: PartyTransaction[] = [
      {
        id: 'tx-1',
        party_id: 'party-1',
        hub_id: 'hub-1',
        transaction_date: '2026-08-01',
        amount_received: 50000,
        cash_paid: 40000,
        online_paid: 0,
        payment_reference: null,
        remarks: null,
        attachment_url: null,
        created_by: null,
        updated_by: null,
        created_at: '2026-08-01T10:00:00Z',
        updated_at: '2026-08-01T10:00:00Z',
      },
      {
        id: 'tx-2',
        party_id: 'party-1',
        hub_id: 'hub-1',
        transaction_date: '2026-08-02',
        amount_received: 30000,
        cash_paid: 25000,
        online_paid: 0,
        payment_reference: null,
        remarks: null,
        attachment_url: null,
        created_by: null,
        updated_by: null,
        created_at: '2026-08-02T10:00:00Z',
        updated_at: '2026-08-02T10:00:00Z',
      },
      {
        id: 'tx-3',
        party_id: 'party-1',
        hub_id: 'hub-1',
        transaction_date: '2026-08-03',
        amount_received: 0,
        cash_paid: 12000,
        online_paid: 0,
        payment_reference: null,
        remarks: null,
        attachment_url: null,
        created_by: null,
        updated_by: null,
        created_at: '2026-08-03T10:00:00Z',
        updated_at: '2026-08-03T10:00:00Z',
      },
    ];

    // Delete tx-1 (old transaction)
    const remainingTx = transactions.filter((t) => t.id !== 'tx-1');

    const recalculatedLedger = calculateRunningLedger(sampleParty, remainingTx);

    expect(recalculatedLedger).toHaveLength(2);
    // tx-2 (now first item): 30000 - 25000 = 5000
    expect(recalculatedLedger[0].running_balance).toBe(5000);
    // tx-3 (now second item): 5000 - 12000 = -7000 (Excess)
    expect(recalculatedLedger[1].running_balance).toBe(-7000);
    expect(recalculatedLedger[1].status).toBe('excess');
  });
});
