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
      case 'UNDEL':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'Calling Pending':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'Customer Contacted':
        return 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20';
      case 'Reattempt Required':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
      case 'Supervisor Review':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 font-semibold animate-pulse';
      case 'Reattempt Approved':
        return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';
      case 'Out For Delivery':
        return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20';
      case 'Delivered':
      case 'DEL':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-bold';
      case 'RTO':
        return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 font-bold';
      case 'Closed':
        return 'bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/20';
      default:
        return 'bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/20';
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
