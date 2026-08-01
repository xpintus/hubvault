import { X, Layers, Calendar, DollarSign, Tag, CheckCircle2, Clock } from 'lucide-react';
import { PartyLedgerEntry, Party } from '@/types';
import { formatINRNumber } from '@/lib/khatabook';
import { Badge } from '@/components/ui/primitives';

interface AdjustmentDetailModalProps {
  open: boolean;
  onClose: () => void;
  party: Party | null;
  ledgerEntries: PartyLedgerEntry[];
  filterType?: 'pending' | 'excess' | 'all';
}

export default function AdjustmentDetailModal({
  open,
  onClose,
  party,
  ledgerEntries,
  filterType = 'all',
}: AdjustmentDetailModalProps) {
  if (!open) return null;

  const filtered = ledgerEntries.filter((e) => {
    if (filterType === 'pending') return e.running_balance > 0;
    if (filterType === 'excess') return e.running_balance < 0;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-3xl rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ background: 'var(--card-bg)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-brand-50 dark:bg-brand-600/10 text-brand-600 dark:text-brand-400">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100 leading-tight">
                {filterType === 'pending'
                  ? 'Pending Dues Breakdown'
                  : filterType === 'excess'
                  ? 'Excess Payments Breakdown'
                  : 'Ledger Adjustment Detail'}
              </h2>
              <p className="text-xs text-neutral-500">
                {party ? `Party: ${party.name}` : 'FIFO Settlement Breakdown'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-y-auto p-6">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-neutral-500">
              <p className="text-sm font-semibold">No transactions found for this view.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-neutral-50 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 uppercase tracking-wider font-semibold">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Received</th>
                    <th className="px-4 py-3 text-right">Cash Paid</th>
                    <th className="px-4 py-3 text-right">Online Paid</th>
                    <th className="px-4 py-3 text-right">Remaining</th>
                    <th className="px-4 py-3 text-right">Adjusted</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {filtered.map((e) => (
                    <tr
                      key={e.id}
                      className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40 transition"
                    >
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-neutral-800 dark:text-neutral-200">
                        {e.transaction_date}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-600 dark:text-emerald-400">
                        {e.amount_received > 0 ? formatINRNumber(e.amount_received) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-neutral-700 dark:text-neutral-300">
                        {e.cash_paid > 0 ? formatINRNumber(e.cash_paid) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-neutral-700 dark:text-neutral-300">
                        {e.online_paid > 0 ? formatINRNumber(e.online_paid) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-red-600 dark:text-red-400">
                        {e.remaining_amount > 0 ? formatINRNumber(e.remaining_amount) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-brand-600 dark:text-brand-400">
                        {e.adjusted_amount > 0 ? formatINRNumber(e.adjusted_amount) : '-'}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <Badge
                          color={
                            e.status === 'settled'
                              ? 'green'
                              : e.status === 'pending'
                              ? 'red'
                              : e.status === 'excess'
                              ? 'blue'
                              : 'yellow'
                          }
                        >
                          {e.status_label}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
