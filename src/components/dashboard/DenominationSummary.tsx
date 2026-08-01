import React, { useMemo, useState } from 'react';
import { Card, EmptyState } from '@/components/ui/primitives';
import DenominationPanel from '@/components/DenominationPanel';
import { useToast } from '@/components/ui/Toast';
import { CollectionEntry, DenominationInput, DENOMINATIONS, EMPTY_DENOMINATIONS } from '@/types';
import { Banknote, CheckCircle2, Copy } from 'lucide-react';
import { clsx } from 'clsx';

export function denominationToText(d: DenominationInput): string {
  const lines = DENOMINATIONS.map((item) => {
    const qty = d[item.key];
    if (qty === 0) return null;
    const lineTotal = qty * item.value;
    return `${item.label} x ${qty} = ₹${lineTotal}`;
  }).filter(Boolean) as string[];
  const totalCash = DENOMINATIONS.reduce((sum, item) => sum + d[item.key] * item.value, 0);
  const totalNotes = DENOMINATIONS.reduce((sum, item) => sum + d[item.key], 0);
  lines.push('--------------------------------');
  lines.push(`Total Notes: ${totalNotes}`);
  lines.push(`Total Cash: ₹${totalCash}`);
  return lines.join('\n');
}

export function aggregateDenominations(entries: CollectionEntry[]): DenominationInput {
  const agg: DenominationInput = { ...EMPTY_DENOMINATIONS };
  entries.forEach((e) => {
    const d = Array.isArray(e.denominations) ? e.denominations[0] : e.denominations;
    if (d) {
      agg.note_500 += d.note_500 || 0;
      agg.note_200 += d.note_200 || 0;
      agg.note_100 += d.note_100 || 0;
      agg.note_50 += d.note_50 || 0;
      agg.note_20 += d.note_20 || 0;
      agg.note_10 += d.note_10 || 0;
      agg.note_5 += d.note_5 || 0;
      agg.note_2 += d.note_2 || 0;
      agg.note_1 += d.note_1 || 0;
    }
  });
  return agg;
}

export function CopyDenominationButton({ entries }: { entries: CollectionEntry[] }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const agg = aggregateDenominations(entries);
    const hasAny = (Object.values(agg) as number[]).some((v) => v > 0);
    if (!hasAny) {
      toast.warning('No denominations to copy yet.');
      return;
    }
    const text = denominationToText(agg);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Denomination summary copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy. Please try again.');
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-all active:scale-95 shrink-0 min-h-[44px]',
        copied
          ? 'border-brand-600/30 bg-brand-50 dark:bg-brand-600/15 text-brand-600'
          : 'border-neutral-200 dark:border-neutral-800 bg-[var(--card-bg)] text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900 hover:text-neutral-700 dark:hover:text-neutral-300'
      )}
    >
      {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

export function AggregateDenominations({ entries }: { entries: CollectionEntry[] }) {
  const agg = useMemo(() => aggregateDenominations(entries), [entries]);
  const hasAny = (Object.values(agg) as number[]).some((v) => v > 0);

  if (!hasAny) {
    return <EmptyState icon={<Banknote className="h-6 w-6" />} title="No denominations recorded" message="Denomination breakdowns will appear here once entries are added." />;
  }
  return <DenominationPanel value={agg} onChange={() => {}} compact />;
}

export const DenominationSummary: React.FC<{ entries: CollectionEntry[]; formattedDate: string }> = ({
  entries,
  formattedDate,
}) => {
  return (
    <Card className="p-4 sm:p-5 border border-neutral-200/80 dark:border-neutral-800/80 rounded-2xl bg-white dark:bg-neutral-900/90 shadow-xs">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div>
          <h3 className="font-extrabold text-neutral-900 dark:text-neutral-100 text-sm sm:text-base">Denomination Summary</h3>
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mt-0.5">Aggregated notes for {formattedDate}</p>
        </div>
        <CopyDenominationButton entries={entries} />
      </div>
      <div className="mt-4">
        <AggregateDenominations entries={entries} />
      </div>
    </Card>
  );
};

export default DenominationSummary;
