import { denomCashTotal } from '@/lib/calc';
import { formatINR } from '@/lib/format';
import { DenominationInput,DENOMINATIONS } from '@/types';
import { clsx } from 'clsx';
import { Minus,Plus } from 'lucide-react';
import { useMemo } from 'react';

interface Props {
  value: DenominationInput;
  onChange: (v: DenominationInput) => void;
  compact?: boolean;
}

export default function DenominationPanel({ value, onChange, compact = false }: Props) {
  const total = useMemo(() => denomCashTotal(value), [value]);

  const setQty = (key: keyof DenominationInput, qty: number) => {
    const next = Math.max(0, Math.min(99999, Math.floor(qty) || 0));
    onChange({ ...value, [key]: next });
  };

  return (
    <div className={clsx('rounded-xl border border-neutral-200 dark:border-neutral-800/80 bg-neutral-50 dark:bg-neutral-950/50', compact ? 'p-3' : 'p-4')}>
      {!compact && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Note Denominations</h3>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">Auto-calculates cash total</span>
        </div>
      )}
      <div className="space-y-1">
        {DENOMINATIONS.map((d) => {
          const qty = value[d.key] || 0;
          const lineTotal = qty * d.value;
          const active = qty > 0;
          return (
            <div key={d.key} className={clsx(
              'flex items-center gap-3 rounded-lg px-2 py-1.5 transition-all duration-150',
              active ? 'bg-[var(--card-bg)] shadow-soft ring-1 ring-neutral-300 dark:ring-neutral-700/60' : 'bg-transparent'
            )}>
              <div className={clsx(
                'w-12 shrink-0 text-sm font-bold text-center rounded-lg py-1 transition-colors',
                active ? 'bg-brand-600 text-white shadow-soft' : 'bg-neutral-200 dark:bg-neutral-800/60 text-neutral-500'
              )}>{d.label}</div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setQty(d.key, qty - 1)}
                  className="h-7 w-7 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[var(--card-bg)] text-neutral-500 flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-950 hover:border-neutral-300 dark:hover:border-neutral-700 active:scale-90 transition disabled:opacity-30 disabled:cursor-not-allowed"
                  disabled={qty <= 0}
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <input
                  type="number"
                  min={0}
                  value={qty || ''}
                  onChange={(e) => setQty(d.key, Number(e.target.value))}
                  placeholder="0"
                  className="w-16 text-center rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[var(--card-bg)] px-1 py-1 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition tabular-nums"
                />
                <button
                  type="button"
                  onClick={() => setQty(d.key, qty + 1)}
                  className="h-7 w-7 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[var(--card-bg)] text-neutral-500 flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-950 hover:border-neutral-300 dark:hover:border-neutral-700 active:scale-90 transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex-1 text-right text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
                {active ? `${qty} × ${d.label}` : ''}
              </div>
              <div className={clsx(
                'w-24 text-right text-sm font-semibold tabular-nums transition-colors',
                active ? 'text-neutral-700 dark:text-neutral-300' : 'text-neutral-500 dark:text-neutral-400'
              )}>
                {formatINR(lineTotal)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800/80 flex items-center justify-between">
        <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Total Cash</span>
        <span className="text-lg font-bold text-brand-600 tabular-nums">{formatINR(total)}</span>
      </div>
    </div>
  );
}
