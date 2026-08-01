import { Button,Card } from '@/components/ui/primitives';
import { formatDate,formatINR } from '@/lib/format';
import { Collector,Due } from '@/types';
import { clsx } from 'clsx';
import { BookOpen } from 'lucide-react';
import React from 'react';

export interface EmployeeSummaryRow {
  collectorId: string;
  collectorName: string;
  employeeId: string;
  phone: string;
  collector: Collector | null;
  totalOriginalDue: number;
  totalRecovered: number;
  currentOutstanding: number;
  dueEntryCount: number;
  oldestDueDate: string;
  recoveryPercentage: number;
  status: 'Outstanding' | 'Partially Recovered' | 'Fully Recovered';
  dueRecords: Due[];
}

export interface EmployeeSummaryProps {
  summaryRows: EmployeeSummaryRow[];
  canManage: boolean;
  onOpenLedger: (collector: Collector) => void;
  onOpenRecoveryModal: (collectorId: string, collectorName: string, employeeId: string, phone: string, collector: Collector | null) => void;
}

export const EmployeeSummary: React.FC<EmployeeSummaryProps> = ({
  summaryRows,
  canManage,
  onOpenLedger,
  onOpenRecoveryModal,
}) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          Employee-Level Outstanding Dues Summary ({summaryRows.length})
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {summaryRows.map((emp) => (
          <Card
            key={emp.collectorId}
            hover
            className="p-4 sm:p-5 flex flex-col justify-between border border-neutral-200/80 dark:border-neutral-800/80 rounded-2xl bg-white dark:bg-neutral-900/90 shadow-xs"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-600/20 to-brand-600/10 text-brand-600 flex items-center justify-center font-bold text-sm shrink-0">
                    {emp.collectorName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-neutral-900 dark:text-neutral-100 truncate text-sm sm:text-base">
                      {emp.collectorName}
                    </h3>
                    <p className="text-xs text-neutral-500 font-mono truncate">{emp.employeeId}</p>
                  </div>
                </div>
                <span className={clsx(
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-wide uppercase shrink-0',
                  emp.status === 'Outstanding' ? 'bg-red-500/10 text-red-500' :
                  emp.status === 'Partially Recovered' ? 'bg-amber-500/10 text-amber-500' :
                  'bg-emerald-500/10 text-emerald-600'
                )}>
                  {emp.status}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-neutral-50 dark:bg-neutral-950 p-2.5 border border-neutral-200/60 dark:border-neutral-800/60">
                  <p className="text-[10px] font-medium text-neutral-500 uppercase">Original Dues</p>
                  <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200 tabular-nums">{formatINR(emp.totalOriginalDue)}</p>
                </div>
                <div className="rounded-xl bg-emerald-500/5 p-2.5 border border-emerald-500/20">
                  <p className="text-[10px] font-medium text-emerald-600 uppercase">Recovered</p>
                  <p className="text-sm font-bold text-emerald-600 tabular-nums">{formatINR(emp.totalRecovered)}</p>
                </div>
              </div>

              <div className="mt-3 p-3 rounded-xl bg-red-500/5 border border-red-500/20 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-red-500">Current Outstanding</p>
                  <p className="text-xl font-extrabold text-red-500 tabular-nums">{formatINR(emp.currentOutstanding)}</p>
                </div>
                <div className="text-right text-[11px] text-neutral-500">
                  <p className="font-semibold">{emp.dueEntryCount} due entries</p>
                  <p className="text-[10px] text-neutral-400">Oldest: {formatDate(emp.oldestDueDate)}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-neutral-200/80 dark:border-neutral-800/80 flex items-center justify-between gap-2">
              {emp.collector && (
                <button
                  onClick={() => onOpenLedger(emp.collector!)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline min-h-[36px]"
                >
                  <BookOpen className="h-3.5 w-3.5" /> View Ledger
                </button>
              )}
              {canManage && emp.currentOutstanding > 0 && (
                <Button
                  size="sm"
                  onClick={() => onOpenRecoveryModal(emp.collectorId, emp.collectorName, emp.employeeId, emp.phone, emp.collector)}
                  className="min-h-[36px] px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white ml-auto"
                >
                  + Recover Payment
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default EmployeeSummary;
