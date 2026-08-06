import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { submitSupervisorAction } from '@/lib/ndr/ndrService';
import { NDRShipment, NDRSupervisorActionType } from '@/types/ndr';
import { RefreshCw, ShieldCheck, X } from 'lucide-react';

interface NDRSupervisorModalProps {
  shipment: NDRShipment | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const NDRSupervisorModal: React.FC<NDRSupervisorModalProps> = ({ shipment, isOpen, onClose, onSuccess }) => {
  const { profile } = useAuth();
  const [actionTaken, setActionTaken] = useState<NDRSupervisorActionType>('Approve Reattempt');
  const [supervisorCalledCustomer, setSupervisorCalledCustomer] = useState(false);
  const [deliveryExecutiveReasonCorrect, setDeliveryExecutiveReasonCorrect] = useState(true);
  const [fakeAttemptSuspected, setFakeAttemptSuspected] = useState(false);
  const [otpMisuseSuspected, setOtpMisuseSuspected] = useState(false);
  const [escalateDeliveryExecutive, setEscalateDeliveryExecutive] = useState(false);
  const [escalateVendor, setEscalateVendor] = useState(false);
  const [supervisorRemarks, setSupervisorRemarks] = useState('');
  const [nextActionDate, setNextActionDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !shipment) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await submitSupervisorAction({
        shipmentId: shipment.id,
        supervisorId: profile?.id || null,
        supervisorName: profile?.name || 'Operations Supervisor',
        userRole: profile?.role || 'supervisor',
        supervisorCalledCustomer,
        deliveryExecutiveReasonCorrect,
        fakeAttemptSuspected,
        otpMisuseSuspected,
        escalateDeliveryExecutive,
        escalateVendor,
        actionTaken,
        supervisorRemarks,
        nextActionDate,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed supervisor action:', err);
      setErrorMsg(err.message || 'Failed to submit supervisor decision.');
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
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-600/15 text-rose-600 dark:text-rose-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Supervisor Review & Action</h2>
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

          {/* Audit Verification Checkboxes */}
          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 space-y-2 text-xs">
            <h3 className="font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider text-[11px] mb-2">
              Verification & Audit Checklist
            </h3>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={supervisorCalledCustomer}
                onChange={(e) => setSupervisorCalledCustomer(e.target.checked)}
                className="rounded border-neutral-300 text-rose-600 focus:ring-rose-500"
              />
              <span className="text-neutral-700 dark:text-neutral-300 font-medium">Supervisor Directly Contacted Customer</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={deliveryExecutiveReasonCorrect}
                onChange={(e) => setDeliveryExecutiveReasonCorrect(e.target.checked)}
                className="rounded border-neutral-300 text-rose-600 focus:ring-rose-500"
              />
              <span className="text-neutral-700 dark:text-neutral-300">Delivery Executive Reason Is Genuine / Verified</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={fakeAttemptSuspected}
                onChange={(e) => setFakeAttemptSuspected(e.target.checked)}
                className="rounded border-neutral-300 text-rose-600 focus:ring-rose-500"
              />
              <span className="text-rose-600 dark:text-rose-400 font-semibold">Flag: Fake Attempt Suspected</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={otpMisuseSuspected}
                onChange={(e) => setOtpMisuseSuspected(e.target.checked)}
                className="rounded border-neutral-300 text-rose-600 focus:ring-rose-500"
              />
              <span className="text-amber-600 dark:text-amber-400 font-semibold">Flag: OTP Misuse / Bypass Suspected</span>
            </label>
          </div>

          {/* Escalations */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <label className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 flex items-center gap-2 cursor-pointer bg-neutral-50/50 dark:bg-neutral-900/20">
              <input
                type="checkbox"
                checked={escalateDeliveryExecutive}
                onChange={(e) => setEscalateDeliveryExecutive(e.target.checked)}
                className="rounded border-neutral-300 text-rose-600"
              />
              <span>Escalate Delivery Executive ({shipment.delivery_executive || 'DE'})</span>
            </label>

            <label className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 flex items-center gap-2 cursor-pointer bg-neutral-50/50 dark:bg-neutral-900/20">
              <input
                type="checkbox"
                checked={escalateVendor}
                onChange={(e) => setEscalateVendor(e.target.checked)}
                className="rounded border-neutral-300 text-rose-600"
              />
              <span>Escalate Vendor ({shipment.partner_name || 'Vendor'})</span>
            </label>
          </div>

          {/* Supervisor Decision */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Supervisor Final Decision *</label>
            <select
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value as NDRSupervisorActionType)}
              className="w-full px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-bold text-neutral-900 dark:text-neutral-100"
            >
              <option value="Approve Reattempt">Approve Reattempt</option>
              <option value="Reject Reattempt">Reject Reattempt</option>
              <option value="Recommend RTO">Recommend RTO</option>
              <option value="Close NDR">Close NDR</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Next Action Date</label>
            <input
              type="date"
              value={nextActionDate}
              onChange={(e) => setNextActionDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Supervisor Remarks</label>
            <textarea
              rows={3}
              placeholder="Provide supervisor justification, findings, and instructions..."
              value={supervisorRemarks}
              onChange={(e) => setSupervisorRemarks(e.target.value)}
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
              className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-glow flex items-center gap-1.5"
            >
              {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Submit Supervisor Decision
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
