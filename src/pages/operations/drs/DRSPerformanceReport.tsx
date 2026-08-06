import React, { useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useHub } from '@/lib/hubContext';
import { computeEmployeeDRSMetrics, computeOverallDRSSummary, filterDRSRows } from '@/lib/drs/drsAnalyticsEngine';
import { exportDRSPerformanceWorkbook } from '@/lib/drs/drsExcelExporter';
import { parseDRSFile } from '@/lib/drs/drsParser';
import { importNDRBatch } from '@/lib/ndr/ndrService';
import { DRSFilterOptions, DRSReportRow, EmployeeDRSMetrics, OverallDRSSummary } from '@/types/drs';
import { DRSEmployeeDrawer } from '@/components/drs/DRSEmployeeDrawer';
import { NDRToast } from '@/components/ndr/NDRToast';
import { ParsedNDRExcelRow } from '@/types/ndr';
import {
  BarChart3,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  PieChart,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Truck,
  Upload,
  User,
  XCircle,
} from 'lucide-react';

type TabType = 'EMPLOYEE' | 'FIRST_ATTEMPT' | 'REATTEMPT' | 'TOTAL_DELIVERY' | 'CHARTS';

export default function DRSPerformanceReport() {
  const { selectedHub } = useHub();
  const { profile } = useAuth();

  const [file, setFile] = useState<File | null>(null);
  const [parsingProgress, setParsingProgress] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('EMPLOYEE');

  // Parsed Raw & Consolidated Data
  const [rawRows, setRawRows] = useState<DRSReportRow[]>([]);
  const [uniqueRows, setUniqueRows] = useState<DRSReportRow[]>([]);
  const [duplicateRows, setDuplicateRows] = useState<DRSReportRow[]>([]);
  const [invalidRows, setInvalidRows] = useState<DRSReportRow[]>([]);

  // Metadata & Summary
  const [summary, setSummary] = useState<OverallDRSSummary | null>(null);
  const [employeeMetrics, setEmployeeMetrics] = useState<EmployeeDRSMetrics[]>([]);

  // Selected Employee for Detail View
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeDRSMetrics | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Import UNDEL to active NDR state
  const [importingNdr, setImportingNdr] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Filters State
  const [filters, setFilters] = useState<DRSFilterOptions>({
    minOfdThreshold: 5,
    sortBy: 'total_delivered',
    sortOrder: 'desc',
  });

  const handleFileUpload = async (uploadedFile: File) => {
    setFile(uploadedFile);
    setParsingProgress('Reading file contents...');
    try {
      setParsingProgress('Normalizing headers & cleaning attempt numbers...');
      const parsed = await parseDRSFile(uploadedFile);

      setParsingProgress('Consolidating duplicate AWBs & picking latest operational record...');
      setRawRows(parsed.rows);
      setUniqueRows(parsed.uniqueRows);
      setDuplicateRows(parsed.duplicateRows);
      setInvalidRows(parsed.invalidRows);

      setParsingProgress('Calculating First Attempt, Reattempt, and Employee metrics...');

      const dateStr = new Date().toISOString().split('T')[0];
      const overall = computeOverallDRSSummary(parsed.uniqueRows, {
        fileName: uploadedFile.name,
        reportDate: dateStr,
        totalRows: parsed.rawRowCount,
        validRows: parsed.rows.length,
        invalidRows: parsed.invalidRows.length,
        duplicateRows: parsed.duplicateRows.length,
      });

      const empMetrics = computeEmployeeDRSMetrics(parsed.uniqueRows);

      setSummary(overall);
      setEmployeeMetrics(empMetrics);
      setParsingProgress(null);
    } catch (err: any) {
      console.error('DRS file parse error:', err);
      alert(`Failed to parse DRS file: ${err.message || 'Invalid format'}`);
      setParsingProgress(null);
    }
  };

  // Filtered Rows for display
  const filteredUniqueRows = useMemo(() => {
    return filterDRSRows(uniqueRows, filters);
  }, [uniqueRows, filters]);

  // Re-computed employee metrics based on filters
  const filteredEmployeeMetrics = useMemo(() => {
    const metrics = computeEmployeeDRSMetrics(filteredUniqueRows);
    const minThreshold = filters.minOfdThreshold || 0;

    const filtered = metrics.filter((e) => e.total_ofd >= minThreshold);

    if (filters.sortBy) {
      filtered.sort((a, b) => {
        const valA = (a as any)[filters.sortBy!] || 0;
        const valB = (b as any)[filters.sortBy!] || 0;
        return filters.sortOrder === 'asc' ? valA - valB : valB - valA;
      });
    }

    return filtered;
  }, [filteredUniqueRows, filters]);

  // Trigger optional UNDEL import to active NDR database
  const handleImportUndelToNdr = async () => {
    if (!summary || uniqueRows.length === 0) return;

    const undelRows = uniqueRows.filter((r: DRSReportRow) => r.shipment_status_normalized === 'Undelivered');
    if (undelRows.length === 0) {
      alert('No UNDEL shipments found in this report to import.');
      return;
    }

    if (!confirm(`Import ${undelRows.length} UNDEL shipments into active NDR calling queue?`)) return;

    setImportingNdr(true);
    try {
      const parsedExcelRows: ParsedNDRExcelRow[] = undelRows.map((r: DRSReportRow) => ({
        rowIndex: r.rowIndex,
        drs_code: r.drs_code,
        waybill_no: r.waybill_no,
        Employee_name: r.employee_name,
        partner_name: r.partner_name,
        LOCATION: r.location,
        city: r.city,
        customer_name: r.customer_name,
        state: r.state,
        shipment_status: r.shipment_status_raw,
        amount_payable: r.amount_payable,
        payment_type: r.payment_type,
        POD_date: r.pod_date,
        first_attempt_date: r.first_attempt_date,
        last_attempt_date: r.last_attempt_date,
        total_attemps: r.total_attempts,
        consignee: r.consignee,
        delivery_pincode: r.delivery_pincode,
        is_mobility: r.is_mobility,
        reason: r.reason,
        otp_details: r.otp_details,
        drs_date: r.drs_date,
        drs_status: r.drs_status,
        ndr_instruction_received: r.ndr_instruction_received,
        errors: [],
        warnings: [],
        isDuplicateInFile: false,
        isExistingInDB: false,
      }));


      const res = await importNDRBatch(
        summary.fileName,
        parsedExcelRows,
        selectedHub?.id || null,
        profile?.id || null,
        profile?.name || null,
        profile?.role || null
      );

      setToastMsg(`Successfully imported ${res.importedCount} UNDEL shipments into active NDR Calling Queue!`);
    } catch (err: any) {
      console.error('NDR import error:', err);
      alert(`Failed to import NDR cases: ${err.message}`);
    } finally {
      setImportingNdr(false);
    }
  };

  const handleExportExcel = () => {
    if (!summary) return;
    exportDRSPerformanceWorkbook(summary, filteredEmployeeMetrics, uniqueRows, duplicateRows, invalidRows);
  };


  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="p-6 rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-brand-600" /> DRS Performance Analytics System
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Upload daily DRS reports for in-browser First Attempt, Reattempt, and Employee-wise delivery analysis.
          </p>
        </div>

        {summary && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleImportUndelToNdr}
              disabled={importingNdr}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-glow transition flex items-center gap-1.5 active:scale-95"
            >
              {importingNdr ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Import UNDEL to NDR
            </button>

            <button
              onClick={handleExportExcel}
              className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-glow transition flex items-center gap-1.5 active:scale-95"
            >
              <FileSpreadsheet className="h-4 w-4" /> Export Multi-Sheet Excel
            </button>
          </div>
        )}
      </div>

      {/* File Dropzone / Upload Area */}
      {!summary ? (
        <div className="p-10 rounded-2xl bg-[var(--card-bg)] border-2 border-dashed border-neutral-300 dark:border-neutral-700 text-center space-y-4 hover:border-brand-500 transition">
          <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-600/15 text-brand-600 dark:text-brand-400 mx-auto flex items-center justify-center">
            <Upload className="h-7 w-7" />
          </div>

          <div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">Upload DRS Daily Performance Report</h3>
            <p className="text-xs text-neutral-500 mt-1">Supports Excel (.xlsx, .xls) and CSV files up to 100,000+ rows</p>
          </div>

          {parsingProgress ? (
            <div className="py-4 flex flex-col items-center gap-2 text-brand-600">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="text-xs font-semibold">{parsingProgress}</span>
            </div>
          ) : (
            <label className="inline-block px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-glow transition cursor-pointer active:scale-95">
              Select DRS File
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
              />
            </label>
          )}
        </div>
      ) : (
        <>
          {/* Top Summary Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs">
            <div className="p-4 rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft">
              <span className="text-neutral-500 block font-semibold">Total OFD</span>
              <span className="text-2xl font-black text-neutral-900 dark:text-neutral-100 mt-1 block">{summary.totalOfd}</span>
              <span className="text-[10px] text-neutral-400">Unique AWBs</span>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 shadow-soft">
              <span className="text-emerald-700 dark:text-emerald-400 block font-bold">1st Attempt OFD</span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">{summary.firstAttemptOfd}</span>
              <span className="text-[10px] text-emerald-600/80 font-semibold">{summary.firstAttemptDeliveryPct}% Delivered</span>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 shadow-soft">
              <span className="text-emerald-700 dark:text-emerald-400 block font-bold">1st Attempt DEL</span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">{summary.firstAttemptDelivered}</span>
              <span className="text-[10px] text-emerald-600/80 font-semibold">{summary.firstAttemptContributionPct}% Contribution</span>
            </div>

            <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 shadow-soft">
              <span className="text-orange-700 dark:text-orange-400 block font-bold">Reattempt OFD</span>
              <span className="text-2xl font-black text-orange-600 dark:text-orange-400 mt-1 block">{summary.reattemptOfd}</span>
              <span className="text-[10px] text-orange-600/80 font-semibold">{summary.reattemptDeliveryPct}% Delivered</span>
            </div>

            <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 shadow-soft">
              <span className="text-orange-700 dark:text-orange-400 block font-bold">Reattempt DEL</span>
              <span className="text-2xl font-black text-orange-600 dark:text-orange-400 mt-1 block">{summary.reattemptDelivered}</span>
              <span className="text-[10px] text-orange-600/80 font-semibold">{summary.reattemptContributionPct}% Contribution</span>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-600/10 border border-emerald-600/30 shadow-soft">
              <span className="text-emerald-700 dark:text-emerald-400 block font-bold">Total Delivered</span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">{summary.totalDelivered}</span>
              <span className="text-[10px] text-emerald-700 font-bold">{summary.overallDeliveryPct}% Delivery Rate</span>
            </div>

            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 shadow-soft">
              <span className="text-amber-700 dark:text-amber-400 block font-bold">Total UNDEL</span>
              <span className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 block">{summary.totalUndel}</span>
              <span className="text-[10px] text-amber-600/80 font-semibold">Active NDR Cases</span>
            </div>

            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 shadow-soft">
              <span className="text-red-700 dark:text-red-400 block font-bold">Total RTO</span>
              <span className="text-2xl font-black text-red-600 dark:text-red-400 mt-1 block">{summary.totalRto}</span>
              <span className="text-[10px] text-red-600/80 font-semibold">{summary.totalCancelled} Cancelled</span>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 dark:border-neutral-800 pb-2">
            <div className="flex space-x-2">
              <button
                onClick={() => setActiveTab('EMPLOYEE')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === 'EMPLOYEE' ? 'bg-brand-600 text-white shadow-glow' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'}`}
              >
                Employee-Wise Report ({filteredEmployeeMetrics.length})
              </button>
              <button
                onClick={() => setActiveTab('FIRST_ATTEMPT')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === 'FIRST_ATTEMPT' ? 'bg-brand-600 text-white shadow-glow' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'}`}
              >
                1st Attempt Delivery Report
              </button>
              <button
                onClick={() => setActiveTab('REATTEMPT')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === 'REATTEMPT' ? 'bg-brand-600 text-white shadow-glow' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'}`}
              >
                Reattempt Delivery Report
              </button>
              <button
                onClick={() => setActiveTab('TOTAL_DELIVERY')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${activeTab === 'TOTAL_DELIVERY' ? 'bg-brand-600 text-white shadow-glow' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'}`}
              >
                Total Delivery Report
              </button>
            </div>

            {/* Threshold Filter for First Attempt / Employee tabs */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-neutral-500 font-semibold">Min OFD Threshold:</span>
              <select
                value={filters.minOfdThreshold}
                onChange={(e) => setFilters((prev) => ({ ...prev, minOfdThreshold: Number(e.target.value) }))}
                className="px-2.5 py-1.5 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-bold"
              >
                <option value={0}>All (No Min)</option>
                <option value={5}>Min 5 OFD</option>
                <option value={10}>Min 10 OFD</option>
                <option value={20}>Min 20 OFD</option>
                <option value={50}>Min 50 OFD</option>
              </select>
            </div>
          </div>

          {/* TAB 1: EMPLOYEE-WISE REPORT TABLE */}
          {activeTab === 'EMPLOYEE' && (
            <div className="rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft overflow-hidden">
              <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                  Employee Performance Table (Click row to view detail drawer)
                </span>
                <span className="text-xs text-neutral-500 font-mono">Showing {filteredEmployeeMetrics.length} Executives</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800">
                    <tr>
                      <th className="px-4 py-3">SR No</th>
                      <th className="px-4 py-3">Employee Name</th>
                      <th className="px-4 py-3">Total OFD</th>
                      <th className="px-4 py-3">1st OFD</th>
                      <th className="px-4 py-3 text-emerald-600">1st DEL</th>
                      <th className="px-4 py-3">1st Rate (%)</th>
                      <th className="px-4 py-3">Re OFD</th>
                      <th className="px-4 py-3 text-orange-600">Re DEL</th>
                      <th className="px-4 py-3">Re Rate (%)</th>
                      <th className="px-4 py-3 font-bold">Total DEL</th>
                      <th className="px-4 py-3">UNDEL</th>
                      <th className="px-4 py-3">RTO</th>
                      <th className="px-4 py-3 font-bold text-emerald-600">Overall %</th>
                      <th className="px-4 py-3 text-right">COD Value (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {filteredEmployeeMetrics.map((e, idx) => (
                      <tr
                        key={e.employee_name}
                        onClick={() => {
                          setSelectedEmployee(e);
                          setDrawerOpen(true);
                        }}
                        className="hover:bg-neutral-50 dark:hover:bg-neutral-900/30 transition cursor-pointer"
                      >
                        <td className="px-4 py-3 font-mono text-neutral-400">{idx + 1}</td>
                        <td className="px-4 py-3 font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-brand-600 shrink-0" />
                          <span>{e.employee_name}</span>
                        </td>
                        <td className="px-4 py-3 font-bold">{e.total_ofd}</td>
                        <td className="px-4 py-3">{e.first_attempt_ofd}</td>
                        <td className="px-4 py-3 font-bold text-emerald-600">{e.first_attempt_delivered}</td>
                        <td className="px-4 py-3 font-mono font-semibold text-emerald-600">{e.first_attempt_delivery_pct}%</td>
                        <td className="px-4 py-3">{e.reattempt_ofd}</td>
                        <td className="px-4 py-3 font-bold text-orange-600">{e.reattempt_delivered}</td>
                        <td className="px-4 py-3 font-mono font-semibold text-orange-600">{e.reattempt_delivery_pct}%</td>
                        <td className="px-4 py-3 font-black text-neutral-900 dark:text-neutral-100">{e.total_delivered}</td>
                        <td className="px-4 py-3 font-semibold text-amber-600">{e.total_undel}</td>
                        <td className="px-4 py-3 text-red-600">{e.total_rto}</td>
                        <td className="px-4 py-3 font-mono font-black text-emerald-600">{e.overall_delivery_pct}%</td>
                        <td className="px-4 py-3 font-mono font-bold text-right">₹{e.cod_value_total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: FIRST ATTEMPT DELIVERY REPORT */}
          {activeTab === 'FIRST_ATTEMPT' && (
            <div className="rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft overflow-hidden">
              <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" /> First Attempt Delivery Rankings (Sorted by Highest 1st Attempt Delivery %)
                </span>
                <span className="text-xs text-neutral-500 font-mono">Min Threshold: {filters.minOfdThreshold} OFD</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800">
                    <tr>
                      <th className="px-4 py-3">Rank</th>
                      <th className="px-4 py-3">Employee Name</th>
                      <th className="px-4 py-3">Total 1st Attempt OFD</th>
                      <th className="px-4 py-3 font-bold text-emerald-600">1st Attempt Delivered</th>
                      <th className="px-4 py-3">1st Attempt UNDEL</th>
                      <th className="px-4 py-3">1st Attempt Cancelled</th>
                      <th className="px-4 py-3">1st Attempt RTO</th>
                      <th className="px-4 py-3 font-black text-emerald-600">1st Attempt Delivery Rate (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {[...filteredEmployeeMetrics]
                      .sort((a, b) => b.first_attempt_delivery_pct - a.first_attempt_delivery_pct)
                      .map((e, idx) => (
                        <tr key={e.employee_name} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/30">
                          <td className="px-4 py-3 font-mono font-bold text-neutral-400">#{idx + 1}</td>
                          <td className="px-4 py-3 font-bold text-neutral-900 dark:text-neutral-100">{e.employee_name}</td>
                          <td className="px-4 py-3 font-bold">{e.first_attempt_ofd}</td>
                          <td className="px-4 py-3 font-bold text-emerald-600">{e.first_attempt_delivered}</td>
                          <td className="px-4 py-3 font-semibold text-amber-600">{e.first_attempt_undel}</td>
                          <td className="px-4 py-3 text-neutral-500">{e.first_attempt_cancelled}</td>
                          <td className="px-4 py-3 text-red-600">{e.first_attempt_rto}</td>
                          <td className="px-4 py-3 font-mono font-black text-emerald-600 text-sm">{e.first_attempt_delivery_pct}%</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: REATTEMPT DELIVERY REPORT */}
          {activeTab === 'REATTEMPT' && (
            <div className="rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft overflow-hidden">
              <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                <span className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Truck className="h-4 w-4" /> Reattempt Delivery Rankings (Sorted by Reattempt Delivery %)
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800">
                    <tr>
                      <th className="px-4 py-3">Rank</th>
                      <th className="px-4 py-3">Employee Name</th>
                      <th className="px-4 py-3">Reattempt OFD</th>
                      <th className="px-4 py-3 font-bold text-orange-600">Reattempt Delivered</th>
                      <th className="px-4 py-3">Reattempt UNDEL</th>
                      <th className="px-4 py-3">Attempt 2 DEL</th>
                      <th className="px-4 py-3">Attempt 3 DEL</th>
                      <th className="px-4 py-3">Attempt 4+ DEL</th>
                      <th className="px-4 py-3 font-black text-orange-600">Reattempt Delivery Rate (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {[...filteredEmployeeMetrics]
                      .sort((a, b) => b.reattempt_delivery_pct - a.reattempt_delivery_pct)
                      .map((e, idx) => (
                        <tr key={e.employee_name} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/30">
                          <td className="px-4 py-3 font-mono font-bold text-neutral-400">#{idx + 1}</td>
                          <td className="px-4 py-3 font-bold text-neutral-900 dark:text-neutral-100">{e.employee_name}</td>
                          <td className="px-4 py-3 font-bold">{e.reattempt_ofd}</td>
                          <td className="px-4 py-3 font-bold text-orange-600">{e.reattempt_delivered}</td>
                          <td className="px-4 py-3 font-semibold text-amber-600">{e.reattempt_undel}</td>
                          <td className="px-4 py-3">{e.attempt_2_delivered}</td>
                          <td className="px-4 py-3">{e.attempt_3_delivered}</td>
                          <td className="px-4 py-3 font-bold">{e.attempt_4plus_delivered}</td>
                          <td className="px-4 py-3 font-mono font-black text-orange-600 text-sm">{e.reattempt_delivery_pct}%</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: TOTAL DELIVERY REPORT */}
          {activeTab === 'TOTAL_DELIVERY' && (
            <div className="rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft overflow-hidden">
              <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Total Delivery & Contribution Report
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800">
                    <tr>
                      <th className="px-4 py-3">Rank</th>
                      <th className="px-4 py-3">Employee Name</th>
                      <th className="px-4 py-3">Total OFD</th>
                      <th className="px-4 py-3 font-bold text-emerald-600">Total Delivered</th>
                      <th className="px-4 py-3">1st Attempt DEL</th>
                      <th className="px-4 py-3">Reattempt DEL</th>
                      <th className="px-4 py-3 font-bold text-emerald-600">Overall Delivery %</th>
                      <th className="px-4 py-3">1st Attempt Contribution %</th>
                      <th className="px-4 py-3">Reattempt Contribution %</th>
                      <th className="px-4 py-3 text-right">Delivered COD Value (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {[...filteredEmployeeMetrics]
                      .sort((a, b) => b.total_delivered - a.total_delivered)
                      .map((e, idx) => (
                        <tr key={e.employee_name} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/30">
                          <td className="px-4 py-3 font-mono font-bold text-neutral-400">#{idx + 1}</td>
                          <td className="px-4 py-3 font-bold text-neutral-900 dark:text-neutral-100">{e.employee_name}</td>
                          <td className="px-4 py-3 font-bold">{e.total_ofd}</td>
                          <td className="px-4 py-3 font-black text-emerald-600">{e.total_delivered}</td>
                          <td className="px-4 py-3 font-bold">{e.first_attempt_delivered}</td>
                          <td className="px-4 py-3 font-bold">{e.reattempt_delivered}</td>
                          <td className="px-4 py-3 font-mono font-black text-emerald-600 text-sm">{e.overall_delivery_pct}%</td>
                          <td className="px-4 py-3 font-mono font-semibold">{e.first_attempt_contribution_pct}%</td>
                          <td className="px-4 py-3 font-mono font-semibold">{e.reattempt_contribution_pct}%</td>
                          <td className="px-4 py-3 font-mono font-bold text-right">₹{e.cod_value_delivered.toLocaleString()}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Employee Detail Drawer */}
      <DRSEmployeeDrawer
        metrics={selectedEmployee}
        shipments={uniqueRows}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      <NDRToast message={toastMsg} onClose={() => setToastMsg(null)} />
    </div>
  );
}
