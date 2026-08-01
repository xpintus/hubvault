import { formatDate,formatINR } from '@/lib/format';
import { Due,DueStatus } from '@/types';
import { clsx } from 'clsx';
import { Edit3,Eye,Trash2 } from 'lucide-react';
import React from 'react';
import DueCard from './DueCard';

export interface DueTableProps {
  dues: Due[];
  statusConfig: Record<DueStatus, { color: string; dot: string; badge: string; label: string }>;
  canManage: boolean;
  onView: (d: Due) => void;
  onEdit: (d: Due) => void;
  onDelete: (d: Due) => void;
  onOpenRecovery: (collectorId: string, collectorName: string, employeeId: string, phone: string, collector: any) => void;
}

export const DueTable: React.FC<DueTableProps> = ({
  dues,
  statusConfig,
  canManage,
  onView,
  onEdit,
  onDelete,
  onOpenRecovery,
}) => {
  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50/90 dark:bg-neutral-950/90 backdrop-blur-xs text-neutral-500 text-[11px] uppercase tracking-wider font-bold border-b border-neutral-200/80 dark:border-neutral-800/80 sticky top-0">
            <tr>
              <th className="text-left px-5 py-3.5 font-bold">Due Date</th>
              <th className="text-left px-4 py-3.5 font-bold">Employee</th>
              <th className="text-left px-4 py-3.5 font-bold">Emp ID</th>
              <th className="text-left px-4 py-3.5 font-bold">Source</th>
              <th className="text-right px-4 py-3.5 font-bold">Original</th>
              <th className="text-right px-4 py-3.5 font-bold text-emerald-600">Recovered</th>
              <th className="text-right px-4 py-3.5 font-bold text-red-500">Remaining</th>
              <th className="text-center px-4 py-3.5 font-bold">Status</th>
              <th className="text-right px-5 py-3.5 font-bold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {dues.map((d) => {
              const cfg = statusConfig[d.status];
              const isManual = d.source === 'manual_old_due' || d.collection_entry_id === null;

              return (
                <tr key={d.id} className="group hover:bg-neutral-50 dark:hover:bg-neutral-950/70 transition-colors">
                  <td className="px-5 py-3.5 font-medium tabular-nums text-neutral-700 dark:text-neutral-300">{formatDate(d.due_date)}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-600/20 to-brand-600/10 text-brand-600 flex items-center justify-center font-bold text-xs shrink-0">
                        {d.collector?.name?.charAt(0).toUpperCase() ?? '?'}
                      </div>
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200 truncate">{d.collector?.name ?? '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-neutral-500 font-mono text-xs">{d.collector?.employee_id ?? '—'}</td>
                  <td className="px-4 py-3.5">
                    <span className={clsx(
                      'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold',
                      isManual ? 'bg-amber-500/10 text-amber-600' : 'bg-blue-500/10 text-blue-600'
                    )}>
                      {isManual ? 'Manual Old Due' : 'Collection Shortage'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right font-bold tabular-nums text-neutral-800 dark:text-neutral-200">{formatINR(d.original_amount)}</td>
                  <td className="px-4 py-3.5 text-right font-bold tabular-nums text-emerald-600">{formatINR(d.recovered_amount)}</td>
                  <td className="px-4 py-3.5 text-right font-extrabold tabular-nums text-red-500">{formatINR(d.remaining_amount)}</td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide uppercase', cfg.badge)}>
                      <span className={clsx('h-1.5 w-1.5 rounded-full', cfg.dot)} />
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onView(d)} title="View Itemized Details" className="p-2 rounded-lg text-neutral-500 hover:text-blue-500 hover:bg-blue-500/10 min-h-[44px] min-w-[44px] flex items-center justify-center">
                        <Eye className="h-4 w-4" />
                      </button>
                      {canManage && isManual && (
                        <button onClick={() => onEdit(d)} title="Edit Manual Due" className="p-2 rounded-lg text-neutral-500 hover:text-brand-600 hover:bg-brand-50 min-h-[44px] min-w-[44px] flex items-center justify-center">
                          <Edit3 className="h-4 w-4" />
                        </button>
                      )}
                      {canManage && isManual && d.recovered_amount === 0 && (
                        <button onClick={() => onDelete(d)} title="Delete Manual Due" className="p-2 rounded-lg text-neutral-500 hover:text-red-500 hover:bg-red-500/10 min-h-[44px] min-w-[44px] flex items-center justify-center">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="divide-y divide-neutral-200 dark:divide-neutral-800 md:hidden">
        {dues.map((d) => (
          <DueCard
            key={d.id}
            due={d}
            statusConfig={statusConfig}
            canManage={canManage}
            onView={onView}
            onEdit={onEdit}
            onDelete={onDelete}
            onOpenRecovery={onOpenRecovery}
          />
        ))}
      </div>
    </>
  );
};

export default DueTable;
