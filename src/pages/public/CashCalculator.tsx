import SEO from '@/components/SEO';
import { Banknote,Check,ChevronDown,ChevronUp,Clipboard,FileDown,Printer,RotateCcw,Share2 } from 'lucide-react';
import { KeyboardEvent,useMemo,useState } from 'react';

const NOTES = [500,200,100,50,20,10,5,2,1] as const;
type NoteValue = typeof NOTES[number];
type ReceiptStatus = 'matched' | 'shortage' | 'excess';

const localDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
};
const emptyCounts = () => Object.fromEntries(NOTES.map(note => [note,0])) as Record<NoteValue,number>;
const money = (value: number) => `₹${Math.abs(value).toLocaleString('en-IN')}`;
const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' })[char] ?? char);

export const calculateCashTotal = (counts: Partial<Record<NoteValue,number>>) => NOTES.reduce((sum,note) => sum+(counts[note]??0)*note,0);
export const reconcileCash = (expected: number,collected: number): { variance:number;status:ReceiptStatus } => {
  const variance=collected-expected;
  return { variance,status:variance===0?'matched':variance<0?'shortage':'excess' };
};

export default function CashCalculator() {
  const [name,setName]=useState('');
  const [date,setDate]=useState(localDate);
  const [expected,setExpected]=useState('');
  const [counts,setCounts]=useState<Record<NoteValue,number>>(emptyCounts);
  const [receiptNo,setReceiptNo]=useState(()=>`HV-${Date.now().toString(36).toUpperCase()}`);
  const [copied,setCopied]=useState(false);
  const totalNotes=useMemo(()=>NOTES.reduce((sum,note)=>sum+counts[note],0),[counts]);
  const collected=useMemo(()=>calculateCashTotal(counts),[counts]);
  const expectedAmount=Math.max(0,Number(expected)||0);
  const reconciliation=reconcileCash(expectedAmount,collected);

  const setCount=(note:NoteValue,value:string)=>setCounts(current=>({...current,[note]:Math.max(0,Math.floor(Number(value)||0))}));
  const adjust=(note:NoteValue,delta:number)=>setCounts(current=>({...current,[note]:Math.max(0,current[note]+delta)}));
  const focusNext=(event:KeyboardEvent<HTMLInputElement>,index:number)=>{
    if(event.key==='Enter') (document.querySelector(`[data-note-index="${index+1}"]`) as HTMLInputElement|null)?.focus();
  };

  const summaryText=()=>{
    const denominationLines=NOTES.filter(note=>counts[note]>0).map(note=>`₹${note} x ${counts[note]} = ${money(note*counts[note])}`);
    const status=reconciliation.status.toUpperCase();
    return [
      '*HubVault Cash Receipt*',`Receipt: ${receiptNo}`,`Name: ${name.trim()||'Not provided'}`,`Date: ${date}`,'',
      ...denominationLines,'',`Total Notes: ${totalNotes}`,`Expected: ${money(expectedAmount)}`,`Collected: ${money(collected)}`,
      `Variance: ${reconciliation.variance<0?'-':reconciliation.variance>0?'+':''}${money(reconciliation.variance)}`,`Status: ${status}`,
      '','Generated with HubVault Cash Calculator',
    ].join('\n');
  };

  const copyWhatsApp=async()=>{
    await navigator.clipboard.writeText(summaryText()); setCopied(true); window.setTimeout(()=>setCopied(false),1800);
  };
  const shareReceipt=async()=>{
    if(navigator.share) await navigator.share({title:'HubVault Cash Receipt',text:summaryText()}); else await copyWhatsApp();
  };

  const downloadPdf=async()=>{
    const { jsPDF }=await import('jspdf');
    const doc=new jsPDF({unit:'mm',format:'a4'});
    doc.setFillColor(79,70,229); doc.roundedRect(14,12,182,28,4,4,'F');
    doc.setFillColor(255,255,255); doc.roundedRect(20,18,16,16,3,3,'F');
    doc.setTextColor(79,70,229); doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.text('HV',24,28);
    doc.setTextColor(255,255,255); doc.setFontSize(19); doc.text('HubVault',42,25); doc.setFontSize(9); doc.text('Cash Reconciliation Receipt',42,32);
    doc.setTextColor(30,41,59); doc.setFontSize(10); doc.setFont('helvetica','normal');
    doc.text(`Receipt: ${receiptNo}`,14,49); doc.text(`Date: ${date}`,145,49); doc.text(`Name: ${name.trim()||'Not provided'}`,14,56);
    let y=68; doc.setFillColor(241,245,249); doc.rect(14,y-7,182,9,'F'); doc.setFont('helvetica','bold');
    doc.text('Denomination',18,y-1); doc.text('Quantity',91,y-1); doc.text('Amount',162,y-1); y+=8;
    doc.setFont('helvetica','normal');
    NOTES.filter(note=>counts[note]>0).forEach(note=>{doc.text(`Rs. ${note}`,18,y);doc.text(String(counts[note]),96,y);doc.text(`Rs. ${(note*counts[note]).toLocaleString('en-IN')}`,162,y);doc.line(14,y+2,196,y+2);y+=8;});
    y+=4; doc.setFillColor(248,250,252); doc.roundedRect(14,y,182,38,3,3,'F'); doc.setFont('helvetica','bold');doc.setFontSize(11);
    doc.text(`Expected: Rs. ${expectedAmount.toLocaleString('en-IN')}`,20,y+10);doc.text(`Collected: Rs. ${collected.toLocaleString('en-IN')}`,20,y+19);
    doc.text(`Variance: ${reconciliation.variance<0?'-':reconciliation.variance>0?'+':''}Rs. ${Math.abs(reconciliation.variance).toLocaleString('en-IN')}`,108,y+10);
    const statusColor:Record<ReceiptStatus,[number,number,number]>={matched:[22,163,74],shortage:[220,38,38],excess:[217,119,6]}; doc.setTextColor(...statusColor[reconciliation.status]);doc.text(`Status: ${reconciliation.status.toUpperCase()}`,108,y+19);
    doc.setTextColor(100,116,139);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text('Generated with HubVault Cash Calculator - hubvault.in',14,287);
    doc.save(`HubVault-Cash-Receipt-${date}-${receiptNo}.pdf`);
  };

  const printThermal=(width:58|80)=>{
    const popup=window.open('','_blank',`width=${width===58?300:420},height=700`); if(!popup)return;
    const rows=NOTES.filter(note=>counts[note]>0).map(note=>`<tr><td>Rs.${note} x ${counts[note]}</td><td>Rs.${(note*counts[note]).toLocaleString('en-IN')}</td></tr>`).join('');
    popup.document.write(`<!doctype html><html><head><title>${escapeHtml(receiptNo)}</title><style>@page{size:${width}mm auto;margin:3mm}*{box-sizing:border-box}body{width:${width-6}mm;margin:0;font:11px monospace;color:#000}.center{text-align:center}h1{font-size:16px;margin:0}.line{border-top:1px dashed #000;margin:7px 0}table{width:100%;border-collapse:collapse}td{padding:2px 0}td:last-child{text-align:right}.total{font-size:13px;font-weight:bold}.status{border:1px solid #000;padding:5px;text-align:center;font-weight:bold;margin-top:6px}</style></head><body><div class="center"><h1>HUBVAULT</h1><div>Cash Reconciliation Receipt</div></div><div class="line"></div><div>Receipt: ${escapeHtml(receiptNo)}</div><div>Name: ${escapeHtml(name.trim()||'Not provided')}</div><div>Date: ${escapeHtml(date)}</div><div class="line"></div><table>${rows}</table><div class="line"></div><table><tr><td>Total Notes</td><td>${totalNotes}</td></tr><tr><td>Expected</td><td>Rs.${expectedAmount.toLocaleString('en-IN')}</td></tr><tr class="total"><td>Collected</td><td>Rs.${collected.toLocaleString('en-IN')}</td></tr><tr><td>Variance</td><td>${reconciliation.variance<0?'-':reconciliation.variance>0?'+':''}Rs.${Math.abs(reconciliation.variance).toLocaleString('en-IN')}</td></tr></table><div class="status">${reconciliation.status.toUpperCase()}</div><div class="line"></div><div class="center">Generated with HubVault<br>hubvault.in</div><script>window.onload=()=>window.print()</script></body></html>`);popup.document.close();
  };

  const reset=()=>{setName('');setDate(localDate());setExpected('');setCounts(emptyCounts());setReceiptNo(`HV-${Date.now().toString(36).toUpperCase()}`);};
  const statusStyles:Record<ReceiptStatus,string>={matched:'bg-emerald-500/15 text-emerald-100 border-emerald-300/30',shortage:'bg-red-500/20 text-red-100 border-red-300/30',excess:'bg-amber-400/20 text-amber-50 border-amber-200/30'};

  return <><SEO title="Free Cash Calculator - HubVault" description="Cash denomination calculator with reconciliation, WhatsApp summary, thermal printing and PDF receipt." path="/tools/cash-calculator" />
    <section className="min-h-screen bg-[#F8FAFC] py-6 pb-28 dark:bg-[#0F172A] md:min-h-[calc(100vh-4rem)] md:py-10 md:pb-10 lg:py-16"><div className="mx-auto max-w-6xl px-3 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl text-center"><span className="inline-flex items-center gap-2 rounded-full border border-brand-600/20 bg-brand-600/10 px-4 py-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400"><Banknote className="h-4 w-4"/>Free Public Tool</span><h1 className="mt-4 text-3xl font-bold text-neutral-900 dark:text-neutral-100 sm:text-4xl">Cash Reconciliation Calculator</h1><p className="mt-3 text-neutral-500 dark:text-neutral-400">Fast denomination counting, automatic variance matching and shareable branded receipts.</p></div>

      <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5 shadow-soft dark:border-neutral-800 dark:bg-neutral-900"><div className="grid gap-4 md:grid-cols-3"><label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Rider / employee name" className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 font-normal outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-neutral-700 dark:bg-neutral-950"/></label><label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Date<input type="date" value={date} onChange={e=>setDate(e.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 font-normal outline-none focus:border-brand-500 dark:border-neutral-700 dark:bg-neutral-950"/></label><label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Expected Amount<input type="number" min={0} value={expected} onChange={e=>setExpected(e.target.value)} placeholder="₹0" className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 font-normal outline-none focus:border-brand-500 dark:border-neutral-700 dark:bg-neutral-950"/></label></div></div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]"><div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-soft dark:border-neutral-800 dark:bg-neutral-900"><div className="grid grid-cols-[72px_1fr_110px] gap-2 border-b border-neutral-200 bg-neutral-50 px-3 py-3 text-xs font-bold uppercase text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 sm:grid-cols-[110px_1fr_150px]"><span>Note</span><span>Fast Quantity Input</span><span className="text-right">Amount</span></div>{NOTES.map((note,index)=><div key={note} className="grid grid-cols-[72px_1fr_110px] items-center gap-2 border-b border-neutral-100 px-3 py-2.5 last:border-0 dark:border-neutral-800 sm:grid-cols-[110px_1fr_150px]"><span className="font-bold text-brand-600 dark:text-brand-400">₹{note}</span><div className="flex items-center gap-1"><button aria-label={`Decrease ₹${note}`} onClick={()=>adjust(note,-1)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-700"><ChevronDown className="h-4 w-4"/></button><input data-note-index={index} aria-label={`₹${note} note quantity`} type="number" inputMode="numeric" min={0} value={counts[note]||''} placeholder="0" onChange={e=>setCount(note,e.target.value)} onKeyDown={e=>focusNext(e,index)} className="h-10 min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white px-2 text-center font-bold outline-none focus:border-brand-500 dark:border-neutral-700 dark:bg-neutral-950"/><button aria-label={`Increase ₹${note}`} onClick={()=>adjust(note,1)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-700"><ChevronUp className="h-4 w-4"/></button></div><span className="text-right font-semibold tabular-nums text-neutral-800 dark:text-neutral-200">{money(note*counts[note])}</span></div>)}</div>

        <aside className="h-fit rounded-2xl bg-gradient-to-br from-brand-600 to-brand-900 p-6 text-white shadow-card-hover lg:sticky lg:top-24"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-white/60">Receipt</p><p className="font-mono text-xs text-white/90">{receiptNo}</p></div><span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusStyles[reconciliation.status]}`}>{reconciliation.status.toUpperCase()}</span></div><div className="mt-5 grid grid-cols-2 gap-3"><Metric label="Expected" value={money(expectedAmount)}/><Metric label="Collected" value={money(collected)}/><Metric label="Variance" value={`${reconciliation.variance<0?'-':reconciliation.variance>0?'+':''}${money(reconciliation.variance)}`}/><Metric label="Total Notes" value={String(totalNotes)}/></div><div className="mt-5 grid gap-2"><button disabled={totalNotes===0} onClick={copyWhatsApp} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-brand-700 disabled:opacity-40">{copied?<Check className="h-4 w-4"/>:<Clipboard className="h-4 w-4"/>}{copied?'WhatsApp Summary Copied':'Copy WhatsApp Summary'}</button><button disabled={totalNotes===0} onClick={shareReceipt} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 text-sm font-semibold disabled:opacity-40"><Share2 className="h-4 w-4"/>Share Receipt</button><button disabled={totalNotes===0} onClick={downloadPdf} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 text-sm font-semibold disabled:opacity-40"><FileDown className="h-4 w-4"/>Download PDF Receipt</button><div className="grid grid-cols-2 gap-2"><button disabled={totalNotes===0} onClick={()=>printThermal(58)} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-white/25 bg-white/10 px-2 text-xs font-semibold disabled:opacity-40"><Printer className="h-4 w-4"/>2-inch Slip</button><button disabled={totalNotes===0} onClick={()=>printThermal(80)} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-white/25 bg-white/10 px-2 text-xs font-semibold disabled:opacity-40"><Printer className="h-4 w-4"/>3-inch Slip</button></div><button disabled={totalNotes===0&&!name&&!expected} onClick={reset} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white/75 disabled:opacity-40"><RotateCcw className="h-4 w-4"/>Reset All</button></div></aside>
      </div>
      <div className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-between gap-3 rounded-2xl bg-neutral-950 px-4 py-3 text-white shadow-2xl md:hidden"><div><p className="text-[10px] uppercase text-white/50">Collected</p><p className="text-lg font-bold tabular-nums">{money(collected)}</p></div><div className="text-right"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusStyles[reconciliation.status]}`}>{reconciliation.status.toUpperCase()}</span><p className="mt-1 text-xs text-white/70">Var: {reconciliation.variance<0?'-':reconciliation.variance>0?'+':''}{money(reconciliation.variance)}</p></div></div>
    </div></section></>;
}

function Metric({label,value}:{label:string;value:string}){return <div className="rounded-xl bg-white/10 p-3"><p className="text-xs text-white/60">{label}</p><p className="mt-1 font-bold tabular-nums">{value}</p></div>;}
