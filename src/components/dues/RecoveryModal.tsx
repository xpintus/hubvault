import React from 'react';
import Modal from '@/components/ui/Modal';
import { Button, Input, Select } from '@/components/ui/primitives';
import { Collector, Due } from '@/types';
import { formatINR, formatDate } from '@/lib/format';
import { safeAmount } from '@/lib/financeCalculations';

export interface RecoveryModalProps {
  recoveryEmployee: {
    collectorId: string;
    collectorName: string;
    employeeId: string;
    phone: string;
    collector: Collector | null;
  } | null;
  onClose: () => void;
  recoveryEmployeeActiveDues: Due[];
  recoveryEmployeeTotalOriginal: number;
  recoveryEmployeeTotalRecovered: number;
  recoveryEmployeeTotalOutstanding: number;
  recoveryAmount: string;
  setRecoveryAmount: (val: string) => void;
  recoveryDate: string;
  setRecoveryDate: (val: string) => void;
  recoveryMode: string;
  setRecoveryMode: (val: string) => void;
  recoveryRef: string;
  setRecoveryRef: (val: string) => void;
  recoveryNotes: string;
  setRecoveryNotes: (val: string) => void;
  recoveryFIFOPreview: {
    due: Due;
    allocated: number;
    newRemaining: number;
    newStatus: string;
  }[];
  savingRecovery: boolean;
  handleEmployeeRecoverySave: () => void;
}

export const RecoveryModal: React.FC<RecoveryModalProps> = ({
  recoveryEmployee,
  onClose,
  recoveryEmployeeActiveDues,
  recoveryEmployeeTotalOriginal,
  recoveryEmployeeTotalRecovered,
  recoveryEmployeeTotalOutstanding,
  recoveryAmount,
  setRecoveryAmount,
  recoveryDate,
  setRecoveryDate,
  recoveryMode,
  setRecoveryMode,
  recoveryRef,
  setRecoveryRef,
  recoveryNotes,
  setRecoveryNotes,
  recoveryFIFOPreview,
  savingRecovery,
  handleEmployeeRecoverySave,
}) => {
  if (!recoveryEmployee) return null;

  return (
    <Modal
      open={!!recoveryEmployee}
      onClose={onClose}
      title={`Record Employee Recovery — ${recoveryEmployee.collectorName}`}
      subtitle={`Employee ID: ${recoveryEmployee.employeeId} · Phone: ${recoveryEmployee.phone}`}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={savingRecovery} className="min-h-[44px]">Cancel</Button>
          <Button onClick={handleEmployeeRecoverySave} loading={savingRecovery} disabled={savingRecovery} className="min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
            Record Employee Recovery
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        {/* Employee Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-neutral-50 dark:bg-neutral-950 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800">
          <div>
            <p className="text-xs text-neutral-500">Active Dues</p>
            <p className="font-bold text-neutral-900 dark:text-neutral-100">{recoveryEmployeeActiveDues.length} entries</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Total Original</p>
            <p className="font-bold text-neutral-900 dark:text-neutral-100">{formatINR(recoveryEmployeeTotalOriginal)}</p>
          </div>
          <div>
            <p className="text-xs text-emerald-600 font-semibold">Total Recovered</p>
            <p className="font-bold text-emerald-600">{formatINR(recoveryEmployeeTotalRecovered)}</p>
          </div>
          <div>
            <p className="text-xs text-red-500 font-semibold">Total Outstanding</p>
            <p className="font-bold text-red-500 text-base">{formatINR(recoveryEmployeeTotalOutstanding)}</p>
          </div>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Recovery Amount (₹)"
            type="number"
            value={recoveryAmount}
            onChange={(e) => setRecoveryAmount(e.target.value)}
            placeholder={`Max: ₹${recoveryEmployeeTotalOutstanding}`}
          />

          <Input
            label="Recovery Date"
            type="date"
            value={recoveryDate}
            onChange={(e) => setRecoveryDate(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Payment Mode"
            value={recoveryMode}
            onChange={(e) => setRecoveryMode(e.target.value)}
          >
            <option value="cash">Cash</option>
            <option value="online">Online / UPI</option>
            <option value="other">Other / Salary Adjustment</option>
          </Select>

          <Input
            label="Reference Number (optional)"
            value={recoveryRef}
            onChange={(e) => setRecoveryRef(e.target.value)}
            placeholder="Transaction ID / Receipt No."
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-500 mb-1">Remarks / Notes (optional)</label>
          <textarea
            value={recoveryNotes}
            onChange={(e) => setRecoveryNotes(e.target.value)}
            rows={2}
            placeholder="Employee recovery remarks..."
            className="input-base resize-none"
          />
        </div>

        {/* Live FIFO Allocation Preview */}
        {safeAmount(recoveryAmount) > 0 && (
          <div className="space-y-2 border-t border-neutral-200 dark:border-neutral-800 pt-3">
            <div className="flex items-center justify-between text-xs font-bold text-neutral-800 dark:text-neutral-200">
              <span>Live Outstanding Impact:</span>
              <span className="tabular-nums">
                ₹{recoveryEmployeeTotalOutstanding.toLocaleString('en-IN')} $\rightarrow$ ₹{Math.max(0, recoveryEmployeeTotalOutstanding - safeAmount(recoveryAmount)).toLocaleString('en-IN')}
              </span>
            </div>

            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden text-xs">
              <div className="bg-neutral-100 dark:bg-neutral-900 px-3 py-2 font-bold text-neutral-600 dark:text-neutral-400">
                FIFO Allocation Preview (Oldest First):
              </div>
              <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {recoveryFIFOPreview.map((item) => (
                  <div key={item.due.id} className="p-3 flex justify-between items-center bg-neutral-50/50 dark:bg-neutral-950/50">
                    <div>
                      <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {item.due.source === 'manual_old_due' || item.due.collection_entry_id === null ? 'Manual Old Due' : 'Collection Shortage'} ({formatDate(item.due.due_date)})
                      </p>
                      <p className="text-[11px] text-neutral-500">
                        Original: {formatINR(item.due.original_amount)} · Was Remaining: {formatINR(item.due.remaining_amount)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-600 tabular-nums">+ {formatINR(item.allocated)}</p>
                      <p className="text-[11px] text-neutral-400 font-semibold">New Rem: {formatINR(item.newRemaining)} ({item.newStatus})</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default RecoveryModal;
