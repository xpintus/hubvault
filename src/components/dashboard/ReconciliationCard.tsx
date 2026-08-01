import { Card } from '@/components/ui/primitives';
import { clsx } from 'clsx';
import React from 'react';

export interface ReconciliationCardProps {
  counts: { reconciled: number; pending: number; shortage: number; excess: number };
  entriesCount: number;
  reconciledRate: number;
}

export const ReconciliationCard: React.FC<ReconciliationCardProps> = ({
  counts,
  entriesCount,
  reconciledRate,
}) => {
  return (
    <Card className="p-4 sm:p-5 lg:col-span-1 min-w-0 border border-neutral-200/80 dark:border-neutral-800/80 rounded-2xl bg-white dark:bg-neutral-900/90">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-extrabold text-neutral-900 dark:text-neutral-100">Reconciliation Rate</h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 font-medium">
            {counts.reconciled} of {entriesCount} {entriesCount === 1 ? 'entry' : 'entries'} reconciled
          </p>
        </div>
        <span className={clsx(
          'text-2xl sm:text-3xl font-extrabold tabular-nums',
          reconciledRate === 100 ? 'text-brand-600 dark:text-brand-400' : reconciledRate >= 80 ? 'text-neutral-700 dark:text-neutral-300' : 'text-amber-500'
        )}>
          {reconciledRate}%
        </span>
      </div>

      <div className="mt-3.5 h-3 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800 p-0.5">
        <div
          className={clsx('h-full rounded-full transition-all duration-700 ease-out', reconciledRate === 100 ? 'bg-gradient-to-r from-brand-600 to-emerald-500' : 'bg-gradient-to-r from-brand-600 to-indigo-500')}
          style={{ width: `${reconciledRate}%` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { label: 'Reconciled', count: counts.reconciled, color: 'text-brand-600 dark:text-brand-400', dot: 'bg-brand-500' },
          ...(counts.pending > 0 ? [{ label: 'Pending', count: counts.pending, color: 'text-neutral-500', dot: 'bg-neutral-400' }] : []),
          { label: 'Shortage', count: counts.shortage, color: 'text-rose-500 dark:text-rose-400', dot: 'bg-rose-500' },
          { label: 'Excess', count: counts.excess, color: 'text-emerald-500 dark:text-emerald-400', dot: 'bg-emerald-500' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200/60 dark:border-neutral-800/60 p-2 text-center">
            <div className="flex items-center justify-center gap-1">
              <span className={clsx('h-1.5 w-1.5 rounded-full shrink-0', s.dot)} />
              <span className={clsx('text-sm sm:text-base font-extrabold tabular-nums', s.color)}>{s.count}</span>
            </div>
            <p className="mt-0.5 text-[10px] sm:text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 truncate">{s.label}</p>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default ReconciliationCard;
