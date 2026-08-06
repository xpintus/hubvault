import React, { useEffect, useMemo, useState } from 'react';
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
import {
  compareDRSReportItems,
  deleteDRSHistoryItem,
  fetchDRSHistoryFromDB,
  saveDRSHistorySnapshot,
} from '@/lib/drs/drsHistoryManager';
import { parseDRSFile } from '@/lib/drs/drsParser';
import { exportDRSPerformancePDF } from '@/lib/drs/drsPdfExporter';
import {
  ClientDRSMetrics,
  DRSFilterOptions,
  DRSReportComparison,
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
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  Columns,
  CreditCard,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  History,
  Layers,
  Package,
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
  | 'REATTEMPT'
  | 'COD'
  | 'PREPAID'
  | 'CLIENT'
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
  const [historyList, setHistoryList] = useState<DRSReportHistoryItem[]>([]);

  // Selected Employee for Detail Drawer
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeDRSMetrics | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Compare Report State
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [compareReportA, setCompareReportA] = useState<DRSReportHistoryItem | null>(null);
  const [compareReportB, setCompareReportB] = useState<DRSReportHistoryItem | null>(null);
  const [comparisonResult, setComparisonResult] = useState<DRSReportComparison | null>(null);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Filters State
  const [filters, setFilters] = useState<DRSFilterOptions>({
    dateRangePreset: 'ALL',
    minOfdThreshold: 0,
    sortBy: 'overall_delivery_pct',
    sortOrder: 'desc',
    search: '',
  });

  // Load Report History on Mount
  useEffect(() => {
    fetchDRSHistoryFromDB().then((history) => {
      setHistoryList(history);
    });
  }, []);

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

      // Auto Save Snapshot into Supabase & LocalStorage
      const historyItem: DRSReportHistoryItem = {
        id: `${uploadedFile.name}_${Date.now()}`,
        fileName: uploadedFile.name,
        reportDate: dateStr,
        uploadTimestamp: new Date().toLocaleString(),
        uploadedBy: profile?.name || 'Logistics Manager',
        hubId: selectedHub?.id || 'hub-01',
        hubName: selectedHub?.name || 'Main Hub',
        clientName: 'All Clients',
        totalOfd: overall.totalOfd,
        totalDelivered: overall.totalDelivered,
        totalUndel: overall.totalUndel,
        totalRto: overall.totalRto,
        totalCancel: overall.totalCancelled,
        firstAttemptOfd: overall.firstAttemptOfd,
        firstAttemptDel: overall.firstAttemptDelivered,
        reattemptOfd: overall.reattemptOfd,
        reattemptDel: overall.reattemptDelivered,
        overallDeliveryPct: overall.overallDeliveryPct,

        codOfd: overall.codOfd,
        codDel: overall.codDelivered,
        codFirstAttemptOfd: overall.codFirstAttemptOfd,
        codFirstAttemptDel: overall.codFirstAttemptDel,
        codFadPercent: overall.codFadPercent,

        prepaidOfd: overall.prepaidOfd,
        prepaidDel: overall.prepaidDelivered,
        prepaidFirstAttemptOfd: overall.prepaidFirstAttemptOfd,
        prepaidFirstAttemptDel: overall.prepaidFirstAttemptDel,
        prepaidFadPercent: overall.prepaidFadPercent,

        codAmount: overall.totalCodValue,
        prepaidAmount: overall.deliveredCodValue,
        averageAttempt: overall.averageAttempts,
        rows: parsed.uniqueRows,
        summary: overall,
      };

      const updatedHistory = await saveDRSHistorySnapshot(historyItem);
      setHistoryList(updatedHistory);
      setToastMsg('DRS File parsed & snapshot saved automatically!');
    } catch (err: any) {
      console.error('DRS parse error:', err);
      alert(`Failed to parse file: ${err.message || 'Invalid format'}`);
      setParsingProgress(null);
    }
  };

  const handleManualSaveSnapshot = async () => {
    if (!summary || uniqueRows.length === 0) return;
    const dateStr = new Date().toISOString().split('T')[0];
    const historyItem: DRSReportHistoryItem = {
      id: `${summary.fileName}_manual_${Date.now()}`,
      fileName: summary.fileName,
      reportDate: dateStr,
      uploadTimestamp: new Date().toLocaleString(),
      uploadedBy: profile?.name || 'Logistics Manager',
      hubId: selectedHub?.id || 'hub-01',
      hubName: selectedHub?.name || 'Main Hub',
      clientName: 'All Clients',
      totalOfd: summary.totalOfd,
      totalDelivered: summary.totalDelivered,
      totalUndel: summary.totalUndel,
      overallDeliveryPct: summary.overallDeliveryPct,

      codOfd: summary.codOfd,
      codDel: summary.codDelivered,
      codFirstAttemptOfd: summary.codFirstAttemptOfd,
      codFirstAttemptDel: summary.codFirstAttemptDel,
      codFadPercent: summary.codFadPercent,

      prepaidOfd: summary.prepaidOfd,
      prepaidDel: summary.prepaidDelivered,
      prepaidFirstAttemptOfd: summary.prepaidFirstAttemptOfd,
      prepaidFirstAttemptDel: summary.prepaidFirstAttemptDel,
      prepaidFadPercent: summary.prepaidFadPercent,

      rows: uniqueRows,
      summary: summary,
    };

    const updated = await saveDRSHistorySnapshot(historyItem);
    setHistoryList(updated);
    setToastMsg('Report snapshot permanently saved!');
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
    if (item.summary && item.rows && item.rows.length > 0) {
      setSummary(item.summary);
      setUniqueRows(item.rows);
      setEmployeeMetrics(computeEmployeeDRSMetrics(item.rows));
      setActiveTab('OVERVIEW');
      setToastMsg(`Loaded saved report: ${item.fileName}`);
    } else {
      alert('Snapshot content is missing or corrupted.');
    }
  };

  const handleDeleteHistory = async (id: string) => {
    if (confirm('Delete this report snapshot permanently?')) {
      const updated = await deleteDRSHistoryItem(id);
      setHistoryList(updated);
      setToastMsg('Report snapshot deleted.');
    }
  };

  const handleExportHistoryExcel = (item: DRSReportHistoryItem) => {
    if (!item.summary || !item.rows) return;
    const empMetrics = computeEmployeeDRSMetrics(item.rows);
    const payMetrics = computePaymentAnalytics(item.rows);
    const cliMetrics = computeClientDRSMetrics(item.rows);
    const rsnMetrics = computeNDRReasonAnalytics(item.rows);
    const rtoMet = computeRTOAnalytics(item.rows);

    exportDRSPerformanceWorkbook(
      item.summary,
      empMetrics,
      cliMetrics,
      payMetrics,
      rsnMetrics,
      rtoMet,
      item.rows,
      [],
      [],
      `Report_${item.reportDate}`
    );
  };

  const handleExportHistoryPDF = async (item: DRSReportHistoryItem) => {
    if (!item.summary || !item.rows) return;
    const empMetrics = computeEmployeeDRSMetrics(item.rows);
    await exportDRSPerformancePDF(item.summary, empMetrics, `Executive_Report_${item.reportDate}`);
  };

  // Run Side-by-Side Report Comparison
  const handleOpenComparison = () => {
    if (historyList.length < 2) {
      alert('You need at least 2 saved DRS report snapshots to compare performance.');
      return;
    }
    const reportA = historyList[1];
    const reportB = historyList[0];
    setCompareReportA(reportA);
    setCompareReportB(reportB);
    setComparisonResult(compareDRSReportItems(reportA, reportB));
    setCompareModalOpen(true);
  };

  const handleTriggerCompare = (itemA: DRSReportHistoryItem, itemB: DRSReportHistoryItem) => {
    setCompareReportA(itemA);
    setCompareReportB(itemB);
    setComparisonResult(compareDRSReportItems(itemA, itemB));
  };

  return (
    <div className="space-y-6 max-w-[1700px] mx-auto pb-12">
      {/* ========================================================= */}
      {/* POWER BI TOP HEADER                                       */}
      {/* ========================================================= */}
      <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-brand-600" /> DRS Performance Analytics
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-500/10 text-brand-600 border border-brand-500/20 uppercase tracking-wider">
              Power BI Edition
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-neutral-500 mt-1 font-medium">
            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-neutral-400" /> Today's Report: {summary?.reportDate || 'Today'}</span>
            <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5 text-neutral-400" /> Hub: {selectedHub?.name || 'Main Hub'}</span>
            <span className="flex items-center gap-1"><User className="h-3.5 w-3.5 text-neutral-400" /> Client: All Clients</span>
          </div>
        </div>

        {/* Global Controls & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {summary && (
            <div className="relative min-w-[220px]">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-400" />
              <input
                type="text"
                placeholder="Global Search (AWB, Executive...)"
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-medium focus:ring-2 focus:ring-brand-500 outline-none"
              />
            </div>
          )}

          <label className="px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-md transition cursor-pointer flex items-center gap-1.5 active:scale-95">
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
                onClick={handleManualSaveSnapshot}
                className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md transition flex items-center gap-1.5 active:scale-95"
              >
                <Save className="h-4 w-4" /> Save Snapshot
              </button>

              <button
                onClick={handleOpenComparison}
                className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition flex items-center gap-1.5 active:scale-95"
              >
                <Columns className="h-4 w-4" /> Compare
              </button>

              <button
                onClick={handleResetFilters}
                className="px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 text-xs font-bold text-neutral-700 dark:text-neutral-300 transition flex items-center gap-1.5"
              >
                <RotateCcw className="h-4 w-4" /> Reset
              </button>

              <button
                onClick={handleExportExcel}
                className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition flex items-center gap-1.5 active:scale-95"
              >
                <FileSpreadsheet className="h-4 w-4" /> Excel
              </button>

              <button
                onClick={handleExportPDF}
                className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md transition flex items-center gap-1.5 active:scale-95"
              >
                <FileText className="h-4 w-4" /> PDF
              </button>
            </>
          )}
        </div>
      </div>

      {!summary ? (
        /* Dropzone */
        <div className="p-12 rounded-2xl bg-white dark:bg-neutral-900 border-2 border-dashed border-neutral-300 dark:border-neutral-700 text-center space-y-4 hover:border-brand-500 transition shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 mx-auto flex items-center justify-center">
            <Upload className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Upload Daily DRS Performance File</h3>
            <p className="text-xs text-neutral-500 mt-1">Instant 5-second Power BI Executive Analytics & Auto-Snapshot Saving</p>
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
          {/* SECTION 1: EXECUTIVE KPI (EXACTLY 8 POWER BI CARDS)       */}
          {/* ========================================================= */}
          {filteredSummary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs">
              {/* 1. Total OFD */}
              <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-1">
                <span className="text-neutral-500 font-semibold block">Total OFD</span>
                <span className="text-2xl font-black text-neutral-900 dark:text-neutral-100 block">{filteredSummary.totalOfd}</span>
                <span className="text-[10px] text-neutral-400 font-mono">Unique AWBs</span>
              </div>

              {/* 2. Delivered */}
              <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 shadow-sm space-y-1">
                <span className="text-emerald-700 dark:text-emerald-400 font-bold block">Delivered</span>
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 block">{filteredSummary.totalDelivered}</span>
                <span className="text-[10px] text-emerald-600 font-semibold block">{filteredSummary.overallDeliveryPct}% Rate</span>
              </div>

              {/* 3. UNDEL */}
              <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 shadow-sm space-y-1">
                <span className="text-rose-700 dark:text-rose-400 font-bold block">UNDEL</span>
                <span className="text-2xl font-black text-rose-600 dark:text-rose-400 block">{filteredSummary.totalUndel}</span>
                <span className="text-[10px] text-rose-600 font-semibold block">Active NDR</span>
              </div>

              {/* 4. First Attempt % */}
              <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 shadow-sm space-y-1">
                <span className="text-blue-700 dark:text-blue-400 font-bold block">1st Attempt %</span>
                <span className="text-2xl font-black text-blue-600 dark:text-blue-400 block">{filteredSummary.firstAttemptDeliveryPct}%</span>
                <span className="text-[10px] text-blue-600 font-semibold block">{filteredSummary.firstAttemptDelivered} / {filteredSummary.firstAttemptOfd}</span>
              </div>

              {/* 5. Reattempt % */}
              <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/20 shadow-sm space-y-1">
                <span className="text-purple-700 dark:text-purple-400 font-bold block">Reattempt %</span>
                <span className="text-2xl font-black text-purple-600 dark:text-purple-400 block">{filteredSummary.reattemptDeliveryPct}%</span>
                <span className="text-[10px] text-purple-600 font-semibold block">{filteredSummary.reattemptDelivered} / {filteredSummary.reattemptOfd}</span>
              </div>

              {/* 6. Overall Delivery % */}
              <div className="p-4 rounded-2xl bg-brand-500/10 border border-brand-500/20 shadow-sm space-y-1">
                <span className="text-brand-700 dark:text-brand-400 font-bold block">Overall %</span>
                <span className="text-2xl font-black text-brand-600 dark:text-brand-400 block">{filteredSummary.overallDeliveryPct}%</span>
                <span className="text-[10px] text-brand-600 font-semibold block">Efficiency</span>
              </div>

              {/* 7. COD Pending Amount */}
              <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 shadow-sm space-y-1">
                <span className="text-amber-700 dark:text-amber-400 font-bold block">COD Pending</span>
                <span className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono block">
                  ₹{(paymentMetrics.codTotalAmount - paymentMetrics.codDeliveredAmount).toLocaleString()}
                </span>
                <span className="text-[10px] text-amber-600 font-semibold block">{paymentMetrics.codPending} AWBs</span>
              </div>

              {/* 8. Total COD Collection */}
              <div className="p-4 rounded-2xl bg-emerald-600/10 border border-emerald-600/30 shadow-sm space-y-1">
                <span className="text-emerald-800 dark:text-emerald-300 font-black block">COD Collection</span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono block">
                  ₹{paymentMetrics.codDeliveredAmount.toLocaleString()}
                </span>
                <span className="text-[10px] text-emerald-700 font-bold block">{paymentMetrics.codDeliveryPct}% Collected</span>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SECTION 2: POWER BI CHARTS                                */}
          {/* ========================================================= */}
          {filteredSummary && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 text-xs">
              {/* Chart 1: Delivery Status Pie */}
              <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-3">
                <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-xs flex items-center gap-2">
                  <PieIcon className="h-4 w-4 text-brand-600" /> Chart 1: Delivery Status
                </h3>
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-emerald-600">Delivered</span>
                    <span className="font-mono font-bold">{filteredSummary.totalDelivered} ({filteredSummary.overallDeliveryPct}%)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-rose-600">UNDEL</span>
                    <span className="font-mono font-bold">{filteredSummary.totalUndel}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-purple-600">RTO</span>
                    <span className="font-mono font-bold">{filteredSummary.totalRto}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-500">Cancel</span>
                    <span className="font-mono font-bold">{filteredSummary.totalCancelled}</span>
                  </div>
                </div>
              </div>

              {/* Chart 2: Attempt Analysis */}
              <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-3">
                <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-xs flex items-center gap-2">
                  <Truck className="h-4 w-4 text-blue-600" /> Chart 2: Attempt Analysis
                </h3>
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-blue-600">1st Attempt DEL / OFD</span>
                    <span className="font-mono font-bold">{filteredSummary.firstAttemptDelivered} / {filteredSummary.firstAttemptOfd}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-purple-600">Reattempt DEL / OFD</span>
                    <span className="font-mono font-bold">{filteredSummary.reattemptDelivered} / {filteredSummary.reattemptOfd}</span>
                  </div>
                </div>
              </div>

              {/* Chart 3: Delivery Trend */}
              <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-3">
                <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-xs flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-emerald-600" /> Chart 3: Delivery Trend Progress
                </h3>
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-600 dark:text-neutral-400">Target Efficiency</span>
                    <span className="font-mono font-bold text-emerald-600">80.00%</span>
                  </div>
                  <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-3 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(filteredSummary.overallDeliveryPct, 100)}%` }} />
                  </div>
                  <span className="text-[11px] text-neutral-400 block font-mono">Current: {filteredSummary.overallDeliveryPct}%</span>
                </div>
              </div>

              {/* Chart 4: Top Executives Horizontal Bar */}
              <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-3">
                <h3 className="font-bold text-emerald-600 uppercase tracking-wider text-xs flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" /> Chart 4: Top Executives
                </h3>
                <div className="space-y-1.5">
                  {filteredEmployeeMetrics.slice(0, 5).map((e, idx) => (
                    <div key={e.employee_name} className="flex items-center justify-between p-1.5 rounded-lg bg-emerald-500/5">
                      <span className="font-bold text-neutral-900 dark:text-neutral-100">#{idx + 1} {e.employee_name}</span>
                      <span className="font-mono font-black text-emerald-600">{e.overall_delivery_pct}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chart 5: Top NDR Reasons Horizontal Bar */}
              <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-3">
                <h3 className="font-bold text-rose-600 uppercase tracking-wider text-xs flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4" /> Chart 5: Top NDR Reasons
                </h3>
                <div className="space-y-1.5">
                  {reasonMetrics.slice(0, 5).map((r) => (
                    <div key={r.reason} className="flex items-center justify-between p-1.5 rounded-lg bg-rose-500/5">
                      <span className="truncate max-w-[170px] font-semibold text-neutral-900 dark:text-neutral-100">{r.reason}</span>
                      <span className="font-bold font-mono text-rose-600">{r.count} AWBs</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SECTION 3: PAYMENT ANALYTICS (SPLIT LEFT/RIGHT)           */}
          {/* ========================================================= */}
          {filteredSummary && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
              {/* LEFT: COD */}
              <div className="p-5 rounded-2xl bg-purple-500/5 border border-purple-500/20 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
                  <h3 className="font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1.5 text-xs">
                    <CreditCard className="h-4 w-4" /> COD Payment Analytics
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-purple-600">{paymentMetrics.codDeliveryPct}% DEL</span>
                    <span className="font-mono font-black bg-purple-600 text-white px-2 py-0.5 rounded-md text-[11px]">
                      COD FAD: {paymentMetrics.codFadPercent}%
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <span className="text-neutral-500 block">COD OFD</span>
                    <span className="font-black text-neutral-900 dark:text-neutral-100 text-sm">{paymentMetrics.codOfd}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">COD Delivered</span>
                    <span className="font-black text-emerald-600 text-sm">{paymentMetrics.codDelivered}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">1st OFD / DEL</span>
                    <span className="font-black text-purple-600 text-xs">{paymentMetrics.codFirstAttemptOfd} / {paymentMetrics.codFirstAttemptDel}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">COD Pending</span>
                    <span className="font-black text-amber-600 text-sm">{paymentMetrics.codPending}</span>
                  </div>
                </div>
                <div className="flex justify-between pt-1 font-mono font-bold text-neutral-700 dark:text-neutral-300">
                  <span>Collected: ₹{paymentMetrics.codDeliveredAmount.toLocaleString()}</span>
                  <span>Total Value: ₹{paymentMetrics.codTotalAmount.toLocaleString()}</span>
                </div>
              </div>

              {/* RIGHT: PREPAID */}
              <div className="p-5 rounded-2xl bg-blue-500/5 border border-blue-500/20 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-blue-500/20 pb-2">
                  <h3 className="font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5 text-xs">
                    <CreditCard className="h-4 w-4" /> Prepaid Payment Analytics
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-blue-600">{paymentMetrics.prepaidDeliveryPct}% DEL</span>
                    <span className="font-mono font-black bg-blue-600 text-white px-2 py-0.5 rounded-md text-[11px]">
                      Prepaid FAD: {paymentMetrics.prepaidFadPercent}%
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <span className="text-neutral-500 block">Prepaid OFD</span>
                    <span className="font-black text-neutral-900 dark:text-neutral-100 text-sm">{paymentMetrics.prepaidOfd}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Delivered</span>
                    <span className="font-black text-emerald-600 text-sm">{paymentMetrics.prepaidDelivered}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">1st OFD / DEL</span>
                    <span className="font-black text-blue-600 text-xs">{paymentMetrics.prepaidFirstAttemptOfd} / {paymentMetrics.prepaidFirstAttemptDel}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block">Pending</span>
                    <span className="font-black text-amber-600 text-sm">{paymentMetrics.prepaidPending}</span>
                  </div>
                </div>
                <div className="flex justify-between pt-1 font-mono font-bold text-neutral-700 dark:text-neutral-300">
                  <span>Amount Total: ₹{paymentMetrics.prepaidTotalAmount.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* SECTION 4: NAVIGATION TABS                                */}
          {/* ========================================================= */}
          <div className="space-y-4">
            <div className="border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto no-scrollbar">
              <nav className="flex space-x-1 min-w-max pb-1">
                {[
                  { id: 'OVERVIEW', label: 'Overview' },
                  { id: 'EMPLOYEE', label: `Employee (${filteredEmployeeMetrics.length})` },
                  { id: 'FIRST_ATTEMPT', label: 'First Attempt' },
                  { id: 'REATTEMPT', label: 'Reattempt' },
                  { id: 'COD', label: 'COD' },
                  { id: 'PREPAID', label: 'Prepaid' },
                  { id: 'CLIENT', label: `Client (${clientMetrics.length})` },
                  { id: 'HISTORY', label: `Report History (${historyList.length})` },
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

            {/* TAB: EMPLOYEE REPORT */}
            {activeTab === 'EMPLOYEE' && (
              <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm overflow-hidden text-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-neutral-50 dark:bg-neutral-800/60 text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800">
                      <tr>
                        <th className="px-4 py-3">Rank</th>
                        <th className="px-4 py-3">Employee</th>
                        <th className="px-4 py-3 font-bold">Total OFD</th>
                        <th className="px-4 py-3 font-bold text-emerald-600">Delivered</th>
                        <th className="px-4 py-3">UNDEL</th>
                        <th className="px-4 py-3 font-semibold text-blue-600">First Attempt %</th>
                        <th className="px-4 py-3 font-semibold text-purple-600">Reattempt %</th>
                        <th className="px-4 py-3 font-black text-emerald-600">Overall %</th>
                        <th className="px-4 py-3 text-right">COD Amount (₹)</th>
                        <th className="px-4 py-3 text-right">Prepaid</th>
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
                          <td className="px-4 py-3 font-mono font-black text-emerald-600">{e.overall_delivery_pct}%</td>
                          <td className="px-4 py-3 font-mono font-bold text-right">₹{e.cod_value_total.toLocaleString()}</td>
                          <td className="px-4 py-3 font-mono text-right">{e.prepaid_ofd} AWBs</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB: REPORT HISTORY */}
            {activeTab === 'HISTORY' && (
              <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm overflow-hidden text-xs space-y-4 p-4">
                <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
                  <span className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-1.5">
                    <History className="h-4 w-4 text-brand-600" /> Permanent Database Report History ({historyList.length})
                  </span>

                  <button
                    onClick={handleOpenComparison}
                    className="px-3.5 py-1.5 rounded-xl bg-brand-600 text-white font-bold transition shadow-md active:scale-95 flex items-center gap-1.5"
                  >
                    <Columns className="h-4 w-4" /> Compare 2 Reports
                  </button>
                </div>

                {historyList.length === 0 ? (
                  <div className="p-8 text-center text-neutral-500">No report history saved yet. Upload a DRS report to create automatic snapshots.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-neutral-50 dark:bg-neutral-800/60 text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800">
                        <tr>
                          <th className="px-4 py-3">Report Date</th>
                          <th className="px-4 py-3">Upload Time</th>
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
                            <td className="px-4 py-3 font-bold font-mono text-neutral-900 dark:text-neutral-100">{h.reportDate}</td>
                            <td className="px-4 py-3 font-mono text-neutral-500">{h.uploadTimestamp}</td>
                            <td className="px-4 py-3 font-medium">{h.hubName}</td>
                            <td className="px-4 py-3 font-medium">{h.clientName}</td>
                            <td className="px-4 py-3 font-bold">{h.totalOfd}</td>
                            <td className="px-4 py-3 font-bold text-emerald-600">{h.totalDelivered}</td>
                            <td className="px-4 py-3 font-mono font-black text-emerald-600">{h.overallDeliveryPct}%</td>
                            <td className="px-4 py-3">{h.uploadedBy}</td>
                            <td className="px-4 py-3 text-right flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleReopenHistory(h)}
                                className="px-2.5 py-1 rounded-lg bg-brand-600 text-white font-bold transition active:scale-95"
                              >
                                Open
                              </button>
                              <button
                                onClick={() => handleExportHistoryExcel(h)}
                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                title="Export Excel"
                              >
                                <FileSpreadsheet className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleExportHistoryPDF(h)}
                                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                title="Export PDF"
                              >
                                <FileText className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteHistory(h.id)}
                                className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                title="Delete"
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

      {/* ========================================================= */}
      {/* COMPARE REPORTS MODAL                                      */}
      {/* ========================================================= */}
      {compareModalOpen && compareReportA && compareReportB && comparisonResult && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
              <div>
                <h2 className="text-lg font-black text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                  <Columns className="h-5 w-5 text-brand-600" /> Side-by-Side Report Comparison
                </h2>
                <p className="text-xs text-neutral-500">Performance variance & trend analysis between two DRS snapshots</p>
              </div>
              <button
                onClick={() => setCompareModalOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-bold"
              >
                Close
              </button>
            </div>

            {/* Select Snapshots to compare */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-bold text-neutral-500 block mb-1">Baseline Report (A)</label>
                <select
                  value={compareReportA.id}
                  onChange={(e) => {
                    const sel = historyList.find((h) => h.id === e.target.value);
                    if (sel && compareReportB) handleTriggerCompare(sel, compareReportB);
                  }}
                  className="w-full p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 font-semibold"
                >
                  {historyList.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.reportDate} - {h.fileName} ({h.overallDeliveryPct}%)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-neutral-500 block mb-1">Comparison Report (B)</label>
                <select
                  value={compareReportB.id}
                  onChange={(e) => {
                    const sel = historyList.find((h) => h.id === e.target.value);
                    if (compareReportA && sel) handleTriggerCompare(compareReportA, sel);
                  }}
                  className="w-full p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 font-semibold"
                >
                  {historyList.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.reportDate} - {h.fileName} ({h.overallDeliveryPct}%)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Comparison Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2">
              <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                <span className="text-neutral-500 block font-semibold">OFD Change</span>
                <span className="text-xl font-black text-neutral-900 dark:text-neutral-100">
                  {comparisonResult.ofdChange >= 0 ? `+${comparisonResult.ofdChange}` : comparisonResult.ofdChange}
                </span>
                <span className="text-[10px] text-neutral-400 block font-mono">{comparisonResult.ofdChangePct}% Variance</span>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-emerald-700 dark:text-emerald-400 block font-bold">Delivered Change</span>
                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                  {comparisonResult.delChange >= 0 ? `+${comparisonResult.delChange}` : comparisonResult.delChange}
                </span>
                <span className="text-[10px] text-emerald-600 block font-semibold">{comparisonResult.delChangePct}% DEL Variance</span>
              </div>

              <div className="p-3.5 rounded-xl bg-brand-500/10 border border-brand-500/20">
                <span className="text-brand-700 dark:text-brand-400 block font-bold">Delivery Rate Shift</span>
                <span className="text-xl font-black text-brand-600 dark:text-brand-400">
                  {comparisonResult.deliveryRateChange >= 0 ? `+${comparisonResult.deliveryRateChange}%` : `${comparisonResult.deliveryRateChange}%`}
                </span>
                <span className="text-[10px] text-brand-600 block font-bold">Overall Efficiency</span>
              </div>

              <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <span className="text-purple-700 dark:text-purple-400 block font-bold">COD Amount Shift</span>
                <span className="text-lg font-black text-purple-600 dark:text-purple-400 font-mono">
                  ₹{comparisonResult.codAmountChange.toLocaleString()}
                </span>
                <span className="text-[10px] text-purple-600 block font-semibold">Cash Collection Variance</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Employee Side Drawer */}
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
