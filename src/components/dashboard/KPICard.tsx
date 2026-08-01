import React from 'react';
import { Card } from '@/components/ui/primitives';
import { ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';

export interface KPICardProps {
  title: string;
  formatted: string;
  sub: string;
  icon: React.ElementType;
  accent: string;
  accentMap: Record<string, { icon: string; ring: string; text: string }>;
  badge?: string;
  badgeClass?: string;
  stateClass?: string;
  openModal: () => void;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  formatted,
  sub,
  icon: Icon,
  accent,
  accentMap,
  badge,
  badgeClass,
  stateClass,
  openModal,
}) => {
  const a = accentMap[accent] || accentMap.slate;

  return (
    <Card
      hover
      className="p-4 sm:p-5 group/kpi cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md w-full min-w-0 border border-neutral-200/80 dark:border-neutral-800/80 rounded-2xl bg-white dark:bg-neutral-900/90"
      role="button"
      tabIndex={0}
      onClick={openModal}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openModal();
        }
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className={clsx('flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl shrink-0 transition-transform group-hover/kpi:scale-105', a.icon, a.ring)}>
          <Icon className="h-5 w-5" />
        </div>
        {badge && (
          <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-wide uppercase', badgeClass)}>
            {badge}
          </span>
        )}
      </div>
      <div className="mt-3.5 min-w-0">
        <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 truncate">{title}</p>
        <p className={clsx('mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums truncate', stateClass || 'text-neutral-900 dark:text-neutral-50')}>
          {formatted}
        </p>
        <p className="mt-1 text-xs font-medium text-neutral-500 dark:text-neutral-400 truncate">{sub}</p>
        <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-brand-600 dark:text-brand-400 opacity-0 -translate-y-1 transition-all duration-200 group-hover/kpi:opacity-100 group-hover/kpi:translate-y-0">
          Click for details <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </Card>
  );
};

export default KPICard;
