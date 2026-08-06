import React, { useEffect, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { useHub } from '@/lib/hubContext';
import { fetchNDRShipments } from '@/lib/ndr/ndrService';
import { exportNDRShipmentsToCSV, exportNDRShipmentsToExcel } from '@/lib/ndr/ndrExcel';
import { NDRFilterParams, NDRShipment, NDRWorkflowStatus } from '@/types/ndr';
import { NDRStatusBadge } from '@/components/ndr/NDRStatusBadge';
import { NDRTimelineDrawer } from '@/components/ndr/NDRTimelineDrawer';
import { NDRCallModal } from '@/components/ndr/NDRCallModal';
import { NDRSupervisorModal } from '@/components/ndr/NDRSupervisorModal';
import { NDRDeliveryModal } from '@/components/ndr/NDRDeliveryModal';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Filter,
  History,
  PhoneCall,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';

export default function NDRAllShipments() {
  const { selectedHub } = useHub();
  const { refreshTrigger } = useOutletContext<{ refreshTrigger: number }>();
  const [searchParams] = useSearchParams();

  const [shipments, setShipments] = useState<NDRShipment[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [search, setSearch] = useState('');
  const [workflowStatus, setWorkflowStatus] = useState<NDRWorkflowStatus | 'ALL'>(
    (searchParams.get('workflowStatus') as NDRWorkflowStatus) || 'ALL'
  );
  const [vendor, setVendor] = useState(searchParams.get('vendor') || 'ALL');
  const [executive, setExecutive] = useState(searchParams.get('executive') || 'ALL');
  const [reason, setReason] = useState(searchParams.get('reason') || 'ALL');
  const [page, setPage] = useState(1);

  // Active Modals & Drawers
  const [selectedShipment, setSelectedShipment] = useState<NDRShipment | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [supervisorModalOpen, setSupervisorModalOpen] = useState(false);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data, count } = await fetchNDRShipments({
        hubId: selectedHub?.id || undefined,

        search,
        workflowStatus,
        vendor: vendor !== 'ALL' ? vendor : undefined,
        executive: executive !== 'ALL' ? executive : undefined,
        reason: reason !== 'ALL' ? reason : undefined,
        page,
        limit: 25,
      });
      setShipments(data);
      setTotalCount(count);
    } catch (err) {
      console.error('Failed to load NDR shipments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedHub, search, workflowStatus, vendor, executive, reason, page, refreshTrigger]);


  const handleExportExcel = () => {
    exportNDRShipmentsToExcel(shipments, `ndr_shipments_export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportCSV = () => {
    exportNDRShipmentsToCSV(shipments, `ndr_shipments_export_${new Date().toISOString().split('T')[0]}.csv`);
  };

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="p-4 rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-1 items-center gap-3 w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by AWB, Consignee, Client, Executive, Pincode, DRS Code..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-medium text-neutral-900 dark:text-neutral-100 placeholder-neutral-400"
            />
          </div>

          <select
            value={workflowStatus}
            onChange={(e) => {
              setWorkflowStatus(e.target.value as any);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-800 dark:text-neutral-200"
          >
            <option value="ALL">All Workflow Statuses</option>
            <option value="UNDEL">UNDEL</option>
            <option value="Calling Pending">Calling Pending</option>
            <option value="Customer Contacted">Customer Contacted</option>
            <option value="Reattempt Required">Reattempt Required</option>
            <option value="Supervisor Review">Supervisor Review</option>
            <option value="Reattempt Approved">Reattempt Approved</option>
            <option value="Out For Delivery">Out For Delivery</option>
            <option value="Delivered">Delivered</option>
            <option value="RTO">RTO</option>
            <option value="Closed">Closed</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-semibold text-neutral-700 dark:text-neutral-300 transition flex items-center gap-1.5"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-semibold text-neutral-700 dark:text-neutral-300 transition flex items-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        </div>
      </div>

      {/* Main Shipments Data Table */}
      <div className="rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-neutral-500 flex flex-col items-center gap-2">
            <RefreshCw className="h-6 w-6 animate-spin text-brand-600" />
            <span className="text-xs">Loading NDR shipments...</span>
          </div>
        ) : shipments.length === 0 ? (
          <div className="py-16 text-center text-neutral-500 text-sm">No NDR shipments found matching criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800">
                <tr>
                  <th className="px-4 py-3">AWB / DRS</th>
                  <th className="px-4 py-3">Consignee & Client</th>
                  <th className="px-4 py-3">Executive & Vendor</th>
                  <th className="px-4 py-3">Original Reason</th>
                  <th className="px-4 py-3">Pincode</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {shipments.map((s) => (
                  <tr key={s.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/30 transition">
                    <td className="px-4 py-3">
                      <p className="font-mono font-bold text-neutral-900 dark:text-neutral-100">{s.awb_number}</p>
                      <p className="text-[11px] text-neutral-400 font-mono">{s.drs_code || '-'}</p>
                    </td>

                    <td className="px-4 py-3">
                      <p className="font-semibold text-neutral-900 dark:text-neutral-100">{s.consignee_name || '-'}</p>
                      <p className="text-[11px] text-neutral-500">{s.client_name || 'Client'}</p>
                    </td>

                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-800 dark:text-neutral-200">{s.delivery_executive || '-'}</p>
                      <p className="text-[11px] text-neutral-500">{s.partner_name || '-'}</p>
                    </td>

                    <td className="px-4 py-3 max-w-[200px] truncate text-amber-600 dark:text-amber-400 font-medium">
                      {s.original_ndr_reason || '-'}
                    </td>

                    <td className="px-4 py-3 font-mono text-neutral-700 dark:text-neutral-300 font-semibold">
                      {s.delivery_pincode || '-'}
                    </td>

                    <td className="px-4 py-3 font-bold text-neutral-900 dark:text-neutral-100">
                      ₹{s.amount_payable}
                    </td>

                    <td className="px-4 py-3">
                      <NDRStatusBadge status={s.ndr_workflow_status} size="sm" />
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedShipment(s);
                            setTimelineOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-neutral-500 hover:text-brand-600 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                          title="View Timeline History"
                        >
                          <History className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => {
                            setSelectedShipment(s);
                            setCallModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30"
                          title="Log Call Remarks"
                        >
                          <PhoneCall className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => {
                            setSelectedShipment(s);
                            setSupervisorModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30"
                          title="Supervisor Action"
                        >
                          <ShieldCheck className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => {
                            setSelectedShipment(s);
                            setDeliveryModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                          title="Mark Delivered After NDR"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="px-4 py-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-500">
          <span>Showing {shipments.length} of {totalCount} shipments</span>
          <div className="flex items-center gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">Page {page}</span>
            <button
              disabled={shipments.length < 25}
              onClick={() => setPage((p) => p + 1)}
              className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modals & Drawers */}
      <NDRTimelineDrawer
        shipment={selectedShipment}
        isOpen={timelineOpen}
        onClose={() => setTimelineOpen(false)}
      />

      <NDRCallModal
        shipment={selectedShipment}
        isOpen={callModalOpen}
        onClose={() => setCallModalOpen(false)}
        onSuccess={loadData}
      />

      <NDRSupervisorModal
        shipment={selectedShipment}
        isOpen={supervisorModalOpen}
        onClose={() => setSupervisorModalOpen(false)}
        onSuccess={loadData}
      />

      <NDRDeliveryModal
        shipment={selectedShipment}
        isOpen={deliveryModalOpen}
        onClose={() => setDeliveryModalOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
}
