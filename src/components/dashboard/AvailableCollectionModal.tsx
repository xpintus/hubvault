import React, { useMemo } from 'react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/primitives';
import { CollectionEntry, Recovery } from '@/types';
import { safeAmount, normalizeRecoveryMode } from '@/lib/financeCalculations';
import { formatINR, formatDate } from '@/lib/format';
import { Search } from 'lucide-react';
import { clsx } from 'clsx';

export interface AvailableCollectionModalProps {
  open: boolean;
  onClose: () => void;
  metrics: {
    normalCash: number;
    normalOnline: number;
    normalTotal: number;
    cashRec: number;
    onlineRec: number;
    otherRec: number;
    totalRec: number;
    availableCash: number;
    availableOnline: number;
    totalAvailableCollection: number;
  };
  entries: CollectionEntry[];
  recoveries: Recovery[];
  dateStr: string;
  filter: 'all' | 'cash' | 'online' | 'collection_only' | 'recovery_only';
  setFilter: (f: 'all' | 'cash' | 'online' | 'collection_only' | 'recovery_only') => void;
  search: string;
  setSearch: (s: string) => void;
}

export const AvailableCollectionModal: React.FC<AvailableCollectionModalProps> = ({
  open,
  onClose,
  metrics,
  entries,
  recoveries,
  dateStr,
  filter,
  setFilter,
  search,
  setSearch,
}) => {
  const q = search.trim().toLowerCase();

  const filteredEntries = useMemo(() => {
    if (filter === 'recovery_only') return [];
    return entries.filter((e) => {
      if (filter === 'cash' && safeAmount(e.cash_amount) <= 0) return false;
      if (filter === 'online' && safeAmount(e.online_amount) <= 0) return false;
      if (!q) return true;
      const name = e.collector?.name?.toLowerCase() ?? '';
      const empId = e.collector?.employee_id?.toLowerCase() ?? '';
      const phone = e.collector?.phone?.toLowerCase() ?? '';
      const rem = (e.remarks || '').toLowerCase();
      return name.includes(q) || empId.includes(q) || phone.includes(q) || rem.includes(q);
    });
  }, [entries, filter, q]);

  const filteredRecoveries = useMemo(() => {
    if (filter === 'collection_only') return [];
    return recoveries.filter((r) => {
      const mode = normalizeRecoveryMode(r.payment_mode);
      if (filter === 'cash' && mode !== 'cash') return false;
      if (filter === 'online' && mode !== 'online') return false;
      if (!q) return true;
      const name = r.collector?.name?.toLowerCase() ?? '';
      const empId = r.collector?.employee_id?.toLowerCase() ?? '';
      const phone = r.collector?.phone?.toLowerCase() ?? '';
      const ref = (r.reference_number || '').toLowerCase();
      const notes = (r.notes || '').toLowerCase();
      return name.includes(q) || empId.includes(q) || phone.includes(q) || ref.includes(q) || notes.includes(q);
    });
  }, [recoveries, filter, q]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Available Collection — Itemized Breakdown"
      subtitle={`Selected Date: ${formatDate(dateStr)} · Total Available: ${formatINR(metrics.totalAvailableCollection)}`}
      size="lg"
      footer={<Button variant="outline" onClick={onClose} className="min-h-[44px]">Close Breakdown</Button>}
    >
      <div className="space-y-5 text-sm">
        {/* Top 3 Metric Group Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Normal Collection */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 p-3.5 space-y-1">
            <p className="text-xs font-bold text-neutral-500 uppercase tracking-wide">Normal Collection</p>
            <p className="text-xl font-extrabold text-neutral-900 dark:text-neutral-100 tabular-nums">{formatINR(metrics.normalTotal)}</p>
            <div className="text-xs text-neutral-500 pt-1 border-t border-neutral-200 dark:border-neutral-800/80 flex justify-between">
              <span>Cash: <strong className="text-emerald-600">{formatINR(metrics.normalCash)}</strong></span>
              <span>Online: <strong className="text-blue-500">{formatINR(metrics.normalOnline)}</strong></span>
            </div>
          </div>

          {/* Dues Recovery */}
          <div className="rounded-xl border border-brand-500/30 bg-brand-500/5 p-3.5 space-y-1">
            <p className="text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wide">Dues Recovery</p>
            <p className="text-xl font-extrabold text-brand-600 dark:text-brand-400 tabular-nums">{formatINR(metrics.totalRec)}</p>
            <div className="text-xs text-neutral-500 pt-1 border-t border-brand-500/20 flex flex-wrap justify-between gap-1">
              <span>Cash: <strong className="text-emerald-600">{formatINR(metrics.cashRec)}</strong></span>
              <span>Online: <strong className="text-blue-500">{formatINR(metrics.onlineRec)}</strong></span>
              {metrics.otherRec > 0 && <span>Other: <strong>{formatINR(metrics.otherRec)}</strong></span>}
            </div>
          </div>

          {/* Final Available */}
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 space-y-1">
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Total Available</p>
            <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatINR(metrics.totalAvailableCollection)}</p>
            <div className="text-xs text-neutral-500 pt-1 border-t border-emerald-500/20 flex justify-between">
              <span>Avail Cash: <strong className="text-emerald-600">{formatINR(metrics.availableCash)}</strong></span>
              <span>Avail Online: <strong className="text-blue-500">{formatINR(metrics.availableOnline)}</strong></span>
            </div>
          </div>
        </div>

        {/* Live Formula Banner */}
        <div className="rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-3 text-xs space-y-1">
          <p className="font-bold text-neutral-800 dark:text-neutral-200">Reconciliation Formula Display:</p>
          <p className="text-neutral-600 dark:text-neutral-400">
            • <strong>Available Cash ({formatINR(metrics.availableCash)})</strong> = Cash Collection ({formatINR(metrics.normalCash)}) + Cash Recovery ({formatINR(metrics.cashRec)})
          </p>
          <p className="text-neutral-600 dark:text-neutral-400">
            • <strong>Available Online ({formatINR(metrics.availableOnline)})</strong> = Online Collection ({formatINR(metrics.normalOnline)}) + Online Recovery ({formatINR(metrics.onlineRec)})
          </p>
        </div>

        {/* Modal Controls: Search & Filter Pills */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employee name, ID, phone, reference..."
              className="input-base pl-9 py-2 text-xs min-h-[44px]"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1">
            {[
              { id: 'all', label: 'All' },
              { id: 'cash', label: 'Cash Only' },
              { id: 'online', label: 'Online Only' },
              { id: 'collection_only', label: 'Collections' },
              { id: 'recovery_only', label: 'Recoveries' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setFilter(t.id as any)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors min-h-[36px]',
                  filter === t.id
                    ? 'bg-brand-600 text-white font-bold'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Section 1: Itemized Collection Entries */}
        {filteredEntries.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              1. Normal Collection Entries ({filteredEntries.length})
            </h3>
            <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-xl">
              <table className="w-full text-xs">
                <thead className="bg-neutral-100 dark:bg-neutral-900 text-neutral-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="text-left px-3.5 py-2.5">Employee</th>
                    <th className="text-left px-3.5 py-2.5">Emp ID</th>
                    <th className="text-right px-3.5 py-2.5 text-emerald-600">Cash</th>
                    <th className="text-right px-3.5 py-2.5 text-blue-500">Online</th>
                    <th className="text-right px-3.5 py-2.5 font-bold">Total</th>
                    <th className="text-left px-3.5 py-2.5">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:border-neutral-800">
                  {filteredEntries.map((e) => (
                    <tr key={e.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-950">
                      <td className="px-3.5 py-2.5 font-bold text-neutral-900 dark:text-neutral-100">{e.collector?.name ?? '—'}</td>
                      <td className="px-3.5 py-2.5 font-mono text-neutral-400">{e.collector?.employee_id ?? '—'}</td>
                      <td className="px-3.5 py-2.5 text-right font-semibold text-emerald-600 tabular-nums">{formatINR(e.cash_amount)}</td>
                      <td className="px-3.5 py-2.5 text-right font-semibold text-blue-500 tabular-nums">{formatINR(e.online_amount)}</td>
                      <td className="px-3.5 py-2.5 text-right font-bold tabular-nums">{formatINR(e.total_collection)}</td>
                      <td className="px-3.5 py-2.5 text-neutral-500 italic max-w-[150px] truncate">{e.remarks || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Section 2: Itemized Dues Recoveries */}
        {filteredRecoveries.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
              2. Dues Recoveries Received ({filteredRecoveries.length})
            </h3>
            <div className="overflow-x-auto border border-neutral-200 dark:border-neutral-800 rounded-xl">
              <table className="w-full text-xs">
                <thead className="bg-brand-500/10 text-brand-600 dark:text-brand-400 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="text-left px-3.5 py-2.5">Date</th>
                    <th className="text-left px-3.5 py-2.5">Employee</th>
                    <th className="text-right px-3.5 py-2.5">Amount</th>
                    <th className="text-center px-3.5 py-2.5">Mode</th>
                    <th className="text-left px-3.5 py-2.5">Reference</th>
                    <th className="text-left px-3.5 py-2.5">Remarks</th>
                    <th className="text-left px-3.5 py-2.5">Due Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:border-neutral-800">
                  {filteredRecoveries.map((r) => {
                    const normMode = normalizeRecoveryMode(r.payment_mode);
                    return (
                      <tr key={r.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-950">
                        <td className="px-3.5 py-2.5 font-medium tabular-nums">{formatDate(r.recovery_date)}</td>
                        <td className="px-3.5 py-2.5">
                          <p className="font-bold text-neutral-900 dark:text-neutral-100">{r.collector?.name ?? '—'}</p>
                          <p className="text-[10px] text-neutral-400 font-mono">{r.collector?.employee_id ?? '—'}</p>
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-extrabold text-brand-600 tabular-nums">{formatINR(r.amount)}</td>
                        <td className="px-3.5 py-2.5 text-center">
                          <span className={clsx(
                            'inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase',
                            normMode === 'cash' ? 'bg-emerald-500/10 text-emerald-600' :
                            normMode === 'online' ? 'bg-blue-500/10 text-blue-500' :
                            'bg-neutral-500/10 text-neutral-500'
                          )}>
                            {normMode}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-[11px] text-neutral-500 max-w-[120px] truncate">{r.reference_number || '—'}</td>
                        <td className="px-3.5 py-2.5 text-neutral-500 italic max-w-[150px] truncate">{r.notes || '—'}</td>
                        <td className="px-3.5 py-2.5 text-[11px] font-semibold text-neutral-600 dark:text-neutral-400">
                          {r.due?.source === 'manual_old_due' || r.due?.collection_entry_id === null ? 'Manual Old Due' : 'Collection Shortage'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {filteredEntries.length === 0 && filteredRecoveries.length === 0 && (
          <p className="p-6 text-center text-neutral-500 text-xs">No records match your filter criteria.</p>
        )}
      </div>
    </Modal>
  );
};

export default AvailableCollectionModal;
