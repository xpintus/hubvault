import { Due, EntryStatus, CmsDeposit } from '@/types';

/**
 * Ensures numeric value conversion with fallback to 0.
 */
export const safeAmount = (val: any): number => {
  if (val === null || val === undefined) return 0;
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  return isNaN(num) ? 0 : num;
};

/**
 * Rounds monetary values to two decimal places.
 */
export const normalizeMoney = (amount: number): number => {
  return Math.round((safeAmount(amount) + Number.EPSILON) * 100) / 100;
};

/**
 * Normalizes payment/recovery modes into standard strings.
 */
export const normalizeRecoveryMode = (mode: string | null | undefined): 'cash' | 'online' | 'other' => {
  if (!mode) return 'other';
  const m = mode.toLowerCase().trim();
  if (m === 'cash') return 'cash';
  if (m === 'online' || m === 'upi' || m === 'bank_transfer' || m === 'net_banking' || m === 'qr') return 'online';
  return 'other';
};

/**
 * Computes difference between total collection and expected COD.
 */
export const calculateCollectionDifference = (totalCollection: number, expectedCod: number): number => {
  return normalizeMoney(safeAmount(totalCollection) - safeAmount(expectedCod));
};

/**
 * Computes gap amount (totalCollection - expectedCod).
 */
export const computeGap = (totalCollection: number, expectedCod: number): number => {
  return calculateCollectionDifference(totalCollection, expectedCod);
};

/**
 * Computes collection status based on gap and presence of entries.
 */
export const computeStatus = (gap: number, hasAnyCollection: boolean): EntryStatus => {
  if (!hasAnyCollection) return 'pending';
  if (gap === 0) return 'reconciled';
  if (gap < 0) return 'shortage';
  return 'excess';
};

/**
 * Computes pending shortage amount.
 */
export const computePendingAmount = (expectedCod: number, totalCollected: number): number => {
  const diff = safeAmount(expectedCod) - safeAmount(totalCollected);
  return diff > 0 ? normalizeMoney(diff) : 0;
};

/**
 * Computes excess collection amount.
 */
export const computeExcessAmount = (expectedCod: number, totalCollected: number): number => {
  const diff = safeAmount(totalCollected) - safeAmount(expectedCod);
  return diff > 0 ? normalizeMoney(diff) : 0;
};

/**
 * Computes recovery percentage ratio.
 */
export const calculateRecoveryPercentage = (recovered: number, original: number): number => {
  const orig = safeAmount(original);
  if (orig <= 0) return 0;
  return Math.min(100, Math.round((safeAmount(recovered) / orig) * 100));
};

/**
 * Calculates total remaining outstanding dues across active dues records.
 */
export const calculateOutstanding = (dues: Due[]): number => {
  if (!Array.isArray(dues)) return 0;
  return dues
    .filter((d) => d.status !== 'fully_recovered' && d.status !== 'cancelled')
    .reduce((sum, d) => sum + safeAmount(d.remaining_amount), 0);
};

/**
 * Calculates CMS deposition pending balance.
 */
export const calculateCmsPending = (expected: number, deposited: number): number => {
  const diff = safeAmount(expected) - safeAmount(deposited);
  return diff > 0 ? normalizeMoney(diff) : 0;
};

/**
 * Calculates CMS deposition excess over-deposited balance.
 */
export const calculateCmsExcess = (expected: number, deposited: number): number => {
  const diff = safeAmount(deposited) - safeAmount(expected);
  return diff > 0 ? normalizeMoney(diff) : 0;
};

/**
 * Authoritative CMS deposit amount helper.
 */
export const getDepositAmount = (d: CmsDeposit): number => {
  const total = safeAmount(d.total_deposited);
  const split = safeAmount(d.cash_submitted) + safeAmount(d.online_submitted);
  if (total > 0) return total;
  if (split > 0) return split;
  return safeAmount(d.cash_deposited);
};

/**
 * Cash submitted amount helper for CMS deposit.
 */
export const getCashSubmittedAmount = (d: CmsDeposit): number => {
  const total = getDepositAmount(d);
  const cash = safeAmount(d.cash_submitted);
  const online = safeAmount(d.online_submitted);
  if (cash > 0) return cash;
  if (online > 0) return Math.max(0, total - online);
  return total;
};

/**
 * Online submitted amount helper for CMS deposit.
 */
export const getOnlineSubmittedAmount = (d: CmsDeposit): number => {
  return safeAmount(d.online_submitted);
};
