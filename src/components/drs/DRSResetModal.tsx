import React, { useState } from 'react';
import { AlertTriangle, Download, RefreshCw, ShieldAlert, Trash2, X } from 'lucide-react';
import { DRSReportHistoryItem } from '@/types/drs';

interface DRSResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  level: 1 | 2 | 3;
  currentReport?: DRSReportHistoryItem | null;
  selectedReports?: DRSReportHistoryItem[];
  totalReportsCount?: number;
  totalNdrCount?: number;
  onConfirm: (options: { reason: string; exportBeforeDelete: boolean }) => Promise<void>;
}

export const DRSResetModal: React.FC<DRSResetModalProps> = ({
  isOpen,
  onClose,
  level,
  currentReport,
  selectedReports = [],
  totalReportsCount = 0,
  totalNdrCount = 0,
  onConfirm,
}) => {
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [exportBeforeDelete, setExportBeforeDelete] = useState(true);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const isLevel3Valid = level === 3 ? deleteConfirmationText.trim().toUpperCase() === 'DELETE' : true;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLevel3Valid) return;

    setSubmitting(true);
    try {
      await onConfirm({
        reason: reason.trim() || `Level ${level} Data Reset`,
        exportBeforeDelete,
      });
      setDeleteConfirmationText('');
      onClose();
    } catch (err) {
      console.error('Reset execution failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-md rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden text-xs">
        {/* Modal Header */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-b ${
            level === 3
              ? 'bg-rose-500/10 border-rose-500/20 text-rose-600'
              : level === 2
              ? 'bg-orange-500/10 border-orange-500/20 text-orange-600'
              : 'bg-brand-500/10 border-brand-500/20 text-brand-600'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {level === 3 ? (
              <ShieldAlert className="h-5 w-5 text-rose-600 animate-bounce" />
            ) : level === 2 ? (
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            ) : (
              <Trash2 className="h-5 w-5 text-brand-600" />
            )}
            <h2 className="text-sm font-black uppercase tracking-wider">
              {level === 1 && 'Delete Current Report?'}
              {level === 2 && 'Delete Selected Reports?'}
              {level === 3 && '⚠ DANGER: Delete ALL Reports?'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {level === 1 && (
            <div className="space-y-2">
              <p className="text-neutral-600 dark:text-neutral-300 font-medium">
                This will permanently delete the current DRS Report and every linked NDR case.
              </p>
              {currentReport && (
                <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800/60 font-mono text-[11px] space-y-1">
                  <div>File: <strong className="text-neutral-900 dark:text-neutral-100">{currentReport.fileName}</strong></div>
                  <div>Date: <strong className="text-neutral-900 dark:text-neutral-100">{currentReport.reportDate}</strong></div>
                  <div>OFD: <strong>{currentReport.totalOfd}</strong> | Delivered: <strong>{currentReport.totalDelivered}</strong></div>
                </div>
              )}
            </div>
          )}

          {level === 2 && (
            <div className="space-y-3">
              <p className="text-neutral-600 dark:text-neutral-300 font-medium">
                You are about to delete multiple selected reports together.
              </p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800">
                  <span className="text-neutral-400 block text-[10px]">Reports</span>
                  <span className="text-base font-black font-mono text-brand-600">{selectedReports.length}</span>
                </div>
                <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800">
                  <span className="text-neutral-400 block text-[10px]">Snapshots</span>
                  <span className="text-base font-black font-mono text-purple-600">{selectedReports.length}</span>
                </div>
                <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800">
                  <span className="text-neutral-400 block text-[10px]">NDR Cases</span>
                  <span className="text-base font-black font-mono text-rose-600">~{selectedReports.length * 10}+</span>
                </div>
              </div>
            </div>
          )}

          {level === 3 && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 font-medium space-y-1">
                <p>
                  This action will permanently remove <strong>EVERY DRS Report</strong>, <strong>EVERY Snapshot</strong>, <strong>EVERY NDR Case</strong> and <strong>EVERY Calling History</strong> from this Hub.
                </p>
              </div>

              <div>
                <label className="block text-neutral-500 font-bold mb-1">
                  Type <span className="font-mono text-rose-600 font-black">DELETE</span> to confirm:
                </label>
                <input
                  type="text"
                  placeholder="Type DELETE..."
                  value={deleteConfirmationText}
                  onChange={(e) => setDeleteConfirmationText(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 font-mono text-xs font-bold uppercase focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>
            </div>
          )}

          {/* Reason Input */}
          <div>
            <label className="block text-neutral-500 font-semibold mb-1">Reason for Reset (Optional)</label>
            <input
              type="text"
              placeholder="Enter reason for reset log..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs"
            />
          </div>

          {/* Export Before Delete Checkbox */}
          <label className="flex items-center gap-2 p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/80 dark:border-neutral-800 cursor-pointer">
            <input
              type="checkbox"
              checked={exportBeforeDelete}
              onChange={(e) => setExportBeforeDelete(e.target.checked)}
              className="rounded text-brand-600 focus:ring-brand-500"
            />
            <span className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
              <Download className="h-3.5 w-3.5 text-brand-600" /> Export Backup before deleting
            </span>
          </label>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-200 dark:border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl font-bold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || (level === 3 && !isLevel3Valid)}
              className={`px-5 py-2 rounded-xl font-bold text-white shadow-md transition flex items-center gap-1.5 ${
                level === 3
                  ? isLevel3Valid
                    ? 'bg-rose-600 hover:bg-rose-500 active:scale-95'
                    : 'bg-neutral-400 cursor-not-allowed'
                  : level === 2
                  ? 'bg-orange-600 hover:bg-orange-500 active:scale-95'
                  : 'bg-brand-600 hover:bg-brand-500 active:scale-95'
              }`}
            >
              {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {level === 1 && 'Delete Current'}
              {level === 2 && 'Delete Selected'}
              {level === 3 && 'Delete ALL Reports'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
