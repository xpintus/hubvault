import React, { useEffect, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { useHub } from '@/lib/hubContext';
import { fetchNDRShipments } from '@/lib/ndr/ndrService';
import { exportNDRShipmentsToCSV, exportNDRShipmentsToExcel } from '@/lib/ndr/ndrExcel';
import { NDR_WORKFLOW_STATUS } from '@/lib/ndr/ndrConstants';
import { NDRFilterParams, NDRShipment, NDRWorkflowStatus } from '@/types/ndr';

import { NDRStatusBadge } from '@/components/ndr/NDRStatusBadge';
import { AWBCopyButton } from '@/components/ndr/AWBCopyButton';
import { NDRTimelineDrawer } from '@/components/ndr/NDRTimelineDrawer';
import { NDRSupervisorModal } from '@/components/ndr/NDRSupervisorModal';
import { NDRToast } from '@/components/ndr/NDRToast';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Filter,
  History,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';

export default function NDRAllShipments() {
  const { selectedHub } = useHub();
  const outletCtx = useOutletContext<{ refreshTrigger: number; handleImportSuccess?: () => void }>();
  const [searchParams] = useSearchParams();

  const [shipments, setShipments] = useState<NDRShipment[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Filters State
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [workflowStatus, setWorkflowStatus] = useState<NDRWorkflowStatus | 'ALL'>(
    (searchParams.get('workflowStatus') as NDRWorkflowStatus) || 'ALL'
  );
  const [attempts, setAttempts] = useState<string>(searchParams.get('attempts') || 'ALL');
  const [vendor, setVendor] = useState(searchParams.get('vendor') || 'ALL');
  const [executive, setExecutive] = useState(searchParams.get('executive') || 'ALL');
  const [reason, setReason] = useState(searchParams.get('reason') || 'ALL');
  const [otpStatus, setOtpStatus] = useState(searchParams.get('otpStatus') || 'ALL');
  const [aging, setAging] = useState<number | undefined>(
    searchParams.get('aging') ? Number(searchParams.get('aging')) : undefined
  );
  const [isToday, setIsToday] = useState<boolean>(searchParams.get('isToday') === 'true');
  const [page, setPage] = useState(1);

  // Sync state when URL searchParams change
  useEffect(() => {
    setWorkflowStatus((searchParams.get('workflowStatus') as NDRWorkflowStatus) || 'ALL');
    setAttempts(searchParams.get('attempts') || 'ALL');
    setIsToday(searchParams.get('isToday') === 'true');
    setVendor(searchParams.get('vendor') || 'ALL');
    setExecutive(searchParams.get('executive') || 'ALL');
    setReason(searchParams.get('reason') || 'ALL');
    setOtpStatus(searchParams.get('otpStatus') || 'ALL');
    setAging(searchParams.get('aging') ? Number(searchParams.get('aging')) : undefined);
    if (searchParams.get('search')) setSearch(searchParams.get('search') || '');
    setPage(1);
  }, [searchParams]);

  // Active Modals & Drawers
  const [selectedShipment, setSelectedShipment] = useState<NDRShipment | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [supervisorModalOpen, setSupervisorModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data, count } = await fetchNDRShipments({
        hubId: selectedHub?.id || undefined,
        search,
        workflowStatus,
        attempts: attempts !== 'ALL' ? attempts : undefined,
        isToday,
        vendor: vendor !== 'ALL' ? vendor : undefined,
        executive: executive !== 'ALL' ? executive : undefined,
        reason: reason !== 'ALL' ? reason : undefined,
        otpStatus: otpStatus !== 'ALL' ? otpStatus : undefined,
        aging,
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

    const handleUpdate = () => {
      loadData();
    };

    window.addEventListener('ndr-data-updated', handleUpdate);
    return () => {
      window.removeEventListener('ndr-data-updated', handleUpdate);
    };
  }, [selectedHub, search, workflowStatus, attempts, isToday, vendor, executive, reason, otpStatus, aging, page, outletCtx?.refreshTrigger]);



  const handleSupervisorSuccess = () => {
    setToastMsg('Supervisor action submitted successfully.');
    if (outletCtx?.handleImportSuccess) outletCtx.handleImportSuccess();
    loadData();
  };

  const handleExportExcel = () => {
    exportNDRShipmentsToExcel(shipments, `ndr_shipments_export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportCSV = () => {
    exportNDRShipmentsToCSV(shipments, `ndr_shipments_export_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const hasActiveFilters =
    workflowStatus !== 'ALL' ||
    reason !== 'ALL' ||
    otpStatus !== 'ALL' ||
    vendor !== 'ALL' ||
    executive !== 'ALL' ||
    aging !== undefined ||
    search.trim() !== '';

  const clearFilter = (key: string) => {
    if (key === 'workflowStatus') setWorkflowStatus('ALL');
    if (key === 'reason') setReason('ALL');
    if (key === 'otpStatus') setOtpStatus('ALL');
    if (key === 'vendor') setVendor('ALL');
    if (key === 'executive') setExecutive('ALL');
    if (key === 'aging') setAging(undefined);
    if (key === 'search') setSearch('');
    setPage(1);
  };

  const clearAllFilters = () => {
    setWorkflowStatus('ALL');
    setReason('ALL');
    setOtpStatus('ALL');
    setVendor('ALL');
    setExecutive('ALL');
    setAging(undefined);
    setSearch('');
    setPage(1);
  };

  return (
    <div className="space-y-4 rounded-[28px] border border-neutral-200/70 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 p-4 shadow-sm dark:border-neutral-800 dark:from-neutral-950 dark:via-neutral-950 dark:to-indigo-950/20 sm:p-5">
      {/* Active Filters Pill Banner */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-brand-200 bg-brand-50/70 px-4 py-3 text-xs dark:border-brand-800/40 dark:bg-brand-900/20">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-brand-700 dark:text-brand-300 flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5" /> Active Filters:
            </span>
            {workflowStatus !== 'ALL' && (
              <span className="px-2.5 py-1 rounded-lg bg-brand-100 dark:bg-brand-800 text-brand-800 dark:text-brand-200 font-semibold flex items-center gap-1">
                Status: {workflowStatus}
                <button onClick={() => clearFilter('workflowStatus')} className="hover:text-rose-500 font-bold ml-1">✕</button>
              </span>
            )}
            {reason !== 'ALL' && (
              <span className="px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 font-semibold flex items-center gap-1">
                Reason Filter: {reason}
                <button onClick={() => clearFilter('reason')} className="hover:text-rose-500 font-bold ml-1">✕</button>
              </span>
            )}
            {otpStatus !== 'ALL' && (
              <span className="px-2.5 py-1 rounded-lg bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 font-semibold flex items-center gap-1">
                OTP Status: {otpStatus}
                <button onClick={() => clearFilter('otpStatus')} className="hover:text-rose-500 font-bold ml-1">✕</button>
              </span>
            )}
            {aging && (
              <span className="px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200 font-semibold flex items-center gap-1">
                Aging &gt; {aging} Hours
                <button onClick={() => clearFilter('aging')} className="hover:text-rose-500 font-bold ml-1">✕</button>
              </span>
            )}
            {search.trim() && (
              <span className="px-2.5 py-1 rounded-lg bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 font-semibold flex items-center gap-1">
                Search: "{search}"
                <button onClick={() => clearFilter('search')} className="hover:text-rose-500 font-bold ml-1">✕</button>
              </span>
            )}
          </div>
          <button
            onClick={clearAllFilters}
            className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 font-bold transition"
          >
            Clear All
          </button>
        </div>
      )}

      {/* Top Filter Bar */}
      <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-neutral-200/80 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 md:flex-row sm:p-4">
        <div className="flex w-full flex-1 flex-col items-stretch gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by AWB, Customer, Phone, Executive, Vendor, Client..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2.5 pl-10 pr-4 text-xs font-medium text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-500/10 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
            />
          </div>

          <select
            value={workflowStatus}
            onChange={(e) => {
              setWorkflowStatus(e.target.value as any);
              setPage(1);
            }}
            className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs font-semibold text-neutral-800 outline-none focus:border-brand-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200"
          >
            <option value="ALL">All Statuses</option>
            <option value={NDR_WORKFLOW_STATUS.CALLING_PENDING}>Calling Pending</option>
            <option value={NDR_WORKFLOW_STATUS.SUPERVISOR_PENDING}>Supervisor Pending</option>
            <option value={NDR_WORKFLOW_STATUS.FOLLOW_UP}>Follow-up</option>
            <option value={NDR_WORKFLOW_STATUS.DELIVERED}>Delivered</option>
            <option value={NDR_WORKFLOW_STATUS.RTO}>RTO</option>
            <option value={NDR_WORKFLOW_STATUS.CLOSED}>Closed</option>
          </select>

          <select
            value={attempts}
            onChange={(e) => {
              setAttempts(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs font-semibold text-neutral-800 outline-none focus:border-brand-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200"
          >
            <option value="ALL">All Shipments</option>
            <option value="fresh">Fresh (Attempt 1)</option>
            <option value="reattempt">Reattempt Pending (Attempt 2+)</option>
            <option value="3+">Attempt 3+</option>
          </select>
        </div>

        <div className="flex w-full items-center gap-2 md:w-auto">
          <button
            onClick={handleExportExcel}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 md:flex-none"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
          </button>
          <button
            onClick={handleExportCSV}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs font-bold text-blue-700 transition hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300 md:flex-none"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
        </div>
      </div>

      {/* Main Shipments Data Table */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
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
              <thead className="border-b border-neutral-200 bg-slate-100/80 font-bold uppercase tracking-wider text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950/70">
                <tr>
                  <th className="px-4 py-3">AWB</th>
                  <th className="px-4 py-3">Attempt & Type</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Executive</th>
                  <th className="px-4 py-3">Original Reason</th>
                  <th className="px-4 py-3">Workflow Status</th>
                  <th className="px-4 py-3">Shipment Status</th>
                  <th className="px-4 py-3">Latest Caller Remark</th>
                  <th className="px-4 py-3">Latest Supervisor Remark</th>
                  <th className="px-4 py-3">Updated Time</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {shipments.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => {
                      setSelectedShipment(s);
                      setTimelineOpen(true);
                    }}
                    className="cursor-pointer transition hover:bg-indigo-50/60 dark:hover:bg-indigo-950/20"
                  >
                    <td className="px-4 py-3"><AWBCopyButton awb={s.awb_number} /></td>

                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                        (s.total_attempts || 1) <= 1
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                          : (s.total_attempts === 2)
                          ? 'bg-orange-500/10 text-orange-600 border-orange-500/20'
                          : 'bg-red-500/10 text-red-600 border-red-500/20'
                      }`}>
                        {(s.total_attempts || 1) <= 1 ? 'Fresh (Attempt 1)' : `Reattempt (Attempt ${s.total_attempts})`}
                      </span>
                    </td>



                    <td className="px-4 py-3">
                      <p className="font-semibold text-neutral-900 dark:text-neutral-100">{s.consignee_name || '-'}</p>
                      <p className="text-[11px] text-neutral-500">{s.client_name || 'Client'}</p>
                    </td>

                    <td className="px-4 py-3">
                      <p className="font-medium text-neutral-800 dark:text-neutral-200">{s.delivery_executive || '-'}</p>
                      <p className="text-[11px] text-neutral-500">{s.partner_name || '-'}</p>
                    </td>

                    <td className="px-4 py-3 max-w-[180px] truncate text-amber-600 dark:text-amber-400 font-medium">
                      {s.original_ndr_reason || '-'}
                    </td>

                    <td className="px-4 py-3">
                      <NDRStatusBadge status={s.ndr_workflow_status} size="sm" />
                    </td>

                    <td className="px-4 py-3 font-bold text-neutral-800 dark:text-neutral-200">
                      {s.shipment_status_current}
                    </td>

                    <td className="px-4 py-3 max-w-[180px] truncate text-neutral-700 dark:text-neutral-300">
                      {s.last_caller_remark || <span className="text-neutral-400 italic">No call remark</span>}
                    </td>

                    <td className="px-4 py-3 max-w-[180px] truncate text-neutral-700 dark:text-neutral-300">
                      {s.last_supervisor_remark || <span className="text-neutral-400 italic">No supervisor remark</span>}
                    </td>

                    <td className="px-4 py-3 text-neutral-500 font-mono">
                      {new Date(s.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>

                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedShipment(s);
                            setTimelineOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-neutral-500 hover:text-brand-600 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                          title="View Operational Timeline"
                        >
                          <History className="h-4 w-4" />
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="flex items-center justify-between border-t border-neutral-200 bg-neutral-50/70 px-4 py-3 text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950/30">
          <span>Showing <strong className="text-neutral-800 dark:text-neutral-200">{shipments.length}</strong> of <strong className="text-neutral-800 dark:text-neutral-200">{totalCount}</strong> shipments</span>
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

      <NDRSupervisorModal
        shipment={selectedShipment}
        isOpen={supervisorModalOpen}
        onClose={() => setSupervisorModalOpen(false)}
        onSuccess={handleSupervisorSuccess}
      />

      <NDRToast message={toastMsg} onClose={() => setToastMsg(null)} />
    </div>
  );
}
