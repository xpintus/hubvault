import React, { useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useHub } from '@/lib/hubContext';
import {
  computeClientDRSMetrics,
  computeEmployeeDRSMetrics,
  computeNDRReasonAnalytics,
  computeOverallDRSSummary,
  computePaymentAnalytics,
  computeRTOAnalytics,
  filterDRSRows,
} from '@/lib/drs/drsAnalyticsEngine';
import { exportDRSPerformanceWorkbook } from '@/lib/drs/drsExcelExporter';
import { deleteDRSHistoryItem, getDRSHistory, saveDRSHistoryItem } from '@/lib/drs/drsHistoryManager';
import { parseDRSFile } from '@/lib/drs/drsParser';
import { exportDRSPerformancePDF } from '@/lib/drs/drsPdfExporter';
import { importNDRBatch } from '@/lib/ndr/ndrService';
import {
  ClientDRSMetrics,
  DRSFilterOptions,
  DRSReportHistoryItem,
  DRSReportRow,
  EmployeeDRSMetrics,
  NDRReasonMetrics,
  OverallDRSSummary,
  PaymentAnalyticsMetrics,
  RTOAnalyticsMetrics,
} from '@/types/drs';
import { DRSEmployeeDrawer } from '@/components/drs/DRSEmployeeDrawer';
import { NDRToast } from '@/components/ndr/NDRToast';
import { ParsedNDRExcelRow } from '@/types/ndr';
import {
  ArrowRight,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  History,
  Layers,
  PieChart as PieIcon,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  Truck,
  Upload,
  User,
  XCircle,
} from 'lucide-react';

type TabType =
  | 'OVERVIEW'
  | 'EMPLOYEE'
  | 'FIRST_ATTEMPT'
  | 'REATTEMPT' | 'TOTAL_DELIVERY'
  | 'COD'
  | 'PREPAID'
  | 'CLIENT'
  | 'UNDEL_ANALYSIS'
  | 'RTO_ANALYSIS'
  | 'HISTORY';

