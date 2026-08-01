import React from 'react';
import { Card, Button } from '@/components/ui/primitives';
import { ChevronLeft, ChevronRight, Download, Upload, Clock } from 'lucide-react';
import { subDays, addDays, parseISO, isToday as isDateToday } from 'date-fns';
import { clsx } from 'clsx';

export interface DateNavigationProps {
  date: Date;
  dateStr: string;
  todayStr: string;
  isNextDisabled: boolean;
  setDate: (d: Date) => void;
  handleExport: () => void;
  canManage: boolean;
  setImportModalOpen: (open: boolean) => void;
  filteredCount: number;
  totalEntriesCount: number;
}

export const DateNavigation: React.FC<DateNavigationProps> = ({
  date,
  dateStr,
  todayStr,
  isNextDisabled,
  setDate,
  handleExport,
  canManage,
  setImportModalOpen,
  filteredCount,
  totalEntriesCount,
}) => {
  return (
    <Card className="p-4 sm:p-5 lg:col-span-2 min-w-0 flex flex-col justify-between border border-neutral-200/80 dark:border-neutral-800/80 rounded-2xl bg-white dark:bg-neutral-900/90">
      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-neutral-900 dark:text-neutral-100">Date Navigation</h3>
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mt-0.5">
              Select date to inspect daily collection activity
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 p-1 shadow-xs">
              <button
                onClick={() => setDate(subDays(date, 1))}
                aria-label="Previous day"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/70 dark:hover:bg-neutral-800 transition active:scale-95 min-h-[44px] min-w-[44px]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="relative px-1">
                <input
                  type="date"
                  value={dateStr}
                  max={todayStr}
                  onChange={(e) => {
                    const d = parseISO(e.target.value);
                    if (d && !isNaN(d.getTime())) setDate(d);
                  }}
                  className="border-0 bg-transparent px-2 py-1 text-xs sm:text-sm font-bold text-neutral-800 dark:text-neutral-200 outline-none focus:ring-0 [color-scheme:light] dark:[color-scheme:dark] tabular-nums"
                />
              </div>
              <button
                onClick={() => !isNextDisabled && setDate(addDays(date, 1))}
                disabled={isNextDisabled}
                aria-label="Next day"
                className={clsx(
                  'flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 dark:text-neutral-400 transition active:scale-95 min-h-[44px] min-w-[44px]',
                  isNextDisabled
                    ? 'opacity-30 cursor-not-allowed'
                    : 'hover:bg-neutral-200/70 dark:hover:bg-neutral-800'
                )}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <Button
              variant={isDateToday(date) ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setDate(new Date())}
              className="shrink-0 min-h-[44px] px-3.5 font-bold text-xs sm:text-sm"
            >
              Today
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-neutral-200/80 dark:border-neutral-800/80 pt-4">
        <Button
          variant="outline"
          size="sm"
          icon={<Download className="h-4 w-4" />}
          onClick={handleExport}
          className="min-h-[44px] px-3.5 text-xs sm:text-sm font-semibold"
        >
          Export Excel
        </Button>
        {canManage && (
          <Button
            variant="outline"
            size="sm"
            icon={<Upload className="h-4 w-4" />}
            onClick={() => setImportModalOpen(true)}
            className="min-h-[44px] px-3.5 text-xs sm:text-sm font-semibold"
          >
            Import Excel
          </Button>
        )}
        <div className="ml-auto flex items-center gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-950 px-2.5 py-1 rounded-lg border border-neutral-200/60 dark:border-neutral-800/60">
          <Clock className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
          <span>{filteredCount} of {totalEntriesCount} shown</span>
        </div>
      </div>
    </Card>
  );
};

export default DateNavigation;
