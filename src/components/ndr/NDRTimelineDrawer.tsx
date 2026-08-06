import React, { useEffect, useState } from 'react';
import { fetchNDRTimeline } from '@/lib/ndr/ndrService';
import { NDRShipment, NDRTimelineLog } from '@/types/ndr';
import { NDRStatusBadge } from './NDRStatusBadge';
import { CheckCircle2, Clock, History, PhoneCall, ShieldCheck, Truck, X, XCircle } from 'lucide-react';

interface NDRTimelineDrawerProps {
  shipment: NDRShipment | null;
  isOpen: boolean;
  onClose: () => void;
}

export const NDRTimelineDrawer: React.FC<NDRTimelineDrawerProps> = ({ shipment, isOpen, onClose }) => {
  const [timeline, setTimeline] = useState<NDRTimelineLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (shipment && isOpen) {
      setLoading(true);
      fetchNDRTimeline(shipment.id)
        .then(setTimeline)
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
      <div className="w-full max-w-xl bg-[var(--card-bg)] border-l border-neutral-200 dark:border-neutral-800 h-full flex flex-col shadow-2xl">
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Shipment Timeline</h2>
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

        {/* Shipment Overview Card */}
        <div className="p-4 mx-6 mt-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-neutral-500 block">Consignee</span>
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">{shipment.consignee_name || '-'}</span>
          </div>
          <div>
            <span className="text-neutral-500 block">Client / Vendor</span>
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">
              {shipment.client_name || '-'} ({shipment.partner_name || '-'})
            </span>
          </div>
          <div>
            <span className="text-neutral-500 block">Original NDR Reason</span>
            <span className="font-medium text-amber-600 dark:text-amber-400">{shipment.original_ndr_reason || '-'}</span>
          </div>
          <div>
            <span className="text-neutral-500 block">NDR Cycle</span>
            <span className="font-bold text-brand-600 dark:text-brand-400">Cycle #{shipment.ndr_cycle}</span>
          </div>
        </div>

        {/* Timeline Events List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="py-12 text-center text-neutral-500 text-sm">Loading audit timeline...</div>
          ) : timeline.length === 0 ? (
            <div className="py-12 text-center text-neutral-500 text-sm">No timeline logs found.</div>
          ) : (
            <div className="relative border-l-2 border-neutral-200 dark:border-neutral-800 ml-4 space-y-6">
              {timeline.map((event) => (
                <div key={event.id} className="relative pl-6">
                  {/* Event Marker Node */}
                  <div className="absolute -left-3 top-1 p-1 rounded-full bg-[var(--card-bg)] border-2 border-neutral-300 dark:border-neutral-700 shadow-sm">
                    {getEventIcon(event.event_type)}
                  </div>

                  {/* Event Content */}
                  <div className="p-4 rounded-xl bg-neutral-50/50 dark:bg-neutral-900/30 border border-neutral-200/80 dark:border-neutral-800/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">{event.action_title}</h4>
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
  );
};
