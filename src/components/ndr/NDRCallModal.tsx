import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { logNDRCall } from '@/lib/ndr/ndrService';
import { NDRCallerResult, NDRShipment } from '@/types/ndr';
import { AWBCopyButton } from './AWBCopyButton';
import { PhoneCall, RefreshCw, Send, X } from 'lucide-react';

interface NDRCallModalProps {
  shipment: NDRShipment | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CALLER_RESULTS: NDRCallerResult[] = [
  'Customer Refused to Accept',
  'Customer Refused OTP',
  'Customer Not Reachable',
  'Phone Switched Off',
  'Wrong Number',
  'Future Delivery Requested',
  'Customer Wants Reattempt',
  'Customer Already Received',
  'Fake Order',
  'Address Issue',
  'Payment Issue',
  'OTP Issue',
  'Delivery Executive Did Not Visit',
  'Other',
];

export const NDRCallModal: React.FC<NDRCallModalProps> = ({ shipment, isOpen, onClose, onSuccess }) => {
  const { profile } = useAuth();
  const [callerResult, setCallerResult] = useState<NDRCallerResult>('Customer Wants Reattempt');
  const [callerRemarks, setCallerRemarks] = useState('');
  const [nextFollowupDate, setNextFollowupDate] = useState('');
  const [alternateNumber, setAlternateNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !shipment) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await logNDRCall({
        shipmentId: shipment.id,
        callerId: profile?.id || null,
        callerName: profile?.name || 'Calling Executive',
        userRole: profile?.role || 'collector',
        callConnected: callerResult !== 'Customer Not Reachable' && callerResult !== 'Phone Switched Off' && callerResult !== 'Wrong Number',
        attemptNumber: (shipment.total_attempts || 1) + 1,
        callerResult,
        callerRemarks,
        alternateNumber: alternateNumber.trim() || undefined,
        nextFollowupDate: nextFollowupDate || undefined,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to log call:', err);
      setErrorMsg(err.message || 'Failed to record call details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-lg flex flex-col rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-600/15 text-purple-600 dark:text-purple-400">
              <PhoneCall className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Customer Calling Screen</h2>
              <div className="mt-1 text-xs text-neutral-500"><AWBCopyButton awb={shipment.awb_number} /></div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 text-rose-600 text-xs font-medium border border-rose-200">
              {errorMsg}
            </div>
          )}

          {/* Caller Screen Detailed Information */}
          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 text-xs space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-neutral-500 block">AWB Number:</span>
                <AWBCopyButton awb={shipment.awb_number} />
              </div>
              <div>
                <span className="text-neutral-500 block">Customer Name:</span>
                <span className="font-bold text-neutral-900 dark:text-neutral-100">{shipment.consignee_name || '-'}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Phone Mobile:</span>
                <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                  {(shipment.raw_data?.consignee_phone as string) || (shipment.raw_data?.phone as string) || '-'}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 block">Delivery Address:</span>
                <span className="font-medium text-neutral-700 dark:text-neutral-300 truncate block">
                  {(shipment.raw_data?.delivery_address as string) || shipment.city || '-'}
                </span>
              </div>

              <div>
                <span className="text-neutral-500 block">Payment Type & COD:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{shipment.payment_type} (₹{shipment.amount_payable})</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Delivery Executive:</span>
                <span className="font-semibold">{shipment.delivery_executive || '-'}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Partner / Vendor:</span>
                <span className="font-medium">{shipment.partner_name || '-'}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Attempt Count:</span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">Attempt #{shipment.total_attempts || 1}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">OTP Status:</span>
                <span className="font-semibold text-neutral-800 dark:text-neutral-200">{shipment.otp_status || 'N/A'}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Last Attempt Date:</span>
                <span className="font-mono font-semibold">{shipment.last_attempt_date ? new Date(shipment.last_attempt_date).toLocaleDateString() : '-'}</span>
              </div>
            </div>
            <div className="pt-2 border-t border-neutral-200/60 dark:border-neutral-800/60">
              <span className="text-neutral-500 block font-semibold">Original DRS NDR Reason:</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">{shipment.original_ndr_reason || '-'}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
              Call Result *
            </label>
            <select
              value={callerResult}
              onChange={(e) => setCallerResult(e.target.value as NDRCallerResult)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-900 dark:text-neutral-100"
            >
              {CALLER_RESULTS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                Next Follow-up Date (Optional)
              </label>
              <input
                type="date"
                value={nextFollowupDate}
                onChange={(e) => setNextFollowupDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                Alternate Number (Optional)
              </label>
              <input
                type="tel"
                placeholder="Alternate phone..."
                value={alternateNumber}
                onChange={(e) => setAlternateNumber(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
              Caller Remark
            </label>
            <textarea
              rows={3}
              placeholder="Enter caller remark..."
              value={callerRemarks}
              onChange={(e) => setCallerRemarks(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-medium"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-glow transition flex items-center gap-1.5"
            >
              {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Save & Send To Supervisor
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
