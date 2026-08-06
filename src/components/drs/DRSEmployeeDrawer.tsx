import React, { useState } from 'react';
import { DRSReportRow, EmployeeDRSMetrics } from '@/types/drs';
import { MapPin, ShieldAlert, Truck, User, X } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'ALL' | 'FIRST_ATTEMPT' | 'REATTEMPT' | 'DELIVERED' | 'UNDEL'>('ALL');

  if (!isOpen || !metrics) return null;

  // Filter shipments for this employee
  const employeeShipments = shipments.filter(
    (s) => s.employee_name.toLowerCase() === metrics.employee_name.toLowerCase()
  );

  const filteredList = employeeShipments.filter((s) => {
    if (activeTab === 'FIRST_ATTEMPT') return (s.total_attempts || 1) <= 1;
    if (activeTab === 'REATTEMPT') return (s.total_attempts || 1) >= 2;
    if (activeTab === 'DELIVERED') return s.shipment_status_normalized === 'Delivered';
    if (activeTab === 'UNDEL') return s.shipment_status_normalized === 'Undelivered';
    return true;
  });

  // Reason breakdown
  const reasonMap = new Map<string, number>();
  // OTP breakdown
  const otpMap = new Map<string, number>();
  // Pincode breakdown
  const pincodeMap = new Map<string, number>();

  employeeShipments.forEach((s) => {
    if (s.reason) {
      reasonMap.set(s.reason, (reasonMap.get(s.reason) || 0) + 1);
    }
    if (s.otp_details) {
      otpMap.set(s.otp_details, (otpMap.get(s.otp_details) || 0) + 1);
    }
    if (s.delivery_pincode) {
      pincodeMap.set(s.delivery_pincode, (pincodeMap.get(s.delivery_pincode) || 0) + 1);
    }
  });

  const topReasons = Array.from(reasonMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topPincodes = Array.from(pincodeMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-sm animate-fade-in flex justify-end">
      <div className="w-full max-w-3xl bg-[var(--card-bg)] border-l border-neutral-200 dark:border-neutral-800 h-full flex flex-col shadow-2xl overflow-y-auto">
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 sticky top-0 bg-[var(--card-bg)] z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-50 dark:bg-brand-600/15 text-brand-600 dark:text-brand-400">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">{metrics.employee_name}</h2>
              <p className="text-xs text-neutral-500">Employee Delivery Performance Details</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 flex-1">
          {/* Employee KPI Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
              <span className="text-neutral-500 block">Total OFD</span>
              <span className="text-xl font-black text-neutral-900 dark:text-neutral-100">{metrics.total_ofd}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-emerald-700 dark:text-emerald-400 block font-semibold">Overall Delivery %</span>
              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{metrics.overall_delivery_pct}%</span>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <span className="text-blue-700 dark:text-blue-400 block font-semibold">1st Attempt Delivery %</span>
              <span className="text-xl font-black text-blue-600 dark:text-blue-400">{metrics.first_attempt_delivery_pct}%</span>
            </div>

            <div className="p-3.5 rounded-xl bg-orange-500/10 border border-orange-500/20">
              <span className="text-orange-700 dark:text-orange-400 block font-semibold">Reattempt Delivery %</span>
              <span className="text-xl font-black text-orange-600 dark:text-orange-400">{metrics.reattempt_delivery_pct}%</span>
            </div>
          </div>

          {/* Breakdown Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* NDR Reason Breakdown */}
            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-2">
              <h3 className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <ShieldAlert className="h-4 w-4 text-amber-500" /> Top NDR Reasons
              </h3>
              {topReasons.length === 0 ? (
                <p className="text-neutral-400 italic">No NDR reasons recorded.</p>
              ) : (
                <div className="space-y-1.5 pt-1">
                  {topReasons.map(([reason, count]) => (
                    <div key={reason} className="flex items-center justify-between text-neutral-700 dark:text-neutral-300">
                      <span className="truncate max-w-[200px]">{reason}</span>
                      <span className="font-bold bg-neutral-200 dark:bg-neutral-800 px-2 py-0.5 rounded-full text-[11px]">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pincode Breakdown */}
            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-2">
              <h3 className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <MapPin className="h-4 w-4 text-brand-500" /> Top Delivery Pincodes
              </h3>
              {topPincodes.length === 0 ? (
                <p className="text-neutral-400 italic">No pincodes recorded.</p>
              ) : (
                <div className="space-y-1.5 pt-1">
                  {topPincodes.map(([pin, count]) => (
                    <div key={pin} className="flex items-center justify-between text-neutral-700 dark:text-neutral-300">
                      <span className="font-mono">{pin}</span>
                      <span className="font-bold bg-neutral-200 dark:bg-neutral-800 px-2 py-0.5 rounded-full text-[11px]">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Filter Tabs for Shipments List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-1.5">
                <Truck className="h-4 w-4 text-brand-600" /> Shipments List ({filteredList.length})
              </h3>

              <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-900 p-1 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setActiveTab('ALL')}
                  className={`px-2.5 py-1 rounded-lg transition ${activeTab === 'ALL' ? 'bg-[var(--card-bg)] font-bold text-brand-600 shadow-sm' : 'text-neutral-500'}`}
                >
                  All ({employeeShipments.length})
                </button>
                <button
                  onClick={() => setActiveTab('FIRST_ATTEMPT')}
                  className={`px-2.5 py-1 rounded-lg transition ${activeTab === 'FIRST_ATTEMPT' ? 'bg-[var(--card-bg)] font-bold text-emerald-600 shadow-sm' : 'text-neutral-500'}`}
                >
                  1st Attempt ({metrics.first_attempt_ofd})
                </button>
                <button
                  onClick={() => setActiveTab('REATTEMPT')}
                  className={`px-2.5 py-1 rounded-lg transition ${activeTab === 'REATTEMPT' ? 'bg-[var(--card-bg)] font-bold text-orange-600 shadow-sm' : 'text-neutral-500'}`}
                >
                  Reattempt ({metrics.reattempt_ofd})
                </button>
                <button
                  onClick={() => setActiveTab('DELIVERED')}
                  className={`px-2.5 py-1 rounded-lg transition ${activeTab === 'DELIVERED' ? 'bg-[var(--card-bg)] font-bold text-emerald-600 shadow-sm' : 'text-neutral-500'}`}
                >
                  Delivered ({metrics.total_delivered})
                </button>
              </div>
            </div>

            {/* Shipments Data Table */}
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden text-xs">
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left">
                  <thead className="bg-neutral-50 dark:bg-neutral-900 text-neutral-500 font-semibold sticky top-0 border-b border-neutral-200 dark:border-neutral-800">
                    <tr>
                      <th className="px-3 py-2">AWB</th>
                      <th className="px-3 py-2">Customer</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Attempt</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">NDR Reason</th>
                      <th className="px-3 py-2">DRS Code</th>
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
                                ? 'bg-orange-500/10 text-orange-600'
                                : 'bg-red-500/10 text-red-600'
                            }`}
                          >
                            {s.shipment_status_normalized}
                          </span>
                        </td>
                        <td className="px-3 py-2 max-w-[150px] truncate text-amber-600 dark:text-amber-400 font-medium">
                          {s.reason || '-'}
                        </td>
                        <td className="px-3 py-2 font-mono text-neutral-500">{s.drs_code || '-'}</td>
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
