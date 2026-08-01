import React from 'react';
import StatusBadge from '@/components/StatusBadge';
import { CollectionEntry, DenominationInput, DENOMINATIONS, EMPTY_DENOMINATIONS } from '@/types';
import { formatINR } from '@/lib/format';
import { computePendingAmount, computeExcessAmount, safeAmount } from '@/lib/financeCalculations';
import { Eye, Pencil, Trash2, BadgeCheck, Phone, Receipt } from 'lucide-react';
import { clsx } from 'clsx';

export function RowHoverPopup({ entry, mobile = false, onView }: { entry: CollectionEntry; mobile?: boolean; onView: () => void }) {
  const denom: DenominationInput = (() => {
    const d = Array.isArray(entry.denominations) ? entry.denominations[0] : entry.denominations;
    if (!d) return { ...EMPTY_DENOMINATIONS };
    return {
      note_500: d.note_500 || 0, note_200: d.note_200 || 0, note_100: d.note_100 || 0, note_50: d.note_50 || 0,
      note_20: d.note_20 || 0, note_10: d.note_10 || 0, note_5: d.note_5 || 0, note_2: d.note_2 || 0, note_1: d.note_1 || 0,
    };
  })();
  const pending = computePendingAmount(safeAmount(entry.expected_cod), safeAmount(entry.total_collection));
  const excess = computeExcessAmount(safeAmount(entry.expected_cod), safeAmount(entry.total_collection));
  const hasDenoms = (Object.values(denom) as number[]).some((v) => v > 0);

  return (
    <div className={clsx(
      'absolute z-50 left-0 top-full mt-1',
      'opacity-0 invisible group-hover:opacity-100 group-hover:visible',
      'transition-all duration-200 ease-out',
      mobile ? 'right-0' : 'w-80'
    )}>
      <div
        role="button"
        tabIndex={0}
        onClick={onView}
        onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onView(); } }}
        className="rounded-xl border border-neutral-300 dark:border-neutral-700 bg-[var(--card-bg)] shadow-2xl shadow-black/50 p-4 text-left cursor-pointer hover:border-brand-600/50 transition-colors"
      >
        <div className="flex items-center gap-3 pb-3 border-b border-neutral-200 dark:border-neutral-800">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-600/20 to-brand-600/10 text-brand-600 flex items-center justify-center font-bold text-sm shrink-0">
            {entry.collector?.name?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-neutral-900 dark:text-neutral-100 truncate">{entry.collector?.name ?? '—'}</p>
            <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
              <span className="flex items-center gap-1">
                <BadgeCheck className="h-3 w-3" />
                {entry.collector?.employee_id ?? '—'}
              </span>
              {entry.collector?.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {entry.collector.phone}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="rounded-lg bg-neutral-100 dark:bg-neutral-950 px-3 py-2">
            <p className="text-[11px] text-neutral-500">Expected COD</p>
            <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200 tabular-nums">{formatINR(entry.expected_cod)}</p>
          </div>
          <div className="rounded-lg bg-neutral-100 dark:bg-neutral-950 px-3 py-2">
            <p className="text-[11px] text-neutral-500">Total Collection</p>
            <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200 tabular-nums">{formatINR(entry.total_collection)}</p>
          </div>
          <div className="rounded-lg bg-emerald-500/5 px-3 py-2">
            <p className="text-[11px] text-neutral-500">Cash</p>
            <p className="text-sm font-bold text-emerald-500 tabular-nums">{formatINR(entry.cash_amount)}</p>
          </div>
          <div className="rounded-lg bg-blue-500/5 px-3 py-2">
            <p className="text-[11px] text-neutral-500">Online</p>
            <p className="text-sm font-bold text-blue-500 tabular-nums">{formatINR(entry.online_amount)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 rounded-lg bg-neutral-100 dark:bg-neutral-950 px-3 py-2 text-center">
            <p className="text-[11px] text-neutral-500">Gap</p>
            <p className={clsx('text-sm font-bold tabular-nums', entry.gap < 0 ? 'text-red-500' : entry.gap > 0 ? 'text-amber-500' : 'text-brand-600')}>
              {entry.gap < 0 ? '-' : entry.gap > 0 ? '+' : ''}{formatINR(Math.abs(Number(entry.gap)))}
            </p>
          </div>
          {pending > 0 && (
            <div className="flex-1 rounded-lg bg-amber-500/5 px-3 py-2 text-center">
              <p className="text-[11px] text-neutral-500">Pending</p>
              <p className="text-sm font-bold text-amber-500 tabular-nums">{formatINR(pending)}</p>
            </div>
          )}
          {excess > 0 && (
            <div className="flex-1 rounded-lg bg-brand-600/5 px-3 py-2 text-center">
              <p className="text-[11px] text-neutral-500">Excess</p>
              <p className="text-sm font-bold text-brand-600 tabular-nums">{formatINR(excess)}</p>
            </div>
          )}
        </div>

        {hasDenoms && (
          <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
            <p className="flex items-center gap-1.5 text-xs font-bold text-neutral-500 dark:text-neutral-400 mb-2">
              <Receipt className="h-3.5 w-3.5" />
              Denomination Breakdown
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {DENOMINATIONS.map((d) => {
                const qty = denom[d.key];
                if (!qty) return null;
                return (
                  <div key={d.key} className="rounded-lg bg-neutral-100 dark:bg-neutral-950 px-2 py-1.5 text-center">
                    <p className="text-[10px] text-neutral-500">{d.label}</p>
                    <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200 tabular-nums">{qty}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {entry.remarks && (
          <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
            <p className="text-xs font-bold text-amber-500 mb-1">Remarks</p>
            <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">{entry.remarks}</p>
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-center gap-1.5 text-xs font-bold text-brand-600 transition-all">
          <Eye className="h-3.5 w-3.5" />
          Click to view full details
        </div>
      </div>
    </div>
  );
}

export interface StaffActivityTableProps {
  entries: CollectionEntry[];
  canManage: boolean;
  setViewing: (e: CollectionEntry) => void;
  setEditing: (e: CollectionEntry) => void;
  setEntryModalOpen: (open: boolean) => void;
  handleDelete: (e: CollectionEntry) => void;
}

export const StaffActivityTable: React.FC<StaffActivityTableProps> = ({
  entries,
  canManage,
  setViewing,
  setEditing,
  setEntryModalOpen,
  handleDelete,
}) => {
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50/90 dark:bg-neutral-950/90 backdrop-blur-xs text-neutral-500 text-[11px] uppercase tracking-wider font-bold border-b border-neutral-200/80 dark:border-neutral-800/80 sticky top-0">
          <tr>
            <th className="text-left px-5 py-3.5 font-bold">Employee</th>
            <th className="text-left px-4 py-3.5 font-bold hidden lg:table-cell">Emp ID</th>
            <th className="text-right px-4 py-3.5 font-bold hidden xl:table-cell">Expected COD</th>
            <th className="text-right px-4 py-3.5 font-bold">Cash</th>
            <th className="text-right px-4 py-3.5 font-bold hidden sm:table-cell">Online</th>
            <th className="text-right px-4 py-3.5 font-bold">Total</th>
            <th className="text-right px-4 py-3.5 font-bold">Pending</th>
            <th className="text-right px-4 py-3.5 font-bold hidden xl:table-cell">Excess</th>
            <th className="text-center px-4 py-3.5 font-bold">Status</th>
            <th className="text-right px-5 py-3.5 font-bold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {entries.map((e) => (
            <tr key={e.id} className="group hover:bg-neutral-50 dark:hover:bg-neutral-950/70 transition-colors">
              <td className="px-5 py-3.5 relative">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-brand-600/20 to-brand-600/10 text-brand-600 flex items-center justify-center font-bold text-xs shrink-0">
                    {e.collector?.name?.charAt(0).toUpperCase() ?? '?'}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-neutral-800 dark:text-neutral-200 truncate">{e.collector?.name ?? '—'}</div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 lg:hidden">{e.collector?.employee_id}</div>
                  </div>
                </div>
                <RowHoverPopup entry={e} onView={() => setViewing(e)} />
              </td>
              <td className="px-4 py-3.5 text-neutral-500 font-mono text-xs hidden lg:table-cell">{e.collector?.employee_id}</td>
              <td className="px-4 py-3.5 text-right tabular-nums text-neutral-500 hidden xl:table-cell">{formatINR(e.expected_cod)}</td>
              <td className="px-4 py-3.5 text-right tabular-nums text-neutral-500 dark:text-neutral-400">{formatINR(e.cash_amount)}</td>
              <td className="px-4 py-3.5 text-right tabular-nums text-neutral-500 dark:text-neutral-400 hidden sm:table-cell">{formatINR(e.online_amount)}</td>
              <td className="px-4 py-3.5 text-right tabular-nums font-bold text-neutral-800 dark:text-neutral-200">{formatINR(e.total_collection)}</td>
              {(() => {
                const pending = computePendingAmount(safeAmount(e.expected_cod), safeAmount(e.total_collection));
                const excess = computeExcessAmount(safeAmount(e.expected_cod), safeAmount(e.total_collection));
                return (
                  <>
                    <td className={clsx('px-4 py-3.5 text-right tabular-nums font-semibold', pending > 0 ? 'text-amber-500' : 'text-neutral-500 dark:text-neutral-400')}>{formatINR(pending)}</td>
                    <td className={clsx('px-4 py-3.5 text-right tabular-nums font-semibold hidden xl:table-cell', excess > 0 ? 'text-brand-600' : 'text-neutral-500 dark:text-neutral-400')}>{formatINR(excess)}</td>
                  </>
                );
              })()}
              <td className="px-4 py-3.5 text-center"><StatusBadge status={e.status} size="sm" /></td>
              <td className="px-5 py-3.5">
                <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setViewing(e)} title="View" className="p-2 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-blue-500 hover:bg-blue-500/10 transition active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center">
                    <Eye className="h-4 w-4" />
                  </button>
                  {canManage && (
                    <button onClick={() => { setEditing(e); setEntryModalOpen(true); }} title="Edit" className="p-2 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-600/15 transition active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center">
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  {canManage && (
                    <button onClick={() => handleDelete(e)} title="Delete" className="p-2 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-red-500 hover:bg-red-500/10 transition active:scale-95 min-h-[44px] min-w-[44px] flex items-center justify-center">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default StaffActivityTable;
