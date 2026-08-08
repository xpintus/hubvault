import React, { useEffect, useState } from 'react';
import { useHub } from '@/lib/hubContext';
import { fetchNDRShipments } from '@/lib/ndr/ndrService';
import { NDRShipment } from '@/types/ndr';
import { NDRTimelineDrawer } from '@/components/ndr/NDRTimelineDrawer';
import { AWBCopyButton } from '@/components/ndr/AWBCopyButton';
import { CheckCircle2, History, RefreshCw } from 'lucide-react';

export default function NDRDeliveredAfterNDR() {
  const { selectedHub } = useHub();
  const [shipments, setShipments] = useState<NDRShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedShipment, setSelectedShipment] = useState<NDRShipment | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);

  const loadDelivered = async () => {
    setLoading(true);
    try {
      const { data } = await fetchNDRShipments({
        hubId: selectedHub?.id || undefined,

        deliveryStatus: 'DEL',
        limit: 100,
      });
      setShipments(data);
    } catch (err) {
      console.error('Failed to load delivered shipments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDelivered();
  }, [selectedHub]);


  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Delivered After NDR Calling
          </h2>
          <p className="text-xs text-neutral-500">Successfully converted undelivered shipments with POD references and verified COD collections.</p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          {shipments.length} Converted & Delivered
        </span>
      </div>

      <div className="rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-neutral-500 flex flex-col items-center gap-2">
            <RefreshCw className="h-6 w-6 animate-spin text-emerald-600" />
            <span className="text-xs">Loading delivered NDR shipments...</span>
          </div>
        ) : shipments.length === 0 ? (
          <div className="py-16 text-center text-neutral-500 text-sm">No delivered NDR shipments recorded.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800">
                <tr>
                  <th className="px-4 py-3">AWB</th>
                  <th className="px-4 py-3">Consignee</th>
                  <th className="px-4 py-3">POD Reference</th>
                  <th className="px-4 py-3">Delivered By</th>
                  <th className="px-4 py-3">COD Collected</th>
                  <th className="px-4 py-3">Delivered Date</th>
                  <th className="px-4 py-3">Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {shipments.map((s) => (
                  <tr key={s.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/30">
                    <td className="px-4 py-3"><AWBCopyButton awb={s.awb_number} /></td>
                    <td className="px-4 py-3 font-semibold">{s.consignee_name || '-'}</td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">{s.pod_reference || '-'}</td>
                    <td className="px-4 py-3 font-medium">{s.delivered_user || s.delivery_executive || '-'}</td>
                    <td className="px-4 py-3 font-bold">₹{s.cod_collected_amount ?? s.amount_payable}</td>
                    <td className="px-4 py-3 text-neutral-500">
                      {s.delivered_date ? new Date(s.delivered_date).toLocaleDateString() : '-'}
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
