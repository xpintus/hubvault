import React, { useEffect, useState } from 'react';
import { useHub } from '@/lib/hubContext';
import { fetchNDRShipments } from '@/lib/ndr/ndrService';
import { NDRShipment } from '@/types/ndr';
import { NDRDeliveryModal } from '@/components/ndr/NDRDeliveryModal';
import { AWBCopyButton } from '@/components/ndr/AWBCopyButton';
import { CheckCircle2, RefreshCw, Truck } from 'lucide-react';

export default function NDRReattemptQueue() {
  const { selectedHub } = useHub();
  const [shipments, setShipments] = useState<NDRShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedShipment, setSelectedShipment] = useState<NDRShipment | null>(null);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const { data } = await fetchNDRShipments({
        hubId: selectedHub?.id || undefined,

        limit: 100,
      });
      const reattemptItems = data.filter(
        (s) => s.ndr_workflow_status === 'Follow-up'
      );

      setShipments(reattemptItems);
    } catch (err) {
      console.error('Failed to load reattempt queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, [selectedHub]);


  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Truck className="h-5 w-5 text-indigo-600" /> Reattempt Queue
          </h2>
          <p className="text-xs text-neutral-500">Approved reattempts dispatched or out for delivery with executive assignments.</p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
          {shipments.length} Reattempts Out
        </span>
      </div>

      <div className="rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-neutral-500 flex flex-col items-center gap-2">
            <RefreshCw className="h-6 w-6 animate-spin text-indigo-600" />
            <span className="text-xs">Loading reattempt queue...</span>
          </div>
        ) : shipments.length === 0 ? (
          <div className="py-16 text-center text-neutral-500 text-sm">No reattempt shipments currently out.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800">
                <tr>
                  <th className="px-4 py-3">AWB</th>
                  <th className="px-4 py-3">Consignee</th>
                  <th className="px-4 py-3">Assigned Executive</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {shipments.map((s) => (
                  <tr key={s.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/30">
                    <td className="px-4 py-3"><AWBCopyButton awb={s.awb_number} /></td>
                    <td className="px-4 py-3 font-semibold">{s.consignee_name || '-'}</td>
                    <td className="px-4 py-3 font-medium text-indigo-600 dark:text-indigo-400">{s.delivery_executive || '-'}</td>
                    <td className="px-4 py-3 font-bold">₹{s.amount_payable}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          setSelectedShipment(s);
                          setDeliveryModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-glow flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Mark Delivered
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <NDRDeliveryModal
        shipment={selectedShipment}
        isOpen={deliveryModalOpen}
        onClose={() => setDeliveryModalOpen(false)}
        onSuccess={loadQueue}
      />
    </div>
  );
}
