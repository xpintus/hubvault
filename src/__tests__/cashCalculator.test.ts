import { calculateCashTotal } from '@/pages/public/CashCalculator';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe,expect,it } from 'vitest';

describe('Public Cash Calculator', () => {
  it('calculates Indian note denominations exactly', () => {
    expect(calculateCashTotal({ 500: 3, 200: 2, 50: 1, 10: 4, 1: 7 })).toBe(1997);
    expect(calculateCashTotal({})).toBe(0);
  });

  it('is linked from the public route and homepage tools section', () => {
    const app = readFileSync(resolve('src/App.tsx'), 'utf8');
    const home = readFileSync(resolve('src/pages/public/Home.tsx'), 'utf8');
    expect(app).toContain('/tools/cash-calculator');
    expect(home).toContain('id="tools"');
    expect(home).toContain('Open Cash Calculator');
  });
});
