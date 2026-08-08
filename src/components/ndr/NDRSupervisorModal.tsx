import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { logNDRCall, submitSupervisorAction } from '@/lib/ndr/ndrService';
import { NDRCallerResult, NDRShipment, NDRSupervisorActionType } from '@/types/ndr';
import { AWBCopyButton } from './AWBCopyButton';
import { CheckCircle2, PhoneCall, RefreshCw, RotateCcw, ShieldCheck, Truck, X } from 'lucide-react';

const CALLER_RESULTS: NDRCallerResult[] = [
  'Customer Refused to Accept', 'Customer Refused OTP', 'Customer Not Reachable',
  'Phone Switched Off', 'Wrong Number', 'Future Delivery Requested',
  'Customer Wants Reattempt', 'Customer Already Received', 'Fake Order',
  'Address Issue', 'Payment Issue', 'OTP Issue',
  'Delivery Executive Did Not Visit', 'Other',
];

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
  const [callerResult, setCallerResult] = useState<NDRCallerResult>('Customer Wants Reattempt');
  const [callerRemarks, setCallerRemarks] = useState('');
  const [nextFollowupDate, setNextFollowupDate] = useState('');
  const [alternateNumber, setAlternateNumber] = useState('');
  const [callLogged, setCallLogged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setActionTaken('Approve Reattempt');
    setSupervisorRemarks('');
    setCallerResult('Customer Wants Reattempt');
    setCallerRemarks('');
    setNextFollowupDate('');
    setAlternateNumber('');
    setCallLogged(false);
    setErrorMsg(null);
  }, [isOpen, shipment?.id]);

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
      if (!callLogged) {
        await logNDRCall({
          shipmentId: shipment.id,
          callerId: profile?.id || null,
          callerName: profile?.name || 'Operations Supervisor',
          userRole: profile?.role || 'supervisor',
          callConnected: !['Customer Not Reachable', 'Phone Switched Off', 'Wrong Number'].includes(callerResult),
          attemptNumber: (shipment.total_attempts || 1) + 1,
          callerResult,
          callerRemarks,
          alternateNumber: alternateNumber.trim() || undefined,
          nextFollowupDate: nextFollowupDate || undefined,
        });
        setCallLogged(true);
      }
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
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-600/15 text-rose-600 dark:text-rose-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Supervisor Decision</h2>
              <div className="mt-1 text-xs text-neutral-500"><AWBCopyButton awb={shipment.awb_number} /></div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 text-rose-600 text-xs font-medium border border-rose-200">
              {errorMsg}
            </div>
          )}

          {/* Complete shipment and customer details */}
          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 text-xs space-y-2">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Detail label="Customer" value={shipment.consignee_name || '-'} />
              <Detail label="Phone" value={shipment.consignee_phone || (shipment.raw_data?.consignee_phone as string) || (shipment.raw_data?.phone as string) || '-'} mono />
              <Detail label="Delivery Address" value={shipment.delivery_address || (shipment.raw_data?.delivery_address as string) || shipment.city || '-'} />
              <Detail label="Payment / COD" value={`${shipment.payment_type} (₹${shipment.amount_payable || 0})`} />
              <Detail label="Delivery Executive" value={shipment.delivery_executive || '-'} />
              <Detail label="Partner / Vendor" value={shipment.partner_name || '-'} />
              <Detail label="Attempt Count" value={`Attempt #${shipment.total_attempts || 1}`} />
              <Detail label="OTP Status" value={shipment.otp_status || 'N/A'} />
              <Detail label="Last Attempt" value={shipment.last_attempt_date ? new Date(shipment.last_attempt_date).toLocaleDateString() : '-'} />
              <Detail label="Original NDR Reason" value={shipment.original_ndr_reason || '-'} />
            </div>
          </div>

          <div className="rounded-xl border border-purple-200 bg-purple-50/60 p-4 dark:border-purple-500/20 dark:bg-purple-500/5">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-purple-700 dark:text-purple-300">
              <PhoneCall className="h-4 w-4" /> Customer Call Details
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-bold">Call Result *</label>
                <select value={callerResult} onChange={(e) => setCallerResult(e.target.value as NDRCallerResult)} className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-xs font-semibold dark:border-neutral-800 dark:bg-neutral-900">
                  {CALLER_RESULTS.map((result) => <option key={result} value={result}>{result}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-xs font-bold">Next Follow-up Date
                  <input type="date" value={nextFollowupDate} onChange={(e) => setNextFollowupDate(e.target.value)} className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 font-semibold dark:border-neutral-800 dark:bg-neutral-900" />
                </label>
                <label className="text-xs font-bold">Alternate Number
                  <input type="tel" value={alternateNumber} onChange={(e) => setAlternateNumber(e.target.value)} placeholder="Alternate phone..." className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 font-semibold dark:border-neutral-800 dark:bg-neutral-900" />
                </label>
              </div>
              <label className="block text-xs font-bold">Caller Remark
                <textarea rows={2} value={callerRemarks} onChange={(e) => setCallerRemarks(e.target.value)} placeholder="Enter customer call details..." className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 font-medium dark:border-neutral-800 dark:bg-neutral-900" />
              </label>
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

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div><span className="block text-neutral-500">{label}</span><span className={`font-semibold text-neutral-900 dark:text-neutral-100 ${mono ? 'font-mono' : ''}`}>{value}</span></div>;
}
