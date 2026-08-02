import SEO from '@/components/SEO';
import { CalendarDays,Check,Clipboard,FileDown,Mic,MicOff,Minus,Printer,RotateCcw,Share2,Sparkles,Target,UserRound,Volume2 } from 'lucide-react';
import { KeyboardEvent,useCallback,useEffect,useMemo,useRef,useState } from 'react';

const NOTES = [500,200,100,50,20,10,5,2,1] as const;
type NoteValue = typeof NOTES[number];
type ReceiptStatus = 'matched' | 'shortage' | 'excess';
type SpeechRecognitionLike = { lang:string;interimResults:boolean;continuous:boolean;start:()=>void;stop:()=>void;onresult:((event:{results:ArrayLike<{0:{transcript:string}}>} )=>void)|null;onerror:((event:{error:string})=>void)|null;onend:(()=>void)|null };
type SpeechRecognitionConstructor = new()=>SpeechRecognitionLike;

const localDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
};
const emptyCounts = () => Object.fromEntries(NOTES.map(note => [note,0])) as Record<NoteValue,number>;
const money = (value: number) => `₹${Math.abs(value).toLocaleString('en-IN')}`;
const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' })[char] ?? char);
const SMALL_WORDS=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
const TENS_WORDS=['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
const numberWords=(value:number):string=>{const n=Math.floor(Math.abs(value));if(n<20)return SMALL_WORDS[n];if(n<100)return `${TENS_WORDS[Math.floor(n/10)]}${n%10?` ${SMALL_WORDS[n%10]}`:''}`;if(n<1000)return `${SMALL_WORDS[Math.floor(n/100)]} hundred${n%100?` ${numberWords(n%100)}`:''}`;if(n<100000)return `${numberWords(Math.floor(n/1000))} thousand${n%1000?` ${numberWords(n%1000)}`:''}`;if(n<10000000)return `${numberWords(Math.floor(n/100000))} lakh${n%100000?` ${numberWords(n%100000)}`:''}`;return n.toLocaleString('en-IN');};
const QUANTITY_WORDS:Record<string,number>={...Object.fromEntries([...SMALL_WORDS.map((word,index)=>[word,index]),...TENS_WORDS.map((word,index)=>[word,index*10]).filter(([word])=>word)]),'एक':1,'दो':2,'तीन':3,'चार':4,'पांच':5,'पाँच':5,'छह':6,'सात':7,'आठ':8,'नौ':9,'दस':10,'ग्यारह':11,'बारह':12,'तेरह':13,'चौदह':14,'पंद्रह':15,'सोलह':16,'सत्रह':17,'अठारह':18,'उन्नीस':19,'बीस':20,'तीस':30,'चालीस':40,'पचास':50,'साठ':60,'सत्तर':70,'अस्सी':80,'नब्बे':90,ek:1,do:2,teen:3,char:4,panch:5,paanch:5,chhah:6,saat:7,aath:8,nau:9,das:10,bees:20,tees:30,chalis:40,pachas:50,pachaas:50};
export const isVoiceTotalRequest=(transcript:string)=>/(?:what(?:'s| is)? (?:the )?total|tell (?:me )?(?:the )?total|live total|total batao|कुल|टोटल|कितना (?:हुआ|है))/.test(transcript.toLowerCase());
export const parseVoiceCashCommand=(transcript:string):{note:NoteValue;quantity:number}|null=>{const text=transcript.toLowerCase().replace(/-/g,' ').replace(/\s+/g,' ').trim();const aliases:[NoteValue,RegExp][]=[[500,/(?:\bfive hundred\b|\b500\b|पांच सौ|पाँच सौ|\bpaa?nch sau\b)/],[200,/(?:\btwo hundred\b|\b200\b|दो सौ|\bdo sau\b)/],[100,/(?:\bone hundred\b|\bhundred\b|\b100\b|एक सौ|\bek sau\b)/],[50,/(?:\bfifty\b|\b50\b|पचास|\bpachaa?s\b)/],[20,/(?:\btwenty\b|\b20\b|बीस|\bbees\b)/],[10,/(?:\bten\b|\b10\b|दस|\bdas\b)/],[5,/(?:\bfive\b|\b5\b|पांच|पाँच|\bpaa?nch\b)/],[2,/(?:\btwo\b|\b2\b|दो|\bdo\b)/],[1,/(?:\bone\b|\b1\b|एक|\bek\b)/]];for(const [note,pattern] of aliases){const match=text.match(pattern);if(!match)continue;const remainder=text.replace(pattern,' ').replace(/(?:rupees?|notes?|quantity|set|add|for|of|रुपये?|नोट|लगाओ|डालो|जोड़ो)/g,' ').trim();const numeric=remainder.match(/\d+/);if(numeric)return {note,quantity:Math.max(0,Number(numeric[0]))};const parts=remainder.split(' ').filter(Boolean);let quantity=0;for(const part of parts){if(part==='hundred'||part==='सौ'||part==='sau')quantity*=100;else quantity+=QUANTITY_WORDS[part]??0;}if(quantity>0)return {note,quantity};}return null;};
export const buildDenominationAnnouncement=(note:NoteValue,quantity:number,total:number,increased:boolean,language:'en-IN'|'hi-IN')=>language==='hi-IN'?(increased?`आपके ${note} रुपये के ${quantity} नोट ऐड हुए हैं और टोटल ${total.toLocaleString('hi-IN')} रुपये हुए हैं`:`${note} रुपये के नोट अब ${quantity} हैं और टोटल ${total.toLocaleString('hi-IN')} रुपये है`):(increased?`${quantity} notes of ${note} rupees have been added. The total is ${numberWords(total)} rupees`:`The ${note} rupee note count is now ${quantity}. The total is ${numberWords(total)} rupees`);

export const calculateCashTotal = (counts: Partial<Record<NoteValue,number>>) => NOTES.reduce((sum,note) => sum+(counts[note]??0)*note,0);
export const reconcileCash = (expected: number,collected: number): { variance:number;status:ReceiptStatus } => {
  const variance=collected-expected;
  return { variance,status:variance===0?'matched':variance<0?'shortage':'excess' };
};
export const buildCashSummary = ({ name,date,hasExpected,expected,collected,totalNotes,counts }:{ name:string;date:string;hasExpected:boolean;expected:number;collected:number;totalNotes:number;counts:Partial<Record<NoteValue,number>> }) => {
  const denominationLines=NOTES.filter(note=>(counts[note]??0)>0).map(note=>`₹${note} x ${counts[note]} = ${money(note*(counts[note]??0))}`);
  const reconciliation=reconcileCash(expected,collected);
  return [
    '*HubVault Cash Summary*',...(name.trim()?[`Name: ${name.trim()}`]:[]),`Date: ${date}`,'',...denominationLines,'',
    `Total Notes: ${totalNotes}`,`Total Cash: ${money(collected)}`,
    ...(hasExpected?[`Expected: ${money(expected)}`,`Collected: ${money(collected)}`,`Variance: ${reconciliation.variance<0?'-':reconciliation.variance>0?'+':''}${money(reconciliation.variance)}`,`Status: ${reconciliation.status.toUpperCase()}`]:[]),
    '','Generated with HubVault Cash Calculator',
  ].join('\n');
};

export default function CashCalculator() {
  const [name,setName]=useState('');
  const [date,setDate]=useState(localDate);
  const [expected,setExpected]=useState('');
  const [counts,setCounts]=useState<Record<NoteValue,number>>(emptyCounts);
  const [copied,setCopied]=useState(false);
  const [listening,setListening]=useState(false);
  const [voiceLanguage,setVoiceLanguage]=useState<'en-IN'|'hi-IN'>('en-IN');
  const [voiceMessage,setVoiceMessage]=useState('Say: “five hundred ten notes”');
  const recognitionRef=useRef<SpeechRecognitionLike|null>(null);
  const previousCountsRef=useRef<Record<NoteValue,number>>(emptyCounts());
  const totalNotes=useMemo(()=>NOTES.reduce((sum,note)=>sum+counts[note],0),[counts]);
  const collected=useMemo(()=>calculateCashTotal(counts),[counts]);
  const expectedAmount=Math.max(0,Number(expected)||0);
  const hasExpected=expected.trim()!=='';
  const reconciliation=reconcileCash(expectedAmount,collected);

  const setCount=(note:NoteValue,value:string)=>setCounts(current=>({...current,[note]:Math.max(0,Math.floor(Number(value)||0))}));
  const adjust=(note:NoteValue,delta:number)=>setCounts(current=>({...current,[note]:Math.max(0,current[note]+delta)}));
  const announceTotal=useCallback((amount=collected)=>{if(amount<=0||!('speechSynthesis' in window))return;window.speechSynthesis.cancel();const text=voiceLanguage==='hi-IN'?`अभी तक कुल ${amount.toLocaleString('hi-IN')} रुपये हुए हैं`:`Live total is ${numberWords(amount)} rupees`;const utterance=new SpeechSynthesisUtterance(text);utterance.lang=voiceLanguage;utterance.rate=.9;utterance.volume=.75;window.speechSynthesis.speak(utterance);setVoiceMessage(voiceLanguage==='hi-IN'?`कुल राशि: ${money(amount)}`:`Live total: ${money(amount)}`);},[collected,voiceLanguage]);
  const announceDenomination=useCallback((note:NoteValue,quantity:number,total:number,increased:boolean)=>{if(!('speechSynthesis' in window))return;window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(buildDenominationAnnouncement(note,quantity,total,increased,voiceLanguage));utterance.lang=voiceLanguage;utterance.rate=.88;utterance.volume=.75;window.speechSynthesis.speak(utterance);setVoiceMessage(voiceLanguage==='hi-IN'?`${note} के ${quantity} नोट • कुल ${money(total)}`:`${quantity} × ${money(note)} • Total ${money(total)}`);},[voiceLanguage]);
  const focusNext=(event:KeyboardEvent<HTMLInputElement>,index:number)=>{
    if(event.key==='Enter')(document.querySelector(`[data-note-index="${index+1}"]`) as HTMLInputElement|null)?.focus();
  };

  const toggleVoice=()=>{if(listening){recognitionRef.current?.stop();return;}const speechWindow=window as typeof window&{SpeechRecognition?:SpeechRecognitionConstructor;webkitSpeechRecognition?:SpeechRecognitionConstructor};const Recognition=speechWindow.SpeechRecognition??speechWindow.webkitSpeechRecognition;if(!Recognition){setVoiceMessage(voiceLanguage==='hi-IN'?'यह ब्राउज़र वॉइस कमांड सपोर्ट नहीं करता।':'Voice commands are not supported in this browser.');return;}const recognition=new Recognition();recognition.lang=voiceLanguage;recognition.interimResults=false;recognition.continuous=false;recognition.onresult=event=>{const transcript=event.results[0]?.[0]?.transcript??'';if(isVoiceTotalRequest(transcript)){announceTotal();return;}const command=parseVoiceCashCommand(transcript);if(!command){setVoiceMessage(voiceLanguage==='hi-IN'?`समझ नहीं आया: “${transcript}”`:`Could not understand: “${transcript}”`);return;}setCounts(current=>({...current,[command.note]:command.quantity}));setVoiceMessage(`${money(command.note)} × ${command.quantity} ${voiceLanguage==='hi-IN'?'जोड़ा गया':'added'}`);};recognition.onerror=event=>setVoiceMessage(event.error==='not-allowed'?(voiceLanguage==='hi-IN'?'माइक्रोफ़ोन की अनुमति नहीं मिली।':'Microphone permission was denied.'):(voiceLanguage==='hi-IN'?'आवाज़ सुनाई नहीं दी।':'Voice command could not be captured.'));recognition.onend=()=>setListening(false);recognitionRef.current=recognition;setListening(true);setVoiceMessage(voiceLanguage==='hi-IN'?'सुन रहा हूँ…':'Listening…');recognition.start();};
  useEffect(()=>()=>recognitionRef.current?.stop(),[]);
  useEffect(()=>{const previous=previousCountsRef.current;const changedNote=NOTES.find(note=>previous[note]!==counts[note]);previousCountsRef.current={...counts};if(!changedNote)return;const quantity=counts[changedNote];const increased=quantity>previous[changedNote];const timer=window.setTimeout(()=>announceDenomination(changedNote,quantity,collected,increased),1000);return()=>window.clearTimeout(timer);},[counts,collected,announceDenomination]);

  const summaryText=()=>buildCashSummary({name,date,hasExpected,expected:expectedAmount,collected,totalNotes,counts});

  const copyWhatsApp=async()=>{
    await navigator.clipboard.writeText(summaryText()); setCopied(true); window.setTimeout(()=>setCopied(false),1800);
  };
  const shareReceipt=async()=>{
    if(navigator.share) await navigator.share({title:'HubVault Cash Summary',text:summaryText()}); else await copyWhatsApp();
  };

  const downloadPdf=async()=>{
    const { jsPDF }=await import('jspdf');
    const doc=new jsPDF({unit:'mm',format:'a4'});
    doc.setFillColor(79,70,229); doc.roundedRect(14,12,182,28,4,4,'F');
    doc.setFillColor(255,255,255); doc.roundedRect(20,18,16,16,3,3,'F');
    doc.setTextColor(79,70,229); doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.text('HV',24,28);
    doc.setTextColor(255,255,255); doc.setFontSize(19); doc.text('HubVault',42,25); doc.setFontSize(9); doc.text('Cash Count Summary',42,32);
    doc.setTextColor(30,41,59); doc.setFontSize(10); doc.setFont('helvetica','normal');
    doc.text(`Date: ${date}`,145,49); if(name.trim())doc.text(`Name: ${name.trim()}`,14,49);
    let y=68; doc.setFillColor(241,245,249); doc.rect(14,y-7,182,9,'F'); doc.setFont('helvetica','bold');
    doc.text('Denomination',18,y-1); doc.text('Quantity',91,y-1); doc.text('Amount',162,y-1); y+=8;
    doc.setFont('helvetica','normal');
    NOTES.filter(note=>counts[note]>0).forEach(note=>{doc.text(`Rs. ${note}`,18,y);doc.text(String(counts[note]),96,y);doc.text(`Rs. ${(note*counts[note]).toLocaleString('en-IN')}`,162,y);doc.line(14,y+2,196,y+2);y+=8;});
    y+=4; doc.setFillColor(248,250,252); doc.roundedRect(14,y,182,38,3,3,'F'); doc.setFont('helvetica','bold');doc.setFontSize(11);
    doc.text(`Total Notes: ${totalNotes}`,20,y+10);doc.text(`Total Cash: Rs. ${collected.toLocaleString('en-IN')}`,20,y+19);
    if(hasExpected){doc.text(`Expected: Rs. ${expectedAmount.toLocaleString('en-IN')}`,108,y+10);doc.text(`Variance: ${reconciliation.variance<0?'-':reconciliation.variance>0?'+':''}Rs. ${Math.abs(reconciliation.variance).toLocaleString('en-IN')}`,108,y+19);const statusColor:Record<ReceiptStatus,[number,number,number]>={matched:[22,163,74],shortage:[220,38,38],excess:[217,119,6]};doc.setTextColor(...statusColor[reconciliation.status]);doc.text(`Status: ${reconciliation.status.toUpperCase()}`,108,y+28);}
    doc.setTextColor(100,116,139);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text('Generated with HubVault Cash Calculator - hubvault.in',14,287);
    doc.save(`HubVault-Cash-Summary-${date}.pdf`);
  };

  const printThermal=(width:58|80)=>{
    const popup=window.open('','_blank',`width=${width===58?300:420},height=700`); if(!popup)return;
    const rows=NOTES.filter(note=>counts[note]>0).map(note=>`<tr><td>Rs.${note} x ${counts[note]}</td><td>Rs.${(note*counts[note]).toLocaleString('en-IN')}</td></tr>`).join('');
    const nameLine=name.trim()?`<div>Name: ${escapeHtml(name.trim())}</div>`:'';const reconciliationRows=hasExpected?`<tr><td>Expected</td><td>Rs.${expectedAmount.toLocaleString('en-IN')}</td></tr><tr><td>Variance</td><td>${reconciliation.variance<0?'-':reconciliation.variance>0?'+':''}Rs.${Math.abs(reconciliation.variance).toLocaleString('en-IN')}</td></tr>`:'';const statusBlock=hasExpected?`<div class="status">${reconciliation.status.toUpperCase()}</div>`:'';
    popup.document.write(`<!doctype html><html><head><title>HubVault Cash Summary</title><style>@page{size:${width}mm auto;margin:3mm}*{box-sizing:border-box}body{width:${width-6}mm;margin:0;font:11px monospace;color:#000}.center{text-align:center}h1{font-size:16px;margin:0}.line{border-top:1px dashed #000;margin:7px 0}table{width:100%;border-collapse:collapse}td{padding:2px 0}td:last-child{text-align:right}.total{font-size:13px;font-weight:bold}.status{border:1px solid #000;padding:5px;text-align:center;font-weight:bold;margin-top:6px}</style></head><body><div class="center"><h1>HUBVAULT</h1><div>Cash Count Summary</div></div><div class="line"></div>${nameLine}<div>Date: ${escapeHtml(date)}</div><div class="line"></div><table>${rows}</table><div class="line"></div><table><tr><td>Total Notes</td><td>${totalNotes}</td></tr><tr class="total"><td>Total Cash</td><td>Rs.${collected.toLocaleString('en-IN')}</td></tr>${reconciliationRows}</table>${statusBlock}<div class="line"></div><div class="center">Generated with HubVault<br>hubvault.in</div><script>window.onload=()=>window.print()</script></body></html>`);popup.document.close();
  };

  const reset=()=>{setName('');setDate(localDate());setExpected('');setCounts(emptyCounts());};
  const statusStyles:Record<ReceiptStatus,string>={matched:'bg-emerald-500/15 text-emerald-100 border-emerald-300/30',shortage:'bg-red-500/20 text-red-100 border-red-300/30',excess:'bg-amber-400/20 text-amber-50 border-amber-200/30'};

  return <><SEO title="Free Cash Calculator - HubVault" description="Cash denomination calculator with optional reconciliation, WhatsApp summary, thermal printing and PDF download." path="/tools/cash-calculator" />
    <section className="relative min-h-screen overflow-hidden bg-[#f5f7ff] pb-28 dark:bg-[#080b16] md:pb-12">
      <div className="pointer-events-none absolute -left-32 top-20 h-80 w-80 rounded-full bg-violet-400/20 blur-3xl"/><div className="pointer-events-none absolute -right-32 top-0 h-96 w-96 rounded-full bg-cyan-300/20 blur-3xl"/>
      <div className="relative mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-12">
        <header className="overflow-hidden rounded-[28px] bg-gradient-to-br from-[#17152f] via-[#2f2370] to-[#5145cd] p-5 text-white shadow-2xl shadow-indigo-900/20 sm:p-8">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between"><div className="max-w-2xl"><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-violet-100"><Sparkles className="h-3.5 w-3.5"/>Smart cash tool</span><h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">Count cash.<br/><span className="text-cyan-300">Close with confidence.</span></h1><p className="mt-3 max-w-xl text-sm leading-6 text-white/65 sm:text-base">Count denominations, optionally match an expected amount, and instantly share a clear cash summary.</p></div>
            <div className="rounded-3xl border border-white/15 bg-white/10 p-4 backdrop-blur-md sm:min-w-72"><p className="text-xs font-bold uppercase tracking-[0.18em] text-white/50">Live cash total</p><p className="mt-2 text-4xl font-black tracking-tight tabular-nums sm:text-5xl">{money(collected)}</p><div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-sm"><span className="text-white/55">Notes counted</span><span className="font-bold">{totalNotes}</span></div></div>
          </div>
        </header>

        <div className="relative -mt-3 mx-2 grid gap-3 rounded-3xl border border-white/80 bg-white/85 p-3 shadow-xl shadow-slate-200/50 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/85 dark:shadow-none sm:mx-5 sm:grid-cols-3 sm:p-4">
          <Field icon={<UserRound className="h-4 w-4"/>} label="Name (optional)"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Name" className="w-full bg-transparent text-sm font-semibold outline-none placeholder:font-normal placeholder:text-neutral-400"/></Field>
          <Field icon={<CalendarDays className="h-4 w-4"/>} label="Date"><input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full bg-transparent text-sm font-semibold outline-none"/></Field>
          <Field icon={<Target className="h-4 w-4"/>} label="Expected (optional)"><input type="number" min={0} value={expected} onChange={e=>setExpected(e.target.value)} placeholder="₹0" className="w-full bg-transparent text-sm font-semibold outline-none placeholder:font-normal placeholder:text-neutral-400"/></Field>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-[28px] border border-white bg-white/80 p-3 shadow-xl shadow-slate-200/60 backdrop-blur dark:border-white/10 dark:bg-slate-900/70 dark:shadow-none sm:p-5"><div className="flex items-center justify-between gap-3 px-1 pb-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-brand-600">Denominations</p><h2 className="mt-1 text-xl font-black text-slate-900 dark:text-white">Tap, type & count</h2></div><button disabled={totalNotes===0&&!name&&!expected} onClick={reset} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-red-600 px-4 text-xs font-black text-white shadow-lg shadow-red-600/25 transition hover:bg-red-700 active:scale-95 disabled:opacity-40"><RotateCcw className="h-4 w-4"/>Reset</button></div>
            <div className="mb-4 rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50 to-cyan-50 p-3 dark:border-brand-500/20 dark:from-brand-500/10 dark:to-cyan-500/10"><div className="flex min-w-0 items-center gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${listening?'animate-pulse bg-red-500 text-white':'bg-brand-600 text-white'}`}>{listening?<Volume2 className="h-5 w-5"/>:<Mic className="h-5 w-5"/>}</span><div className="min-w-0 flex-1"><p className="text-sm font-black text-slate-800 dark:text-white">Voice-assisted entry</p><p className="truncate text-xs text-slate-500 dark:text-slate-400">{voiceMessage}</p></div><div className="flex rounded-xl bg-white p-1 shadow-sm dark:bg-white/10"><button onClick={()=>{setVoiceLanguage('en-IN');setVoiceMessage('Say: “five hundred ten notes”');}} className={`rounded-lg px-2.5 py-1.5 text-[11px] font-black ${voiceLanguage==='en-IN'?'bg-brand-600 text-white':'text-slate-500 dark:text-slate-300'}`}>EN</button><button onClick={()=>{setVoiceLanguage('hi-IN');setVoiceMessage('बोलें: “पाँच सौ दस नोट”');}} className={`rounded-lg px-2.5 py-1.5 text-[11px] font-black ${voiceLanguage==='hi-IN'?'bg-brand-600 text-white':'text-slate-500 dark:text-slate-300'}`}>हिंदी</button></div></div><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={toggleVoice} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-xs font-black transition ${listening?'bg-red-600 text-white hover:bg-red-700':'bg-white text-brand-700 shadow-sm hover:bg-brand-100 dark:bg-white/10 dark:text-brand-300'}`}>{listening?<><MicOff className="h-4 w-4"/>Stop</>:<><Mic className="h-4 w-4"/>{voiceLanguage==='hi-IN'?'बोलें':'Start voice'}</>}</button><button disabled={collected===0} onClick={()=>announceTotal()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 text-xs font-black text-white disabled:opacity-30 dark:bg-cyan-300 dark:text-slate-950"><Volume2 className="h-4 w-4"/>{voiceLanguage==='hi-IN'?'कुल सुनें':'Hear live total'}</button></div></div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">{NOTES.map((note,index)=>{const active=counts[note]>0;return <article key={note} className={`relative overflow-hidden rounded-2xl border p-3 transition-all ${active?'border-brand-500 bg-brand-50 shadow-lg shadow-brand-500/10 dark:bg-brand-500/10':'border-slate-200 bg-white hover:border-brand-300 dark:border-white/10 dark:bg-white/[0.03]'}`}><div className="flex items-start justify-between gap-2"><div><p className={`text-xl font-black tracking-tight ${active?'text-brand-700 dark:text-brand-300':'text-slate-800 dark:text-slate-100'}`}>₹{note}</p><p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Indian note</p></div><p className="max-w-[80px] truncate text-right text-xs font-extrabold tabular-nums text-slate-500 dark:text-slate-300">{money(note*counts[note])}</p></div><div className="mt-3 flex items-center rounded-xl bg-slate-100 p-1 dark:bg-black/25"><button aria-label={`Decrease ₹${note}`} onClick={()=>adjust(note,-1)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white hover:text-brand-600 hover:shadow-sm dark:hover:bg-white/10"><Minus className="h-4 w-4"/></button><input data-note-index={index} aria-label={`₹${note} note quantity`} type="number" inputMode="numeric" min={0} value={counts[note]||''} placeholder="0" onChange={e=>setCount(note,e.target.value)} onKeyDown={e=>focusNext(e,index)} className="h-9 min-w-0 flex-1 bg-transparent px-1 text-center text-lg font-black tabular-nums outline-none"/><button aria-label={`Increase ₹${note}`} onClick={()=>adjust(note,1)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-xl font-medium text-white shadow-md shadow-brand-600/25 transition hover:bg-brand-700 active:scale-90">+</button></div></article>})}</div>
          </div>

          <aside className="h-fit overflow-hidden rounded-[28px] bg-[#111327] text-white shadow-2xl shadow-slate-900/20 lg:sticky lg:top-20"><div className="border-b border-white/10 p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Cash summary</p><p className="mt-1 text-3xl font-black tabular-nums">{money(collected)}</p></div>{hasExpected&&<span className={`rounded-full border px-3 py-1 text-[10px] font-black tracking-wider ${statusStyles[reconciliation.status]}`}>{reconciliation.status.toUpperCase()}</span>}</div><div className="mt-5 grid grid-cols-2 gap-2">{hasExpected&&<Metric label="Expected" value={money(expectedAmount)}/>}<Metric label="Total notes" value={String(totalNotes)}/>{hasExpected&&<Metric label="Variance" value={`${reconciliation.variance<0?'-':reconciliation.variance>0?'+':''}${money(reconciliation.variance)}`}/>}<Metric label="Entries" value={String(NOTES.filter(note=>counts[note]>0).length)}/></div></div>
            <div className="grid gap-2 p-4"><button disabled={totalNotes===0} onClick={copyWhatsApp} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-4 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:opacity-30">{copied?<Check className="h-4 w-4"/>:<Clipboard className="h-4 w-4"/>}{copied?'Summary Copied':'Copy WhatsApp Summary'}</button><div className="grid grid-cols-2 gap-2"><button disabled={totalNotes===0} onClick={shareReceipt} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/10 px-3 text-xs font-bold transition hover:bg-white/15 disabled:opacity-30"><Share2 className="h-4 w-4"/>Share</button><button disabled={totalNotes===0} onClick={downloadPdf} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/10 px-3 text-xs font-bold transition hover:bg-white/15 disabled:opacity-30"><FileDown className="h-4 w-4"/>PDF</button></div><div className="grid grid-cols-2 gap-2"><button disabled={totalNotes===0} onClick={()=>printThermal(58)} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-white/10 px-2 text-xs font-semibold text-white/70 transition hover:bg-white/5 disabled:opacity-30"><Printer className="h-3.5 w-3.5"/>2-inch</button><button disabled={totalNotes===0} onClick={()=>printThermal(80)} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-white/10 px-2 text-xs font-semibold text-white/70 transition hover:bg-white/5 disabled:opacity-30"><Printer className="h-3.5 w-3.5"/>3-inch</button></div></div>
          </aside>
        </div>
        <div className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111327]/95 px-4 py-3 text-white shadow-2xl backdrop-blur-xl md:hidden"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">Live total</p><p className="truncate text-xl font-black tabular-nums">{money(collected)}</p></div>{hasExpected?<div className="shrink-0 text-right"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusStyles[reconciliation.status]}`}>{reconciliation.status.toUpperCase()}</span><p className="mt-1 text-[11px] text-white/60">Variance {reconciliation.variance<0?'-':reconciliation.variance>0?'+':''}{money(reconciliation.variance)}</p></div>:<div className="shrink-0 text-right"><p className="text-[10px] uppercase tracking-wider text-white/40">Notes</p><p className="text-lg font-black tabular-nums">{totalNotes}</p></div>}</div>
      </div>
    </section></>;
}

function Metric({label,value}:{label:string;value:string}){return <div className="rounded-2xl border border-white/5 bg-white/[0.06] p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-white/40">{label}</p><p className="mt-1 font-black tabular-nums">{value}</p></div>;}
function Field({icon,label,children}:{icon:React.ReactNode;label:string;children:React.ReactNode}){return <label className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3 transition focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-500/10 dark:border-white/10 dark:bg-white/[0.04]"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">{icon}</span><span className="min-w-0 flex-1"><span className="mb-0.5 block text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</span>{children}</span></label>;}
