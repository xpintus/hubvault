import React, { useState } from 'react';
import { exportDRSPerformanceWorkbook } from '@/lib/drs/drsExcelExporter';
import { DRSReportRow, EmployeeDRSMetrics } from '@/types/drs';
import {
  Award,
  CheckCircle2,
  CreditCard,
  Download,
  MapPin,
  Search,
  ShieldAlert,
  Truck,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';

interface DRSEmployeeDrawerProps {
  metrics: EmployeeDRSMetrics | null;
  shipments: DRSReportRow[];
  isOpen: boolean;
  onClose: () => void;
}

export const DRSEmployeeDrawer: React.FC<DRSEmployeeDrawerProps> = ({
  metrics,
  shipments,
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'ALL' | 'DELIVERED' | 'UNDEL' | 'COD'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen || !metrics) return null;

  // Filter shipments for this executive
  const employeeShipments = shipments.filter(
    (s) => s.employee_name.toLowerCase() === metrics.employee_name.toLowerCase()
  );

  const filteredList = employeeShipments.filter((s) => {
    if (activeTab === 'DELIVERED' && s.shipment_status_normalized !== 'Delivered') return false;
    if (activeTab === 'UNDEL' && s.shipment_status_normalized !== 'Undelivered') return false;
    if (activeTab === 'COD' && !s.payment_type.toUpperCase().includes('COD')) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchAwb = s.waybill_no.toLowerCase().includes(q);
      const matchCustomer = s.consignee.toLowerCase().includes(q);
      const matchDrs = s.drs_code.toLowerCase().includes(q);
      if (!matchAwb && !matchCustomer && !matchDrs) return false;
    }
    return true;
  });

  // Calculate Performance Score & Grade
  const deliveryPct = metrics.overall_delivery_pct;
  let scoreLabel = 'Action Needed';
  let scoreBg = 'bg-rose-500/10 text-rose-600 border-rose-500/20';
  if (deliveryPct >= 90) {
    scoreLabel = 'Outstanding (Grade A+)';
    scoreBg = 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
  } else if (deliveryPct >= 80) {
    scoreLabel = 'Excellent (Grade A)';
    scoreBg = 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
  } else if (deliveryPct >= 70) {
    scoreLabel = 'Good (Grade B)';
    scoreBg = 'bg-blue-500/10 text-blue-600 border-blue-500/20';
  } else if (deliveryPct >= 60) {
    scoreLabel = 'Average (Grade C)';
    scoreBg = 'bg-amber-500/10 text-amber-600 border-amber-500/20';
  }

  const handleDownloadSingleEmployeeReport = () => {
    const singleEmpSummary = {
      fileName: `Employee_${metrics.employee_name.replace(/\s+/g, '_')}_Report.xlsx`,
      reportDate: new Date().toISOString().split('T')[0],
      totalRows: employeeShipments.length,
      validRows: employeeShipments.length,
      invalidRows: 0,
      uniqueAwbs: employeeShipments.length,
      duplicateRows: 0,
      consolidatedRows: employeeShipments.length,
      totalEmployees: 1,
      totalDrsCodes: new Set(employeeShipments.map((s) => s.drs_code)).size,

      totalOfd: metrics.total_ofd,
      firstAttemptOfd: metrics.first_attempt_ofd,
      firstAttemptDelivered: metrics.first_attempt_delivered,
      firstAttemptUndel: metrics.first_attempt_undel,
      firstAttemptCancelled: metrics.first_attempt_cancelled,
      firstAttemptRto: metrics.first_attempt_rto,
      firstAttemptDeliveryPct: metrics.first_attempt_delivery_pct,

      reattemptOfd: metrics.reattempt_ofd,
      reattemptDelivered: metrics.reattempt_delivered,
      reattemptUndel: metrics.reattempt_undel,
      reattemptCancelled: metrics.reattempt_cancelled,
      reattemptRto: metrics.reattempt_rto,
      reattemptDeliveryPct: metrics.reattempt_delivery_pct,

      attempt2Ofd: metrics.attempt_2_ofd,
      attempt2Delivered: metrics.attempt_2_delivered,
      attempt3Ofd: metrics.attempt_3_ofd,
      attempt3Delivered: metrics.attempt_3_delivered,
      attempt4PlusOfd: metrics.attempt_4plus_ofd,
      attempt4PlusDelivered: metrics.attempt_4plus_delivered,

      totalDelivered: metrics.total_delivered,
      totalUndel: metrics.total_undel,
      totalCancelled: metrics.total_cancelled,
      totalRto: metrics.total_rto,
      overallDeliveryPct: metrics.overall_delivery_pct,

      firstAttemptContributionPct: metrics.first_attempt_contribution_pct,
      reattemptContributionPct: metrics.reattempt_contribution_pct,

      totalCodValue: metrics.cod_value_total,
      deliveredCodValue: metrics.cod_value_delivered,
      averageAttempts: metrics.average_attempts,
      maximumAttempts: metrics.maximum_attempts,
    };

    exportDRSPerformanceWorkbook(
      singleEmpSummary,
      [metrics],
      [],
      {
        codOfd: metrics.cod_ofd,
        codDelivered: metrics.cod_delivered,
        codUndel: metrics.cod_undel,
        codDeliveryPct: metrics.cod_delivery_pct,
        codPending: metrics.cod_pending,
        codTotalAmount: metrics.cod_value_total,
        codDeliveredAmount: metrics.cod_value_delivered,

        prepaidOfd: metrics.prepaid_ofd,
        prepaidDelivered: metrics.prepaid_delivered,
        prepaidUndel: metrics.prepaid_undel,
        prepaidDeliveryPct: metrics.prepaid_delivery_pct,
        prepaidPending: metrics.prepaid_pending,
        prepaidTotalAmount: metrics.prepaid_amount_total,
        prepaidDeliveredAmount: metrics.prepaid_amount_total,
      },
      [],
      [],
      employeeShipments,
      [],
      [],
      `Executive_${metrics.employee_name.replace(/\s+/g, '_')}_Report`
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-sm animate-fade-in flex justify-end">
      <div className="w-full max-w-2xl bg-[var(--card-bg)] border-l border-neutral-200 dark:border-neutral-800 h-full flex flex-col shadow-2xl overflow-y-auto">
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 sticky top-0 bg-[var(--card-bg)] z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-brand-100 dark:bg-brand-600/20 border-2 border-brand-500/30 flex items-center justify-center text-brand-600 dark:text-brand-400 font-black text-lg">
              {metrics.employee_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">{metrics.employee_name}</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${scoreBg}`}>
                  {scoreLabel}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">Executive Delivery Intelligence Card</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadSingleEmployeeReport}
              className="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-glow transition flex items-center gap-1.5 active:scale-95"
            >
              <Download className="h-4 w-4" /> Export Report
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5 flex-1 text-xs">
          {/* Performance Score Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
              <span className="text-neutral-500 block font-semibold">Total OFD</span>
              <span className="text-xl font-black text-neutral-900 dark:text-neutral-100">{metrics.total_ofd}</span>
              <span className="text-[10px] text-neutral-400 block font-mono">Avg Attempts: {metrics.average_attempts}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-emerald-700 dark:text-emerald-400 block font-bold">Delivery %</span>
              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{metrics.overall_delivery_pct}%</span>
              <span className="text-[10px] text-emerald-600/80 block font-semibold">{metrics.total_delivered} DEL</span>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <span className="text-blue-700 dark:text-blue-400 block font-bold">1st Attempt %</span>
              <span className="text-xl font-black text-blue-600 dark:text-blue-400">{metrics.first_attempt_delivery_pct}%</span>
              <span className="text-[10px] text-blue-600/80 block font-semibold">{metrics.first_attempt_delivered} / {metrics.first_attempt_ofd}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <span className="text-purple-700 dark:text-purple-400 block font-bold">COD Collection</span>
              <span className="text-xl font-black text-purple-600 dark:text-purple-400">{metrics.cod_delivery_pct}%</span>
              <span className="text-[10px] text-purple-600/80 block font-mono font-bold">₹{metrics.cod_value_delivered.toLocaleString()}</span>
            </div>
          </div>

          {/* Today's Shipments List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Truck className="h-4 w-4 text-brand-600" /> Today's Assigned Shipments ({employeeShipments.length})
              </h3>

              <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-900 p-1 rounded-xl font-semibold">
                <button
                  onClick={() => setActiveTab('ALL')}
                  className={`px-2.5 py-1 rounded-lg transition ${activeTab === 'ALL' ? 'bg-[var(--card-bg)] font-bold text-brand-600 shadow-sm' : 'text-neutral-500'}`}
                >
                  All ({employeeShipments.length})
                </button>
                <button
                  onClick={() => setActiveTab('DELIVERED')}
                  className={`px-2.5 py-1 rounded-lg transition ${activeTab === 'DELIVERED' ? 'bg-[var(--card-bg)] font-bold text-emerald-600 shadow-sm' : 'text-neutral-500'}`}
                >
                  DEL ({metrics.total_delivered})
                </button>
                <button
                  onClick={() => setActiveTab('UNDEL')}
                  className={`px-2.5 py-1 rounded-lg transition ${activeTab === 'UNDEL' ? 'bg-[var(--card-bg)] font-bold text-amber-600 shadow-sm' : 'text-neutral-500'}`}
                >
                  UNDEL ({metrics.total_undel})
                </button>
              </div>
            </div>

            {/* Local Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-400" />
              <input
                type="text"
                placeholder="Search by AWB, Customer, DRS Code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-medium"
              />
            </div>

            {/* Table */}
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-left">
                  <thead className="bg-neutral-50 dark:bg-neutral-900 text-neutral-500 font-semibold sticky top-0 border-b border-neutral-200 dark:border-neutral-800">
                    <tr>
                      <th className="px-3 py-2">AWB</th>
                      <th className="px-3 py-2">Customer</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Attempts</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {filteredList.map((s) => (
                      <tr key={s.rowIndex} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/30">
                        <td className="px-3 py-2 font-mono font-bold">{s.waybill_no}</td>
                        <td className="px-3 py-2">{s.consignee || s.customer_name || '-'}</td>
                        <td className="px-3 py-2 font-mono">₹{s.amount_payable} ({s.payment_type})</td>
                        <td className="px-3 py-2 font-mono font-bold">#{s.total_attempts}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              s.shipment_status_normalized === 'Delivered'
                                ? 'bg-emerald-500/10 text-emerald-600'
                                : s.shipment_status_normalized === 'Undelivered'
                                ? 'bg-amber-500/10 text-amber-600'
                                : 'bg-rose-500/10 text-rose-600'
                            }`}
                          >
                            {s.shipment_status_normalized}
                          </span>
                        </td>
                        <td className="px-3 py-2 max-w-[140px] truncate text-amber-600 font-medium">
                          {s.reason || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
