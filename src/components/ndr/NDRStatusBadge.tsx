import React from 'react';
import { NDRWorkflowStatus } from '@/types/ndr';
import { clsx } from 'clsx';

interface NDRStatusBadgeProps {
  status: NDRWorkflowStatus | string;
  size?: 'sm' | 'md' | 'lg';
}

export const NDRStatusBadge: React.FC<NDRStatusBadgeProps> = ({ status, size = 'md' }) => {
  const getBadgeStyle = (s: string) => {
    switch (s) {
      case 'Calling Pending':
      case 'UNDEL':
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30 font-semibold';
      case 'Supervisor Pending':
      case 'Supervisor Review':
        return 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30 font-semibold';
      case 'Follow-up':
      case 'Reattempt Required':
      case 'Reattempt Approved':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 font-semibold';
      case 'Delivered':
      case 'DEL':
        return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-bold';
      case 'RTO':
        return 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30 font-bold';
      case 'Closed':
        return 'bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/30';
      default:
        return 'bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/30';
    }
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs font-medium',
    lg: 'px-3 py-1.5 text-sm font-semibold',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border transition-colors',
        getBadgeStyle(status),
        sizeClasses[size]
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
};
