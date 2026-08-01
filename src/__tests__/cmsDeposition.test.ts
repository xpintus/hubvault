import { describe,expect,it } from 'vitest';
import {
calculateCmsExcess,
calculateCmsPending,
getCashSubmittedAmount,
getDepositAmount,
getOnlineSubmittedAmount,
} from '../lib/financeCalculations';
import { CmsDeposit } from '../types';

describe('CMS Deposition Calculations', () => {
  it('calculates CMS pending balance', () => {
    expect(calculateCmsPending(100000, 75000)).toBe(25000);
    expect(calculateCmsPending(100000, 100000)).toBe(0);
    expect(calculateCmsPending(100000, 120000)).toBe(0);
  });

  it('calculates CMS excess over-deposited balance', () => {
    expect(calculateCmsExcess(100000, 120000)).toBe(20000);
    expect(calculateCmsExcess(100000, 100000)).toBe(0);
    expect(calculateCmsExcess(100000, 80000)).toBe(0);
  });

  it('determines authoritative deposit amount', () => {
    const depositTotal: CmsDeposit = {
      id: 'dep-1',
      deposit_date: '2025-01-10',
      collection_date: '2025-01-10',
      hub_id: 'hub-1',
      total_cash_collected: 30000,
      cash_deposited: 30000,
      online_amount: 20000,
      total_expected_cms: 50000,
      total_deposited: 50000,
      cash_submitted: 30000,
      online_submitted: 20000,
      short_amount: 0,
      reference_number: null,
      bank_name: null,
      remarks: null,
      created_by: 'user-1',
      created_at: '2025-01-10T00:00:00Z',
      updated_at: '2025-01-10T00:00:00Z',
    };
    expect(getDepositAmount(depositTotal)).toBe(50000);
    expect(getCashSubmittedAmount(depositTotal)).toBe(30000);
    expect(getOnlineSubmittedAmount(depositTotal)).toBe(20000);
  });
});
