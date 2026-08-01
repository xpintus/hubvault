import { describe, expect, it } from 'vitest';
import { isOfflineFallbackError } from '@/lib/khatabook';

describe('KhataBook offline fallback classification', () => {
  it('does not hide PostgREST schema errors as offline writes', () => {
    expect(isOfflineFallbackError({
      code: 'PGRST205',
      message: "Could not find the table 'public.parties' in the schema cache",
    })).toBe(false);
  });

  it('allows browser network failures to use the offline queue', () => {
    expect(isOfflineFallbackError(new TypeError('Failed to fetch'))).toBe(true);
  });
});
