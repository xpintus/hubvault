import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useHub } from '@/lib/hubContext';
import { fetchNDRShipments } from '@/lib/ndr/ndrService';
import { NDRShipment } from '@/types/ndr';
import { NDRCallModal } from '@/components/ndr/NDRCallModal';
import { AWBCopyButton } from '@/components/ndr/AWBCopyButton';
import { NDRStatusBadge } from '@/components/ndr/NDRStatusBadge';
import { NDRToast } from '@/components/ndr/NDRToast';
import { Filter, PhoneCall, RefreshCw, Sparkles, Truck } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';

export default function NDRCallingQueue() {
  const { selectedHub } = useHub();
  const { profile } = useAuth();
  const outletCtx = useOutletContext<{ refreshTrigger: number; handleImportSuccess?: () => void }>();
  const [shipments, setShipments] = useState<NDRShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedShipment, setSelectedShipment] = useState<NDRShipment | null>(null);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [attemptsFilter, setAttemptsFilter] = useState<string>('ALL');

  const loadQueue = async () => {
    setLoading(true);
    try {
      const { data } = await fetchNDRShipments({
        hubId: selectedHub?.id || undefined,
        workflowStatus: 'Calling Pending',
        attempts: attemptsFilter !== 'ALL' ? attemptsFilter : undefined,
        limit: 150,
      });

      // Operational Calling Priority Comparator:
      // 1. Fresh Shipments (Attempt 1) first
      // 2. Reattempt Shipments sorted by highest attempt count first
      const sorted = [...data].sort((a, b) => {
        const attA = a.total_attempts || 1;
        const attB = b.total_attempts || 1;

        const isFreshA = attA === 1;
        const isFreshB = attB === 1;

        if (isFreshA && !isFreshB) return -1;
        if (!isFreshA && isFreshB) return 1;

        // Both are reattempt (>= 2) or both are fresh (= 1): sort by highest attempt count DESC
        return attB - attA;
      });

      setShipments(sorted);
    } catch (err) {
      console.error('Failed calling queue load:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();

    const handleUpdate = () => {
      loadQueue();
    };

    window.addEventListener('ndr-data-updated', handleUpdate);
    return () => {
      window.removeEventListener('ndr-data-updated', handleUpdate);
    };
  }, [selectedHub, attemptsFilter, outletCtx?.refreshTrigger]);

  const handleCallSuccess = () => {
    setToastMsg('Call saved successfully. Sent to Supervisor.');
    if (selectedShipment) {
      setShipments((prev) => prev.filter((item) => item.id !== selectedShipment.id));
    }
    if (outletCtx?.handleImportSuccess) {
      outletCtx.handleImportSuccess();
    }
    loadQueue();
  };

  const getAttemptBadge = (attempts: number = 1) => {
    if (attempts <= 1) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1">
          <Sparkles className="h-3 w-3" /> Fresh (Attempt 1)
        </span>
      );
    }
    if (attempts === 2) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/30 inline-flex items-center gap-1">
          <Truck className="h-3 w-3" /> Reattempt (Attempt 2)
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30 inline-flex items-center gap-1">
        <Truck className="h-3 w-3" /> Reattempt (Attempt {attempts})
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <PhoneCall className="h-5 w-5 text-purple-600" /> Calling Queue
          </h2>
          <p className="text-xs text-neutral-500">
            Operational Priority: <strong className="text-emerald-600">Fresh Shipments (Attempt 1)</strong> display first, followed by Reattempts sorted by highest attempt count.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-neutral-50 dark:bg-neutral-900 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs">
            <Filter className="h-3.5 w-3.5 text-neutral-400" />
            <select
              value={attemptsFilter}
              onChange={(e) => setAttemptsFilter(e.target.value)}
              className="bg-transparent font-semibold text-neutral-800 dark:text-neutral-200 focus:outline-none"
            >
              <option value="ALL">All Pending Calls</option>
              <option value="fresh">Fresh Shipments (Attempt 1)</option>
              <option value="reattempt">Reattempt Pending (Attempt 2+)</option>
            </select>
          </div>

          <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            {shipments.length} Pending Calls
          </span>
        </div>
      </div>

      <div className="rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-neutral-500 flex flex-col items-center gap-2">
            <RefreshCw className="h-6 w-6 animate-spin text-purple-600" />
            <span className="text-xs">Loading Calling Queue...</span>
          </div>
        ) : shipments.length === 0 ? (
          <div className="py-16 text-center text-neutral-500 text-sm">No pending calling shipments in queue.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800">
                <tr>
                  <th className="px-4 py-3">AWB</th>
                  <th className="px-4 py-3">Type & Attempt</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Executive</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Updated Time</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {shipments.map((s) => (
                  <tr key={s.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/30">
                    <td className="px-4 py-3"><AWBCopyButton awb={s.awb_number} /></td>
                    <td className="px-4 py-3">{getAttemptBadge(s.total_attempts)}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-neutral-900 dark:text-neutral-100">{s.consignee_name || '-'}</p>
                      <p className="text-[11px] text-neutral-500">{s.client_name || '-'}</p>
                    </td>
                    <td className="px-4 py-3 font-medium">{s.delivery_executive || '-'}</td>
                    <td className="px-4 py-3 text-amber-600 dark:text-amber-400 font-medium">{s.original_ndr_reason || '-'}</td>
                    <td className="px-4 py-3">
                      <NDRStatusBadge status={s.ndr_workflow_status} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-neutral-500 font-mono">
                      {new Date(s.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          setSelectedShipment(s);
                          setCallModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-glow flex items-center gap-1.5 ml-auto"
                      >
                        <PhoneCall className="h-3.5 w-3.5" /> Call Customer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <NDRCallModal
        shipment={selectedShipment}
        isOpen={callModalOpen}
        onClose={() => setCallModalOpen(false)}
        onSuccess={handleCallSuccess}
      />

      <NDRToast message={toastMsg} onClose={() => setToastMsg(null)} />
    </div>
  );
}
