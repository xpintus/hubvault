import { buildCashSummary,calculateCashTotal,reconcileCash } from '@/pages/public/CashCalculator';
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

  it('keeps a basic denomination summary when name and expected are blank', () => {
    const summary=buildCashSummary({name:'',date:'2026-08-02',hasExpected:false,expected:0,collected:1500,totalNotes:3,counts:{500:3}});
    expect(summary).toContain('Date: 2026-08-02');
    expect(summary).toContain('₹500 x 3 = ₹1,500');
    expect(summary).toContain('Total Notes: 3');
    expect(summary).not.toContain('Name:');
    expect(summary).not.toContain('Expected:');
    expect(summary).not.toContain('Variance:');
    expect(summary).not.toContain('Status:');
    expect(summary).not.toContain('Receipt');
  });

  it('adds name and reconciliation only when supplied', () => {
    const summary=buildCashSummary({name:'Ajit Kumar',date:'2026-08-02',hasExpected:true,expected:2000,collected:1800,totalNotes:6,counts:{500:3,100:3}});
    expect(summary).toContain('Name: Ajit Kumar');
    expect(summary).toContain('Expected: ₹2,000');
    expect(summary).toContain('Variance: -₹200');
    expect(summary).toContain('Status: SHORTAGE');
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
