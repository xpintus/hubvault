import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/primitives';
import { formatINR, toISODate } from '@/lib/format';
import { recordRiderRecovery } from '@/lib/riderDuesService';
import { RiderLedgerSummary, RiderRecoveryPaymentMode } from '@/types';
import { AlertTriangle } from 'lucide-react';
import React, { useState } from 'react';

const PAYMENT_MODES: RiderRecoveryPaymentMode[] = [
  'Cash',
  'UPI',
  'Bank Transfer',
  'Salary Deduction',
  'Other',
];

interface RecoveryModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  riderSummary: RiderLedgerSummary | null;
  currentUserName?: string | null;
  currentUserRole?: string | null;
  currentUserId?: string | null;
}

export default function RecoveryModal({
  open,
  onClose,
  onSuccess,
  riderSummary,
  currentUserName,
  currentUserRole,
  currentUserId,
}: RecoveryModalProps) {
  const toast = useToast();

  const [recoveryDate, setRecoveryDate] = useState(toISODate(new Date()));
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<RiderRecoveryPaymentMode>('Cash');
  const [transactionId, setTransactionId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [collectedBy, setCollectedBy] = useState(currentUserName || 'Cashier / Supervisor');
  const [saving, setSaving] = useState(false);
  const [allowOverRecovery, setAllowOverRecovery] = useState(false);

  if (!riderSummary) return null;

  const outstanding = riderSummary.outstandingBalance;
  const numAmount = parseFloat(amount) || 0;
  const isOverRecovery = numAmount > outstanding && outstanding > 0;
  const canAuthorizeOverRecovery =
    currentUserRole === 'super_admin' || currentUserRole === 'hub_admin';

  const handleQuickAmount = (val: number) => {
    setAmount(val.toString());
  };

  const handleSave = async () => {
    if (numAmount <= 0) {
      toast.error('Please enter a valid recovery amount greater than ₹0');
      return;
    }

    if (isOverRecovery && !allowOverRecovery) {
      toast.error(
        `Recovery amount (₹${numAmount}) exceeds outstanding balance (₹${outstanding}). Admin approval required.`
      );
      return;
    }

    setSaving(true);
    try {
      await recordRiderRecovery({
        rider_id: riderSummary.riderId,
        hub_id: riderSummary.hubId,
        recovery_date: recoveryDate,
        amount: numAmount,
        payment_mode: paymentMode,
        transaction_id: transactionId.trim() || null,
        remarks: remarks.trim() || null,
        collected_by: collectedBy.trim() || null,
        created_by: currentUserId,
        allow_over_recovery: allowOverRecovery,
      });

      toast.success(
        `Successfully recorded recovery of ₹${numAmount.toLocaleString('en-IN')} from ${
          riderSummary.riderName
        }`
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record recovery');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record Recovery Payment"
      subtitle="Settle outstanding dues and allocate payments in FIFO order"
      size="lg"
    >
      <div className="space-y-4">

        {/* Rider Summary Header Card */}
        <div className="mt-5 p-4 rounded-2xl bg-gradient-to-r from-slate-50 via-slate-50/80 to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-850 border border-slate-200 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-white text-base">
                  {riderSummary.riderName}
                </span>
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {riderSummary.feId}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span>Phone: {riderSummary.phone}</span>
                <span>•</span>
                <span>Hub: {riderSummary.hubName}</span>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-xs text-slate-500 dark:text-slate-400 block">
                Current Outstanding Balance
              </span>
              <span className="text-xl font-black text-rose-600 dark:text-rose-400">
                {formatINR(outstanding)}
              </span>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <div className="mt-5 space-y-4">
          {/* Row 1: Recovery Date & Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Recovery Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={recoveryDate}
                onChange={(e) => setRecoveryDate(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Recovery Amount (₹) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                placeholder="0.00"
                min="1"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full text-sm font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-emerald-600 dark:text-emerald-400 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Quick Amount Suggestion Chips */}
          {outstanding > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500 text-[11px] font-medium">Quick Fill:</span>
              <button
                type="button"
                onClick={() => handleQuickAmount(outstanding)}
                className="rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 px-2.5 py-1 text-emerald-700 dark:text-emerald-300 font-semibold hover:bg-emerald-100 transition"
              >
                Full Balance: {formatINR(outstanding)}
              </button>
              {outstanding > 500 && (
                <button
                  type="button"
                  onClick={() => handleQuickAmount(Math.round(outstanding / 2))}
                  className="rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-200 transition"
                >
                  Half: {formatINR(Math.round(outstanding / 2))}
                </button>
              )}
            </div>
          )}

          {/* Over-Recovery Warning & Admin Override */}
          {isOverRecovery && (
            <div className="p-3.5 rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/40 text-xs text-amber-900 dark:text-amber-200 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Over-Recovery Warning: </span>
                  Entered amount of {formatINR(numAmount)} exceeds outstanding balance of{' '}
                  {formatINR(outstanding)} by {formatINR(numAmount - outstanding)}.
                </div>
              </div>

              {canAuthorizeOverRecovery ? (
                <label className="flex items-center gap-2 pt-1 font-semibold text-slate-900 dark:text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowOverRecovery}
                    onChange={(e) => setAllowOverRecovery(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                  <span>
                    I am an authorized admin and approve recording this excess amount as an advance / credit balance.
                  </span>
                </label>
              ) : (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                  Only Super Admin or Hub Admin can authorize recovery greater than the outstanding balance.
                </p>
              )}
            </div>
          )}

          {/* Row 2: Payment Mode & Transaction ID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Payment Mode <span className="text-rose-500">*</span>
              </label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as RiderRecoveryPaymentMode)}
                className="w-full text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {PAYMENT_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Transaction ID / Ref # (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. UTR-998822 or Cash Receipt #"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>
          </div>

          {/* Row 3: Collected By & Remarks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Collected By
              </label>
              <input
                type="text"
                placeholder="Supervisor / Cashier name"
                value={collectedBy}
                onChange={(e) => setCollectedBy(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Remarks / Notes
              </label>
              <input
                type="text"
                placeholder="e.g. Collected during evening roll call"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-end gap-2.5">
          <Button variant="ghost" onClick={onClose} disabled={saving} className="w-full sm:w-auto">
            Cancel
          </Button>

          <Button
            variant="primary"
            onClick={handleSave}
            disabled={saving || (isOverRecovery && !allowOverRecovery)}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {saving ? 'Processing...' : `Confirm Recovery (₹${numAmount.toLocaleString('en-IN')})`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
