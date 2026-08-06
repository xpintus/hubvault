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
  loadActiveDRSReport,
  saveDRSHistorySnapshot,
  setActiveReportId,
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
  ArrowUpRight,
  BarChart2,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Columns,
  CreditCard,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  History,
  Layers,
  LayoutDashboard,
  Package,
  PieChart as PieIcon,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  TrendingUp,
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

  const [isLoading, setIsLoading] = useState(true);
  const [parsingProgress, setParsingProgress] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('OVERVIEW');

  // Currently Loaded Active Report State
  const [activeItem, setActiveItem] = useState<DRSReportHistoryItem | null>(null);
  const [uniqueRows, setUniqueRows] = useState<DRSReportRow[]>([]);
  const [summary, setSummary] = useState<OverallDRSSummary | null>(null);
  const [historyList, setHistoryList] = useState<DRSReportHistoryItem[]>([]);

  // Selected Employee for Detail Drawer
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeDRSMetrics | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Compare Modal State
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

  // Automatically Restore Active Report on Startup / Refresh
  useEffect(() => {
    setIsLoading(true);
    loadActiveDRSReport()
      .then(({ activeReport, historyList: hList }) => {
        setHistoryList(hList);
        if (activeReport) {
          setActiveItem(activeReport);
          setSummary(activeReport.summary);
          setUniqueRows(activeReport.rows);
        }
      })
      .catch((err) => {
        console.error('Failed to load active DRS report:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const handleFileUpload = async (uploadedFile: File) => {
    setParsingProgress('Reading DRS file...');
    try {
      setParsingProgress('Parsing AWBs...');
      const parsed = await parseDRSFile(uploadedFile);

      setParsingProgress('Calculating Analytics Engine...');
      const dateStr = new Date().toISOString().split('T')[0];
      const overall = computeOverallDRSSummary(parsed.uniqueRows, {
        fileName: uploadedFile.name,
        reportDate: dateStr,
        totalRows: parsed.rawRowCount,
        validRows: parsed.rows.length,
        invalidRows: parsed.invalidRows.length,
        duplicateRows: parsed.duplicateRows.length,
      });

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
      setActiveReportId(historyItem.id);
      setActiveItem(historyItem);
      setSummary(overall);
      setUniqueRows(parsed.uniqueRows);
      setHistoryList(updatedHistory);
      setParsingProgress(null);
      setToastMsg('DRS File uploaded, snapshot saved & restored automatically!');
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
    setActiveReportId(historyItem.id);
    setActiveItem(historyItem);
    setHistoryList(updated);
    setToastMsg('Report snapshot permanently saved!');
  };

  // Unified Single-Report Filtered Rows
  const filteredUniqueRows = useMemo(() => {
    return filterDRSRows(uniqueRows, filters);
  }, [uniqueRows, filters]);

  // Unified Single-Report Filtered Summary
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
    setToastMsg('Filters reset.');
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
      [],
      []
    );
  };

  const handleExportPDF = async () => {
    if (!filteredSummary) return;
    await exportDRSPerformancePDF(filteredSummary, filteredEmployeeMetrics);
  };

  const handleOpenHistoryItem = (item: DRSReportHistoryItem) => {
    if (item.summary && item.rows && item.rows.length > 0) {
      setActiveReportId(item.id);
      setActiveItem(item);
      setSummary(item.summary);
      setUniqueRows(item.rows);
      setActiveTab('OVERVIEW');
      setToastMsg(`Loaded report snapshot: ${item.fileName}`);
    } else {
      alert('Snapshot content is empty or corrupt.');
    }
  };

  const handleDeleteHistory = async (id: string) => {
    if (confirm('Delete this report snapshot permanently?')) {
      const updated = await deleteDRSHistoryItem(id);
      setHistoryList(updated);
      if (activeItem?.id === id) {
        if (updated.length > 0) {
          handleOpenHistoryItem(updated[0]);
        } else {
          setActiveItem(null);
          setSummary(null);
          setUniqueRows([]);
        }
      }
      setToastMsg('Report snapshot deleted.');
    }
  };

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
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 p-4 md:p-8 space-y-6 max-w-[1700px] mx-auto transition-colors font-sans antialiased">
      {/* ========================================================= */}
      {/* LINEAR / STACK OVERVIEW HEADER                            */}
      {/* ========================================================= */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800/80 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 flex items-center justify-center font-black">
              <LayoutDashboard className="h-4 w-4" />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              DRS Performance Analytics
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 uppercase tracking-wider">
              V5 Enterprise
            </span>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium flex items-center gap-2">
            <span>Hub: <strong className="text-neutral-700 dark:text-neutral-300">{selectedHub?.name || 'Main Hub'}</strong></span>
            <span>•</span>
            <span>Date: <strong className="text-neutral-700 dark:text-neutral-300">{summary?.reportDate || 'No Report Loaded'}</strong></span>
            {activeItem && (
              <>
                <span>•</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Auto-Restored ({activeItem.fileName})
                </span>
              </>
            )}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {summary && (
            <div className="relative min-w-[200px]">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-400" />
              <input
                type="text"
                placeholder="Search AWBs, Executive..."
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-medium focus:ring-1 focus:ring-neutral-900 dark:focus:ring-neutral-100 outline-none"
              />
            </div>
          )}

          <label className="px-3.5 py-2 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-bold transition hover:opacity-90 cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95">
            <Upload className="h-3.5 w-3.5" /> Upload DRS
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
                className="px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-xs font-bold transition flex items-center gap-1.5 border border-neutral-200 dark:border-neutral-700"
              >
                Save
              </button>

              <button
                onClick={handleOpenComparison}
                className="px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-xs font-bold transition flex items-center gap-1.5 border border-neutral-200 dark:border-neutral-700"
              >
                <Columns className="h-3.5 w-3.5" /> Compare
              </button>

              <button
                onClick={handleExportExcel}
                className="px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-emerald-600 dark:text-emerald-400 text-xs font-bold transition flex items-center gap-1.5 border border-neutral-200 dark:border-neutral-700"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
              </button>

              <button
                onClick={handleExportPDF}
                className="px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-rose-600 dark:text-rose-400 text-xs font-bold transition flex items-center gap-1.5 border border-neutral-200 dark:border-neutral-700"
              >
                <FileText className="h-3.5 w-3.5" /> PDF
              </button>
            </>
          )}
        </div>
      </header>

      {/* ========================================================= */}
      {/* INITIAL EMPTY / LOADING STATE                             */}
      {/* ========================================================= */}
      {isLoading ? (
        <div className="p-12 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center space-y-3">
          <RefreshCw className="h-8 w-8 animate-spin text-neutral-400 mx-auto" />
          <p className="text-xs font-medium text-neutral-500">Auto-restoring latest DRS report snapshot...</p>
        </div>
      ) : !summary ? (
        <div className="p-16 rounded-2xl bg-white dark:bg-neutral-900 border border-dashed border-neutral-300 dark:border-neutral-800 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 mx-auto flex items-center justify-center">
            <Upload className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">No Active DRS Report Loaded</h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto mt-1">
              Upload a daily DRS Excel report to generate analytics and save permanent snapshots.
            </p>
          </div>
          {parsingProgress ? (
            <div className="py-4 flex flex-col items-center gap-2 text-neutral-600 dark:text-neutral-300">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="text-xs font-bold">{parsingProgress}</span>
            </div>
          ) : (
            <label className="inline-block px-5 py-2.5 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-bold transition hover:opacity-90 cursor-pointer shadow-md active:scale-95">
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
          {/* REQUIREMENT 1: EXACTLY 6 PRIMARY KPI CARDS               */}
          {/* ========================================================= */}
          {filteredSummary && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Card 1: Total OFD */}
              <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800/80 shadow-sm space-y-1">
                <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider block">Total OFD</span>
                <span className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 block font-mono">
                  {filteredSummary.totalOfd}
                </span>
                <span className="text-[10px] text-neutral-400 font-medium block">Unique Shipments</span>
              </div>

              {/* Card 2: Delivered */}
              <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800/80 shadow-sm space-y-1">
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Delivered</span>
                <span className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 block font-mono">
                  {filteredSummary.totalDelivered}
                </span>
                <span className="text-[10px] text-emerald-600/80 font-medium block">{filteredSummary.overallDeliveryPct}% Delivered</span>
              </div>

              {/* Card 3: Pending */}
              <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800/80 shadow-sm space-y-1">
                <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">Pending</span>
                <span className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400 block font-mono">
                  {filteredSummary.totalUndel}
                </span>
                <span className="text-[10px] text-rose-600/80 font-medium block">Active Undelivered</span>
              </div>

              {/* Card 4: Overall Delivery % */}
              <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800/80 shadow-sm space-y-1">
                <span className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider block">Overall Delivery %</span>
                <span className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 block font-mono">
                  {filteredSummary.overallDeliveryPct}%
                </span>
                <span className="text-[10px] text-neutral-400 font-medium block">Target benchmark: 80%</span>
              </div>

              {/* Card 5: First Attempt % */}
              <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800/80 shadow-sm space-y-1">
                <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">First Attempt %</span>
                <span className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400 block font-mono">
                  {filteredSummary.firstAttemptDeliveryPct}%
                </span>
                <span className="text-[10px] text-blue-600/80 font-medium block">{filteredSummary.firstAttemptDelivered} / {filteredSummary.firstAttemptOfd}</span>
              </div>

              {/* Card 6: Reattempt % */}
              <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800/80 shadow-sm space-y-1">
                <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider block">Reattempt %</span>
                <span className="text-2xl font-bold tracking-tight text-purple-600 dark:text-purple-400 block font-mono">
                  {filteredSummary.reattemptDeliveryPct}%
                </span>
                <span className="text-[10px] text-purple-600/80 font-medium block">{filteredSummary.reattemptDelivered} / {filteredSummary.reattemptOfd}</span>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* NAVIGATION TABS (LINEAR STYLE)                            */}
          {/* ========================================================= */}
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
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === t.id
                      ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-sm'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800/60'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>

          {/* ========================================================= */}
          {/* TAB: OVERVIEW EXECUTIVE SECTIONS                         */}
          {/* ========================================================= */}
          {activeTab === 'OVERVIEW' && filteredSummary && (
            <div className="space-y-6">
              {/* REQUIREMENT 2: SEPARATE SECTIONS                         */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {/* SECTION 1: COD ANALYTICS */}
                <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800/80 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                      <CreditCard className="h-4 w-4 text-purple-600" /> COD Analytics
                    </h3>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400">
                      COD FAD: {paymentMetrics.codFadPercent}%
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-neutral-400 block font-medium">COD OFD</span>
                      <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">{paymentMetrics.codOfd}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block font-medium">Delivered</span>
                      <span className="font-mono font-bold text-emerald-600">{paymentMetrics.codDelivered}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block font-medium">Pending</span>
                      <span className="font-mono font-bold text-amber-600">{paymentMetrics.codPending}</span>
                    </div>
                  </div>
                  <div className="pt-1 text-xs font-mono font-semibold text-neutral-600 dark:text-neutral-300 flex justify-between">
                    <span>Collected: ₹{paymentMetrics.codDeliveredAmount.toLocaleString()}</span>
                    <span>Total: ₹{paymentMetrics.codTotalAmount.toLocaleString()}</span>
                  </div>
                </div>

                {/* SECTION 2: PREPAID ANALYTICS */}
                <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800/80 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                      <CreditCard className="h-4 w-4 text-blue-600" /> Prepaid Analytics
                    </h3>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      Prepaid FAD: {paymentMetrics.prepaidFadPercent}%
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-neutral-400 block font-medium">Prepaid OFD</span>
                      <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">{paymentMetrics.prepaidOfd}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block font-medium">Delivered</span>
                      <span className="font-mono font-bold text-emerald-600">{paymentMetrics.prepaidDelivered}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block font-medium">Pending</span>
                      <span className="font-mono font-bold text-amber-600">{paymentMetrics.prepaidPending}</span>
                    </div>
                  </div>
                  <div className="pt-1 text-xs font-mono font-semibold text-neutral-600 dark:text-neutral-300">
                    Total Prepaid Value: ₹{paymentMetrics.prepaidTotalAmount.toLocaleString()}
                  </div>
                </div>

                {/* SECTION 3: DELIVERY TREND & EFFICIENCY */}
                <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800/80 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4 text-emerald-600" /> Delivery Trend
                    </h3>
                    <span className="font-mono text-xs font-bold text-emerald-600">{filteredSummary.overallDeliveryPct}%</span>
                  </div>
                  <div className="space-y-2 pt-1 text-xs">
                    <div className="flex justify-between font-medium">
                      <span className="text-neutral-500">Benchmark Target</span>
                      <span className="font-mono font-bold text-neutral-700 dark:text-neutral-300">80.00%</span>
                    </div>
                    <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(filteredSummary.overallDeliveryPct, 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-neutral-400 block font-mono">
                      Average Attempts per Shipment: {filteredSummary.averageAttempts}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* SECTION 4: EMPLOYEE RANKING */}
                <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800/80 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                      <User className="h-4 w-4 text-brand-600" /> Top Executive Leaderboard
                    </h3>
                    <button
                      onClick={() => setActiveTab('EMPLOYEE')}
                      className="text-[11px] font-semibold text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 flex items-center gap-1"
                    >
                      View All <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="space-y-2 text-xs">
                    {filteredEmployeeMetrics.slice(0, 5).map((e, idx) => (
                      <div
                        key={e.employee_name}
                        onClick={() => {
                          setSelectedEmployee(e);
                          setDrawerOpen(true);
                        }}
                        className="flex items-center justify-between p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-neutral-400 text-xs">#{idx + 1}</span>
                          <span className="font-semibold text-neutral-900 dark:text-neutral-100">{e.employee_name}</span>
                        </div>
                        <div className="flex items-center gap-3 font-mono">
                          <span className="text-neutral-500">{e.total_delivered} / {e.total_ofd} DEL</span>
                          <span className="font-bold text-emerald-600">{e.overall_delivery_pct}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* SECTION 5: TOP NDR REASONS */}
                <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800/80 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                      <ShieldAlert className="h-4 w-4 text-rose-600" /> Top NDR Failure Reasons
                    </h3>
                    <span className="text-[11px] font-mono font-bold text-rose-600">{filteredSummary.totalUndel} UNDEL</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    {reasonMetrics.length === 0 ? (
                      <div className="py-4 text-center text-neutral-400">No NDR failure reasons in current report</div>
                    ) : (
                      reasonMetrics.slice(0, 5).map((r) => (
                        <div key={r.reason} className="flex items-center justify-between p-2 rounded-xl bg-rose-500/5 border border-rose-500/10">
                          <span className="font-semibold text-neutral-800 dark:text-neutral-200 truncate max-w-[220px]">{r.reason}</span>
                          <span className="font-mono font-bold text-rose-600">{r.count} AWBs ({r.percentage}%)</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB: EMPLOYEE TABLE                                       */}
          {/* ========================================================= */}
          {activeTab === 'EMPLOYEE' && (
            <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800/80 shadow-sm overflow-hidden text-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800">
                    <tr>
                      <th className="px-4 py-3">Rank</th>
                      <th className="px-4 py-3">Employee Executive</th>
                      <th className="px-4 py-3 font-bold">Total OFD</th>
                      <th className="px-4 py-3 font-bold text-emerald-600">Delivered</th>
                      <th className="px-4 py-3">UNDEL</th>
                      <th className="px-4 py-3 font-semibold text-blue-600">1st Attempt %</th>
                      <th className="px-4 py-3 font-semibold text-purple-600">Reattempt %</th>
                      <th className="px-4 py-3 font-black text-emerald-600">Overall %</th>
                      <th className="px-4 py-3 text-right">COD Collection</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {filteredEmployeeMetrics.map((e, idx) => (
                      <tr
                        key={e.employee_name}
                        onClick={() => {
                          setSelectedEmployee(e);
                          setDrawerOpen(true);
                        }}
                        className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 cursor-pointer transition"
                      >
                        <td className="px-4 py-3 font-mono text-neutral-400 font-semibold">#{idx + 1}</td>
                        <td className="px-4 py-3 font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-neutral-500" /> {e.employee_name}
                        </td>
                        <td className="px-4 py-3 font-bold font-mono">{e.total_ofd}</td>
                        <td className="px-4 py-3 font-bold font-mono text-emerald-600">{e.total_delivered}</td>
                        <td className="px-4 py-3 font-semibold font-mono text-rose-600">{e.total_undel}</td>
                        <td className="px-4 py-3 font-mono font-bold text-blue-600">{e.first_attempt_delivery_pct}%</td>
                        <td className="px-4 py-3 font-mono font-bold text-purple-600">{e.reattempt_delivery_pct}%</td>
                        <td className="px-4 py-3 font-mono font-black text-emerald-600">{e.overall_delivery_pct}%</td>
                        <td className="px-4 py-3 font-mono font-semibold text-right">₹{e.cod_value_delivered.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* REQUIREMENT 6: REPORT HISTORY PERSISTENCE & ACTIONS       */}
          {/* ========================================================= */}
          {activeTab === 'HISTORY' && (
            <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800/80 shadow-sm p-5 space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
                <span className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="h-4 w-4 text-neutral-500" /> Permanent Saved DRS Report Snapshots ({historyList.length})
                </span>

                <button
                  onClick={handleOpenComparison}
                  className="px-3 py-1.5 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-bold transition shadow-sm active:scale-95 flex items-center gap-1.5"
                >
                  <Columns className="h-3.5 w-3.5" /> Compare 2 Snapshots
                </button>
              </div>

              {historyList.length === 0 ? (
                <div className="p-8 text-center text-neutral-500">No report snapshots saved yet. Upload a DRS report to create automatic snapshots.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800">
                      <tr>
                        <th className="px-4 py-3">Report Date</th>
                        <th className="px-4 py-3">Hub</th>
                        <th className="px-4 py-3">Client</th>
                        <th className="px-4 py-3 font-bold">OFD</th>
                        <th className="px-4 py-3 font-bold text-emerald-600">Delivered</th>
                        <th className="px-4 py-3 font-black text-emerald-600">Delivery %</th>
                        <th className="px-4 py-3">Uploaded By</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {historyList.map((h) => {
                        const isActive = activeItem?.id === h.id;
                        return (
                          <tr
                            key={h.id}
                            className={`hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition ${
                              isActive ? 'bg-neutral-100/60 dark:bg-neutral-800/60 font-semibold' : ''
                            }`}
                          >
                            <td className="px-4 py-3 font-bold font-mono text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                              {isActive && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                              {h.reportDate}
                            </td>
                            <td className="px-4 py-3">{h.hubName}</td>
                            <td className="px-4 py-3">{h.clientName}</td>
                            <td className="px-4 py-3 font-bold font-mono">{h.totalOfd}</td>
                            <td className="px-4 py-3 font-bold font-mono text-emerald-600">{h.totalDelivered}</td>
                            <td className="px-4 py-3 font-mono font-black text-emerald-600">{h.overallDeliveryPct}%</td>
                            <td className="px-4 py-3 text-neutral-500">{h.uploadedBy}</td>
                            <td className="px-4 py-3 text-right flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenHistoryItem(h)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                                  isActive
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:opacity-90'
                                }`}
                              >
                                {isActive ? 'Active' : 'Open'}
                              </button>
                              <button
                                onClick={() => handleExportExcel()}
                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                title="Export Excel"
                              >
                                <FileSpreadsheet className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleExportPDF()}
                                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                title="Export PDF"
                              >
                                <FileText className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteHistory(h.id)}
                                className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                title="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* OTHER TABS FALLBACK (CLIENT, COD, PREPAID, FIRST ATTEMPT, REATTEMPT) */}
          {['FIRST_ATTEMPT', 'REATTEMPT', 'COD', 'PREPAID', 'CLIENT'].includes(activeTab) && (
            <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800/80 shadow-sm p-6 text-xs space-y-3">
              <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
                {activeTab} Breakdown View ({filteredUniqueRows.length} AWBs)
              </h3>
              <p className="text-neutral-500">
                Consuming unified active report payload without recalculating raw data.
              </p>
              <div className="pt-2 font-mono text-neutral-600 dark:text-neutral-400">
                Active Report ID: <span className="font-bold text-neutral-900 dark:text-neutral-100">{activeItem?.id}</span> | OFD: {filteredSummary?.totalOfd} | Delivered: {filteredSummary?.totalDelivered}
              </div>
            </div>
          )}
        </>
      )}

      {/* COMPARE MODAL */}
      {compareModalOpen && compareReportA && compareReportB && comparisonResult && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl w-full max-w-3xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
              <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <Columns className="h-4 w-4 text-brand-600" /> Side-by-Side Snapshot Comparison
              </h2>
              <button onClick={() => setCompareModalOpen(false)} className="px-3 py-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-bold">
                Close
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-bold text-neutral-500 block mb-1">Baseline Snapshot (A)</label>
                <select
                  value={compareReportA.id}
                  onChange={(e) => {
                    const sel = historyList.find((h) => h.id === e.target.value);
                    if (sel && compareReportB) handleTriggerCompare(sel, compareReportB);
                  }}
                  className="w-full p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 font-semibold"
                >
                  {historyList.map((h) => (
                    <option key={h.id} value={h.id}>{h.reportDate} - {h.fileName} ({h.overallDeliveryPct}%)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-bold text-neutral-500 block mb-1">Comparison Snapshot (B)</label>
                <select
                  value={compareReportB.id}
                  onChange={(e) => {
                    const sel = historyList.find((h) => h.id === e.target.value);
                    if (compareReportA && sel) handleTriggerCompare(compareReportA, sel);
                  }}
                  className="w-full p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 font-semibold"
                >
                  {historyList.map((h) => (
                    <option key={h.id} value={h.id}>{h.reportDate} - {h.fileName} ({h.overallDeliveryPct}%)</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 text-xs pt-2">
              <div className="p-3.5 rounded-xl bg-neutral-100 dark:bg-neutral-800/80">
                <span className="text-neutral-500 block">OFD Change</span>
                <span className="text-lg font-bold font-mono">{comparisonResult.ofdChange >= 0 ? `+${comparisonResult.ofdChange}` : comparisonResult.ofdChange}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-500/10">
                <span className="text-emerald-700 dark:text-emerald-400 block font-semibold">Delivered Change</span>
                <span className="text-lg font-bold font-mono text-emerald-600">{comparisonResult.delChange >= 0 ? `+${comparisonResult.delChange}` : comparisonResult.delChange}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-blue-500/10">
                <span className="text-blue-700 dark:text-blue-400 block font-semibold">Rate Shift</span>
                <span className="text-lg font-bold font-mono text-blue-600">{comparisonResult.deliveryRateChange >= 0 ? `+${comparisonResult.deliveryRateChange}%` : `${comparisonResult.deliveryRateChange}%`}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-purple-500/10">
                <span className="text-purple-700 dark:text-purple-400 block font-semibold">COD Amount Shift</span>
                <span className="text-lg font-bold font-mono text-purple-600">₹{comparisonResult.codAmountChange.toLocaleString()}</span>
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
