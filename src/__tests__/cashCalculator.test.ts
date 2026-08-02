import { buildCashSummary,buildDenominationAnnouncement,calculateCashTotal,isVoiceTotalRequest,parseVoiceCashCommand,parseVoiceCashCommands,reconcileCash } from '@/pages/public/CashCalculator';
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

  it('parses spoken denomination commands', () => {
    expect(parseVoiceCashCommand('five hundred ten notes')).toEqual({note:500,quantity:10});
    expect(parseVoiceCashCommand('200 12 notes')).toEqual({note:200,quantity:12});
    expect(parseVoiceCashCommand('पाँच सौ दस नोट')).toEqual({note:500,quantity:10});
    expect(parseVoiceCashCommand('do sau bees note')).toEqual({note:200,quantity:20});
    expect(parseVoiceCashCommands('500 ke 4 note 200 ke 10 note 100 ke 3 note')).toEqual([{note:500,quantity:4},{note:200,quantity:10},{note:100,quantity:3}]);
    expect(parseVoiceCashCommands('पाँच सौ के चार नोट दो सौ के दस नोट सौ के तीन नोट')).toEqual([{note:500,quantity:4},{note:200,quantity:10},{note:100,quantity:3}]);
    expect(parseVoiceCashCommands('500 ke 4 note 200 ke 10 note 100 ke 3 note 50 ke 2 note 20 ke 5 note 10 ke 8 note')).toEqual([{note:500,quantity:4},{note:200,quantity:10},{note:100,quantity:3},{note:50,quantity:2},{note:20,quantity:5},{note:10,quantity:8}]);
    expect(parseVoiceCashCommand('something unrelated')).toBeNull();
    expect(isVoiceTotalRequest('total batao')).toBe(true);
    expect(isVoiceTotalRequest('what is the total')).toBe(true);
    expect(buildDenominationAnnouncement(500,4,2000,true,'hi-IN')).toBe('आपके 500 रुपये के 4 नोट ऐड हुए हैं और टोटल 2,000 रुपये हुए हैं');
    expect(buildDenominationAnnouncement(500,4,2000,true,'en-IN')).toBe('4 notes of 500 rupees have been added. The total is two thousand rupees');
  });

  it('is linked from the public route and homepage tools section', () => {
    const app = readFileSync(resolve('src/App.tsx'), 'utf8');
    const home = readFileSync(resolve('src/pages/public/Home.tsx'), 'utf8');
    const layout = readFileSync(resolve('src/components/PublicLayout.tsx'), 'utf8');
    expect(app).toContain('/tools/cash-calculator');
    expect(home).toContain('id="tools"');
    expect(home).toContain('Open Cash Calculator');
    expect(layout).toContain("location.pathname === '/tools/cash-calculator'");
    expect(layout).toContain("isMobileToolMode&&'hidden'");
    const calculator = readFileSync(resolve('src/pages/public/CashCalculator.tsx'), 'utf8');
    expect(calculator).toContain('<ThemeToggle');
    expect(calculator).toContain('lg:hidden');
    expect(calculator).toContain('setHeroCollapsed(true),1000');
    expect(calculator).toContain('Smart Cash Calculator');
  });

  it('includes resilient local, voice and reconciliation controls', () => {
    const calculator = readFileSync(resolve('src/pages/public/CashCalculator.tsx'), 'utf8');
    expect(calculator).toContain('hubvault.cash.draft.v1');
    expect(calculator).toContain('Draft auto-saved on this device');
    expect(calculator).toContain('Recognized voice text');
    expect(calculator).toContain('Continuous voice session');
    expect(calculator).toContain('Sound announcements');
    expect(calculator).toContain('Cash Count Mode');
    expect(calculator).toContain('Reconciliation Mode');
    expect(calculator).toContain('Calculation reset');
    expect(calculator).toContain("dark:!bg-[#282052]");
    expect(calculator).not.toContain('Indian note');
  });

  it('includes offline tools, history, bags, exports and guarded camera estimates', () => {
    const tools = readFileSync(resolve('src/components/cash-calculator/CashCalculatorTools.tsx'), 'utf8');
    const manifest = readFileSync(resolve('public/manifest.webmanifest'), 'utf8');
    expect(tools).toContain('hubvault.cash.history.v1');
    expect(tools).toContain('Multi-bag counting');
    expect(tools).toContain('Save current preset');
    expect(tools).toContain("import('qrcode')");
    expect(tools).toContain("import('xlsx')");
    expect(tools).toContain('Shareable calculation link copied');
    expect(tools).toContain('Estimate only—not counterfeit detection');
    expect(tools).toContain("import('tesseract.js')");
    expect(tools).toContain('Apply verified estimate');
    expect(tools).not.toContain('TextDetector');
    expect(tools).toContain('beforeinstallprompt');
    expect(manifest).toContain('/tools/cash-calculator');
  });

  it('isolates the indexable clean URL from the noindex hash application', () => {
    const app = readFileSync(resolve('src/App.tsx'), 'utf8');
    const seo = readFileSync(resolve('src/components/SEO.tsx'), 'utf8');
    const mainHtml = readFileSync(resolve('index.html'), 'utf8');
    const calculatorHtml = readFileSync(resolve('cash-calculator.html'), 'utf8');
    const vercel = JSON.parse(readFileSync(resolve('vercel.json'), 'utf8')) as {rewrites:Array<{source:string;destination:string}>};
    const sitemap = readFileSync(resolve('public/sitemap.xml'), 'utf8');
    const robots = readFileSync(resolve('public/robots.txt'), 'utf8');
    const calculator = readFileSync(resolve('src/pages/public/CashCalculator.tsx'), 'utf8');
    expect(app).toContain("'/cod-reconciliation-software'");
    expect(app).toContain('<BrowserRouter>');
    expect(app).toContain('<HashRouter>');
    expect(seo).toContain("INDEXABLE_PATHS.has(path) && currentPath === path");
    expect(mainHtml).toContain('<meta name="robots" content="noindex, nofollow"');
    expect(calculatorHtml).toContain('<meta name="robots" content="index, follow"');
    expect(calculatorHtml).toContain('<link rel="canonical" href="https://www.hubvault.in/tools/cash-calculator"');
    expect(calculatorHtml).not.toContain('/#/tools/cash-calculator');
    expect(vercel.rewrites).toContainEqual({source:'/tools/cash-calculator',destination:'/cash-calculator.html'});
    expect((sitemap.match(/<loc>/g)??[])).toHaveLength(3);
    expect(sitemap).toContain('<loc>https://www.hubvault.in/tools/cash-calculator</loc>');
    expect(robots).toContain('Sitemap: https://www.hubvault.in/sitemap.xml');
    expect(calculator).toContain("'@type':'WebApplication'");
    expect(calculator).toContain("'@type':'FAQPage'");
    expect((calculator.match(/<h1 className=/g)??[])).toHaveLength(1);
    expect(calculator).toContain('COD and logistics cash reconciliation');
  });

  it('serves an indexable product landing page with official buying CTAs', () => {
    const app = readFileSync(resolve('src/App.tsx'), 'utf8');
    const seo = readFileSync(resolve('src/components/SEO.tsx'), 'utf8');
    const landing = readFileSync(resolve('src/pages/public/CollectionReconciliationSoftware.tsx'), 'utf8');
    const landingHtml = readFileSync(resolve('hubvault-software.html'), 'utf8');
    const sitemap = readFileSync(resolve('public/sitemap.xml'), 'utf8');
    const vercel = JSON.parse(readFileSync(resolve('vercel.json'), 'utf8')) as {rewrites:Array<{source:string;destination:string}>};
    expect(app).toContain('/collection-reconciliation-software');
    expect(seo).toContain("'/collection-reconciliation-software'");
    expect(landingHtml).toContain('<meta name="robots" content="index, follow"');
    expect(landingHtml).toContain('https://www.hubvault.in/collection-reconciliation-software');
    expect(landing).toContain("const BUY_URL='/#/buy-now'");
    expect(landing).toContain("'@type':'SoftwareApplication'");
    expect(landing).toContain("'@type':'FAQPage'");
    expect((landing.match(/<h1 className=/g)??[])).toHaveLength(1);
    ['KhataBook','CMS deposition records','Daily closing'].forEach(feature=>expect(landing).toContain(feature));
    expect(sitemap).toContain('<loc>https://www.hubvault.in/collection-reconciliation-software</loc>');
    expect((sitemap.match(/<loc>/g)??[])).toHaveLength(3);
    expect(vercel.rewrites).toContainEqual({source:'/collection-reconciliation-software',destination:'/hubvault-software.html'});
  });

  it('serves an indexable COD reconciliation page with a direct buying path', () => {
    const page = readFileSync(resolve('src/pages/public/CodReconciliationSoftware.tsx'), 'utf8');
    const html = readFileSync(resolve('cod-reconciliation.html'), 'utf8');
    const sitemap = readFileSync(resolve('public/sitemap.xml'), 'utf8');
    const vercel = JSON.parse(readFileSync(resolve('vercel.json'), 'utf8')) as {rewrites:Array<{source:string;destination:string}>};
    expect(html).toContain('<meta name="robots" content="index, follow"');
    expect(html).toContain('<link rel="canonical" href="https://www.hubvault.in/cod-reconciliation-software"');
    expect(page).toContain("const BUY_URL='/#/buy-now'");
    expect(page).toContain("'@type':'SoftwareApplication'");
    expect(page).toContain("'@type':'FAQPage'");
    expect((page.match(/<h1 className=/g)??[])).toHaveLength(1);
    expect(page).toContain('Cash and online separated');
    expect(page).toContain('employee dues and recovery');
    expect(sitemap).toContain('<loc>https://www.hubvault.in/cod-reconciliation-software</loc>');
    expect(vercel.rewrites).toContainEqual({source:'/cod-reconciliation-software',destination:'/cod-reconciliation.html'});
  });
});
