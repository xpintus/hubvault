import SEO from '@/components/SEO';
import { Banknote,Check,Clipboard,Printer,RotateCcw } from 'lucide-react';
import { useMemo,useState } from 'react';

const NOTES = [500,200,100,50,20,10,5,2,1] as const;
type NoteValue = typeof NOTES[number];

const emptyCounts = () => Object.fromEntries(NOTES.map(note => [note, 0])) as Record<NoteValue, number>;
export const calculateCashTotal = (counts: Partial<Record<NoteValue, number>>) =>
  NOTES.reduce((sum, note) => sum + (counts[note] ?? 0) * note, 0);

export default function CashCalculator() {
  const [counts, setCounts] = useState<Record<NoteValue, number>>(emptyCounts);
  const [copied, setCopied] = useState(false);
  const totalNotes = useMemo(() => NOTES.reduce((sum, note) => sum + counts[note], 0), [counts]);
  const totalAmount = useMemo(() => calculateCashTotal(counts), [counts]);

  const setCount = (note: NoteValue, value: string) => {
    const count = Math.max(0, Math.floor(Number(value) || 0));
    setCounts(current => ({ ...current, [note]: count }));
  };

  const copySummary = async () => {
    const lines = NOTES.filter(note => counts[note] > 0).map(note => `₹${note} × ${counts[note]} = ₹${(note * counts[note]).toLocaleString('en-IN')}`);
    await navigator.clipboard.writeText([...lines, `Total notes: ${totalNotes}`, `Total cash: ₹${totalAmount.toLocaleString('en-IN')}`].join('\n'));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return <>
    <SEO title="Free Cash Calculator — HubVault" description="Count Indian currency notes instantly with HubVault's free public cash denomination calculator." path="/tools/cash-calculator" />
    <section className="min-h-[calc(100vh-4rem)] bg-[#F8FAFC] dark:bg-[#0F172A] py-12 lg:py-20">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-600/20 bg-brand-600/10 px-4 py-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400"><Banknote className="h-4 w-4" />Free Public Tool</span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-4xl">Cash Denomination Calculator</h1>
          <p className="mt-3 text-neutral-500 dark:text-neutral-400">Enter the number of Indian currency notes and get the cash total instantly. Nothing is saved or uploaded.</p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-soft dark:border-neutral-800 dark:bg-neutral-900">
            <div className="grid grid-cols-[90px_1fr_120px] gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-bold uppercase text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 sm:grid-cols-[120px_1fr_160px]"><span>Note</span><span>Quantity</span><span className="text-right">Amount</span></div>
            {NOTES.map(note => <div key={note} className="grid grid-cols-[90px_1fr_120px] items-center gap-3 border-b border-neutral-100 px-4 py-3 last:border-0 dark:border-neutral-800 sm:grid-cols-[120px_1fr_160px]">
              <span className="font-bold text-brand-600 dark:text-brand-400">₹{note}</span>
              <input aria-label={`₹${note} note quantity`} type="number" inputMode="numeric" min={0} step={1} value={counts[note] || ''} placeholder="0" onChange={event => setCount(note, event.target.value)} className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-neutral-700 dark:bg-neutral-950" />
              <span className="text-right font-semibold tabular-nums text-neutral-800 dark:text-neutral-200">₹{(note * counts[note]).toLocaleString('en-IN')}</span>
            </div>)}
          </div>

          <aside className="h-fit rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white shadow-card-hover lg:sticky lg:top-24">
            <p className="text-sm font-medium text-white/70">Total Cash</p>
            <p className="mt-2 text-4xl font-bold tabular-nums">₹{totalAmount.toLocaleString('en-IN')}</p>
            <div className="mt-5 rounded-xl bg-white/10 p-4"><p className="text-xs text-white/60">Total notes</p><p className="mt-1 text-xl font-bold tabular-nums">{totalNotes.toLocaleString('en-IN')}</p></div>
            <div className="mt-5 grid gap-2">
              <button type="button" disabled={totalNotes===0} onClick={copySummary} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-brand-700 disabled:opacity-50">{copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}{copied ? 'Copied' : 'Copy Summary'}</button>
              <button type="button" disabled={totalNotes===0} onClick={() => window.print()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold disabled:opacity-50"><Printer className="h-4 w-4" />Print</button>
              <button type="button" disabled={totalNotes===0} onClick={() => setCounts(emptyCounts())} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white/80 disabled:opacity-50"><RotateCcw className="h-4 w-4" />Reset</button>
            </div>
          </aside>
        </div>
      </div>
    </section>
  </>;
}
