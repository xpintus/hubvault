import StatusBadge from '@/components/StatusBadge';
import { formatINR } from '@/lib/format';
import { CollectionEntry } from '@/types';
import { clsx } from 'clsx';
import { Eye,Pencil,Trash2 } from 'lucide-react';
import React from 'react';
import { RowHoverPopup } from './StaffActivityTable';

export interface StaffActivityMobileProps {
  entries: CollectionEntry[];
  canManage: boolean;
  setViewing: (e: CollectionEntry) => void;
  setEditing: (e: CollectionEntry) => void;
  setEntryModalOpen: (open: boolean) => void;
  handleDelete: (e: CollectionEntry) => void;
}

export const StaffActivityMobile: React.FC<StaffActivityMobileProps> = ({
  entries,
  canManage,
  setViewing,
  setEditing,
  setEntryModalOpen,
  handleDelete,
}) => {
  return (
    <div className="divide-y divide-neutral-200 dark:divide-neutral-800 md:hidden">
      {entries.map((e) => (
        <div key={e.id} className="p-4 hover:bg-neutral-50 dark:hover:bg-neutral-950/70 transition-colors">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-600/20 to-brand-600/10 text-brand-600 flex items-center justify-center font-bold text-sm shrink-0">
                {e.collector?.name?.charAt(0).toUpperCase() ?? '?'}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-neutral-800 dark:text-neutral-200 truncate text-sm">{e.collector?.name ?? '—'}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono truncate">{e.collector?.employee_id}</p>
              </div>
            </div>
            <StatusBadge status={e.status} size="sm" />
          </div>

          <RowHoverPopup entry={e} mobile onView={() => setViewing(e)} />

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-neutral-100 dark:bg-neutral-900 px-2.5 py-2 text-center">
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400">Cash</p>
              <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200 tabular-nums">{formatINR(e.cash_amount)}</p>
            </div>
            <div className="rounded-lg bg-neutral-100 dark:bg-neutral-900 px-2.5 py-2 text-center">
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400">Online</p>
              <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200 tabular-nums">{formatINR(e.online_amount)}</p>
            </div>
            <div className="rounded-lg bg-neutral-100 dark:bg-neutral-900 px-2.5 py-2 text-center">
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400">Total</p>
              <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">{formatINR(e.total_collection)}</p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className={clsx(
              'text-xs font-semibold tabular-nums',
              e.gap < 0 ? 'text-red-500 dark:text-red-400' : e.gap > 0 ? 'text-amber-500 dark:text-amber-400' : 'text-brand-600 dark:text-brand-400'
            )}>
              Gap: {e.gap < 0 ? '-' : e.gap > 0 ? '+' : ''}{formatINR(Math.abs(Number(e.gap)))}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setViewing(e)}
                className="p-2 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-blue-500 hover:bg-blue-500/10 transition active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <Eye className="h-4 w-4" />
              </button>
              {canManage && (
                <button
                  onClick={() => { setEditing(e); setEntryModalOpen(true); }}
                  className="p-2 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-600/15 transition active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              {canManage && (
                <button
                  onClick={() => handleDelete(e)}
                  className="p-2 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-red-500 hover:bg-red-500/10 transition active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StaffActivityMobile;
