import { EntryStatus, STATUS_LABELS } from '@/types';
import { CheckCircle2, Clock, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { clsx } from 'clsx';

export default function StatusBadge({ status, size = 'md' }: { status: EntryStatus; size?: 'sm' | 'md' }) {
  const config: Record<EntryStatus, { color: string; icon: typeof CheckCircle2 }> = {
    reconciled: { color: 'bg-brand-600/15 text-brand-600 ring-brand-600/30', icon: CheckCircle2 },
    pending: { color: 'bg-[var(--card-bg)] text-neutral-500 dark:text-neutral-400 ring-neutral-300 dark:ring-neutral-700/60', icon: Clock },
    shortage: { color: 'bg-red-500/10 text-red-400 ring-red-500/30', icon: ArrowDownRight },
    excess: { color: 'bg-amber-500/10 text-amber-400 ring-amber-500/30', icon: ArrowUpRight },
  };
  const { color, icon: Icon } = config[status];
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 rounded-lg font-semibold ring-1 ring-inset',
      color,
      size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
    )}>
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      {STATUS_LABELS[status]}
    </span>
  );
}
