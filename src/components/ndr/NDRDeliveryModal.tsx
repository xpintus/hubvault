import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { markNDRDelivered } from '@/lib/ndr/ndrService';
import { NDRShipment } from '@/types/ndr';
import { AWBCopyButton } from './AWBCopyButton';
import { AlertTriangle, CheckCircle2, RefreshCw, X } from 'lucide-react';

interface NDRDeliveryModalProps {
  shipment: NDRShipment | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const NDRDeliveryModal: React.FC<NDRDeliveryModalProps> = ({ shipment, isOpen, onClose, onSuccess }) => {
  const { profile } = useAuth();
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveredByText, setDeliveredByText] = useState(shipment?.delivery_executive || '');
  const [podReference, setPodReference] = useState('');
  const [codCollectedAmount, setCodCollectedAmount] = useState<number>(shipment?.amount_payable || 0);
  const [codExceptionRemark, setCodExceptionRemark] = useState('');
  const [deliveryRemarks, setDeliveryRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !shipment) return null;

  const expectedAmount = shipment.amount_payable || 0;
  const isMismatch = Math.abs(codCollectedAmount - expectedAmount) > 0.01;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!podReference.trim()) {
      setErrorMsg('POD Reference / Delivery Confirmation proof is required.');
      return;
    }

    if (isMismatch && (!codExceptionRemark || !codExceptionRemark.trim())) {
      setErrorMsg('COD Collected amount differs from Expected Payable Amount. Exception Remark is required.');
      return;
    }

    setSubmitting(true);
    try {
      await markNDRDelivered({
        shipmentId: shipment.id,
        userId: profile?.id || null,
        userName: profile?.name || 'Supervisor',
        deliveredDate: deliveryDate,

        deliveredByText: deliveredByText || shipment.delivery_executive || 'Delivery Agent',

        podReference,
        codCollectedAmount,
        expectedAmount,
        codExceptionRemark,
        deliveryRemarks,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to mark delivered:', err);
      setErrorMsg(err.message || 'Failed to record delivery.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-600/15 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Mark Delivered After NDR</h2>
              <div className="mt-1 text-xs text-neutral-500"><AWBCopyButton awb={shipment.awb_number} /></div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 text-rose-600 text-xs font-medium border border-rose-200 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Amount Comparison Card */}
          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-neutral-500 block">Expected Payable COD</span>
              <span className="text-base font-bold text-neutral-900 dark:text-neutral-100">₹{expectedAmount}</span>
            </div>
            <div>
              <span className="text-neutral-500 block">Payment Mode</span>
              <span className="text-sm font-semibold uppercase text-brand-600 dark:text-brand-400">{shipment.payment_type}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Delivery Date *</label>
              <input
                type="date"
                required
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Delivered By (Executive) *</label>
              <input
                type="text"
                required
                value={deliveredByText}
                onChange={(e) => setDeliveredByText(e.target.value)}
                placeholder="Name of executive who delivered"
                className="w-full px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">POD Reference / Signature ID *</label>
              <input
                type="text"
                required
                value={podReference}
                onChange={(e) => setPodReference(e.target.value)}
                placeholder="POD-998811 / OTP verified / Customer sign"
                className="w-full px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Actual COD Collected (₹) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={codCollectedAmount}
                onChange={(e) => setCodCollectedAmount(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-bold text-emerald-600 dark:text-emerald-400"
              />
            </div>
          </div>

          {/* COD Mismatch Exception Warning & Field */}
          {isMismatch && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-bold">
                <AlertTriangle className="h-4 w-4" /> COD Mismatch Detected: Expected ₹{expectedAmount} vs Collected ₹
                {codCollectedAmount}
              </div>
              <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                COD Exception Remark * (Mandatory for discrepancy audit)
              </label>
              <textarea
                rows={2}
                required
                placeholder="Explain reason for shortage/excess COD collected..."
                value={codExceptionRemark}
                onChange={(e) => setCodExceptionRemark(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-amber-500/40 text-xs"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Delivery Remarks</label>
            <textarea
              rows={2}
              placeholder="Additional delivery comments..."
              value={deliveryRemarks}
              onChange={(e) => setDeliveryRemarks(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-glow flex items-center gap-1.5"
            >
              {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Confirm NDR Delivered
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
