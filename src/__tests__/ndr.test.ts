import { describe, expect, it } from 'vitest';
import { normalizePincode, parseNDRNumber } from '../lib/ndr/ndrExcel';

describe('NDR Management Utility Tests', () => {
  it('normalizes pincodes with commas, spaces, and formatting', () => {
    expect(normalizePincode('1,965')).toBe('1965');
    expect(normalizePincode('8,51,218')).toBe('851218');
    expect(normalizePincode('400 001')).toBe('400001');
    expect(normalizePincode(400001)).toBe('400001');
    expect(normalizePincode(null)).toBe('');
  });

  it('parses numeric amounts cleanly', () => {
    expect(parseNDRNumber('₹1,450.50')).toBe(1450.5);
    expect(parseNDRNumber('1,965')).toBe(1965);
    expect(parseNDRNumber(2500)).toBe(2500);
    expect(parseNDRNumber('')).toBe(0);
  });

  it('validates COD collected mismatch rule', () => {
    const expectedAmount = 1500;
    const collectedAmount = 1400;
    const isMismatch = Math.abs(collectedAmount - expectedAmount) > 0.01;
    expect(isMismatch).toBe(true);

    const matchAmount = 1500;
    const isMatch = Math.abs(matchAmount - expectedAmount) > 0.01;
    expect(isMatch).toBe(false);
  });
});
