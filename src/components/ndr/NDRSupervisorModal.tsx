import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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

const getTomorrowDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatFollowupDate = (value: string) => {
  if (!value) return 'the next scheduled date';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
};

const buildSupervisorRemark = (
  action: NDRSupervisorActionType,
  result: NDRCallerResult,
  followupDate: string
) => {
  const callSummary = `Customer call result: ${result}.`;
  if (action === 'Approve Delivery') return `${callSummary} Delivery approved by supervisor.`;
  if (action === 'Approve RTO') return `${callSummary} RTO approved by supervisor.`;
  return `${callSummary} Reattempt approved. Next follow-up scheduled for ${formatFollowupDate(followupDate)}.`;
};

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
  const [supervisorRemarkIsAuto, setSupervisorRemarkIsAuto] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    setActionTaken('Approve Reattempt');
    const tomorrow = getTomorrowDate();
    setSupervisorRemarks(buildSupervisorRemark('Approve Reattempt', 'Customer Wants Reattempt', tomorrow));
    setSupervisorRemarkIsAuto(true);
    setCallerResult('Customer Wants Reattempt');
    setCallerRemarks('');
    setNextFollowupDate(tomorrow);
    setAlternateNumber('');
    setCallLogged(false);
    setErrorMsg(null);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, shipment?.id, onClose]);

  useEffect(() => {
    if (!isOpen || !supervisorRemarkIsAuto) return;
    setSupervisorRemarks(buildSupervisorRemark(actionTaken, callerResult, nextFollowupDate));
  }, [isOpen, actionTaken, callerResult, nextFollowupDate, supervisorRemarkIsAuto]);

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

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex h-dvh w-screen items-end justify-center overflow-hidden bg-black/60 backdrop-blur-sm animate-fade-in sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Supervisor decision"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex h-dvh w-full flex-col overflow-hidden border border-neutral-200 bg-[var(--card-bg)] shadow-2xl dark:border-neutral-800 sm:h-auto sm:max-h-[92dvh] sm:max-w-3xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-600/15 text-rose-600 dark:text-rose-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-neutral-900 dark:text-neutral-100 sm:text-lg">Supervisor Decision</h2>
              <div className="mt-1 text-xs text-neutral-500"><AWBCopyButton awb={shipment.awb_number} /></div>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close supervisor action" className="shrink-0 rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 pb-6 sm:space-y-5 sm:p-6 sm:pb-7">
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
                <select value={callerResult} onChange={(e) => { setCallerResult(e.target.value as NDRCallerResult); setSupervisorRemarkIsAuto(true); }} className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-xs font-semibold dark:border-neutral-800 dark:bg-neutral-900">
                  {CALLER_RESULTS.map((result) => <option key={result} value={result}>{result}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-xs font-bold">Next Follow-up Date
                  <input type="date" value={nextFollowupDate} onChange={(e) => { setNextFollowupDate(e.target.value); setSupervisorRemarkIsAuto(true); }} className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 font-semibold dark:border-neutral-800 dark:bg-neutral-900" />
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
            <div className="grid grid-cols-1 gap-2 min-[430px]:grid-cols-3">
              <button
                type="button"
                onClick={() => { setActionTaken('Approve Delivery'); setSupervisorRemarkIsAuto(true); }}
                className={`min-h-12 rounded-xl border p-3 text-xs font-bold transition flex min-[430px]:flex-col items-center justify-center gap-1.5 ${
                  actionTaken === 'Approve Delivery'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-500/30'
                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                }`}
              >
                <CheckCircle2 className="h-4 w-4" /> Approve Delivery
              </button>

              <button
                type="button"
                onClick={() => { setActionTaken('Approve Reattempt'); setSupervisorRemarkIsAuto(true); }}
                className={`min-h-12 rounded-xl border p-3 text-xs font-bold transition flex min-[430px]:flex-col items-center justify-center gap-1.5 ${
                  actionTaken === 'Approve Reattempt'
                    ? 'bg-orange-600 text-white border-orange-600 shadow-md ring-2 ring-orange-500/30'
                    : 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30 hover:bg-orange-500/20'
                }`}
              >
                <Truck className="h-4 w-4" /> Approve Reattempt
              </button>

              <button
                type="button"
                onClick={() => { setActionTaken('Approve RTO'); setSupervisorRemarkIsAuto(true); }}
                className={`min-h-12 rounded-xl border p-3 text-xs font-bold transition flex min-[430px]:flex-col items-center justify-center gap-1.5 ${
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
              onChange={(e) => { setSupervisorRemarks(e.target.value); setSupervisorRemarkIsAuto(false); }}
              className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-medium"
              required
            />
          </div>

          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-neutral-200 bg-[var(--card-bg)] px-4 py-3 shadow-[0_-12px_30px_-24px_rgba(15,23,42,.45)] dark:border-neutral-800 sm:gap-3 sm:px-6 sm:py-4">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 flex-1 rounded-xl px-4 py-2.5 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800 sm:flex-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-glow transition hover:bg-rose-500 disabled:opacity-60 sm:flex-none"
            >
              {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Save Decision
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="min-w-0"><span className="block text-neutral-500">{label}</span><span className={`block break-words font-semibold text-neutral-900 dark:text-neutral-100 ${mono ? 'font-mono' : ''}`}>{value}</span></div>;
}
