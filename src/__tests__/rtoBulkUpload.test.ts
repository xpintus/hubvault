import { describe, expect, it } from 'vitest';
import { parseUniqueAwbs } from '@/pages/operations/rto/RTOBulkUpload';

describe('RTO bulk upload AWB parser', () => {
  it('supports mixed delimiters, uppercase normalization and stable deduplication', () => {
    expect(parseUniqueAwbs('vm123, VM123\n sf456\t"TBA789" | sf456')).toEqual([
      'VM123', 'SF456', 'TBA789',
    ]);
  });

  it('drops empty and unsupported values', () => {
    expect(parseUniqueAwbs(' , ; AWB-100 <> AWB@200')).toEqual(['AWB-100']);
  });
});