export default function DRSPerformanceReport() {
  const { selectedHub } = useHub();
  const { profile } = useAuth();

  const [file, setFile] = useState<File | null>(null);
  const [parsingProgress, setParsingProgress] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('OVERVIEW');

  // Parsed Raw & Consolidated Data
  const [rawRows, setRawRows] = useState<DRSReportRow[]>([]);
  const [uniqueRows, setUniqueRows] = useState<DRSReportRow[]>([]);
  const [duplicateRows, setDuplicateRows] = useState<DRSReportRow[]>([]);
  const [invalidRows, setInvalidRows] = useState<DRSReportRow[]>([]);

  // Analytics Engine Results
  const [summary, setSummary] = useState<OverallDRSSummary | null>(null);
  const [employeeMetrics, setEmployeeMetrics] = useState<EmployeeDRSMetrics[]>([]);
  const [historyList, setHistoryList] = useState<DRSReportHistoryItem[]>(getDRSHistory());

  // Selected Employee for Detail Drawer
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeDRSMetrics | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // NDR Import Trigger State
  const [importingNdr, setImportingNdr] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Filters State
  const [filters, setFilters] = useState<DRSFilterOptions>({
    dateRangePreset: 'ALL',
    minOfdThreshold: 0,
    sortBy: 'total_delivered',
    sortOrder: 'desc',
    search: '',
  });

  const handleFileUpload = async (uploadedFile: File) => {
    setFile(uploadedFile);
    setParsingProgress('Reading DRS file contents...');
    try {
      setParsingProgress('Normalizing headers & cleaning attempt numbers...');
      const parsed = await parseDRSFile(uploadedFile);

      setParsingProgress('Consolidating duplicate AWBs & selecting latest record...');
      setRawRows(parsed.rows);
      setUniqueRows(parsed.uniqueRows);
      setDuplicateRows(parsed.duplicateRows);
      setInvalidRows(parsed.invalidRows);

      setParsingProgress('Calculating Enterprise BI Metrics & Excel Pivots...');

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

      // Auto save to history
      const historyItem: DRSReportHistoryItem = {
        id: `${uploadedFile.name}_${Date.now()}`,
        fileName: uploadedFile.name,
        reportDate: dateStr,
        uploadTimestamp: new Date().toLocaleString(),
        uploadedBy: profile?.name || 'Logistics Admin',
        hubName: selectedHub?.name || 'Main Hub',
        clientName: 'All Clients',
        totalOfd: overall.totalOfd,
        totalDelivered: overall.totalDelivered,
        totalUndel: overall.totalUndel,
        overallDeliveryPct: overall.overallDeliveryPct,
        rows: parsed.uniqueRows,
        summary: overall,
      };
      const updatedHistory = saveDRSHistoryItem(historyItem, true);
      setHistoryList(updatedHistory);
    } catch (err: any) {
      console.error('DRS parse error:', err);
      alert(`Failed to parse file: ${err.message || 'Invalid format'}`);
      setParsingProgress(null);
    }
  };

  // Filtered Rows for Display
  const filteredUniqueRows = useMemo(() => {
    return filterDRSRows(uniqueRows, filters);
  }, [uniqueRows, filters]);

  // Re-calculated Analytics Metrics based on active filters
  const filteredSummary = useMemo(() => {
    if (!summary) return null;
    if (filteredUniqueRows.length === uniqueRows.length) return summary;
    return computeOverallDRSSummary(filteredUniqueRows, {
      fileName: summary.fileName,
      reportDate: summary.reportDate,
      totalRows: summary.totalRows,
      validRows: filteredUniqueRows.length,
      invalidRows: summary.invalidRows,
      duplicateRows: summary.duplicateRows,
    });
  }, [summary, filteredUniqueRows, uniqueRows.length]);

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

  const clientMetrics = useMemo(() => {
    return computeClientDRSMetrics(filteredUniqueRows);
  }, [filteredUniqueRows]);

  const paymentMetrics = useMemo(() => {
    return computePaymentAnalytics(filteredUniqueRows);
  }, [filteredUniqueRows]);

  const reasonMetrics = useMemo(() => {
    return computeNDRReasonAnalytics(filteredUniqueRows);
  }, [filteredUniqueRows]);

  const rtoMetrics = useMemo(() => {
    return computeRTOAnalytics(filteredUniqueRows);
  }, [filteredUniqueRows]);

  const handleResetFilters = () => {
    setFilters({
      dateRangePreset: 'ALL',
      minOfdThreshold: 0,
      sortBy: 'total_delivered',
      sortOrder: 'desc',
      search: '',
    });
    setToastMsg('All filters reset to default.');
  };

  const handleExportExcel = () => {
    if (!filteredSummary) return;
    exportDRSPerformanceWorkbook(
      filteredSummary,
      filteredEmployeeMetrics,
      clientMetrics,
      paymentMetrics,
      reasonMetrics,
      rtoMetrics,
      filteredUniqueRows,
      duplicateRows,
      invalidRows
    );
  };

  const handleExportPDF = async () => {
    if (!filteredSummary) return;
    await exportDRSPerformancePDF(filteredSummary, filteredEmployeeMetrics);
  };

  // Reopen History Report Item
  const handleReopenHistory = (item: DRSReportHistoryItem) => {
    setSummary(item.summary);
    setUniqueRows(item.rows);
    setEmployeeMetrics(computeEmployeeDRSMetrics(item.rows));
    setToastMsg(`Loaded saved report: ${item.fileName}`);
  };

  const handleDeleteHistory = (id: string) => {
    if (confirm('Delete this report snapshot from history?')) {
      const updated = deleteDRSHistoryItem(id);
      setHistoryList(updated);
      setToastMsg('Report snapshot deleted.');
    }
  };

  // Trigger optional UNDEL import to active NDR queue
  const handleImportUndelToNdr = async () => {
    if (!filteredSummary || filteredUniqueRows.length === 0) return;

    const undelRows = filteredUniqueRows.filter((r) => r.shipment_status_normalized === 'Undelivered');
    if (undelRows.length === 0) {
      alert('No UNDEL shipments found matching current filters to import.');
      return;
    }

    if (!confirm(`Import ${undelRows.length} UNDEL shipments into active NDR calling queue?`)) return;

    setImportingNdr(true);
    try {
      const parsedExcelRows: ParsedNDRExcelRow[] = undelRows.map((r) => ({
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
        filteredSummary.fileName,
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

  return (
    <div className="space-y-6">
      {/* Enterprise SaaS Top Bar */}
      <div className="p-6 rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-brand-600" /> DRS Performance Analytics V4
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 uppercase tracking-wider">
              Enterprise BI Edition
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Logistics BI analytics dashboard matching Delhivery & Blue Dart operational standards.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <label className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-glow transition cursor-pointer flex items-center gap-1.5 active:scale-95">
            <Upload className="h-4 w-4" /> Upload DRS File
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

          {summary && (
            <>
              <button
                onClick={handleImportUndelToNdr}
                disabled={importingNdr}
                className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-glow transition flex items-center gap-1.5 active:scale-95"
              >
                {importingNdr ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Import UNDEL to NDR
              </button>

              <button
                onClick={handleResetFilters}
                className="px-3.5 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 text-xs font-bold text-neutral-700 dark:text-neutral-300 transition flex items-center gap-1.5"
              >
                <RotateCcw className="h-4 w-4" /> Reset
              </button>

              <button
                onClick={handleExportExcel}
                className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-glow transition flex items-center gap-1.5 active:scale-95"
              >
                <FileSpreadsheet className="h-4 w-4" /> Excel Workbook
              </button>

              <button
                onClick={handleExportPDF}
                className="px-3.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-glow transition flex items-center gap-1.5 active:scale-95"
              >
                <FileText className="h-4 w-4" /> Executive PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* Top Filter Bar Section */}
      {summary && (
        <div className="p-4 rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft space-y-3">
          <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2.5">
            <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
              <Filter className="h-4 w-4 text-brand-600" /> Enterprise Logistics Filters
            </span>
            <span className="text-xs text-neutral-500 font-mono">
              Filtered: {filteredUniqueRows.length} / {summary.totalOfd} Unique AWBs
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
            {/* Search Box */}
            <div className="col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search AWB, Executive, Customer, Client, DRS..."
                  value={filters.search}
                  onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-medium"
                />
              </div>
            </div>

            {/* Shipment Status Filter */}
            <div>
              <select
                value={filters.shipmentStatus || 'ALL'}
                onChange={(e) => setFilters((prev) => ({ ...prev, shipmentStatus: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-semibold"
              >
                <option value="ALL">All Statuses</option>
                <option value="Delivered">Delivered</option>
                <option value="Undelivered">Undelivered</option>
                <option value="Cancelled">Cancelled</option>
                <option value="RTO">RTO</option>
              </select>
            </div>

            {/* Attempt Type Filter */}
            <div>
              <select
                value={filters.attemptType || 'ALL'}
                onChange={(e) => setFilters((prev) => ({ ...prev, attemptType: e.target.value as any }))}
                className="w-full px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-semibold"
              >
                <option value="ALL">All Attempt Types</option>
                <option value="FIRST_ATTEMPT">1st Attempt (Attempt 1)</option>
                <option value="REATTEMPT">Reattempt (Attempt 2+)</option>
              </select>
            </div>

            {/* Payment Type Filter */}
            <div>
              <select
                value={filters.paymentType || 'ALL'}
                onChange={(e) => setFilters((prev) => ({ ...prev, paymentType: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-semibold"
              >
                <option value="ALL">All Payment Types</option>
                <option value="COD">COD Only</option>
                <option value="Prepaid">Prepaid Only</option>
              </select>
            </div>

            {/* Min OFD Threshold */}
            <div>
              <select
                value={filters.minOfdThreshold}
                onChange={(e) => setFilters((prev) => ({ ...prev, minOfdThreshold: Number(e.target.value) }))}
                className="w-full px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-semibold"
              >
                <option value={0}>Min OFD: None</option>
                <option value={5}>Min 5 OFD</option>
                <option value={10}>Min 10 OFD</option>
                <option value={20}>Min 20 OFD</option>
                <option value={50}>Min 50 OFD</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {!summary ? (
        /* Empty Upload Dropzone */
        <div className="p-12 rounded-2xl bg-[var(--card-bg)] border-2 border-dashed border-neutral-300 dark:border-neutral-700 text-center space-y-4 hover:border-brand-500 transition">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-600/15 text-brand-600 dark:text-brand-400 mx-auto flex items-center justify-center shadow-soft">
            <Upload className="h-8 w-8" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Upload DRS Daily Performance File</h3>
            <p className="text-xs text-neutral-500 mt-1">Select Excel (.xlsx, .xls) or CSV files for real-time BI analytics processing</p>
          </div>

          {parsingProgress ? (
            <div className="py-6 flex flex-col items-center gap-2 text-brand-600">
              <RefreshCw className="h-7 w-7 animate-spin" />
              <span className="text-xs font-bold">{parsingProgress}</span>
            </div>
          ) : (
            <label className="inline-block px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-glow transition cursor-pointer active:scale-95">
              Choose File
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
          {/* 12 PRIMARY LOGISTICS KPI CARDS SECTION */}
          {filteredSummary && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
                {/* 1. Total OFD */}
                <div className="p-4 rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft">
                  <span className="text-neutral-500 block font-semibold">1. Total OFD</span>
                  <span className="text-2xl font-black text-neutral-900 dark:text-neutral-100 mt-1 block">{filteredSummary.totalOfd}</span>
                  <span className="text-[10px] text-neutral-400 font-mono">Unique AWBs</span>
                </div>

                {/* 2. First Attempt OFD */}
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 shadow-soft">
                  <span className="text-emerald-700 dark:text-emerald-400 block font-bold">2. 1st Attempt OFD</span>
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">{filteredSummary.firstAttemptOfd}</span>
                  <span className="text-[10px] text-emerald-600/80 font-semibold">Attempt 1 Count</span>
                </div>

                {/* 3. First Attempt DEL */}
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 shadow-soft">
                  <span className="text-emerald-700 dark:text-emerald-400 block font-bold">3. 1st Attempt DEL</span>
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">{filteredSummary.firstAttemptDelivered}</span>
                  <span className="text-[10px] text-emerald-600/80 font-semibold">{filteredSummary.firstAttemptContributionPct}% Contribution</span>
                </div>

                {/* 4. First Attempt Delivery % */}
                <div className="p-4 rounded-2xl bg-emerald-600/15 border border-emerald-500/30 shadow-soft">
                  <span className="text-emerald-700 dark:text-emerald-400 block font-bold">4. 1st Attempt %</span>
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">{filteredSummary.firstAttemptDeliveryPct}%</span>
                  <span className="text-[10px] text-emerald-700 font-bold">
                    {filteredSummary.firstAttemptDeliveryPct >= 70 ? '🟢 Good' : '🔴 Warning'}
                  </span>
                </div>

                {/* 5. Reattempt OFD */}
                <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 shadow-soft">
                  <span className="text-orange-700 dark:text-orange-400 block font-bold">5. Reattempt OFD</span>
                  <span className="text-2xl font-black text-orange-600 dark:text-orange-400 mt-1 block">{filteredSummary.reattemptOfd}</span>
                  <span className="text-[10px] text-orange-600/80 font-semibold">Attempt 2+ Count</span>
                </div>

                {/* 6. Reattempt DEL */}
                <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 shadow-soft">
                  <span className="text-orange-700 dark:text-orange-400 block font-bold">6. Reattempt DEL</span>
                  <span className="text-2xl font-black text-orange-600 dark:text-orange-400 mt-1 block">{filteredSummary.reattemptDelivered}</span>
                  <span className="text-[10px] text-orange-600/80 font-semibold">{filteredSummary.reattemptContributionPct}% Contribution</span>
                </div>

                {/* 7. Reattempt Delivery % */}
                <div className="p-4 rounded-2xl bg-orange-600/15 border border-orange-500/30 shadow-soft">
                  <span className="text-orange-700 dark:text-orange-400 block font-bold">7. Reattempt %</span>
                  <span className="text-2xl font-black text-orange-600 dark:text-orange-400 mt-1 block">{filteredSummary.reattemptDeliveryPct}%</span>
                  <span className="text-[10px] text-orange-700 font-bold">Reattempt Efficiency</span>
                </div>

                {/* 8. Total Delivered */}
                <div className="p-4 rounded-2xl bg-emerald-600/20 border border-emerald-600/40 shadow-soft">
                  <span className="text-emerald-700 dark:text-emerald-400 block font-black">8. Total Delivered</span>
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">{filteredSummary.totalDelivered}</span>
                  <span className="text-[10px] text-emerald-700 font-bold">Delivered AWBs</span>
                </div>

                {/* 9. Total UNDEL */}
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 shadow-soft">
                  <span className="text-amber-700 dark:text-amber-400 block font-bold">9. Total UNDEL</span>
                  <span className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 block">{filteredSummary.totalUndel}</span>
                  <span className="text-[10px] text-amber-600/80 font-semibold">Active NDR Cases</span>
                </div>

                {/* 10. Total RTO */}
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 shadow-soft">
                  <span className="text-red-700 dark:text-red-400 block font-bold">10. Total RTO</span>
                  <span className="text-2xl font-black text-red-600 dark:text-red-400 mt-1 block">{filteredSummary.totalRto}</span>
                  <span className="text-[10px] text-red-600/80 font-semibold">Return To Origin</span>
                </div>

                {/* 11. Total Cancel */}
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 shadow-soft">
                  <span className="text-rose-700 dark:text-rose-400 block font-bold">11. Total Cancel</span>
                  <span className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1 block">{filteredSummary.totalCancelled}</span>
                  <span className="text-[10px] text-rose-600/80 font-semibold">Cancelled Orders</span>
                </div>

                {/* 12. Overall Delivery % */}
                <div className="p-4 rounded-2xl bg-brand-500/15 border border-brand-500/30 shadow-soft">
                  <span className="text-brand-700 dark:text-brand-400 block font-black">12. Overall Delivery %</span>
                  <span className="text-2xl font-black text-brand-600 dark:text-brand-400 mt-1 block">{filteredSummary.overallDeliveryPct}%</span>
                  <span className="text-[10px] text-brand-700 font-bold">Overall Efficiency</span>
                </div>
              </div>

              {/* PAYMENT ANALYTICS KPI CARDS */}
              <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2 text-xs">
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <span className="text-neutral-500 block font-semibold">COD OFD</span>
                  <span className="text-lg font-black text-purple-600">{paymentMetrics.codOfd}</span>
                </div>
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <span className="text-neutral-500 block font-semibold">COD DEL</span>
                  <span className="text-lg font-black text-purple-600">{paymentMetrics.codDelivered}</span>
                </div>
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <span className="text-neutral-500 block font-semibold">COD %</span>
                  <span className="text-lg font-black text-purple-600">{paymentMetrics.codDeliveryPct}%</span>
                </div>
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <span className="text-neutral-500 block font-semibold">COD Pending</span>
                  <span className="text-lg font-black text-purple-600">{paymentMetrics.codPending}</span>
                </div>
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <span className="text-neutral-500 block font-semibold">COD Amount</span>
                  <span className="text-sm font-black text-purple-600 font-mono">₹{paymentMetrics.codTotalAmount.toLocaleString()}</span>
                </div>

                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <span className="text-neutral-500 block font-semibold">Prepaid OFD</span>
                  <span className="text-lg font-black text-blue-600">{paymentMetrics.prepaidOfd}</span>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <span className="text-neutral-500 block font-semibold">Prepaid DEL</span>
                  <span className="text-lg font-black text-blue-600">{paymentMetrics.prepaidDelivered}</span>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <span className="text-neutral-500 block font-semibold">Prepaid %</span>
                  <span className="text-lg font-black text-blue-600">{paymentMetrics.prepaidDeliveryPct}%</span>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <span className="text-neutral-500 block font-semibold">Prepaid Pend</span>
                  <span className="text-lg font-black text-blue-600">{paymentMetrics.prepaidPending}</span>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <span className="text-neutral-500 block font-semibold">Prepaid Amt</span>
                  <span className="text-sm font-black text-blue-600 font-mono">₹{paymentMetrics.prepaidTotalAmount.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* 11 ENTERPRISE NAVIGATION TABS */}
          <div className="border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto no-scrollbar">
            <nav className="flex space-x-1 min-w-max pb-1">
              {[
                { id: 'OVERVIEW', label: 'Overview BI' },
                { id: 'EMPLOYEE', label: `Employee Report (${filteredEmployeeMetrics.length})` },
                { id: 'FIRST_ATTEMPT', label: '1st Attempt Report' },
                { id: 'REATTEMPT', label: 'Reattempt Report' },
                { id: 'TOTAL_DELIVERY', label: 'Total Delivery Report' },
                { id: 'COD', label: 'COD Report' },
                { id: 'PREPAID', label: 'Prepaid Report' },
                { id: 'CLIENT', label: `Client Report (${clientMetrics.length})` },
                { id: 'UNDEL_ANALYSIS', label: 'UNDEL Analysis' },
                { id: 'RTO_ANALYSIS', label: 'RTO Analysis' },
                { id: 'HISTORY', label: `Report History (${historyList.length})` },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as TabType)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeTab === t.id
                      ? 'bg-brand-600 text-white shadow-glow'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>

          {/* TAB 1: OVERVIEW VISUAL BI DASHBOARD */}
          {activeTab === 'OVERVIEW' && filteredSummary && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-xs">
              {/* Delivery Efficiency Progress */}
              <div className="p-6 rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft space-y-4">
                <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-xs">
                  Overall Delivery Efficiency Rate
                </h3>
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-black text-brand-600">{filteredSummary.overallDeliveryPct}%</span>
                  <span className="text-neutral-500 font-semibold">{filteredSummary.totalDelivered} / {filteredSummary.totalOfd} DEL</span>
                </div>
                <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-3 rounded-full overflow-hidden">
                  <div className="bg-brand-600 h-full rounded-full transition-all" style={{ width: `${filteredSummary.overallDeliveryPct}%` }} />
                </div>
              </div>

              {/* Attempt Distribution */}
              <div className="p-6 rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft space-y-4">
                <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-xs">
                  Attempt Contribution Breakdown
                </h3>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between font-semibold mb-1">
                      <span>1st Attempt Contribution</span>
                      <span className="font-bold text-emerald-600">{filteredSummary.firstAttemptContributionPct}%</span>
                    </div>
                    <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-2.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${filteredSummary.firstAttemptContributionPct}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between font-semibold mb-1">
                      <span>Reattempt Contribution</span>
                      <span className="font-bold text-orange-600">{filteredSummary.reattemptContributionPct}%</span>
                    </div>
                    <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-2.5 rounded-full overflow-hidden">
                      <div className="bg-orange-500 h-full rounded-full" style={{ width: `${filteredSummary.reattemptContributionPct}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* COD vs Prepaid Distribution */}
              <div className="p-6 rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft space-y-4">
                <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-xs">
                  Payment Method Distribution
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-purple-600">COD OFD</span>
                    <span className="font-bold">{paymentMetrics.codOfd} AWBs ({paymentMetrics.codDeliveryPct}% DEL)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-blue-600">Prepaid OFD</span>
                    <span className="font-bold">{paymentMetrics.prepaidOfd} AWBs ({paymentMetrics.prepaidDeliveryPct}% DEL)</span>
                  </div>
                </div>
              </div>

              {/* Top 5 Performers Leaderboard */}
              <div className="p-6 rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft space-y-3">
                <h3 className="font-bold text-emerald-600 uppercase tracking-wider text-xs flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" /> Top 5 Executives
                </h3>
                <div className="space-y-2">
                  {filteredEmployeeMetrics.slice(0, 5).map((e, idx) => (
                    <div key={e.employee_name} className="flex items-center justify-between p-2 rounded-xl bg-emerald-500/5">
                      <span className="font-bold">#{idx + 1} {e.employee_name}</span>
                      <span className="font-mono font-black text-emerald-600">{e.overall_delivery_pct}% ({e.total_delivered} DEL)</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top 5 NDR Reasons */}
              <div className="p-6 rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft space-y-3">
                <h3 className="font-bold text-amber-600 uppercase tracking-wider text-xs flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4" /> Top 5 NDR Reasons
                </h3>
                <div className="space-y-2">
                  {reasonMetrics.slice(0, 5).map((r) => (
                    <div key={r.reason} className="flex items-center justify-between p-2 rounded-xl bg-amber-500/5">
                      <span className="truncate max-w-[200px] font-semibold">{r.reason}</span>
                      <span className="font-bold font-mono">{r.count} AWBs ({r.percentage}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EMPLOYEE REPORT TABLE */}
          {activeTab === 'EMPLOYEE' && (
            <div className="rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft overflow-hidden">
              <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs">
                <span className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
                  Employee Performance Table (Click row to open Executive Drawer)
                </span>
                <span className="text-neutral-500 font-mono">Count: {filteredEmployeeMetrics.length}</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800">
                    <tr>
                      <th className="px-4 py-3">Rank</th>
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">Total OFD</th>
                      <th className="px-4 py-3">1st OFD</th>
                      <th className="px-4 py-3 text-emerald-600">1st DEL</th>
                      <th className="px-4 py-3">1st %</th>
                      <th className="px-4 py-3">Re OFD</th>
                      <th className="px-4 py-3 text-orange-600">Re DEL</th>
                      <th className="px-4 py-3">Re %</th>
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
                        <td className="px-4 py-3 font-mono font-bold text-neutral-400">#{idx + 1}</td>
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

          {/* TAB 8: CLIENT REPORT TABLE */}
          {activeTab === 'CLIENT' && (
            <div className="rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft overflow-hidden text-xs">
              <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                <span className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
                  Client / Merchant Wise Performance Summary
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800">
                    <tr>
                      <th className="px-4 py-3">Client / Merchant Name</th>
                      <th className="px-4 py-3">Total OFD</th>
                      <th className="px-4 py-3 font-bold text-emerald-600">Total DEL</th>
                      <th className="px-4 py-3">UNDEL</th>
                      <th className="px-4 py-3 font-black text-emerald-600">Overall Delivery %</th>
                      <th className="px-4 py-3">COD OFD</th>
                      <th className="px-4 py-3">COD DEL</th>
                      <th className="px-4 py-3">Prepaid OFD</th>
                      <th className="px-4 py-3">Prepaid DEL</th>
                      <th className="px-4 py-3 text-right">COD Value (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {clientMetrics.map((c) => (
                      <tr key={c.client_name} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/30">
                        <td className="px-4 py-3 font-bold text-neutral-900 dark:text-neutral-100">{c.client_name}</td>
                        <td className="px-4 py-3 font-bold">{c.total_ofd}</td>
                        <td className="px-4 py-3 font-bold text-emerald-600">{c.total_delivered}</td>
                        <td className="px-4 py-3 font-semibold text-amber-600">{c.total_undel}</td>
                        <td className="px-4 py-3 font-mono font-black text-emerald-600">{c.overall_delivery_pct}%</td>
                        <td className="px-4 py-3">{c.cod_ofd}</td>
                        <td className="px-4 py-3 font-bold text-purple-600">{c.cod_delivered}</td>
                        <td className="px-4 py-3">{c.prepaid_ofd}</td>
                        <td className="px-4 py-3 font-bold text-blue-600">{c.prepaid_delivered}</td>
                        <td className="px-4 py-3 font-mono font-bold text-right">₹{c.cod_value_total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 9: UNDEL ANALYSIS */}
          {activeTab === 'UNDEL_ANALYSIS' && (
            <div className="rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft overflow-hidden text-xs">
              <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                <span className="font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4" /> NDR Reason Analysis & Executive Failures
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800">
                    <tr>
                      <th className="px-4 py-3">Rank</th>
                      <th className="px-4 py-3">NDR Reason</th>
                      <th className="px-4 py-3 font-bold">UNDEL Count</th>
                      <th className="px-4 py-3 font-bold text-amber-600">Share %</th>
                      <th className="px-4 py-3">Top Executive Affected</th>
                      <th className="px-4 py-3">Top Exec Failure Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {reasonMetrics.map((r, idx) => (
                      <tr key={r.reason} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/30">
                        <td className="px-4 py-3 font-mono font-bold text-neutral-400">#{idx + 1}</td>
                        <td className="px-4 py-3 font-bold text-neutral-900 dark:text-neutral-100">{r.reason}</td>
                        <td className="px-4 py-3 font-bold">{r.count}</td>
                        <td className="px-4 py-3 font-mono font-bold text-amber-600">{r.percentage}%</td>
                        <td className="px-4 py-3 font-semibold">{r.affectedExecutives[0]?.name || 'N/A'}</td>
                        <td className="px-4 py-3 font-mono font-bold">{r.affectedExecutives[0]?.count || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 11: REPORT HISTORY */}
          {activeTab === 'HISTORY' && (
            <div className="rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft overflow-hidden text-xs">
              <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                <span className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="h-4 w-4 text-brand-600" /> Stored DRS Upload History ({historyList.length})
                </span>
              </div>

              {historyList.length === 0 ? (
                <div className="p-8 text-center text-neutral-500">No report history saved yet. Upload a DRS report to begin.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800">
                      <tr>
                        <th className="px-4 py-3">Upload Time</th>
                        <th className="px-4 py-3">File Name</th>
                        <th className="px-4 py-3">Uploaded By</th>
                        <th className="px-4 py-3">Total OFD</th>
                        <th className="px-4 py-3 font-bold text-emerald-600">Delivered</th>
                        <th className="px-4 py-3">UNDEL</th>
                        <th className="px-4 py-3 font-black text-emerald-600">Delivery %</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                      {historyList.map((h) => (
                        <tr key={h.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/30">
                          <td className="px-4 py-3 font-mono">{h.uploadTimestamp}</td>
                          <td className="px-4 py-3 font-bold text-neutral-900 dark:text-neutral-100">{h.fileName}</td>
                          <td className="px-4 py-3">{h.uploadedBy}</td>
                          <td className="px-4 py-3 font-bold">{h.totalOfd}</td>
                          <td className="px-4 py-3 font-bold text-emerald-600">{h.totalDelivered}</td>
                          <td className="px-4 py-3 font-semibold text-amber-600">{h.totalUndel}</td>
                          <td className="px-4 py-3 font-mono font-black text-emerald-600">{h.overallDeliveryPct}%</td>
                          <td className="px-4 py-3 text-right flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleReopenHistory(h)}
                              className="px-3 py-1 rounded-lg bg-brand-600 text-white font-bold transition"
                            >
                              Reopen
                            </button>
                            <button
                              onClick={() => handleDeleteHistory(h.id)}
                              className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Employee Detail Side Drawer */}
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
