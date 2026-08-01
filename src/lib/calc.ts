import { DenominationInput,DENOMINATIONS,EntryStatus } from '@/types';

export function denomCashTotal(d: DenominationInput): number {
  return DENOMINATIONS.reduce((sum, item) => sum + item.value * (d[item.key] || 0), 0);
}

export function computeStatus(gap: number, hasAnyCollection: boolean): EntryStatus {
  if (!hasAnyCollection) return 'pending';
  if (gap === 0) return 'reconciled';
  if (gap < 0) return 'shortage';
  return 'excess';
}

export function computeGap(totalCollection: number, expectedCod: number): number {
  return Math.round((totalCollection - expectedCod) * 100) / 100;
}

export function computeTotal(cash: number, online: number): number {
  return Math.round((cash + online) * 100) / 100;
}

export function computePendingAmount(expectedCod: number, totalCollected: number): number {
  const diff = expectedCod - totalCollected;
  return diff > 0 ? Math.round(diff * 100) / 100 : 0;
}

export function computeExcessAmount(expectedCod: number, totalCollected: number): number {
  const diff = totalCollected - expectedCod;
  return diff > 0 ? Math.round(diff * 100) / 100 : 0;
}
