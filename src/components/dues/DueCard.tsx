import { formatDate,formatINR } from '@/lib/format';
import { Due,DueStatus } from '@/types';
import { clsx } from 'clsx';
import { Edit3,Eye,Trash2 } from 'lucide-react';
import React from 'react';

export interface DueCardProps {
  due: Due;
  statusConfig: Record<DueStatus, { color: string; dot: string; badge: string; label: string }>;
  canManage: boolean;
  onView: (d: Due) => void;
  onEdit: (d: Due) => void;
  onDelete: (d: Due) => void;
  onOpenRecovery: (collectorId: string, collectorName: string, employeeId: string, phone: string, collector: any) => void;
}

export const DueCard: React.FC<DueCardProps> = ({
  due,
  statusConfig,
  canManage,
  onView,
  onEdit,
  onDelete,
  onOpenRecovery: _onOpenRecovery,
}) => {
  const cfg = statusConfig[due.status];
  const isManual = due.source === 'manual_old_due' || due.collection_entry_id === null;

  return (
    <div className="p-4 hover:bg-neutral-50 dark:hover:bg-neutral-950/70 transition-colors">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-brand-600/20 to-brand-600/10 text-brand-600 flex items-center justify-center font-bold text-xs shrink-0">
            {due.collector?.name?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-neutral-800 dark:text-neutral-200 truncate text-sm">{due.collector?.name ?? '—'}</p>
            <p className="text-xs text-neutral-500 font-mono truncate">{due.collector?.employee_id}</p>
          </div>
        </div>
        <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase', cfg.badge)}>
          <span className={clsx('h-1.5 w-1.5 rounded-full', cfg.dot)} />
          {cfg.label}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg bg-neutral-100 dark:bg-neutral-900 px-2.5 py-2 text-center">
          <p className="text-[10px] text-neutral-500">Original</p>
          <p className="font-bold text-neutral-800 dark:text-neutral-200 tabular-nums">{formatINR(due.original_amount)}</p>
        </div>
        <div className="rounded-lg bg-emerald-500/10 px-2.5 py-2 text-center">
          <p className="text-[10px] text-emerald-600">Recovered</p>
          <p className="font-bold text-emerald-600 tabular-nums">{formatINR(due.recovered_amount)}</p>
        </div>
        <div className="rounded-lg bg-red-500/10 px-2.5 py-2 text-center">
          <p className="text-[10px] text-red-500">Remaining</p>
          <p className="font-bold text-red-500 tabular-nums">{formatINR(due.remaining_amount)}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-neutral-500 font-medium">{formatDate(due.due_date)}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => onView(due)} className="p-2 rounded-lg text-neutral-500 hover:text-blue-500 hover:bg-blue-500/10 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <Eye className="h-4 w-4" />
          </button>
          {canManage && isManual && (
            <button onClick={() => onEdit(due)} className="p-2 rounded-lg text-neutral-500 hover:text-brand-600 hover:bg-brand-50 min-h-[44px] min-w-[44px] flex items-center justify-center">
              <Edit3 className="h-4 w-4" />
            </button>
          )}
          {canManage && isManual && due.recovered_amount === 0 && (
            <button onClick={() => onDelete(due)} className="p-2 rounded-lg text-neutral-500 hover:text-red-500 hover:bg-red-500/10 min-h-[44px] min-w-[44px] flex items-center justify-center">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DueCard;
