import { describe,expect,it } from 'vitest';
import {
calculateRecoveryPercentage,
computeExcessAmount,
computeGap,
computePendingAmount,
computeStatus,
normalizeRecoveryMode,
safeAmount
} from '../lib/financeCalculations';

describe('Dashboard Financial Calculations', () => {
  it('computes exact gap correctly', () => {
    expect(computeGap(45000, 50000)).toBe(-5000);
    expect(computeGap(52000, 50000)).toBe(2000);
    expect(computeGap(50000, 50000)).toBe(0);
  });

  it('computes collection status correctly based on gap and presence of collection', () => {
    expect(computeStatus(-500, true)).toBe('shortage');
    expect(computeStatus(500, true)).toBe('excess');
    expect(computeStatus(0, true)).toBe('reconciled');
    expect(computeStatus(0, false)).toBe('pending');
  });

  it('computes shortage pending amount', () => {
    expect(computePendingAmount(50000, 45000)).toBe(5000);
    expect(computePendingAmount(50000, 55000)).toBe(0);
  });

  it('computes excess amount', () => {
    expect(computeExcessAmount(50000, 55000)).toBe(5000);
    expect(computeExcessAmount(50000, 45000)).toBe(0);
  });

  it('computes recovery percentage ratio', () => {
    expect(calculateRecoveryPercentage(5000, 10000)).toBe(50);
    expect(calculateRecoveryPercentage(10000, 10000)).toBe(100);
    expect(calculateRecoveryPercentage(0, 10000)).toBe(0);
    expect(calculateRecoveryPercentage(5000, 0)).toBe(0);
  });

  it('safely handles non-numeric inputs', () => {
    expect(safeAmount(null)).toBe(0);
    expect(safeAmount(undefined)).toBe(0);
    expect(safeAmount('1250 font')).toBe(1250);
    expect(safeAmount('invalid')).toBe(0);
  });

  it('normalizes recovery mode aliases', () => {
    expect(normalizeRecoveryMode('cash')).toBe('cash');
    expect(normalizeRecoveryMode('online')).toBe('online');
    expect(normalizeRecoveryMode('upi')).toBe('online');
    expect(normalizeRecoveryMode('bank_transfer')).toBe('online');
    expect(normalizeRecoveryMode('other')).toBe('other');
    expect(normalizeRecoveryMode(null)).toBe('other');
  });
});
