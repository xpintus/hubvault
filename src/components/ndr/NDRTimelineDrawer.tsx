import React, { useEffect, useState } from 'react';
import { fetchNDRCallLogs, fetchNDRSupervisorActions, fetchNDRTimeline } from '@/lib/ndr/ndrService';
import { NDRCallLog, NDRShipment, NDRSupervisorAction, NDRTimelineLog } from '@/types/ndr';
import { NDRStatusBadge } from './NDRStatusBadge';
import { CheckCircle2, Clock, History, PhoneCall, ShieldCheck, Truck, X, XCircle } from 'lucide-react';

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

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-sm animate-fade-in flex justify-end">
      <div className="w-full max-w-2xl bg-[var(--card-bg)] border-l border-neutral-200 dark:border-neutral-800 h-full flex flex-col shadow-2xl overflow-y-auto">
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 sticky top-0 bg-[var(--card-bg)] z-10">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Shipment Operational View</h2>
              <NDRStatusBadge status={shipment.ndr_workflow_status} size="sm" />
            </div>
            <p className="text-xs text-neutral-500 font-mono mt-0.5">AWB: {shipment.awb_number}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 flex-1">
          {/* Section 1: Shipment & Customer Details */}
          <div className="p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-4">
            <h3 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider">
              Shipment & Customer Details
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-neutral-500 block">AWB Number</span>
                <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">{shipment.awb_number}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Consignee</span>
                <span className="font-bold text-neutral-900 dark:text-neutral-100">{shipment.consignee_name || '-'}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Delivery Executive</span>
                <span className="font-semibold text-neutral-800 dark:text-neutral-200">{shipment.delivery_executive || '-'}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Vendor / Partner</span>
                <span className="font-medium text-neutral-700 dark:text-neutral-300">{shipment.partner_name || '-'}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Pincode / Location</span>
                <span className="font-mono font-semibold">{shipment.delivery_pincode || '-'} ({shipment.city || '-'})</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Amount Payable</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{shipment.amount_payable} ({shipment.payment_type})</span>
              </div>
              <div>
                <span className="text-neutral-500 block">Original Reason</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">{shipment.original_ndr_reason || '-'}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">OTP Status</span>
                <span className="font-semibold text-neutral-800 dark:text-neutral-200">{shipment.otp_status || '-'}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">NDR Cycle</span>
                <span className="font-bold text-brand-600 dark:text-brand-400">Cycle #{shipment.ndr_cycle}</span>
              </div>
            </div>

            {/* Audit Tracking Block */}
            <div className="pt-3 border-t border-neutral-200/60 dark:border-neutral-800/60 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
              <div>
                <span className="text-neutral-400 block">Created Time</span>
                <span className="font-mono text-neutral-700 dark:text-neutral-300">
                  {new Date(shipment.created_at).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-neutral-400 block">Last Updated Time</span>
                <span className="font-mono text-neutral-700 dark:text-neutral-300">
                  {new Date(shipment.updated_at).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-neutral-400 block">Current Status</span>
                <span className="font-bold text-neutral-800 dark:text-neutral-200">
                  {shipment.ndr_workflow_status}
                </span>
              </div>
              <div>
                <span className="text-neutral-400 block">Live Shipment Status</span>
                <span className="font-bold text-neutral-800 dark:text-neutral-200">
                  {shipment.shipment_status_current}
                </span>
              </div>
            </div>
          </div>


          {/* Section 2: Latest Call & Supervisor Logs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Call History Card */}
            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 space-y-2">
              <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 font-bold">
                <PhoneCall className="h-4 w-4" /> Latest Call Log
              </div>
              {callLogs.length > 0 ? (
                <div className="space-y-1 text-neutral-800 dark:text-neutral-200">
                  <p><strong>Result:</strong> {callLogs[0].caller_result}</p>
                  <p><strong>Remark:</strong> {callLogs[0].caller_remarks || 'No remark entered'}</p>
                  <p className="text-[11px] text-neutral-500">{new Date(callLogs[0].created_at).toLocaleString()}</p>
                </div>
              ) : (
                <p className="text-neutral-500 italic">No call history recorded yet.</p>
              )}
            </div>

            {/* Supervisor History Card */}
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-2">
              <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-bold">
                <ShieldCheck className="h-4 w-4" /> Latest Supervisor Action
              </div>
              {supervisorLogs.length > 0 ? (
                <div className="space-y-1 text-neutral-800 dark:text-neutral-200">
                  <p><strong>Action:</strong> {supervisorLogs[0].action_taken}</p>
                  <p><strong>Remark:</strong> {supervisorLogs[0].supervisor_remarks || 'No remark entered'}</p>
                  <p className="text-[11px] text-neutral-500">{new Date(supervisorLogs[0].created_at).toLocaleString()}</p>
                </div>
              ) : (
                <p className="text-neutral-500 italic">No supervisor action taken yet.</p>
              )}
            </div>
          </div>

          {/* Section 3: Vertical Audit Timeline */}
          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider">
              Complete Lifecycle Timeline
            </h3>

            {loading ? (
              <div className="py-8 text-center text-neutral-500 text-sm">Loading timeline history...</div>
            ) : timeline.length === 0 ? (
              <div className="py-8 text-center text-neutral-500 text-sm">No timeline entries found.</div>
            ) : (
              <div className="relative border-l-2 border-neutral-200 dark:border-neutral-800 ml-4 space-y-5">
                {timeline.map((event) => (
                  <div key={event.id} className="relative pl-6">
                    <div className="absolute -left-3 top-1 p-1 rounded-full bg-[var(--card-bg)] border-2 border-neutral-300 dark:border-neutral-700 shadow-sm">
                      {getEventIcon(event.event_type)}
                    </div>

                    <div className="p-4 rounded-xl bg-neutral-50/50 dark:bg-neutral-900/30 border border-neutral-200/80 dark:border-neutral-800/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">{event.action_title}</h4>
                        <span className="text-[11px] text-neutral-400">
                          {new Date(event.created_at).toLocaleString([], {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>

                      {event.remarks && <p className="text-xs text-neutral-700 dark:text-neutral-300">{event.remarks}</p>}

                      <div className="flex items-center justify-between text-[11px] text-neutral-500 border-t border-neutral-200/50 dark:border-neutral-800/50 pt-2 mt-1">
                        <span>
                          By: <strong className="text-neutral-700 dark:text-neutral-300">{event.user_name || 'System'}</strong> ({event.user_role || 'user'})
                        </span>
                        {event.new_status && (
                          <span>
                            Status → <NDRStatusBadge status={event.new_status} size="sm" />
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
    </div>
  );
};
