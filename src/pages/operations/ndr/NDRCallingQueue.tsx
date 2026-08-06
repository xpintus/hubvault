import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useHub } from '@/lib/hubContext';
import { fetchNDRShipments } from '@/lib/ndr/ndrService';
import { NDRShipment } from '@/types/ndr';
import { NDRCallModal } from '@/components/ndr/NDRCallModal';
import { NDRStatusBadge } from '@/components/ndr/NDRStatusBadge';
import { PhoneCall, RefreshCw } from 'lucide-react';

export default function NDRCallingQueue() {
  const { selectedHub } = useHub();
  const { profile } = useAuth();
  const [shipments, setShipments] = useState<NDRShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedShipment, setSelectedShipment] = useState<NDRShipment | null>(null);
  const [callModalOpen, setCallModalOpen] = useState(false);

  const loadQueue = async () => {
    setLoading(true);
    try {
      // Calling Queue holds UNDEL & Calling Pending shipments
      const { data } = await fetchNDRShipments({
        hubId: selectedHub?.id || undefined,
        workflowStatus: 'Calling Pending',
        limit: 100,
      });
      setShipments(data);

    } catch (err) {
      console.error('Failed calling queue load:', err);
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
            <PhoneCall className="h-5 w-5 text-purple-600" /> My Calling Queue
          </h2>
          <p className="text-xs text-neutral-500">Contact customers to verify refusal reasons, capture delivery requests, or alternate numbers.</p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
          {shipments.length} Pending Calls
        </span>
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
                  <th className="px-4 py-3">Consignee & Phone</th>
                  <th className="px-4 py-3">Executive</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Pincode</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {shipments.map((s) => (
                  <tr key={s.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/30">
                    <td className="px-4 py-3 font-mono font-bold text-neutral-900 dark:text-neutral-100">{s.awb_number}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-neutral-900 dark:text-neutral-100">{s.consignee_name || '-'}</p>
                      <p className="text-[11px] text-neutral-500">{s.client_name || '-'}</p>
                    </td>
                    <td className="px-4 py-3 font-medium">{s.delivery_executive || '-'}</td>
                    <td className="px-4 py-3 text-amber-600 dark:text-amber-400 font-medium">{s.original_ndr_reason || '-'}</td>
                    <td className="px-4 py-3 font-mono">{s.delivery_pincode || '-'}</td>
                    <td className="px-4 py-3 font-bold">₹{s.amount_payable}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          setSelectedShipment(s);
                          setCallModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-glow flex items-center gap-1.5"
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
        onSuccess={loadQueue}
      />
    </div>
  );
}
