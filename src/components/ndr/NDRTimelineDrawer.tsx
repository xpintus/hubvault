import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchNDRCallLogs, fetchNDRSupervisorActions, fetchNDRTimeline } from '@/lib/ndr/ndrService';
import type { NDRCallLog, NDRShipment, NDRSupervisorAction, NDRTimelineLog } from '@/types/ndr';
import { NDRStatusBadge } from './NDRStatusBadge';
import { AWBCopyButton } from './AWBCopyButton';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  History,
  MapPin,
  Package,
  Phone,
  PhoneCall,
  RotateCcw,
  ShieldCheck,
  Truck,
  User,
  X,
  XCircle,
} from 'lucide-react';

interface NDRTimelineDrawerProps {
  shipment: NDRShipment | null;
  isOpen: boolean;
  onClose: () => void;
}

export const NDRTimelineDrawer: React.FC<NDRTimelineDrawerProps> = ({ shipment, isOpen, onClose }) => {
  const [timeline, setTimeline] = useState<NDRTimelineLog[]>([]);
  const [callLogs, setCallLogs] = useState<NDRCallLog[]>([]);
  const [supervisorLogs, setSupervisorLogs] = useState<NDRSupervisorAction[]>([]);
  const [loading, setLoading] = useState(false);

  // Lock background scroll and handle Escape key while drawer is active
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Fetch timeline and activity logs for the current shipment
  useEffect(() => {
    if (shipment && isOpen) {
      setLoading(true);
      Promise.all([
        fetchNDRTimeline(shipment.id),
        fetchNDRCallLogs(shipment.id),
        fetchNDRSupervisorActions(shipment.id),
      ])
        .then(([tl, cl, sl]) => {
          setTimeline(tl);
          setCallLogs(cl);
          setSupervisorLogs(sl);
        })
        .finally(() => setLoading(false));
    }
  }, [shipment, isOpen]);

  if (!isOpen || !shipment) return null;

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'import':
        return <History className="h-4 w-4 text-blue-500" />;
      case 'caller_update':
        return <PhoneCall className="h-4 w-4 text-purple-500" />;
      case 'supervisor_update':
        return <ShieldCheck className="h-4 w-4 text-rose-500" />;
      case 'reattempt_approval':
        return <Truck className="h-4 w-4 text-amber-500" />;
      case 'delivered':
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'rto':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-neutral-400" />;
    }
  };

  const isFresh = (shipment.total_attempts || 1) <= 1;
  const isSecondAttempt = shipment.total_attempts === 2;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex h-dvh w-screen justify-end overflow-hidden bg-black/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Shipment Operational View"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        data-ndr-vertical-scroll
        className="flex h-dvh w-full flex-col overflow-hidden border-l border-neutral-200 bg-[var(--card-bg)] shadow-2xl dark:border-neutral-800 sm:max-w-xl md:max-w-2xl lg:max-w-[620px]"
      >
        {/* Fixed Header */}
        <div className="z-10 flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 bg-[var(--card-bg)] px-5 py-4 dark:border-neutral-800 sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100 truncate">
                Shipment Operational View
              </h2>
              <NDRStatusBadge status={shipment.ndr_workflow_status} size="sm" />
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
              <AWBCopyButton awb={shipment.awb_number} />
              {shipment.client_name && (
                <>
                  <span className="text-neutral-300 dark:text-neutral-700">•</span>
                  <span className="truncate max-w-[180px] font-medium text-neutral-600 dark:text-neutral-400">
                    {shipment.client_name}
                  </span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Shipment Operational View"
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 transition shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 pb-12">
          {/* Quick Stats Pill Strip */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${
                isFresh
                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                  : isSecondAttempt
                  ? 'bg-orange-500/10 text-orange-600 border-orange-500/20'
                  : 'bg-red-500/10 text-red-600 border-red-500/20'
              }`}
            >
              <RotateCcw className="h-3 w-3" />
              {isFresh ? 'Fresh (Attempt 1)' : `Reattempt (Attempt ${shipment.total_attempts})`}
            </span>

            <span className="px-2.5 py-1 rounded-lg text-xs font-bold border bg-brand-500/10 text-brand-700 border-brand-500/20 dark:text-brand-300">
              Cycle #{shipment.ndr_cycle}
            </span>

            <span className="px-2.5 py-1 rounded-lg text-xs font-bold border bg-neutral-100 text-neutral-800 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:border-neutral-700">
              {shipment.payment_type} • ₹{shipment.amount_payable}
            </span>

            {shipment.otp_status && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-medium border bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-300">
                OTP: {shipment.otp_status}
              </span>
            )}
          </div>

          {/* Original NDR Reason Alert Banner */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-800/40 dark:bg-amber-950/20">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 block">
                  Original Delivery Failure Reason
                </span>
                <p className="mt-0.5 text-xs sm:text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {shipment.original_ndr_reason || 'No failure reason recorded'}
                </p>
                {shipment.normalized_ndr_reason && shipment.normalized_ndr_reason !== shipment.original_ndr_reason && (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                    Normalized: <span className="font-medium">{shipment.normalized_ndr_reason}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Section 1: Shipment & Customer Details Grid Card */}
          <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/70 p-4 sm:p-5 dark:border-neutral-800 dark:bg-neutral-900/50 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200/70 dark:border-neutral-800/70 pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                <Package className="h-4 w-4 text-brand-600" /> Shipment & Customer Details
              </h3>
              <span className="text-[11px] font-mono text-neutral-500">
                Status: <strong className="text-neutral-800 dark:text-neutral-200">{shipment.shipment_status_current}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              {/* Consignee */}
              <div className="space-y-1">
                <span className="text-neutral-500 text-[11px] block font-medium">Consignee (Customer)</span>
                <p className="font-bold text-neutral-900 dark:text-neutral-100 text-sm">
                  {shipment.consignee_name || '-'}
                </p>
                {shipment.consignee_phone && (
                  <p className="text-neutral-600 dark:text-neutral-400 flex items-center gap-1 font-mono text-[11px]">
                    <Phone className="h-3 w-3" /> {shipment.consignee_phone}
                  </p>
                )}
              </div>

              {/* Delivery Executive */}
              <div className="space-y-1">
                <span className="text-neutral-500 text-[11px] block font-medium">Delivery Executive</span>
                <p className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-neutral-400" />
                  {shipment.delivery_executive || '-'}
                </p>
                <p className="text-[11px] text-neutral-500">
                  Vendor: <strong className="text-neutral-700 dark:text-neutral-300">{shipment.partner_name || '-'}</strong>
                </p>
              </div>

              {/* Pincode & City */}
              <div className="space-y-1">
                <span className="text-neutral-500 text-[11px] block font-medium">Pincode / Destination</span>
                <p className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5 font-mono">
                  <MapPin className="h-3.5 w-3.5 text-rose-500" />
                  {shipment.delivery_pincode || '-'}
                </p>
                <p className="text-[11px] text-neutral-500">
                  {shipment.city || '-'}{shipment.state ? `, ${shipment.state}` : ''}
                </p>
              </div>

              {/* Amount & Payment */}
              <div className="space-y-1">
                <span className="text-neutral-500 text-[11px] block font-medium">Amount Payable</span>
                <p className="font-bold text-emerald-600 dark:text-emerald-400 text-sm flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5" />
                  ₹{shipment.amount_payable}
                </p>
                <p className="text-[11px] text-neutral-500 font-medium">
                  Mode: <strong className="text-neutral-700 dark:text-neutral-300">{shipment.payment_type}</strong>
                </p>
              </div>

              {/* Hub Location */}
              <div className="space-y-1">
                <span className="text-neutral-500 text-[11px] block font-medium">Hub Location</span>
                <p className="font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-neutral-400" />
                  {shipment.hub_location || shipment.hub?.name || '-'}
                </p>
                {shipment.hub?.code && (
                  <p className="text-[11px] text-neutral-500 font-mono">Code: {shipment.hub.code}</p>
                )}
              </div>

              {/* DRS Code & Status */}
              <div className="space-y-1">
                <span className="text-neutral-500 text-[11px] block font-medium">DRS Information</span>
                <p className="font-mono font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                  {shipment.drs_code || '-'}
                </p>
                {shipment.drs_status && (
                  <p className="text-[11px] text-neutral-500">Status: {shipment.drs_status}</p>
                )}
              </div>
            </div>

            {/* Delivery Address (if present) */}
            {shipment.delivery_address && (
              <div className="pt-3 border-t border-neutral-200/60 dark:border-neutral-800/60">
                <span className="text-neutral-500 text-[11px] block font-medium mb-1">Delivery Address</span>
                <p className="text-xs text-neutral-700 dark:text-neutral-300 bg-white/70 dark:bg-neutral-950/40 p-2.5 rounded-xl border border-neutral-200/60 dark:border-neutral-800/60">
                  {shipment.delivery_address}
                </p>
              </div>
            )}

            {/* Audit & Timing Metadata Strip */}
            <div className="pt-3 border-t border-neutral-200/60 dark:border-neutral-800/60 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
              <div>
                <span className="text-neutral-400 block font-medium">Created Time</span>
                <span className="font-mono text-neutral-700 dark:text-neutral-300">
                  {new Date(shipment.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </div>
              <div>
                <span className="text-neutral-400 block font-medium">Last Updated</span>
                <span className="font-mono text-neutral-700 dark:text-neutral-300">
                  {new Date(shipment.updated_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </div>
              <div>
                <span className="text-neutral-400 block font-medium">Workflow Status</span>
                <span className="font-bold text-neutral-800 dark:text-neutral-200">
                  {shipment.ndr_workflow_status}
                </span>
              </div>
              <div>
                <span className="text-neutral-400 block font-medium">Current Status</span>
                <span className="font-bold text-neutral-800 dark:text-neutral-200">
                  {shipment.shipment_status_current}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Latest Call & Supervisor Logs Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Call History Card */}
            <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-purple-700 dark:text-purple-300 font-bold">
                  <PhoneCall className="h-4 w-4" /> Latest Call Log
                </div>
                {callLogs.length > 0 && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-800 dark:text-purple-200">
                    Log #{callLogs.length}
                  </span>
                )}
              </div>
              {callLogs.length > 0 ? (
                <div className="space-y-1.5 text-neutral-800 dark:text-neutral-200">
                  <p>
                    <span className="text-neutral-500">Result:</span>{' '}
                    <strong className="text-purple-800 dark:text-purple-300">{callLogs[0].caller_result}</strong>
                  </p>
                  <p className="bg-white/60 dark:bg-neutral-950/40 p-2 rounded-xl text-neutral-700 dark:text-neutral-300 italic border border-purple-200/40 dark:border-purple-900/40">
                    "{callLogs[0].caller_remarks || 'No remark entered'}"
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1">
                    <span>By: {callLogs[0].caller_name || 'Caller'}</span>
                    <span>{new Date(callLogs[0].created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                  </div>
                </div>
              ) : shipment.last_caller_remark ? (
                <div className="space-y-1.5 text-neutral-800 dark:text-neutral-200">
                  <p className="bg-white/60 dark:bg-neutral-950/40 p-2 rounded-xl text-neutral-700 dark:text-neutral-300 italic border border-purple-200/40 dark:border-purple-900/40">
                    "{shipment.last_caller_remark}"
                  </p>
                  <p className="text-[11px] text-neutral-500">Recorded on shipment record</p>
                </div>
              ) : (
                <p className="text-neutral-500 italic py-2">No call history recorded yet.</p>
              )}
            </div>

            {/* Supervisor History Card */}
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-300 font-bold">
                  <ShieldCheck className="h-4 w-4" /> Latest Supervisor Action
                </div>
                {supervisorLogs.length > 0 && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-800 dark:text-rose-200">
                    Action #{supervisorLogs.length}
                  </span>
                )}
              </div>
              {supervisorLogs.length > 0 ? (
                <div className="space-y-1.5 text-neutral-800 dark:text-neutral-200">
                  <p>
                    <span className="text-neutral-500">Action:</span>{' '}
                    <strong className="text-rose-800 dark:text-rose-300">{supervisorLogs[0].action_taken}</strong>
                  </p>
                  <p className="bg-white/60 dark:bg-neutral-950/40 p-2 rounded-xl text-neutral-700 dark:text-neutral-300 italic border border-rose-200/40 dark:border-rose-900/40">
                    "{supervisorLogs[0].supervisor_remarks || 'No remark entered'}"
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1">
                    <span>By: {supervisorLogs[0].supervisor_name || 'Supervisor'}</span>
                    <span>{new Date(supervisorLogs[0].created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                  </div>
                </div>
              ) : shipment.last_supervisor_remark ? (
                <div className="space-y-1.5 text-neutral-800 dark:text-neutral-200">
                  <p className="bg-white/60 dark:bg-neutral-950/40 p-2 rounded-xl text-neutral-700 dark:text-neutral-300 italic border border-rose-200/40 dark:border-rose-900/40">
                    "{shipment.last_supervisor_remark}"
                  </p>
                  <p className="text-[11px] text-neutral-500">Recorded on shipment record</p>
                </div>
              ) : (
                <p className="text-neutral-500 italic py-2">No supervisor action taken yet.</p>
              )}
            </div>
          </div>

          {/* Section 3: Vertical Audit Timeline */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                <History className="h-4 w-4 text-brand-600" /> Complete Lifecycle Timeline
              </h3>
              <span className="text-[11px] text-neutral-500 font-medium">
                {timeline.length} event{timeline.length === 1 ? '' : 's'}
              </span>
            </div>

            {loading ? (
              <div className="py-12 text-center text-neutral-500 text-xs flex flex-col items-center gap-2">
                <Clock className="h-5 w-5 animate-spin text-brand-600" />
                <span>Loading operational timeline...</span>
              </div>
            ) : timeline.length === 0 ? (
              <div className="py-10 text-center text-neutral-500 text-xs rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
                No timeline events recorded yet.
              </div>
            ) : (
              <div className="relative border-l-2 border-neutral-200 dark:border-neutral-800 ml-4 space-y-5">
                {timeline.map((event) => (
                  <div key={event.id} className="relative pl-6">
                    <div className="absolute -left-3 top-1 p-1 rounded-full bg-[var(--card-bg)] border-2 border-neutral-300 dark:border-neutral-700 shadow-sm">
                      {getEventIcon(event.event_type)}
                    </div>

                    <div className="p-4 rounded-2xl bg-neutral-50/70 dark:bg-neutral-900/40 border border-neutral-200/80 dark:border-neutral-800/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">{event.action_title}</h4>
                        <span className="text-[11px] text-neutral-400 font-mono">
                          {new Date(event.created_at).toLocaleString([], {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>

                      {event.remarks && (
                        <p className="text-xs text-neutral-700 dark:text-neutral-300 bg-white/60 dark:bg-neutral-950/40 p-2 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50">
                          {event.remarks}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-[11px] text-neutral-500 border-t border-neutral-200/50 dark:border-neutral-800/50 pt-2 mt-1">
                        <span>
                          By: <strong className="text-neutral-700 dark:text-neutral-300">{event.user_name || 'System'}</strong>{' '}
                          <span className="text-neutral-400">({event.user_role || 'user'})</span>
                        </span>
                        {event.new_status && (
                          <span className="flex items-center gap-1.5">
                            <span className="text-neutral-400">Status:</span>
                            <NDRStatusBadge status={event.new_status} size="sm" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
