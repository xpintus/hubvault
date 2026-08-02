import { calculateCashTotal,reconcileCash } from '@/pages/public/CashCalculator';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe,expect,it } from 'vitest';

describe('Public Cash Calculator', () => {
  it('calculates Indian note denominations exactly', () => {
    expect(calculateCashTotal({ 500: 3, 200: 2, 50: 1, 10: 4, 1: 7 })).toBe(1997);
    expect(calculateCashTotal({})).toBe(0);
  });

  it('classifies matched, shortage and excess receipts', () => {
    expect(reconcileCash(2000,2000)).toEqual({variance:0,status:'matched'});
    expect(reconcileCash(2000,1800)).toEqual({variance:-200,status:'shortage'});
    expect(reconcileCash(2000,2200)).toEqual({variance:200,status:'excess'});
  });

  it('is linked from the public route and homepage tools section', () => {
    const app = readFileSync(resolve('src/App.tsx'), 'utf8');
    const home = readFileSync(resolve('src/pages/public/Home.tsx'), 'utf8');
    const layout = readFileSync(resolve('src/components/PublicLayout.tsx'), 'utf8');
    expect(app).toContain('/tools/cash-calculator');
    expect(home).toContain('id="tools"');
    expect(home).toContain('Open Cash Calculator');
    expect(layout).toContain("location.pathname === '/tools/cash-calculator'");
    expect(layout).toContain("'hidden md:block'");
  });
});
