import React, { useEffect, useState } from 'react';
import { useHub } from '@/lib/hubContext';
import { fetchNDRShipments } from '@/lib/ndr/ndrService';
import { exportNDRShipmentsToCSV, exportNDRShipmentsToExcel } from '@/lib/ndr/ndrExcel';
import { NDRShipment } from '@/types/ndr';
import { BarChart3, Download, FileSpreadsheet, FileText, RefreshCw, Sparkles, Truck } from 'lucide-react';

type ReportType =
  | 'Fresh & Reattempt Analysis'
  | 'Daily'
  | 'Hub Wise'
  | 'Vendor Wise'
  | 'Caller Wise'
  | 'Supervisor Wise'
  | 'Executive Wise'
  | 'Reason Wise'
  | 'OTP Wise'
  | 'COD Wise'
  | 'Delivered After NDR'
  | 'RTO';

export default function NDRReports() {
  const { selectedHub } = useHub();
  const [reportType, setReportType] = useState<ReportType>('Fresh & Reattempt Analysis');
  const [shipments, setShipments] = useState<NDRShipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchNDRShipments({
      hubId: selectedHub?.id || undefined,
      limit: 1000,
    })
      .then(({ data }) => setShipments(data))
      .finally(() => setLoading(false));
  }, [selectedHub, reportType]);

  // Compute Fresh vs Reattempt Metrics
  const stats = React.useMemo(() => {
    if (shipments.length === 0) {
      return { fresh: 0, reattempt: 0, delivered: 0, rto: 0, avgAttempts: 0, maxAttempts: 0 };
    }
    let fresh = 0;
    let reattempt = 0;
    let delivered = 0;
    let rto = 0;
    let sumAttempts = 0;
    let maxAttempts = 0;

    shipments.forEach((s) => {
      const att = s.total_attempts || 1;
      sumAttempts += att;
      if (att > maxAttempts) maxAttempts = att;

      if (att === 1) fresh++;
      else if (att >= 2) reattempt++;

      if (s.shipment_status_current === 'DEL') delivered++;
      if (s.shipment_status_current === 'RTO') rto++;
    });

    const avgAttempts = Number((sumAttempts / shipments.length).toFixed(2));

    return { fresh, reattempt, delivered, rto, avgAttempts, maxAttempts };
  }, [shipments]);

  // Aggregate Data depending on reportType
  const getAggregatedData = () => {
    const map = new Map<string, { label: string; total: number; delivered: number; rto: number; cod: number }>();

    shipments.forEach((s) => {
      let key = 'Default';
      switch (reportType) {
        case 'Fresh & Reattempt Analysis':
          key = (s.total_attempts || 1) <= 1 ? 'Fresh Shipments (Attempt 1)' : `Reattempt (Attempt ${s.total_attempts})`;
          break;
        case 'Daily':
          key = new Date(s.created_at).toLocaleDateString();
          break;
        case 'Vendor Wise':
          key = s.partner_name || 'Unknown Vendor';
          break;
        case 'Executive Wise':
          key = s.delivery_executive || 'Unassigned DE';
          break;
        case 'Reason Wise':
          key = s.original_ndr_reason || 'Unspecified';
          break;
        case 'Caller Wise':
          key = s.assigned_caller?.name || 'Unassigned Caller';
          break;
        case 'Supervisor Wise':
          key = s.assigned_supervisor?.name || 'Unassigned Supervisor';
          break;
        case 'OTP Wise':
          key = s.otp_status || 'No OTP Details';
          break;
        case 'COD Wise':
          key = s.payment_type || 'COD';
          break;
        case 'Hub Wise':
          key = s.hub_location || s.hub?.name || 'Main Hub';
          break;
        case 'Delivered After NDR':
          if (s.shipment_status_current !== 'DEL') return;
          key = 'Delivered NDRs';
          break;
        case 'RTO':
          if (s.shipment_status_current !== 'RTO') return;
          key = 'RTO Approved';
          break;
        default:
          key = new Date(s.created_at).toLocaleDateString();
      }

      const curr = map.get(key) || { label: key, total: 0, delivered: 0, rto: 0, cod: 0 };
      curr.total++;
      if (s.shipment_status_current === 'DEL') curr.delivered++;
      if (s.shipment_status_current === 'RTO') curr.rto++;
      curr.cod += s.amount_payable || 0;
      map.set(key, curr);
    });

    return Array.from(map.values());
  };

  const reportData = getAggregatedData();

  const exportPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`HubVault NDR Report - ${reportType}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);

    let y = 40;
    doc.setFontSize(10);
    doc.text('Category', 14, y);
    doc.text('Total NDR', 80, y);
    doc.text('Delivered', 120, y);
    doc.text('RTO', 150, y);
    doc.text('Total COD (₹)', 180, y);
    y += 6;

    reportData.forEach((row) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(String(row.label).slice(0, 30), 14, y);
      doc.text(String(row.total), 80, y);
      doc.text(String(row.delivered), 120, y);
      doc.text(String(row.rto), 150, y);
      doc.text(String(row.cod), 180, y);
      y += 6;
    });

    doc.save(`ndr_report_${reportType.toLowerCase().replace(/ /g, '_')}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Fresh vs Reattempt Operational KPI Summary Cards */}
      <div className="p-6 rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft space-y-4">
        <div className="flex items-center gap-3 border-b border-neutral-200 dark:border-neutral-800 pb-3">
          <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
              Logistics Attempt & Operational Summary
            </h3>
            <p className="text-xs text-neutral-500">Breakdown of fresh imports, reattempt pending, resolutions, and average attempt metrics.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10">
            <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400 flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600" /> Fresh Shipments
            </span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
              {stats.fresh}
            </span>
          </div>

          <div className="p-4 rounded-xl border border-orange-500/20 bg-orange-500/10">
            <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400 block">Reattempt Shipments</span>
            <span className="text-2xl font-black text-orange-600 dark:text-orange-400 mt-1 block">
              {stats.reattempt}
            </span>
          </div>

          <div className="p-4 rounded-xl border border-emerald-600/20 bg-emerald-500/10">
            <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400 block">Delivered After NDR</span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
              {stats.delivered}
            </span>
          </div>

          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10">
            <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400 block">RTO Approved</span>
            <span className="text-2xl font-black text-red-600 dark:text-red-400 mt-1 block">
              {stats.rto}
            </span>
          </div>

          <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/10">
            <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400 block">Average Attempts</span>
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1 block">
              {stats.avgAttempts}
            </span>
          </div>

          <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/10">
            <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400 block">Maximum Attempts</span>
            <span className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1 block">
              {stats.maxAttempts}
            </span>
          </div>
        </div>
      </div>

      {/* Header & Controls */}
      <div className="p-6 rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-brand-600" /> Operational Reports & Analytics
          </h2>
          <p className="text-xs text-neutral-500">Generate, analyze, and export comprehensive NDR performance metrics.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as ReportType)}
            className="px-3.5 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-bold text-neutral-900 dark:text-neutral-100"
          >
            <option value="Fresh & Reattempt Analysis">Fresh & Reattempt Analysis</option>
            <option value="Daily">Daily Breakdown</option>
            <option value="Vendor Wise">Vendor Wise</option>
            <option value="Executive Wise">Executive Wise</option>
            <option value="Reason Wise">Reason Wise</option>
            <option value="Caller Wise">Caller Wise</option>
            <option value="Supervisor Wise">Supervisor Wise</option>
            <option value="OTP Wise">OTP Wise</option>
            <option value="COD Wise">COD Wise</option>
            <option value="Hub Wise">Hub Wise</option>
            <option value="Delivered After NDR">Delivered After NDR</option>
            <option value="RTO">RTO Approved</option>
          </select>

          <button
            onClick={() => exportNDRShipmentsToExcel(shipments, `ndr_${reportType.toLowerCase().replace(/ /g, '_')}.xlsx`)}
            className="px-3.5 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 text-xs font-bold text-neutral-700 dark:text-neutral-300 transition flex items-center gap-1.5"
          >
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </button>
          <button
            onClick={() => exportNDRShipmentsToCSV(shipments, `ndr_${reportType.toLowerCase().replace(/ /g, '_')}.csv`)}
            className="px-3.5 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 text-xs font-bold text-neutral-700 dark:text-neutral-300 transition flex items-center gap-1.5"
          >
            <Download className="h-4 w-4" /> CSV
          </button>
          <button
            onClick={exportPDF}
            className="px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-glow transition flex items-center gap-1.5"
          >
            <FileText className="h-4 w-4" /> PDF Report
          </button>
        </div>
      </div>

      {/* Aggregated Data Table */}
      <div className="rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-neutral-500 flex flex-col items-center gap-2">
            <RefreshCw className="h-6 w-6 animate-spin text-brand-600" />
            <span className="text-xs">Computing report metrics...</span>
          </div>
        ) : reportData.length === 0 ? (
          <div className="py-16 text-center text-neutral-500 text-sm">No report data found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800">
                <tr>
                  <th className="px-4 py-3">Category / Group</th>
                  <th className="px-4 py-3">Total NDRs</th>
                  <th className="px-4 py-3">Delivered</th>
                  <th className="px-4 py-3">RTO Approved</th>
                  <th className="px-4 py-3">Delivery Rate (%)</th>
                  <th className="px-4 py-3 text-right">Total COD Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {reportData.map((row) => {
                  const delRate = row.total > 0 ? ((row.delivered / row.total) * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={row.label} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/30">
                      <td className="px-4 py-3 font-semibold text-neutral-900 dark:text-neutral-100">{row.label}</td>
                      <td className="px-4 py-3 font-bold">{row.total}</td>
                      <td className="px-4 py-3 font-bold text-emerald-600">{row.delivered}</td>
                      <td className="px-4 py-3 font-bold text-red-600">{row.rto}</td>
                      <td className="px-4 py-3 font-mono font-semibold">{delRate}%</td>
                      <td className="px-4 py-3 font-mono font-bold text-right">₹{row.cod.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
