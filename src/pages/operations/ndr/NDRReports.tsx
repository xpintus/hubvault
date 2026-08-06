import React, { useEffect, useState } from 'react';
import { useHub } from '@/lib/hubContext';
import { fetchNDRShipments } from '@/lib/ndr/ndrService';
import { exportNDRShipmentsToCSV, exportNDRShipmentsToExcel } from '@/lib/ndr/ndrExcel';
import { NDRShipment } from '@/types/ndr';
import { BarChart3, Download, FileSpreadsheet, FileText, RefreshCw } from 'lucide-react';

type ReportType =
  | 'Daily'
  | 'Weekly'
  | 'Monthly'
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
  const [reportType, setReportType] = useState<ReportType>('Daily');
  const [shipments, setShipments] = useState<NDRShipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchNDRShipments({
      hubId: selectedHub?.id || undefined,

      limit: 500,
    })
      .then(({ data }) => setShipments(data))
      .finally(() => setLoading(false));
  }, [selectedHub, reportType]);


  // Aggregate Data depending on reportType
  const getAggregatedData = () => {
    const map = new Map<string, { label: string; total: number; delivered: number; rto: number; cod: number }>();

    shipments.forEach((s) => {
      let key = 'Default';
      switch (reportType) {
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
            <option value="Daily">Daily Breakdown</option>
            <option value="Weekly">Weekly Breakdown</option>
            <option value="Monthly">Monthly Breakdown</option>
            <option value="Hub Wise">Hub Wise</option>
            <option value="Vendor Wise">Vendor Wise</option>
            <option value="Caller Wise">Caller Wise</option>
            <option value="Supervisor Wise">Supervisor Wise</option>
            <option value="Executive Wise">Delivery Executive Wise</option>
            <option value="Reason Wise">Original Reason Wise</option>
            <option value="OTP Wise">OTP Issues Wise</option>
            <option value="COD Wise">COD / Payment Mode</option>
            <option value="Delivered After NDR">Delivered After NDR</option>
            <option value="RTO">RTO Queue</option>
          </select>

          <button
            onClick={() => exportNDRShipmentsToExcel(shipments, `ndr_report_${reportType}.xlsx`)}
            className="px-3.5 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 text-xs font-semibold flex items-center gap-1.5"
          >
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </button>
          <button
            onClick={() => exportNDRShipmentsToCSV(shipments, `ndr_report_${reportType}.csv`)}
            className="px-3.5 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 text-xs font-semibold flex items-center gap-1.5"
          >
            <Download className="h-4 w-4" /> CSV
          </button>
          <button
            onClick={exportPDF}
            className="px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-glow flex items-center gap-1.5"
          >
            <FileText className="h-4 w-4" /> PDF Report
          </button>
        </div>
      </div>

      {/* Report Summary Data Table */}
      <div className="rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-neutral-500 flex flex-col items-center gap-2">
            <RefreshCw className="h-6 w-6 animate-spin text-brand-600" />
            <span className="text-xs">Generating report aggregations...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800">
                <tr>
                  <th className="px-4 py-3">Category / Group</th>
                  <th className="px-4 py-3">Total NDR Shipments</th>
                  <th className="px-4 py-3">Delivered Post-NDR</th>
                  <th className="px-4 py-3">RTO Approved</th>
                  <th className="px-4 py-3">Total COD Amount</th>
                  <th className="px-4 py-3">Conversion Rate %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {reportData.map((row) => {
                  const conversion = row.total > 0 ? ((row.delivered / row.total) * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={row.label} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/30">
                      <td className="px-4 py-3 font-semibold text-neutral-900 dark:text-neutral-100">{row.label}</td>
                      <td className="px-4 py-3 font-bold">{row.total}</td>
                      <td className="px-4 py-3 text-emerald-600 font-bold">{row.delivered}</td>
                      <td className="px-4 py-3 text-red-600 font-bold">{row.rto}</td>
                      <td className="px-4 py-3 font-mono font-semibold">₹{row.cod}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-brand-500/10 text-brand-600 dark:text-brand-400">
                          {conversion}%
                        </span>
                      </td>
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
