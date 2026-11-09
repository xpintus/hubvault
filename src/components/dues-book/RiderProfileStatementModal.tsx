import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/primitives';
import { formatDate, formatINR } from '@/lib/format';
import {
  exportRiderStatementExcel,
  exportRiderStatementPDF,
  generateChronologicalStatement,
  reverseRiderRecovery,
} from '@/lib/riderDuesService';
import { RiderLedgerSummary } from '@/types';
import {
  FileSpreadsheet,
  FileText,
  MessageCircle,
  RotateCcw,
  Tag,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';

interface RiderProfileStatementModalProps {
  open: boolean;
  onClose: () => void;
  riderSummary: RiderLedgerSummary | null;
  onOpenRecovery: () => void;
  onOpenWhatsApp: () => void;
  onDataChanged: () => void;
  currentUserId?: string | null;
  currentUserRole?: string | null;
}

type TabKey = 'statement' | 'dues' | 'recoveries' | 'messages';

export default function RiderProfileStatementModal({
  open,
  onClose,
  riderSummary,
  onOpenRecovery,
  onOpenWhatsApp,
  onDataChanged,
  currentUserId,
  currentUserRole: _currentUserRole,
}: RiderProfileStatementModalProps) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>('statement');
  const [reversingId, setReversingId] = useState<string | null>(null);

  const statementRows = useMemo(() => {
    if (!riderSummary) return [];
    return generateChronologicalStatement(riderSummary.dues, riderSummary.recoveries);
  }, [riderSummary]);

  // Category breakdown calculation
  const categoryBreakdown = useMemo(() => {
    if (!riderSummary) return [];
    const map = new Map<string, { count: number; total: number }>();
    for (const d of riderSummary.dues) {
      const cat = d.category || 'Other';
      const existing = map.get(cat) || { count: 0, total: 0 };
      existing.count += 1;
      existing.total += d.amount;
      map.set(cat, existing);
    }
    return Array.from(map.entries()).map(([category, data]) => ({
      category,
      ...data,
    }));
  }, [riderSummary]);

  if (!riderSummary) return null;

  const handleExportExcel = () => {
    try {
      exportRiderStatementExcel(riderSummary, statementRows);
      toast.success('Rider statement exported to Excel');
    } catch {
      toast.error('Failed to export Excel statement');
    }
  };

  const handleExportPDF = async () => {
    try {
      await exportRiderStatementPDF(riderSummary, statementRows);
      toast.success('Rider statement downloaded as PDF');
    } catch {
      toast.error('Failed to generate PDF statement');
    }
  };

  const handleReverseRecovery = async (recoveryId: string) => {
    const reason = prompt('Please enter reason for reversing this recovery transaction:');
    if (!reason || !reason.trim()) return;

    setReversingId(recoveryId);
    try {
      await reverseRiderRecovery(recoveryId, reason.trim(), currentUserId || undefined);
      toast.success('Recovery transaction successfully reversed');
      onDataChanged();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reverse recovery');
    } finally {
      setReversingId(null);
    }
  };

  const recoveryRate =
    riderSummary.totalDues > 0
      ? Math.min(100, Math.round((riderSummary.totalRecovered / riderSummary.totalDues) * 100))
      : 100;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Rider Statement — ${riderSummary.riderName}`}
      subtitle={`FE ID: ${riderSummary.feId} · Mobile: ${riderSummary.phone} · Hub: ${riderSummary.hubName} · Status: ${riderSummary.status}`}
      size="xl"
    >
      <div className="space-y-4">
        {/* Quick Actions Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                riderSummary.status === 'Fully Recovered'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : riderSummary.status === 'Overdue'
                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                  : riderSummary.status === 'Partially Recovered'
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  : 'bg-slate-500/15 text-slate-600 dark:text-slate-400'
              }`}
            >
              {riderSummary.status}
            </span>
            <span className="text-xs text-slate-500 font-mono">
              FE ID: {riderSummary.feId}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>Export Excel</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportPDF}
              className="inline-flex items-center gap-1.5"
            >
              <FileText className="h-3.5 w-3.5 text-rose-600" />
              <span>Download PDF</span>
            </Button>
          </div>
        </div>

        {/* Financial Highlights Ribbon */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
              Total Dues Generated
            </span>
            <span className="text-lg font-black text-slate-900 dark:text-white mt-0.5 block">
              {formatINR(riderSummary.totalDues)}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 block">
              Total Amount Recovered
            </span>
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">
              {formatINR(riderSummary.totalRecovered)}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-rose-50/50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40">
            <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 block">
              Current Outstanding
            </span>
            <span className="text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5 block">
              {formatINR(riderSummary.outstandingBalance)}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
            <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-400 block">
              Recovery Rate %
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                {recoveryRate}%
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full"
                  style={{ width: `${recoveryRate}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Dues Category Breakdown Pills */}
        {categoryBreakdown.length > 0 && (
          <div className="mt-4 p-3 rounded-2xl bg-slate-50/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Dues Category Breakdown
            </div>
            <div className="flex flex-wrap gap-2">
              {categoryBreakdown.map((item) => (
                <div
                  key={item.category}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 text-xs shadow-sm"
                >
                  <Tag className="h-3 w-3 text-indigo-500" />
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {item.category}:
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatINR(item.total)}
                  </span>
                  <span className="text-[10px] text-slate-400">({item.count})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Toolbar */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-2">
          {/* Sub Navigation Tabs */}
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            <button
              onClick={() => setActiveTab('statement')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === 'statement'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Statement Ledger ({statementRows.length})
            </button>
            <button
              onClick={() => setActiveTab('dues')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === 'dues'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Dues History ({riderSummary.dues.length})
            </button>
            <button
              onClick={() => setActiveTab('recoveries')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === 'recoveries'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Recovery History ({riderSummary.recoveries.length})
            </button>
            <button
              onClick={() => setActiveTab('messages')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                activeTab === 'messages'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Messages ({riderSummary.messages.length})
            </button>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={onOpenWhatsApp}
              className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
            >
              <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
              <span>Send WhatsApp</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onOpenRecovery}
              className="bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>+ Add Recovery</span>
            </Button>
          </div>
        </div>

        {/* Tab Content Tables */}
        <div className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
          {/* TAB 1: Date-Wise Chronological Statement */}
          {activeTab === 'statement' && (
            <div className="max-h-[380px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/90 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-800 z-10 backdrop-blur-sm">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Category / Mode</th>
                    <th className="py-2.5 px-3">Reference / AWB</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 text-right">Debit (Due ₹)</th>
                    <th className="py-2.5 px-3 text-right">Credit (Rec ₹)</th>
                    <th className="py-2.5 px-3 text-right">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {statementRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                        No transactions recorded for this rider yet.
                      </td>
                    </tr>
                  ) : (
                    statementRows.map((row) => (
                      <tr
                        key={row.id}
                        className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition ${
                          row.isReversed ? 'opacity-50 line-through' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-400">
                          {formatDate(row.date)}
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          <span
                            className={`inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-full ${
                              row.type === 'Due'
                                ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                                : row.type === 'Recovery'
                                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            }`}
                          >
                            {row.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-sans font-medium text-slate-700 dark:text-slate-300">
                          {row.categoryOrMode}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px]">{row.reference}</td>
                        <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-400 max-w-xs truncate">
                          {row.description}
                        </td>
                        <td className="py-2.5 px-3 text-right text-rose-600 dark:text-rose-400 font-bold">
                          {row.debit ? formatINR(row.debit) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400 font-bold">
                          {row.credit ? formatINR(row.credit) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-white">
                          {formatINR(row.balance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: Dues History */}
          {activeTab === 'dues' && (
            <div className="max-h-[380px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/90 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-800 z-10">
                  <tr>
                    <th className="py-2.5 px-3">Dues Date</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Recovered</th>
                    <th className="py-2.5 px-3">Remaining</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Reference / AWB</th>
                    <th className="py-2.5 px-3">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {riderSummary.dues.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                        No dues recorded.
                      </td>
                    </tr>
                  ) : (
                    riderSummary.dues.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-400">
                          {formatDate(d.dues_date)}
                        </td>
                        <td className="py-2.5 px-3 font-sans font-semibold text-slate-900 dark:text-white">
                          {d.category}
                        </td>
                        <td className="py-2.5 px-3 text-slate-900 dark:text-white font-bold">
                          {formatINR(d.amount)}
                        </td>
                        <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400">
                          {formatINR(d.recovered_amount)}
                        </td>
                        <td className="py-2.5 px-3 text-rose-600 dark:text-rose-400 font-bold">
                          {formatINR(d.remaining_amount)}
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          <span
                            className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              d.status === 'fully_recovered'
                                ? 'bg-emerald-50 text-emerald-600'
                                : d.status === 'partially_recovered'
                                ? 'bg-amber-50 text-amber-600'
                                : 'bg-rose-50 text-rose-600'
                            }`}
                          >
                            {d.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                          {d.reference_id || '-'}
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-400 max-w-xs truncate">
                          {d.description || d.remarks || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: Recovery History with Safe Reversal Action */}
          {activeTab === 'recoveries' && (
            <div className="max-h-[380px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/90 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-800 z-10">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Payment Mode</th>
                    <th className="py-2.5 px-3">Transaction ID</th>
                    <th className="py-2.5 px-3">Collected By</th>
                    <th className="py-2.5 px-3">Remarks</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {riderSummary.recoveries.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                        No recovery payments recorded yet.
                      </td>
                    </tr>
                  ) : (
                    riderSummary.recoveries.map((r) => (
                      <tr
                        key={r.id}
                        className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 ${
                          r.is_reversed ? 'opacity-60 bg-slate-50/40 dark:bg-slate-900/40' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-400">
                          {formatDate(r.recovery_date)}
                        </td>
                        <td
                          className={`py-2.5 px-3 font-bold ${
                            r.is_reversed
                              ? 'text-slate-400 line-through'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {formatINR(r.amount)}
                        </td>
                        <td className="py-2.5 px-3 font-sans font-medium text-slate-700 dark:text-slate-300">
                          {r.payment_mode}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                          {r.transaction_id || '-'}
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-400">
                          {r.collected_by || '-'}
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-500 max-w-xs truncate">
                          {r.is_reversed
                            ? `[REVERSED] ${r.reversal_reason || ''}`
                            : r.remarks || '-'}
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          {r.is_reversed ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                              Reversed
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-sans">
                          {!r.is_reversed && (
                            <button
                              onClick={() => handleReverseRecovery(r.id)}
                              disabled={reversingId === r.id}
                              className="text-xs text-rose-600 hover:text-rose-700 font-semibold hover:underline cursor-pointer"
                              title="Never deleted permanently. Reversal adjusts dues balance."
                            >
                              {reversingId === r.id ? 'Reversing...' : 'Reverse'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 4: Messages History */}
          {activeTab === 'messages' && (
            <div className="max-h-[380px] overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/90 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-800 z-10">
                  <tr>
                    <th className="py-2.5 px-3">Date &amp; Time</th>
                    <th className="py-2.5 px-3">Message Type</th>
                    <th className="py-2.5 px-3">Channel</th>
                    <th className="py-2.5 px-3">Recipient</th>
                    <th className="py-2.5 px-3">Snapshot Dues</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Message Preview</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {riderSummary.messages.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No messages logged for this rider yet.
                      </td>
                    </tr>
                  ) : (
                    riderSummary.messages.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 text-slate-500 text-[11px] whitespace-nowrap font-mono">
                          {new Date(m.created_at).toLocaleString('en-IN', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                          {m.message_type}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-emerald-600 dark:text-emerald-400">
                          {m.channel}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 font-mono">
                          {m.recipient_phone}
                        </td>
                        <td className="py-2.5 px-3 text-rose-600 font-mono font-bold">
                          {formatINR(m.snapshot_balance)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                            {m.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate font-mono text-[11px]">
                          {m.message_body}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="mt-5 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div>
            Last Recovery:{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {riderSummary.lastRecoveryDate ? formatDate(riderSummary.lastRecoveryDate) : 'Never'}
            </span>
          </div>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
