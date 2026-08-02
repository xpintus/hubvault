import SEO from '@/components/SEO';
import { ArrowRight, Banknote, Check, Clipboard, IndianRupee, Printer, RotateCcw, ShieldCheck, Smartphone } from 'lucide-react';
import { useMemo,useState } from 'react';

const URL='https://www.hubvault.in/tools/cod-reconciliation-calculator';
const BUY_URL='/#/buy-now';
const DESCRIPTION='Free COD reconciliation calculator for logistics teams. Compare expected COD with cash and online collections, calculate shortage or excess and copy a ready summary.';
const FAQS=[
  {question:'How is COD variance calculated?',answer:'Cash received and online received are added together, then expected COD is subtracted. A negative result is a shortage and a positive result is an excess.'},
  {question:'Is my collection data saved on HubVault?',answer:'No. This public calculator performs the calculation in your browser and does not submit these values to HubVault.'},
  {question:'Can I share the result on WhatsApp?',answer:'Yes. Use Copy summary and paste the formatted result into WhatsApp or any messaging application.'},
];
const STRUCTURED_DATA=[
  {'@context':'https://schema.org','@type':'WebApplication',name:'HubVault COD Reconciliation Calculator',url:URL,applicationCategory:'FinanceApplication',operatingSystem:'Any',description:DESCRIPTION,offers:{'@type':'Offer',price:'0',priceCurrency:'INR'}},
  {'@context':'https://schema.org','@type':'FAQPage',mainEntity:FAQS.map(item=>({'@type':'Question',name:item.question,acceptedAnswer:{'@type':'Answer',text:item.answer}}))},
];
const money=(amount:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(amount);
const numberValue=(value:string)=>Math.max(0,Number(value)||0);

export default function CodReconciliationCalculator(){
  const [name,setName]=useState('');
  const [date,setDate]=useState(()=>new Date().toISOString().slice(0,10));
  const [expected,setExpected]=useState('');
  const [cash,setCash]=useState('');
  const [online,setOnline]=useState('');
  const [remarks,setRemarks]=useState('');
  const [copied,setCopied]=useState(false);
  const result=useMemo(()=>{const expectedAmount=numberValue(expected),cashAmount=numberValue(cash),onlineAmount=numberValue(online),collected=cashAmount+onlineAmount,variance=collected-expectedAmount;return {expectedAmount,cashAmount,onlineAmount,collected,variance,status:variance===0?'Reconciled':variance<0?'Shortage':'Excess'}},[expected,cash,online]);
  const hasExpected=expected.trim()!=='';
  const summary=[
    'HubVault COD Reconciliation',
    `Date: ${date}`,
    ...(name.trim()?[`Collector: ${name.trim()}`]:[]),
    `Expected COD: ${money(result.expectedAmount)}`,
    `Cash received: ${money(result.cashAmount)}`,
    `Online received: ${money(result.onlineAmount)}`,
    `Total received: ${money(result.collected)}`,
    `Variance: ${result.variance>=0?'+':''}${money(result.variance)}`,
    `Status: ${result.status}`,
    ...(remarks.trim()?[`Remarks: ${remarks.trim()}`]:[]),
  ].join('\n');
  async function copySummary(){if(!hasExpected)return;await navigator.clipboard.writeText(summary);setCopied(true);window.setTimeout(()=>setCopied(false),1800)}
  function reset(){setName('');setExpected('');setCash('');setOnline('');setRemarks('');setCopied(false)}
  const statusTone=result.status==='Reconciled'?'text-emerald-600 dark:text-emerald-300':result.status==='Shortage'?'text-red-600 dark:text-red-300':'text-amber-600 dark:text-amber-300';
  return <>
    <SEO title="COD Reconciliation Calculator – Calculate Shortage & Excess | HubVault" description={DESCRIPTION} path="/tools/cod-reconciliation-calculator" image="https://www.hubvault.in/og-image-v2.jpg" structuredData={STRUCTURED_DATA}/>
    <main className="min-h-screen bg-slate-50 px-3 py-8 text-slate-900 dark:bg-[#080b16] dark:text-white sm:px-6 sm:py-12"><div className="mx-auto max-w-6xl"><div className="text-center"><p className="text-xs font-black uppercase tracking-[.18em] text-indigo-600 dark:text-indigo-300">Free logistics tool</p><h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">COD Reconciliation Calculator</h1><p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-600 dark:text-slate-300">Match expected COD with cash and online collections. Instantly identify shortage, excess or a fully reconciled handover.</p></div>
      <section className="mt-9 grid overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl shadow-indigo-950/10 dark:border-white/10 dark:bg-[#111526] lg:grid-cols-[1.15fr_.85fr]"><div className="p-5 sm:p-8"><div className="grid gap-4 sm:grid-cols-2"><Field label="Collector name (optional)" value={name} onChange={setName} placeholder="Enter name" type="text"/><Field label="Collection date" value={date} onChange={setDate} type="date"/><Field label="Expected COD" value={expected} onChange={setExpected} placeholder="e.g. 10000" icon={<IndianRupee/>}/><Field label="Cash received" value={cash} onChange={setCash} placeholder="e.g. 6000" icon={<Banknote/>}/><div className="sm:col-span-2"><Field label="Online received" value={online} onChange={setOnline} placeholder="e.g. 3500" icon={<Smartphone/>}/></div></div><label className="mt-4 block"><span className="mb-2 block text-sm font-bold">Remarks (optional)</span><textarea value={remarks} onChange={e=>setRemarks(e.target.value)} rows={3} className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-white/[.04]" placeholder="Reason for mismatch..."/></label><div className="mt-5 flex flex-col gap-3 sm:flex-row"><button onClick={copySummary} disabled={!hasExpected} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 text-sm font-black text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-45">{copied?<Check className="h-4 w-4"/>:<Clipboard className="h-4 w-4"/>}{copied?'Copied':'Copy WhatsApp summary'}</button><button onClick={()=>window.print()} disabled={!hasExpected} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-300 px-5 text-sm font-black disabled:opacity-45 dark:border-white/15"><Printer className="h-4 w-4"/>Print</button><button onClick={reset} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-red-300 px-5 text-sm font-black text-red-600 dark:border-red-400/30 dark:text-red-300"><RotateCcw className="h-4 w-4"/>Reset</button></div><p className="mt-4 flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-500"/>Calculation stays in this browser and is not submitted to HubVault.</p></div>
      <aside className="bg-slate-950 p-5 text-white sm:p-8"><p className="text-xs font-black uppercase tracking-[.18em] text-indigo-300">Live reconciliation</p>{hasExpected?<><div className="mt-6 grid grid-cols-2 gap-3"><Metric label="Expected" value={money(result.expectedAmount)}/><Metric label="Total received" value={money(result.collected)}/><Metric label="Cash" value={money(result.cashAmount)}/><Metric label="Online" value={money(result.onlineAmount)}/></div><div className="mt-4 rounded-3xl border border-white/10 bg-white/[.06] p-5"><p className="text-xs font-bold uppercase tracking-wider text-white/45">Variance</p><p className={`mt-2 text-3xl font-black tabular-nums ${statusTone}`}>{result.variance>0?'+':''}{money(result.variance)}</p><p className={`mt-2 font-black ${statusTone}`}>{result.status}</p></div></>:<div className="mt-6 rounded-3xl border border-dashed border-white/15 p-8 text-center"><IndianRupee className="mx-auto h-9 w-9 text-white/25"/><p className="mt-4 font-black">Enter expected COD</p><p className="mt-2 text-sm leading-6 text-white/45">Your live reconciliation result will appear here.</p></div>}<div className="mt-6 rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-700 p-5"><p className="text-lg font-black">Need this for every collector?</p><p className="mt-2 text-sm leading-6 text-white/70">HubVault adds supervisor approval, dues, recovery, CMS deposits and final daily closing reports.</p><a href={BUY_URL} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-indigo-700">Buy HubVault <ArrowRight className="h-4 w-4"/></a></div></aside></section>
      <section className="mx-auto max-w-4xl py-14"><h2 className="text-center text-2xl font-black sm:text-3xl">How to use the COD calculator</h2><div className="mt-7 grid gap-4 sm:grid-cols-3">{['Enter the expected COD amount','Add cash and online received','Review variance and copy the summary'].map((text,index)=><div key={text} className="rounded-2xl border border-slate-200 bg-white p-5 text-sm font-bold dark:border-white/10 dark:bg-white/[.04]"><span className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-black text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-300">{index+1}</span>{text}</div>)}</div><div className="mt-12"><h2 className="text-center text-2xl font-black">Frequently asked questions</h2><div className="mt-6 grid gap-3">{FAQS.map(item=><details key={item.question} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[.04]"><summary className="cursor-pointer font-black">{item.question}</summary><p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.answer}</p></details>)}</div></div></section>
    </div></main>
  </>;
}

function Field({label,value,onChange,placeholder,type='number',icon}:{label:string;value:string;onChange:(value:string)=>void;placeholder?:string;type?:string;icon?:React.ReactNode}){return <label className="block"><span className="mb-2 block text-sm font-bold">{label}</span><span className="relative block">{icon&&<span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}<input type={type} min={type==='number'?'0':undefined} step={type==='number'?'0.01':undefined} inputMode={type==='number'?'decimal':undefined} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className={`min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-white/[.04] ${icon?'pl-11':''}`}/></span></label>}
function Metric({label,value}:{label:string;value:string}){return <div className="rounded-2xl border border-white/10 bg-white/[.05] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-white/40">{label}</p><p className="mt-1 font-black tabular-nums">{value}</p></div>}
