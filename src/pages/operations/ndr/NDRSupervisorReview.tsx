import React, { useEffect, useState } from 'react';
import { useHub } from '@/lib/hubContext';
import { fetchNDRShipments } from '@/lib/ndr/ndrService';
import { NDRShipment } from '@/types/ndr';
import { NDRSupervisorModal } from '@/components/ndr/NDRSupervisorModal';
import { RefreshCw, ShieldCheck } from 'lucide-react';

export default function NDRSupervisorReview() {
  const { selectedHub } = useHub();
  const [shipments, setShipments] = useState<NDRShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedShipment, setSelectedShipment] = useState<NDRShipment | null>(null);
  const [supervisorModalOpen, setSupervisorModalOpen] = useState(false);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const { data } = await fetchNDRShipments({
        hubId: selectedHub?.id || undefined,

        workflowStatus: 'Supervisor Review',
        limit: 100,
      });
      setShipments(data);
    } catch (err) {
      console.error('Failed to load supervisor queue:', err);
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
            <ShieldCheck className="h-5 w-5 text-rose-600" /> Supervisor Review Queue
          </h2>
          <p className="text-xs text-neutral-500">Verify customer responses, audit fake attempt claims, flag OTP issues, and approve reattempt/RTO.</p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
          {shipments.length} Requires Review
        </span>
      </div>

      <div className="rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-neutral-500 flex flex-col items-center gap-2">
            <RefreshCw className="h-6 w-6 animate-spin text-rose-600" />
            <span className="text-xs">Loading supervisor review queue...</span>
          </div>
        ) : shipments.length === 0 ? (
          <div className="py-16 text-center text-neutral-500 text-sm">No NDR shipments currently requiring supervisor review.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800">
                <tr>
                  <th className="px-4 py-3">AWB</th>
                  <th className="px-4 py-3">Consignee</th>
                  <th className="px-4 py-3">Executive</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {shipments.map((s) => (
                  <tr key={s.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/30">
                    <td className="px-4 py-3 font-mono font-bold text-neutral-900 dark:text-neutral-100">{s.awb_number}</td>
                    <td className="px-4 py-3 font-semibold">{s.consignee_name || '-'}</td>
                    <td className="px-4 py-3 font-medium text-rose-600 dark:text-rose-400">{s.delivery_executive || '-'}</td>
                    <td className="px-4 py-3">{s.partner_name || '-'}</td>
                    <td className="px-4 py-3 text-amber-600 font-medium">{s.original_ndr_reason || '-'}</td>
                    <td className="px-4 py-3 font-bold">₹{s.amount_payable}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          setSelectedShipment(s);
                          setSupervisorModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-glow flex items-center gap-1.5"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" /> Review & Action
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <NDRSupervisorModal
        shipment={selectedShipment}
        isOpen={supervisorModalOpen}
        onClose={() => setSupervisorModalOpen(false)}
        onSuccess={loadQueue}
      />
    </div>
  );
}
