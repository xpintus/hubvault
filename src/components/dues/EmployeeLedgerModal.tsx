import Modal from '@/components/ui/Modal';
import { Button,Input } from '@/components/ui/primitives';
import { formatDate,formatINR } from '@/lib/format';
import { Collector } from '@/types';
import { clsx } from 'clsx';
import { Download } from 'lucide-react';
import React from 'react';

export interface LedgerEvent {
  id: string;
  dateStr: string;
  eventType: 'due' | 'recovery';
  typeLabel: string;
  originalDue: number | null;
  recovered: number | null;
  runningBalance: number;
  paymentMode: string;
  remarks: string;
}

export interface EmployeeLedgerModalProps {
  collector: Collector | null;
  onClose: () => void;
  ledgerSearch: string;
  setLedgerSearch: (s: string) => void;
  ledgerStartDate: string;
  setLedgerStartDate: (s: string) => void;
  ledgerEndDate: string;
  setLedgerEndDate: (s: string) => void;
  filteredLedgerEvents: LedgerEvent[];
  handleExportLedgerExcel: () => void;
}

export const EmployeeLedgerModal: React.FC<EmployeeLedgerModalProps> = ({
  collector,
  onClose,
  ledgerSearch,
  setLedgerSearch,
  ledgerStartDate,
  setLedgerStartDate,
  ledgerEndDate,
  setLedgerEndDate,
  filteredLedgerEvents,
  handleExportLedgerExcel,
}) => {
  if (!collector) return null;

  return (
    <Modal
      open={!!collector}
      onClose={onClose}
      title={`Employee Ledger — ${collector.name}`}
      subtitle={`Employee ID: ${collector.employee_id} · Phone: ${collector.phone || 'N/A'}`}
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" icon={<Download className="h-4 w-4" />} onClick={handleExportLedgerExcel} className="min-h-[44px]">Export Excel</Button>
          </div>
          <Button variant="outline" onClick={onClose} className="min-h-[44px] px-5">Close Ledger</Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Ledger Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-neutral-50 dark:bg-neutral-950 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800">
          <Input
            placeholder="Search ledger entries..."
            value={ledgerSearch}
            onChange={(e) => setLedgerSearch(e.target.value)}
          />
          <Input
            type="date"
            label="Start Date"
            value={ledgerStartDate}
            onChange={(e) => setLedgerStartDate(e.target.value)}
          />
          <Input
            type="date"
            label="End Date"
            value={ledgerEndDate}
            onChange={(e) => setLedgerEndDate(e.target.value)}
          />
        </div>

        {/* Ledger Timeline Table */}
        <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100 dark:bg-neutral-900 text-neutral-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Date</th>
                <th className="text-left px-4 py-3 font-semibold">Type</th>
                <th className="text-right px-4 py-3 font-semibold">Original Due</th>
                <th className="text-right px-4 py-3 font-semibold text-emerald-600">Recovered</th>
                <th className="text-right px-4 py-3 font-semibold text-red-500">Running Balance</th>
                <th className="text-left px-4 py-3 font-semibold">Mode</th>
                <th className="text-left px-4 py-3 font-semibold">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {filteredLedgerEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-neutral-500">No ledger transactions found.</td>
                </tr>
              ) : (
                filteredLedgerEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-950/70 transition-colors">
                    <td className="px-4 py-3 font-medium tabular-nums">{formatDate(evt.dateStr)}</td>
                    <td className="px-4 py-3">
                      <span className={clsx(
                        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold',
                        evt.eventType === 'recovery' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                      )}>
                        {evt.typeLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">
                      {evt.originalDue !== null ? formatINR(evt.originalDue) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600 tabular-nums">
                      {evt.recovered !== null ? formatINR(evt.recovered) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-red-500 tabular-nums">
                      {formatINR(evt.runningBalance)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{evt.paymentMode}</td>
                    <td className="px-4 py-3 text-xs text-neutral-600 dark:text-neutral-400 italic">{evt.remarks}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
};

export default EmployeeLedgerModal;
