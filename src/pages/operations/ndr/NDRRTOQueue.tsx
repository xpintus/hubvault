import React, { useEffect, useState } from 'react';
import { useHub } from '@/lib/hubContext';
import { fetchNDRShipments } from '@/lib/ndr/ndrService';
import { NDRShipment } from '@/types/ndr';
import { NDRTimelineDrawer } from '@/components/ndr/NDRTimelineDrawer';
import { AWBCopyButton } from '@/components/ndr/AWBCopyButton';
import { History, RefreshCw, RotateCcw } from 'lucide-react';

export default function NDRRTOQueue() {
  const { selectedHub } = useHub();
  const [shipments, setShipments] = useState<NDRShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedShipment, setSelectedShipment] = useState<NDRShipment | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);

  const loadRTO = async () => {
    setLoading(true);
    try {
      const { data } = await fetchNDRShipments({
        hubId: selectedHub?.id || undefined,

        deliveryStatus: 'RTO',
        limit: 100,
      });
      setShipments(data);
    } catch (err) {
      console.error('Failed to load RTO queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRTO();
  }, [selectedHub]);


  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-red-600" /> RTO (Return to Origin) Queue
          </h2>
          <p className="text-xs text-neutral-500">Shipments approved for return to origin post supervisor audit & customer verification.</p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
          {shipments.length} Approved RTOs
        </span>
      </div>

      <div className="rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-neutral-500 flex flex-col items-center gap-2">
            <RefreshCw className="h-6 w-6 animate-spin text-red-600" />
            <span className="text-xs">Loading RTO shipments...</span>
          </div>
        ) : shipments.length === 0 ? (
          <div className="py-16 text-center text-neutral-500 text-sm">No RTO shipments recorded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800">
                <tr>
                  <th className="px-4 py-3">AWB</th>
                  <th className="px-4 py-3">Consignee</th>
                  <th className="px-4 py-3">RTO Reason</th>
                  <th className="px-4 py-3">Executive</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">RTO Date</th>
                  <th className="px-4 py-3">Timeline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {shipments.map((s) => (
                  <tr key={s.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/30">
                    <td className="px-4 py-3"><AWBCopyButton awb={s.awb_number} /></td>
                    <td className="px-4 py-3 font-semibold">{s.consignee_name || '-'}</td>
                    <td className="px-4 py-3 font-bold text-red-600 dark:text-red-400">{s.rto_reason || s.original_ndr_reason || '-'}</td>
                    <td className="px-4 py-3 font-medium">{s.delivery_executive || '-'}</td>
                    <td className="px-4 py-3 font-bold">₹{s.amount_payable}</td>
                    <td className="px-4 py-3 text-neutral-500">
                      {s.rto_date ? new Date(s.rto_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          setSelectedShipment(s);
                          setTimelineOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-medium flex items-center gap-1"
                      >
                        <History className="h-3.5 w-3.5" /> Timeline
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <NDRTimelineDrawer
        shipment={selectedShipment}
        isOpen={timelineOpen}
        onClose={() => setTimelineOpen(false)}
      />
    </div>
  );
}
