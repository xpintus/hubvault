import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useHub } from '@/lib/hubContext';
import {
  fetchRecycleBinReports,
  purgeReportPermanently,
  restoreReportFromRecycleBin,
  SoftDeletedReportItem,
} from '@/lib/drs/drsResetManager';
import { History, RefreshCw, RotateCcw, Trash2, X } from 'lucide-react';

interface DRSRecycleBinDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreSuccess: () => void;
}

export const DRSRecycleBinDrawer: React.FC<DRSRecycleBinDrawerProps> = ({
  isOpen,
  onClose,
  onRestoreSuccess,
}) => {
  const { selectedHub } = useHub();
  const { profile } = useAuth();

  const [items, setItems] = useState<SoftDeletedReportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await fetchRecycleBinReports(selectedHub?.id || null);
      setItems(data);
    } catch (err) {
      console.error('Failed to load recycle bin items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) loadItems();
  }, [isOpen, selectedHub]);

  if (!isOpen) return null;

  const handleRestore = async (id: string) => {
    setRestoringId(id);
    try {
      const ok = await restoreReportFromRecycleBin(id, profile);
      if (ok) {
        setItems((prev) => prev.filter((i) => i.id !== id));
        onRestoreSuccess();
      }
    } catch (err) {
      console.error('Restore error:', err);
    } finally {
      setRestoringId(null);
    }
  };

  const handlePurge = async (id: string) => {
    if (confirm('Permanently purge this report? This action CANNOT be undone.')) {
      try {
        const ok = await purgeReportPermanently(id);
        if (ok) {
          setItems((prev) => prev.filter((i) => i.id !== id));
        }
      } catch (err) {
        console.error('Purge error:', err);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-xl bg-[var(--card-bg)] border-l border-neutral-200 dark:border-neutral-800 h-full flex flex-col shadow-2xl animate-slide-left text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-500/10 text-orange-600">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
                Recycle Bin ({items.length})
              </h2>
              <p className="text-[11px] text-neutral-500">Soft-deleted reports can be restored within 30 days.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="py-20 text-center text-neutral-500 flex flex-col items-center gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-brand-600" />
              <span>Loading soft-deleted reports...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="py-20 text-center text-neutral-500 space-y-2">
              <History className="h-8 w-8 mx-auto text-neutral-400" />
              <p className="font-semibold">Recycle Bin is Empty</p>
              <p className="text-[11px] text-neutral-400">Deleted reports will appear here for restoration.</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-3 shadow-sm hover:shadow-md transition"
              >
                <div className="flex items-center justify-between border-b border-neutral-200/60 dark:border-neutral-800/60 pb-2">
                  <div>
                    <h3 className="font-bold text-neutral-900 dark:text-neutral-100 truncate max-w-[260px]">{item.fileName}</h3>
                    <span className="text-[10px] text-neutral-400 font-mono">Date: {item.reportDate}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20 uppercase">
                    Soft Deleted
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                  <div><span className="text-neutral-400 block text-[10px]">OFD</span><strong>{item.totalOfd}</strong></div>
                  <div><span className="text-neutral-400 block text-[10px]">Delivered</span><strong className="text-emerald-600">{item.totalDelivered}</strong></div>
                  <div><span className="text-neutral-400 block text-[10px]">Delivery %</span><strong className="text-brand-600">{item.overallDeliveryPct}%</strong></div>
                </div>

                <div className="text-[10px] text-neutral-500 space-y-0.5 pt-1 border-t border-neutral-200/40 dark:border-neutral-800/40">
                  <div>Deleted by: <strong>{item.deleted_by_name}</strong> at {new Date(item.deleted_at).toLocaleString()}</div>
                  <div>Reason: <span className="italic">{item.deleted_reason}</span></div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => handleRestore(item.id)}
                    disabled={restoringId === item.id}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95"
                  >
                    {restoringId === item.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                    Restore Report
                  </button>
                  <button
                    onClick={() => handlePurge(item.id)}
                    className="px-3 py-1.5 rounded-xl bg-neutral-200 dark:bg-neutral-800 hover:bg-rose-500 hover:text-white font-bold transition flex items-center gap-1 text-neutral-600 dark:text-neutral-400 active:scale-95"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Purge
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
