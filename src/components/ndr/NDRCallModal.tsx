import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { logNDRCall } from '@/lib/ndr/ndrService';
import { NDRCallerResult, NDRShipment } from '@/types/ndr';
import { Calendar, PhoneCall, RefreshCw, X } from 'lucide-react';

interface NDRCallModalProps {
  shipment: NDRShipment | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CALLER_RESULTS: NDRCallerResult[] = [
  'Customer Not Reachable',
  'Phone Switched Off',
  'Wrong Number',
  'Customer Refused Order',
  'Customer Denied Refusal',
  'Customer Did Not Receive Call',
  'Customer Wants Tomorrow Delivery',
  'Future Delivery Requested',
  'Address Issue',
  'Payment Issue',
  'OTP Issue',
  'Customer Already Received',
  'Duplicate Order',
  'Fake Order',
  'Customer Wants RTO',
  'Other',
];

export const NDRCallModal: React.FC<NDRCallModalProps> = ({ shipment, isOpen, onClose, onSuccess }) => {
  const { profile } = useAuth();
  const [callerResult, setCallerResult] = useState<NDRCallerResult>('Customer Wants Tomorrow Delivery');
  const [callConnected, setCallConnected] = useState(true);
  const [customerResponse, setCustomerResponse] = useState('');
  const [customerVerifiedReason, setCustomerVerifiedReason] = useState('');
  const [customerComplaint, setCustomerComplaint] = useState('');
  const [customerWantsDelivery, setCustomerWantsDelivery] = useState(true);
  const [preferredDeliveryDate, setPreferredDeliveryDate] = useState('');
  const [alternateNumber, setAlternateNumber] = useState('');
  const [nextFollowupDate, setNextFollowupDate] = useState('');
  const [callerRemarks, setCallerRemarks] = useState('');
  const [callDuration, setCallDuration] = useState('01:30');
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
        callConnected,
        attemptNumber: (shipment.total_attempts || 1) + 1,
        customerResponse,
        callerResult,
        customerVerifiedReason,
        customerComplaint,
        customerWantsDelivery,
        preferredDeliveryDate,
        alternateNumber,
        nextFollowupDate,
        callerRemarks,
        callDuration,
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
      <div className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-600/15 text-purple-600 dark:text-purple-400">
              <PhoneCall className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Log Customer Call</h2>
              <p className="text-xs text-neutral-500 font-mono">AWB: {shipment.awb_number}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 text-rose-600 text-xs font-medium border border-rose-200">
              {errorMsg}
            </div>
          )}

          {/* Shipment Summary */}
          <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-neutral-500">Consignee:</span>
              <span className="font-semibold">{shipment.consignee_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Pincode:</span>
              <span className="font-mono">{shipment.delivery_pincode || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Original Reason:</span>
              <span className="font-medium text-amber-600">{shipment.original_ndr_reason || '-'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Call Connected?</label>
              <select
                value={callConnected ? 'yes' : 'no'}
                onChange={(e) => setCallConnected(e.target.value === 'yes')}
                className="w-full px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-medium"
              >
                <option value="yes">Yes - Connected</option>
                <option value="no">No - Unreachable / Switched Off</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Caller Result Dropdown *</label>
              <select
                value={callerResult}
                onChange={(e) => setCallerResult(e.target.value as NDRCallerResult)}
                className="w-full px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-medium"
              >
                {CALLER_RESULTS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Customer Verified Reason</label>
            <input
              type="text"
              placeholder="e.g. Price high, Out of station, Wants discount..."
              value={customerVerifiedReason}
              onChange={(e) => setCustomerVerifiedReason(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Customer Wants Delivery?</label>
              <select
                value={customerWantsDelivery ? 'yes' : 'no'}
                onChange={(e) => setCustomerWantsDelivery(e.target.value === 'yes')}
                className="w-full px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs"
              >
                <option value="yes">Yes - Wants Delivery</option>
                <option value="no">No - Refuses Order / Wants RTO</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Preferred Delivery Date</label>
              <input
                type="date"
                value={preferredDeliveryDate}
                onChange={(e) => setPreferredDeliveryDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Alternate Phone Number</label>
              <input
                type="tel"
                placeholder="Alternate phone if provided"
                value={alternateNumber}
                onChange={(e) => setAlternateNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Next Follow-up Date</label>
              <input
                type="date"
                value={nextFollowupDate}
                onChange={(e) => setNextFollowupDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Caller Remarks / Call Summary</label>
            <textarea
              rows={3}
              placeholder="Detail conversation summary..."
              value={callerRemarks}
              onChange={(e) => setCallerRemarks(e.target.value)}
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
              className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-glow flex items-center gap-1.5"
            >
              {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <PhoneCall className="h-4 w-4" />} Record Call Remarks
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
