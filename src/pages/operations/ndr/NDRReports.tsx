import React, { useEffect, useState } from 'react';
import { useHub } from '@/lib/hubContext';
import { fetchNDRShipments } from '@/lib/ndr/ndrService';
import { exportNDRShipmentsToCSV, exportNDRShipmentsToExcel } from '@/lib/ndr/ndrExcel';
import { NDRShipment } from '@/types/ndr';
import { BarChart3, Download, FileSpreadsheet, FileText, RefreshCw, ShieldCheck, Sparkles, Truck } from 'lucide-react';

type ReportType =
  | 'Fresh & Reattempt Analysis'
  | 'Daily'
  | 'Caller Performance'
  | 'Caller Wise'
  | 'Supervisor Performance'
  | 'Supervisor Wise'
  | 'Hub Wise'
  | 'Vendor Wise'
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

  // Compute Logistics Stats
  const stats = React.useMemo(() => {
    if (shipments.length === 0) {
      return { todaysUpload: 0, fresh: 0, reattempt: 0, supervisorPending: 0, deliveredToday: 0, rto: 0, avgAttempts: 0, maxAttempts: 0 };
    }
    const todayStr = new Date().toISOString().split('T')[0];
    let todaysUpload = 0;
    let fresh = 0;
    let reattempt = 0;
    let supervisorPending = 0;
    let deliveredToday = 0;
    let rto = 0;
    let sumAttempts = 0;
    let maxAttempts = 0;

    shipments.forEach((s) => {
      const att = s.total_attempts || 1;
      const createdDate = s.created_at ? s.created_at.split('T')[0] : '';
      const updatedDate = s.updated_at ? s.updated_at.split('T')[0] : '';

      if (createdDate === todayStr) todaysUpload++;
      sumAttempts += att;
      if (att > maxAttempts) maxAttempts = att;

      if (att === 1 && (s.ndr_workflow_status === 'Calling Pending' || s.shipment_status_current === 'UNDEL')) fresh++;
      else if (att >= 2) reattempt++;

      if (s.ndr_workflow_status === 'Supervisor Pending') supervisorPending++;
      if ((s.shipment_status_current === 'DEL' || s.ndr_workflow_status === 'Delivered') && updatedDate === todayStr) deliveredToday++;
      if (s.shipment_status_current === 'RTO' || s.ndr_workflow_status === 'RTO') rto++;
    });

    const avgAttempts = Number((sumAttempts / shipments.length).toFixed(2));

    return { todaysUpload, fresh, reattempt, supervisorPending, deliveredToday, rto, avgAttempts, maxAttempts };
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
        case 'Caller Performance':
        case 'Caller Wise':
          key = s.assigned_caller?.name || 'Unassigned Caller';
          break;
        case 'Supervisor Performance':
        case 'Supervisor Wise':
          key = s.assigned_supervisor?.name || 'Unassigned Supervisor';
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
      {/* Logistics KPI Summary Block */}
      <div className="p-6 rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft space-y-4">
        <div className="flex items-center gap-3 border-b border-neutral-200 dark:border-neutral-800 pb-3">
          <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
              Logistics Operational Performance Summary
            </h3>
            <p className="text-xs text-neutral-500">Summary of today's uploads, active queues, supervisor pending, resolutions, and average attempt metrics.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs">
          <div className="p-3.5 rounded-xl border border-indigo-500/20 bg-indigo-500/10">
            <span className="font-bold text-neutral-600 dark:text-neutral-400 block">Today's Upload</span>
            <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1 block">
              {stats.todaysUpload}
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10">
            <span className="font-bold text-neutral-600 dark:text-neutral-400 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-emerald-600" /> Fresh
            </span>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
              {stats.fresh}
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-orange-500/20 bg-orange-500/10">
            <span className="font-bold text-neutral-600 dark:text-neutral-400 block">Reattempt</span>
            <span className="text-xl font-black text-orange-600 dark:text-orange-400 mt-1 block">
              {stats.reattempt}
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/10">
            <span className="font-bold text-neutral-600 dark:text-neutral-400 flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-rose-600" /> Supervisor
            </span>
            <span className="text-xl font-black text-rose-600 dark:text-rose-400 mt-1 block">
              {stats.supervisorPending}
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-emerald-600/20 bg-emerald-500/10">
            <span className="font-bold text-neutral-600 dark:text-neutral-400 block">Delivered Today</span>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
              {stats.deliveredToday}
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-red-500/20 bg-red-500/10">
            <span className="font-bold text-neutral-600 dark:text-neutral-400 block">RTO Closed</span>
            <span className="text-xl font-black text-red-600 dark:text-red-400 mt-1 block">
              {stats.rto}
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-blue-500/20 bg-blue-500/10">
            <span className="font-bold text-neutral-600 dark:text-neutral-400 block">Avg Attempts</span>
            <span className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1 block">
              {stats.avgAttempts}
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-purple-500/20 bg-purple-500/10">
            <span className="font-bold text-neutral-600 dark:text-neutral-400 block">Max Attempts</span>
            <span className="text-xl font-black text-purple-600 dark:text-purple-400 mt-1 block">
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
            <option value="Caller Performance">Caller Performance</option>
            <option value="Supervisor Performance">Supervisor Performance</option>
            <option value="Vendor Wise">Vendor Wise</option>
            <option value="Executive Wise">Executive Wise</option>
            <option value="Reason Wise">Reason Wise</option>
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
