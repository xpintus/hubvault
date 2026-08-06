import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { submitSupervisorAction } from '@/lib/ndr/ndrService';
import { NDRShipment, NDRSupervisorActionType } from '@/types/ndr';
import { CheckCircle2, RefreshCw, RotateCcw, ShieldCheck, Truck, X } from 'lucide-react';

interface NDRSupervisorModalProps {
  shipment: NDRShipment | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const NDRSupervisorModal: React.FC<NDRSupervisorModalProps> = ({ shipment, isOpen, onClose, onSuccess }) => {
  const { profile } = useAuth();
  const [actionTaken, setActionTaken] = useState<NDRSupervisorActionType>('Approve Reattempt');
  const [supervisorRemarks, setSupervisorRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !shipment) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supervisorRemarks.trim()) {
      setErrorMsg('Supervisor Remark is mandatory.');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await submitSupervisorAction({
        shipmentId: shipment.id,
        supervisorId: profile?.id || null,
        supervisorName: profile?.name || 'Operations Supervisor',
        userRole: profile?.role || 'supervisor',
        actionTaken,
        supervisorRemarks,
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
      <div className="w-full max-w-lg flex flex-col rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-600/15 text-rose-600 dark:text-rose-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Supervisor Decision</h2>
              <p className="text-xs text-neutral-500 font-mono">AWB: {shipment.awb_number}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 text-rose-600 text-xs font-medium border border-rose-200">
              {errorMsg}
            </div>
          )}

          {/* Shipment Details Summary */}
          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-neutral-500 font-medium">Customer:</span>
              <span className="font-bold text-neutral-900 dark:text-neutral-100">{shipment.consignee_name || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500 font-medium">Delivery Executive:</span>
              <span className="font-semibold text-neutral-800 dark:text-neutral-200">{shipment.delivery_executive || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500 font-medium">Original Reason:</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">{shipment.original_ndr_reason || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500 font-medium">Attempt Count:</span>
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">Attempt #{shipment.total_attempts || 1}</span>
            </div>
          </div>

          {/* 3 Supervisor Decision Buttons */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-2">
              Supervisor Decision *
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setActionTaken('Approve Delivery')}
                className={`p-3 rounded-xl text-xs font-bold border transition flex flex-col items-center gap-1.5 ${
                  actionTaken === 'Approve Delivery'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-500/30'
                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                }`}
              >
                <CheckCircle2 className="h-4 w-4" /> Approve Delivery
              </button>

              <button
                type="button"
                onClick={() => setActionTaken('Approve Reattempt')}
                className={`p-3 rounded-xl text-xs font-bold border transition flex flex-col items-center gap-1.5 ${
                  actionTaken === 'Approve Reattempt'
                    ? 'bg-orange-600 text-white border-orange-600 shadow-md ring-2 ring-orange-500/30'
                    : 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30 hover:bg-orange-500/20'
                }`}
              >
                <Truck className="h-4 w-4" /> Approve Reattempt
              </button>

              <button
                type="button"
                onClick={() => setActionTaken('Approve RTO')}
                className={`p-3 rounded-xl text-xs font-bold border transition flex flex-col items-center gap-1.5 ${
                  actionTaken === 'Approve RTO'
                    ? 'bg-red-600 text-white border-red-600 shadow-md ring-2 ring-red-500/30'
                    : 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30 hover:bg-red-500/20'
                }`}
              >
                <RotateCcw className="h-4 w-4" /> Approve RTO
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
              Supervisor Remark * <span className="text-rose-500">(Mandatory)</span>
            </label>
            <textarea
              rows={3}
              placeholder="Enter mandatory supervisor instructions..."
              value={supervisorRemarks}
              onChange={(e) => setSupervisorRemarks(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-medium"
              required
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
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-glow transition flex items-center gap-1.5"
            >
              {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Save Decision
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
