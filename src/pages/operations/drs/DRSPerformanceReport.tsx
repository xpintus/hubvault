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
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  CreditCard,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  History,
  Package,
  PieChart as PieIcon,
  RefreshCw,
  RotateCcw,
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
  | 'REATTEMPT'
  | 'COD'
  | 'PREPAID'
  | 'CLIENTS'
  | 'HISTORY';

export default function DRSPerformanceReport() {
  const { selectedHub } = useHub();
  const { profile } = useAuth();

  const [parsingProgress, setParsingProgress] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('OVERVIEW');

  // Parsed Raw & Consolidated Data
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

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Filters State
  const [filters, setFilters] = useState<DRSFilterOptions>({
    dateRangePreset: 'ALL',
    minOfdThreshold: 0,
    sortBy: 'overall_delivery_pct',
    sortOrder: 'desc',
    search: '',
  });

  const handleFileUpload = async (uploadedFile: File) => {
    setParsingProgress('Reading DRS file contents...');
    try {
      setParsingProgress('Processing & consolidating AWBs...');
      const parsed = await parseDRSFile(uploadedFile);

      setUniqueRows(parsed.uniqueRows);
      setDuplicateRows(parsed.duplicateRows);
      setInvalidRows(parsed.invalidRows);

      setParsingProgress('Calculating Excel Pivot Analytics...');
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

      // Save report snapshot to history
      const historyItem: DRSReportHistoryItem = {
        id: `${uploadedFile.name}_${Date.now()}`,
        fileName: uploadedFile.name,
        reportDate: dateStr,
        uploadTimestamp: new Date().toLocaleString(),
        uploadedBy: profile?.name || 'Logistics Manager',
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
      setToastMsg('DRS File processed successfully!');
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

  // Filtered Analytics Summary
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
      sortBy: 'overall_delivery_pct',
      sortOrder: 'desc',
      search: '',
    });
    setToastMsg('Filters reset to default.');
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

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* ========================================================= */}
      {/* SECTION 1: TOP HEADER & CONTROLS                          */}
      {/* ========================================================= */}
      <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-brand-600" /> DRS Performance Dashboard
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400 border border-brand-200 dark:border-brand-800">
              V5 SMART EDITION
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-neutral-500 mt-1">
            <span className="flex items-center gap-1 font-medium"><Calendar className="h-3.5 w-3.5 text-neutral-400" /> Date: {summary?.reportDate || 'Today'}</span>
            <span className="flex items-center gap-1 font-medium"><Building2 className="h-3.5 w-3.5 text-neutral-400" /> Hub: {selectedHub?.name || 'Main Hub'}</span>
          </div>
        </div>

        {/* Global Search & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {summary && (
            <div className="relative min-w-[240px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search AWB, Executive, Client..."
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-medium focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
          )}

          <label className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-md transition cursor-pointer flex items-center gap-1.5 active:scale-95">
            <Upload className="h-4 w-4" /> Upload DRS
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
                onClick={handleResetFilters}
                className="px-3.5 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 text-xs font-bold text-neutral-700 dark:text-neutral-300 transition flex items-center gap-1.5"
              >
                <RotateCcw className="h-4 w-4" /> Reset
              </button>

              <button
                onClick={handleExportExcel}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition flex items-center gap-1.5 active:scale-95"
              >
                <FileSpreadsheet className="h-4 w-4" /> Export Excel
              </button>

              <button
                onClick={handleExportPDF}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md transition flex items-center gap-1.5 active:scale-95"
              >
                <FileText className="h-4 w-4" /> Export PDF
              </button>
            </>
          )}
        </div>
      </div>

      {!summary ? (
        /* Empty Upload Dropzone */
        <div className="p-12 rounded-2xl bg-white dark:bg-neutral-900 border-2 border-dashed border-neutral-300 dark:border-neutral-700 text-center space-y-4 hover:border-brand-500 transition shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 mx-auto flex items-center justify-center">
            <Upload className="h-8 w-8" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Upload DRS Daily Report</h3>
            <p className="text-xs text-neutral-500 mt-1">Select Excel (.xlsx, .xls) or CSV files for instant 5-second logistics analytics</p>
          </div>

          {parsingProgress ? (
            <div className="py-6 flex flex-col items-center gap-2 text-brand-600">
              <RefreshCw className="h-7 w-7 animate-spin" />
              <span className="text-xs font-bold">{parsingProgress}</span>
            </div>
          ) : (
            <label className="inline-block px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-md transition cursor-pointer active:scale-95">
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
          {/* ========================================================= */}
          {/* SECTION 2: TODAY SUMMARY (EXACTLY 6 LARGE KPI CARDS)      */}
          {/* ========================================================= */}
          {filteredSummary && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* 1. Total OFD */}
              <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-1">
                <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-brand-600" /> Total OFD
                </span>
                <span className="text-3xl font-black text-neutral-900 dark:text-neutral-100 block tracking-tight">
                  {filteredSummary.totalOfd}
                </span>
                <span className="text-[11px] text-neutral-400 font-medium block">Unique AWBs</span>
              </div>

              {/* 2. Delivered */}
              <div className="p-5 rounded-2xl bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/20 shadow-sm space-y-1">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Delivered
                </span>
                <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 block tracking-tight">
                  {filteredSummary.totalDelivered}
                </span>
                <span className="text-[11px] text-emerald-600/80 font-bold block">{filteredSummary.overallDeliveryPct}% Delivery Rate</span>
              </div>

              {/* 3. UNDEL */}
              <div className="p-5 rounded-2xl bg-rose-500/5 dark:bg-rose-950/20 border border-rose-500/20 shadow-sm space-y-1">
                <span className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                  <XCircle className="h-4 w-4 text-rose-600" /> UNDEL
                </span>
                <span className="text-3xl font-black text-rose-600 dark:text-rose-400 block tracking-tight">
                  {filteredSummary.totalUndel}
                </span>
                <span className="text-[11px] text-rose-600/80 font-semibold block">Active NDR Cases</span>
              </div>

              {/* 4. First Attempt % */}
              <div className="p-5 rounded-2xl bg-blue-500/5 dark:bg-blue-950/20 border border-blue-500/20 shadow-sm space-y-1">
                <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                  🥇 1st Attempt %
                </span>
                <span className="text-3xl font-black text-blue-600 dark:text-blue-400 block tracking-tight">
                  {filteredSummary.firstAttemptDeliveryPct}%
                </span>
                <span className="text-[11px] text-blue-600/80 font-semibold block">{filteredSummary.firstAttemptDelivered} / {filteredSummary.firstAttemptOfd} DEL</span>
              </div>

              {/* 5. Reattempt % */}
              <div className="p-5 rounded-2xl bg-purple-500/5 dark:bg-purple-950/20 border border-purple-500/20 shadow-sm space-y-1">
                <span className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                  🔄 Reattempt %
                </span>
                <span className="text-3xl font-black text-purple-600 dark:text-purple-400 block tracking-tight">
                  {filteredSummary.reattemptDeliveryPct}%
                </span>
                <span className="text-[11px] text-purple-600/80 font-semibold block">{filteredSummary.reattemptDelivered} / {filteredSummary.reattemptOfd} DEL</span>
              </div>

              {/* 6. COD Pending */}
              <div className="p-5 rounded-2xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 shadow-sm space-y-1">
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  💰 COD Pending
                </span>
                <span className="text-2xl font-black text-amber-600 dark:text-amber-400 block tracking-tight font-mono">
                  ₹{(paymentMetrics.codTotalAmount - paymentMetrics.codDeliveredAmount).toLocaleString()}
                </span>
                <span className="text-[11px] text-amber-600/80 font-semibold block">{paymentMetrics.codPending} Pending COD AWBs</span>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SECTION 3: PERFORMANCE SUMMARY (EXACTLY 4 CARDS)          */}
          {/* ========================================================= */}
          {filteredSummary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Delivery % */}
              <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">Overall Delivery Rate</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600">Target 80%+</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-black text-emerald-600">{filteredSummary.overallDeliveryPct}%</span>
                  <span className="text-xs text-neutral-400 font-semibold">{filteredSummary.totalDelivered} / {filteredSummary.totalOfd} AWBs</span>
                </div>
                <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${filteredSummary.overallDeliveryPct}%` }} />
                </div>
              </div>

              {/* Card 2: First Attempt % */}
              <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">1st Attempt Rate</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-600">Target 70%+</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-black text-blue-600">{filteredSummary.firstAttemptDeliveryPct}%</span>
                  <span className="text-xs text-neutral-400 font-semibold">{filteredSummary.firstAttemptDelivered} / {filteredSummary.firstAttemptOfd} AWBs</span>
                </div>
                <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full rounded-full transition-all" style={{ width: `${filteredSummary.firstAttemptDeliveryPct}%` }} />
                </div>
              </div>

              {/* Card 3: Reattempt % */}
              <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">Reattempt Rate</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/10 text-purple-600">Efficiency</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-black text-purple-600">{filteredSummary.reattemptDeliveryPct}%</span>
                  <span className="text-xs text-neutral-400 font-semibold">{filteredSummary.reattemptDelivered} / {filteredSummary.reattemptOfd} AWBs</span>
                </div>
                <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-purple-500 h-full rounded-full transition-all" style={{ width: `${filteredSummary.reattemptDeliveryPct}%` }} />
                </div>
              </div>

              {/* Card 4: COD Collection % */}
              <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">COD Collection Rate</span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600">Financial</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-black text-amber-600">{paymentMetrics.codDeliveryPct}%</span>
                  <span className="text-xs text-neutral-400 font-semibold">{paymentMetrics.codDelivered} / {paymentMetrics.codOfd} COD</span>
                </div>
                <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-2.5 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full transition-all" style={{ width: `${paymentMetrics.codDeliveryPct}%` }} />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SECTION 4: 8 CLEAN NAVIGATION TABS                        */}
          {/* ========================================================= */}
          <div className="space-y-4">
            <div className="border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto no-scrollbar">
              <nav className="flex space-x-1 min-w-max pb-1">
                {[
                  { id: 'OVERVIEW', label: 'Overview' },
                  { id: 'EMPLOYEE', label: `Employee Report (${filteredEmployeeMetrics.length})` },
                  { id: 'FIRST_ATTEMPT', label: 'First Attempt' },
                  { id: 'REATTEMPT', label: 'Reattempt' },
                  { id: 'COD', label: 'COD' },
                  { id: 'PREPAID', label: 'Prepaid' },
                  { id: 'CLIENTS', label: `Clients (${clientMetrics.length})` },
                  { id: 'HISTORY', label: `History (${historyList.length})` },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id as TabType)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      activeTab === t.id
                        ? 'bg-brand-600 text-white shadow-md'
                        : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* TAB 1: OVERVIEW */}
            {activeTab === 'OVERVIEW' && filteredSummary && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 text-xs">
                {/* 1. Delivery Pie Progress */}
                <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-3">
                  <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-xs flex items-center gap-2">
                    <PieIcon className="h-4 w-4 text-brand-600" /> Delivery Status Distribution
                  </h3>
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-emerald-600">Delivered</span>
                      <span className="font-bold font-mono">{filteredSummary.totalDelivered} AWBs ({filteredSummary.overallDeliveryPct}%)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-rose-600">Undelivered</span>
                      <span className="font-bold font-mono">{filteredSummary.totalUndel} AWBs</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-purple-600">RTO / Cancelled</span>
                      <span className="font-bold font-mono">{filteredSummary.totalRto + filteredSummary.totalCancelled} AWBs</span>
                    </div>
                  </div>
                </div>

                {/* 2. Attempt Chart */}
                <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-3">
                  <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-xs flex items-center gap-2">
                    <Truck className="h-4 w-4 text-blue-600" /> Attempt Distribution
                  </h3>
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-blue-600">1st Attempt OFD</span>
                      <span className="font-bold font-mono">{filteredSummary.firstAttemptOfd} AWBs</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-purple-600">Reattempt OFD</span>
                      <span className="font-bold font-mono">{filteredSummary.reattemptOfd} AWBs</span>
                    </div>
                  </div>
                </div>

                {/* 3. COD vs Prepaid */}
                <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-3">
                  <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-xs flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-purple-600" /> COD vs Prepaid Breakdown
                  </h3>
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-purple-600">COD OFD</span>
                      <span className="font-bold font-mono">{paymentMetrics.codOfd} ({paymentMetrics.codDeliveryPct}% DEL)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-blue-600">Prepaid OFD</span>
                      <span className="font-bold font-mono">{paymentMetrics.prepaidOfd} ({paymentMetrics.prepaidDeliveryPct}% DEL)</span>
                    </div>
                  </div>
                </div>

                {/* 4. Top 5 Executives */}
                <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-3">
                  <h3 className="font-bold text-emerald-600 uppercase tracking-wider text-xs flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4" /> Top 5 Executives
                  </h3>
                  <div className="space-y-2">
                    {filteredEmployeeMetrics.slice(0, 5).map((e, idx) => (
                      <div key={e.employee_name} className="flex items-center justify-between p-2 rounded-xl bg-emerald-500/5">
                        <span className="font-bold text-neutral-900 dark:text-neutral-100">#{idx + 1} {e.employee_name}</span>
                        <span className="font-mono font-black text-emerald-600">{e.overall_delivery_pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 5. Top 5 NDR Reasons */}
                <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-3">
                  <h3 className="font-bold text-rose-600 uppercase tracking-wider text-xs flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4" /> Top 5 NDR Reasons
                  </h3>
                  <div className="space-y-2">
                    {reasonMetrics.slice(0, 5).map((r) => (
                      <div key={r.reason} className="flex items-center justify-between p-2 rounded-xl bg-rose-500/5">
                        <span className="truncate max-w-[180px] font-semibold text-neutral-900 dark:text-neutral-100">{r.reason}</span>
                        <span className="font-bold font-mono text-rose-600">{r.count} AWBs</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: EMPLOYEE REPORT */}
            {activeTab === 'EMPLOYEE' && (
              <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm overflow-hidden text-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-neutral-50 dark:bg-neutral-800/60 text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800">
                      <tr>
                        <th className="px-4 py-3">Rank</th>
                        <th className="px-4 py-3">Employee</th>
                        <th className="px-4 py-3 font-bold">OFD</th>
                        <th className="px-4 py-3 font-bold text-emerald-600">Delivered</th>
                        <th className="px-4 py-3">UNDEL</th>
                        <th className="px-4 py-3 font-semibold text-blue-600">First Attempt %</th>
                        <th className="px-4 py-3 font-semibold text-purple-600">Reattempt %</th>
                        <th className="px-4 py-3">COD</th>
                        <th className="px-4 py-3 font-black text-emerald-600">Overall %</th>
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
                          className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 cursor-pointer transition"
                        >
                          <td className="px-4 py-3 font-mono font-bold text-neutral-400">#{idx + 1}</td>
                          <td className="px-4 py-3 font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-brand-600" /> {e.employee_name}
                          </td>
                          <td className="px-4 py-3 font-bold">{e.total_ofd}</td>
                          <td className="px-4 py-3 font-bold text-emerald-600">{e.total_delivered}</td>
                          <td className="px-4 py-3 font-semibold text-rose-600">{e.total_undel}</td>
                          <td className="px-4 py-3 font-mono font-bold text-blue-600">{e.first_attempt_delivery_pct}%</td>
                          <td className="px-4 py-3 font-mono font-bold text-purple-600">{e.reattempt_delivery_pct}%</td>
                          <td className="px-4 py-3 font-mono">₹{e.cod_value_total.toLocaleString()}</td>
                          <td className="px-4 py-3 font-mono font-black text-emerald-600">{e.overall_delivery_pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: FIRST ATTEMPT */}
            {activeTab === 'FIRST_ATTEMPT' && (
              <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm overflow-hidden text-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-neutral-50 dark:bg-neutral-800/60 text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800">
                      <tr>
                        <th className="px-4 py-3">Employee</th>
                        <th className="px-4 py-3 font-bold">1st OFD</th>
                        <th className="px-4 py-3 font-bold text-emerald-600">1st DEL</th>
                        <th className="px-4 py-3">1st UNDEL</th>
                        <th className="px-4 py-3 font-black text-blue-600">Delivery %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                      {filteredEmployeeMetrics.map((e) => (
                        <tr key={e.employee_name} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                          <td className="px-4 py-3 font-bold text-neutral-900 dark:text-neutral-100">{e.employee_name}</td>
                          <td className="px-4 py-3 font-bold">{e.first_attempt_ofd}</td>
                          <td className="px-4 py-3 font-bold text-emerald-600">{e.first_attempt_delivered}</td>
                          <td className="px-4 py-3 font-semibold text-rose-600">{e.first_attempt_undel}</td>
                          <td className="px-4 py-3 font-mono font-black text-blue-600">{e.first_attempt_delivery_pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: REATTEMPT */}
            {activeTab === 'REATTEMPT' && (
              <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm overflow-hidden text-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-neutral-50 dark:bg-neutral-800/60 text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800">
                      <tr>
                        <th className="px-4 py-3">Employee</th>
                        <th className="px-4 py-3 font-bold">Re OFD</th>
                        <th className="px-4 py-3 font-bold text-emerald-600">Re DEL</th>
                        <th className="px-4 py-3">Re UNDEL</th>
                        <th className="px-4 py-3 font-black text-purple-600">Delivery %</th>
                        <th className="px-4 py-3">Avg Attempts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                      {filteredEmployeeMetrics.map((e) => (
                        <tr key={e.employee_name} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                          <td className="px-4 py-3 font-bold text-neutral-900 dark:text-neutral-100">{e.employee_name}</td>
                          <td className="px-4 py-3 font-bold">{e.reattempt_ofd}</td>
                          <td className="px-4 py-3 font-bold text-emerald-600">{e.reattempt_delivered}</td>
                          <td className="px-4 py-3 font-semibold text-rose-600">{e.reattempt_undel}</td>
                          <td className="px-4 py-3 font-mono font-black text-purple-600">{e.reattempt_delivery_pct}%</td>
                          <td className="px-4 py-3 font-mono">{e.average_attempts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 5: COD */}
            {activeTab === 'COD' && (
              <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm overflow-hidden text-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-neutral-50 dark:bg-neutral-800/60 text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800">
                      <tr>
                        <th className="px-4 py-3">Employee</th>
                        <th className="px-4 py-3 font-bold">COD OFD</th>
                        <th className="px-4 py-3 font-bold text-emerald-600">COD Delivered</th>
                        <th className="px-4 py-3 font-bold text-amber-600">COD Pending</th>
                        <th className="px-4 py-3 font-black text-purple-600">COD Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                      {filteredEmployeeMetrics.map((e) => (
                        <tr key={e.employee_name} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                          <td className="px-4 py-3 font-bold text-neutral-900 dark:text-neutral-100">{e.employee_name}</td>
                          <td className="px-4 py-3 font-bold">{e.cod_ofd}</td>
                          <td className="px-4 py-3 font-bold text-emerald-600">{e.cod_delivered}</td>
                          <td className="px-4 py-3 font-semibold text-amber-600">{e.cod_pending}</td>
                          <td className="px-4 py-3 font-mono font-bold text-purple-600">₹{e.cod_value_total.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 6: PREPAID */}
            {activeTab === 'PREPAID' && (
              <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm overflow-hidden text-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-neutral-50 dark:bg-neutral-800/60 text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800">
                      <tr>
                        <th className="px-4 py-3">Employee</th>
                        <th className="px-4 py-3 font-bold">Prepaid OFD</th>
                        <th className="px-4 py-3 font-bold text-emerald-600">Delivered</th>
                        <th className="px-4 py-3">Pending</th>
                        <th className="px-4 py-3 font-black text-blue-600">Delivery %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                      {filteredEmployeeMetrics.map((e) => (
                        <tr key={e.employee_name} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                          <td className="px-4 py-3 font-bold text-neutral-900 dark:text-neutral-100">{e.employee_name}</td>
                          <td className="px-4 py-3 font-bold">{e.prepaid_ofd}</td>
                          <td className="px-4 py-3 font-bold text-emerald-600">{e.prepaid_delivered}</td>
                          <td className="px-4 py-3 font-semibold text-amber-600">{e.prepaid_pending}</td>
                          <td className="px-4 py-3 font-mono font-black text-blue-600">{e.prepaid_delivery_pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 7: CLIENTS */}
            {activeTab === 'CLIENTS' && (
              <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm overflow-hidden text-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-neutral-50 dark:bg-neutral-800/60 text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800">
                      <tr>
                        <th className="px-4 py-3">Client Name</th>
                        <th className="px-4 py-3 font-bold">OFD</th>
                        <th className="px-4 py-3 font-bold text-emerald-600">Delivered</th>
                        <th className="px-4 py-3">UNDEL</th>
                        <th className="px-4 py-3 font-black text-emerald-600">Delivery %</th>
                        <th className="px-4 py-3">COD OFD</th>
                        <th className="px-4 py-3">Prepaid OFD</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                      {clientMetrics.map((c) => (
                        <tr key={c.client_name} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                          <td className="px-4 py-3 font-bold text-neutral-900 dark:text-neutral-100">{c.client_name}</td>
                          <td className="px-4 py-3 font-bold">{c.total_ofd}</td>
                          <td className="px-4 py-3 font-bold text-emerald-600">{c.total_delivered}</td>
                          <td className="px-4 py-3 font-semibold text-rose-600">{c.total_undel}</td>
                          <td className="px-4 py-3 font-mono font-black text-emerald-600">{c.overall_delivery_pct}%</td>
                          <td className="px-4 py-3 font-mono">{c.cod_ofd}</td>
                          <td className="px-4 py-3 font-mono">{c.prepaid_ofd}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 8: HISTORY */}
            {activeTab === 'HISTORY' && (
              <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm overflow-hidden text-xs">
                {historyList.length === 0 ? (
                  <div className="p-8 text-center text-neutral-500">No report history saved yet. Upload a DRS report to begin.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-neutral-50 dark:bg-neutral-800/60 text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800">
                        <tr>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Hub</th>
                          <th className="px-4 py-3">Client</th>
                          <th className="px-4 py-3 font-bold">Total OFD</th>
                          <th className="px-4 py-3 font-bold text-emerald-600">Delivered</th>
                          <th className="px-4 py-3 font-black text-emerald-600">Delivery %</th>
                          <th className="px-4 py-3">Uploaded By</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                        {historyList.map((h) => (
                          <tr key={h.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                            <td className="px-4 py-3 font-mono">{h.uploadTimestamp}</td>
                            <td className="px-4 py-3 font-medium">{h.hubName}</td>
                            <td className="px-4 py-3 font-medium">{h.clientName}</td>
                            <td className="px-4 py-3 font-bold">{h.totalOfd}</td>
                            <td className="px-4 py-3 font-bold text-emerald-600">{h.totalDelivered}</td>
                            <td className="px-4 py-3 font-mono font-black text-emerald-600">{h.overallDeliveryPct}%</td>
                            <td className="px-4 py-3">{h.uploadedBy}</td>
                            <td className="px-4 py-3 text-right flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleReopenHistory(h)}
                                className="px-3 py-1 rounded-lg bg-brand-600 text-white font-bold transition active:scale-95"
                              >
                                View
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
          </div>
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
