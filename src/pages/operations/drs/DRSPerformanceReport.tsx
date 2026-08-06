import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useHub } from '@/lib/hubContext';
import { useNavigate } from 'react-router-dom';
import { NDRAutoSyncResult, syncDRSUndelToNDR } from '@/lib/ndr/ndrAutoSync';
import {
  deleteAllDRSReports,
  deleteSelectedDRSReports,
  resetCurrentDRSReport,
} from '@/lib/drs/drsResetManager';
import { DRSResetModal } from '@/components/drs/DRSResetModal';
import { DRSRecycleBinDrawer } from '@/components/drs/DRSRecycleBinDrawer';
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
  Save,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
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

  // Enterprise Reset & Data Management State
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetLevel, setResetLevel] = useState<1 | 2 | 3>(1);
  const [recycleBinOpen, setRecycleBinOpen] = useState(false);
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);

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

  const navigate = useNavigate();
  const [ndrSyncResult, setNdrSyncResult] = useState<NDRAutoSyncResult | null>(null);

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

      setParsingProgress('Auto-syncing UNDEL shipments to NDR...');
      const syncResult = await syncDRSUndelToNDR(parsed.uniqueRows, selectedHub?.id, profile, {
        fileName: uploadedFile.name,
        reportDate: dateStr,
      });
      setNdrSyncResult(syncResult);

      setParsingProgress(null);
      setToastMsg(`DRS Uploaded! ${syncResult.undelSentToNdr} UNDEL shipments auto-synced to NDR.`);
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

  const handleOpenResetModal = (lvl: 1 | 2 | 3) => {
    setResetLevel(lvl);
    setResetModalOpen(true);
  };

  const handleConfirmReset = async (options: { reason: string; exportBeforeDelete: boolean }) => {
    if (resetLevel === 1 && activeItem) {
      await resetCurrentDRSReport(activeItem, profile, selectedHub?.id, options);
      setActiveItem(null);
      setSummary(null);
      setUniqueRows([]);
      setNdrSyncResult(null);
      const refreshedHist = await fetchDRSHistoryFromDB();
      setHistoryList(refreshedHist);
      setToastMsg('Current DRS Report & linked NDR cases reset.');
    } else if (resetLevel === 2) {
      const selectedItems = historyList.filter((h) => selectedReportIds.includes(h.id));
      if (selectedItems.length === 0) return;
      await deleteSelectedDRSReports(selectedItems, profile, selectedHub?.id, options.reason);
      setSelectedReportIds([]);
      if (activeItem && selectedReportIds.includes(activeItem.id)) {
        setActiveItem(null);
        setSummary(null);
        setUniqueRows([]);
        setNdrSyncResult(null);
      }
      const refreshedHist = await fetchDRSHistoryFromDB();
      setHistoryList(refreshedHist);
      setToastMsg(`${selectedItems.length} Reports deleted.`);
    } else if (resetLevel === 3) {
      await deleteAllDRSReports(profile, selectedHub?.id, options.reason);
      setActiveItem(null);
      setSummary(null);
      setUniqueRows([]);
      setNdrSyncResult(null);
      setHistoryList([]);
      setToastMsg('ALL DRS Reports, Snapshots & NDR Cases reset.');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 p-4 md:p-8 space-y-6 max-w-[1700px] mx-auto transition-colors font-sans antialiased">
      {/* ========================================================= */}
      {/* HEADER: REPORT METADATA & ACTION CONTROLS                */}
      {/* ========================================================= */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-600 text-white flex items-center justify-center font-black">
              <BarChart3 className="h-4 w-4" />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              {summary?.fileName || 'DRS Performance Analytics Dashboard'}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-brand-500/10 text-brand-600 border border-brand-500/20 uppercase tracking-wider">
              Power BI Edition
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400 font-medium">
            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-neutral-400" /> Report Date: <strong className="text-neutral-800 dark:text-neutral-200">{summary?.reportDate || 'N/A'}</strong></span>
            <span>•</span>
            <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5 text-neutral-400" /> Hub: <strong className="text-neutral-800 dark:text-neutral-200">{selectedHub?.name || activeItem?.hubName || 'Main Hub'}</strong></span>
            <span>•</span>
            <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5 text-neutral-400" /> File: <strong className="text-neutral-800 dark:text-neutral-200">{summary?.fileName || 'N/A'}</strong></span>
            <span>•</span>
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-neutral-400" /> Updated: <strong className="text-neutral-800 dark:text-neutral-200">{activeItem?.uploadTimestamp || 'Just now'}</strong></span>
          </div>
        </div>

        {/* Action Controls & Enterprise Reset Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {summary && (
            <div className="relative min-w-[200px]">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-400" />
              <input
                type="text"
                placeholder="Search AWBs, Executive..."
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-medium focus:ring-2 focus:ring-brand-500 outline-none"
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
                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md transition flex items-center gap-1.5 active:scale-95"
              >
                <Save className="h-4 w-4" /> Save Snapshot
              </button>

              <button
                onClick={handleOpenComparison}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition flex items-center gap-1.5 active:scale-95"
              >
                <Columns className="h-4 w-4" /> Compare
              </button>

              <button
                onClick={() => handleOpenResetModal(1)}
                className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md transition flex items-center gap-1.5 active:scale-95"
                title="Reset Current Opened Report"
              >
                <Trash2 className="h-4 w-4" /> Reset Current
              </button>
            </>
          )}

          {selectedReportIds.length > 0 && (
            <button
              onClick={() => handleOpenResetModal(2)}
              className="px-3 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow-md transition flex items-center gap-1.5 active:scale-95"
            >
              <Trash2 className="h-4 w-4" /> Delete Selected ({selectedReportIds.length})
            </button>
          )}

          <button
            onClick={() => handleOpenResetModal(3)}
            className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md transition flex items-center gap-1.5 active:scale-95"
            title="Admin Delete ALL Reports"
          >
            <ShieldAlert className="h-4 w-4" /> Delete All
          </button>

          <button
            onClick={() => setRecycleBinOpen(true)}
            className="px-3 py-2 rounded-xl bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-bold transition flex items-center gap-1.5 active:scale-95"
          >
            <RotateCcw className="h-4 w-4 text-orange-500" /> Recycle Bin
          </button>
        </div>
      </header>

      {/* NDR AUTO-SYNC RESULT BANNER */}
      {ndrSyncResult && (
        <div className="p-4 rounded-2xl bg-brand-500/10 border border-brand-500/30 flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-600 text-white font-bold">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
                DRS → NDR Auto-Sync Complete
              </h4>
              <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-600 dark:text-neutral-300 font-mono mt-0.5">
                <span>UNDEL Sent to NDR: <strong className="text-brand-600 font-bold">{ndrSyncResult.undelSentToNdr}</strong></span>
                <span>•</span>
                <span>New NDR Created: <strong className="text-emerald-600 font-bold">{ndrSyncResult.newNdrCreated}</strong></span>
                <span>•</span>
                <span>Existing NDR Updated: <strong className="text-blue-600 font-bold">{ndrSyncResult.existingNdrUpdated}</strong></span>
                <span>•</span>
                <span>Duplicates Skipped: <strong className="text-neutral-500 font-bold">{ndrSyncResult.duplicatesSkipped}</strong></span>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/operations/ndr/shipments')}
            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-md transition flex items-center gap-1.5 active:scale-95 shrink-0"
          >
            <ChevronRight className="h-4 w-4" /> View NDR Cases
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* NAVIGATION TABS (ROUNDED PILL TABS)                        */}
      {/* ========================================================= */}
      <div className="overflow-x-auto no-scrollbar">
        <nav className="flex space-x-1.5 min-w-max p-1 bg-neutral-200/50 dark:bg-neutral-900 rounded-full border border-neutral-200/80 dark:border-neutral-800">
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
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 ${
                activeTab === t.id
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-300/60 dark:hover:bg-neutral-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ========================================================= */}
      {/* INITIAL EMPTY / LOADING STATE                             */}
      {/* ========================================================= */}
      {isLoading ? (
        <div className="p-16 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center space-y-3">
          <RefreshCw className="h-8 w-8 animate-spin text-brand-600 mx-auto" />
          <p className="text-xs font-bold text-neutral-500">Restoring report snapshot...</p>
        </div>
      ) : !summary ? (
        <div className="p-16 rounded-2xl bg-white dark:bg-neutral-900 border border-dashed border-neutral-300 dark:border-neutral-800 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 mx-auto flex items-center justify-center">
            <Upload className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Upload DRS Performance Report</h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto mt-1">
              Select a daily DRS Excel or CSV file to calculate executive analytics and save permanent snapshots.
            </p>
          </div>
          {parsingProgress ? (
            <div className="py-4 flex flex-col items-center gap-2 text-brand-600">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="text-xs font-bold">{parsingProgress}</span>
            </div>
          ) : (
            <label className="inline-block px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold transition shadow-md cursor-pointer active:scale-95">
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
          {/* TAB 1: OVERVIEW PAGE                                      */}
          {/* ========================================================= */}
          {activeTab === 'OVERVIEW' && filteredSummary && (
            <div className="space-y-6">
              {/* ----------------------------------------------------- */}
              {/* 6 PRIMARY KPI CARDS (HEIGHT: 135–140PX, VALUE: 42PX BOLD) */}
              {/* ----------------------------------------------------- */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                {/* 1. Total OFD */}
                <div className="min-h-[135px] max-h-[140px] flex flex-col justify-between p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center justify-between">
                    <span>Total OFD</span>
                    <Package className="h-4 w-4 text-neutral-400" />
                  </div>
                  <span className="text-[42px] font-black tracking-tight leading-none text-neutral-900 dark:text-neutral-100 font-mono">
                    {filteredSummary.totalOfd}
                  </span>
                  <span className="text-[10px] text-neutral-400 font-medium">Unique AWBs</span>
                </div>

                {/* 2. Delivered */}
                <div className="min-h-[135px] max-h-[140px] flex flex-col justify-between p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center justify-between">
                    <span>Delivered</span>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  </div>
                  <span className="text-[42px] font-black tracking-tight leading-none text-emerald-600 dark:text-emerald-400 font-mono">
                    {filteredSummary.totalDelivered}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-semibold">{filteredSummary.overallDeliveryPct}% Rate</span>
                </div>

                {/* 3. Pending */}
                <div className="min-h-[135px] max-h-[140px] flex flex-col justify-between p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center justify-between">
                    <span>Pending</span>
                    <Clock className="h-4 w-4 text-rose-600" />
                  </div>
                  <span className="text-[42px] font-black tracking-tight leading-none text-rose-600 dark:text-rose-400 font-mono">
                    {filteredSummary.totalUndel}
                  </span>
                  <span className="text-[10px] text-rose-600 font-semibold">Active UNDEL</span>
                </div>

                {/* 4. Overall Delivery % */}
                <div className="min-h-[135px] max-h-[140px] flex flex-col justify-between p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center justify-between">
                    <span>Overall %</span>
                    <TrendingUp className="h-4 w-4 text-brand-600" />
                  </div>
                  <span className="text-[42px] font-black tracking-tight leading-none text-neutral-900 dark:text-neutral-100 font-mono">
                    {filteredSummary.overallDeliveryPct}%
                  </span>
                  <span className="text-[10px] text-neutral-400 font-medium">Efficiency</span>
                </div>

                {/* 5. First Attempt % */}
                <div className="min-h-[135px] max-h-[140px] flex flex-col justify-between p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center justify-between">
                    <span>1st Attempt %</span>
                    <Target className="h-4 w-4 text-blue-600" />
                  </div>
                  <span className="text-[42px] font-black tracking-tight leading-none text-blue-600 dark:text-blue-400 font-mono">
                    {filteredSummary.firstAttemptDeliveryPct}%
                  </span>
                  <span className="text-[10px] text-blue-600 font-semibold">{filteredSummary.firstAttemptDelivered} / {filteredSummary.firstAttemptOfd}</span>
                </div>

                {/* 6. Reattempt % */}
                <div className="min-h-[135px] max-h-[140px] flex flex-col justify-between p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center justify-between">
                    <span>Reattempt %</span>
                    <RotateCcw className="h-4 w-4 text-purple-600" />
                  </div>
                  <span className="text-[42px] font-black tracking-tight leading-none text-purple-600 dark:text-purple-400 font-mono">
                    {filteredSummary.reattemptDeliveryPct}%
                  </span>
                  <span className="text-[10px] text-purple-600 font-semibold">{filteredSummary.reattemptDelivered} / {filteredSummary.reattemptOfd}</span>
                </div>
              </div>

              {/* ----------------------------------------------------- */}
              {/* EXECUTIVE SECTIONS (TREND, DONUT, EMPLOYEES, NDR, COD, PREPAID) */}
              {/* ----------------------------------------------------- */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 text-xs">
                {/* 1. Delivery Trend Chart */}
                <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2">
                    <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-xs flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-600" /> Delivery Trend Efficiency
                    </h3>
                    <span className="font-mono font-bold text-emerald-600">{filteredSummary.overallDeliveryPct}%</span>
                  </div>
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-500 font-medium">Target Efficiency</span>
                      <span className="font-mono font-bold text-neutral-700 dark:text-neutral-300">80.00%</span>
                    </div>
                    <div className="w-full bg-neutral-100 dark:bg-neutral-800 h-3 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(filteredSummary.overallDeliveryPct, 100)}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-neutral-400 block font-mono">Average Attempts per AWB: {filteredSummary.averageAttempts}</span>
                  </div>
                </div>

                {/* 2. Delivery Status Donut / Pie Breakdown */}
                <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2">
                    <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-xs flex items-center gap-2">
                      <PieIcon className="h-4 w-4 text-brand-600" /> Delivery Status Breakdown
                    </h3>
                  </div>
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-emerald-600">Delivered</span>
                      <span className="font-mono font-bold">{filteredSummary.totalDelivered} ({filteredSummary.overallDeliveryPct}%)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-rose-600">Undelivered</span>
                      <span className="font-mono font-bold">{filteredSummary.totalUndel}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-purple-600">RTO</span>
                      <span className="font-mono font-bold">{filteredSummary.totalRto}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-neutral-500">Cancelled</span>
                      <span className="font-mono font-bold">{filteredSummary.totalCancelled}</span>
                    </div>
                  </div>
                </div>

                {/* 3. Top 5 Employees */}
                <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2">
                    <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-xs flex items-center gap-1.5">
                      <User className="h-4 w-4 text-brand-600" /> Top 5 Employees
                    </h3>
                    <button onClick={() => setActiveTab('EMPLOYEE')} className="text-[11px] font-semibold text-brand-600 hover:underline">View All</button>
                  </div>
                  <div className="space-y-1.5">
                    {filteredEmployeeMetrics.slice(0, 5).map((e, idx) => (
                      <div key={e.employee_name} className="flex items-center justify-between p-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/40">
                        <span className="font-bold text-neutral-900 dark:text-neutral-100 truncate max-w-[160px]">#{idx + 1} {e.employee_name}</span>
                        <span className="font-mono font-bold text-emerald-600">{e.overall_delivery_pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Top NDR Reasons */}
                <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2">
                    <h3 className="font-bold text-rose-600 uppercase tracking-wider text-xs flex items-center gap-1.5">
                      <ShieldAlert className="h-4 w-4" /> Top NDR Reasons
                    </h3>
                  </div>
                  <div className="space-y-1.5">
                    {reasonMetrics.slice(0, 5).map((r) => (
                      <div key={r.reason} className="flex items-center justify-between p-1.5 rounded-lg bg-rose-500/5">
                        <span className="truncate max-w-[170px] font-semibold text-neutral-800 dark:text-neutral-200">{r.reason}</span>
                        <span className="font-bold font-mono text-rose-600">{r.count} AWBs</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 5. COD Summary */}
                <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2">
                    <h3 className="font-bold text-purple-600 uppercase tracking-wider text-xs flex items-center gap-1.5">
                      <CreditCard className="h-4 w-4" /> COD Summary
                    </h3>
                    <span className="font-mono font-bold text-purple-600">FAD: {paymentMetrics.codFadPercent}%</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-neutral-400 block">COD OFD</span><span className="font-bold font-mono text-neutral-900 dark:text-neutral-100">{paymentMetrics.codOfd}</span></div>
                    <div><span className="text-neutral-400 block">Delivered</span><span className="font-bold font-mono text-emerald-600">{paymentMetrics.codDelivered}</span></div>
                  </div>
                  <div className="pt-1 font-mono font-bold text-neutral-700 dark:text-neutral-300">
                    Collected: ₹{paymentMetrics.codDeliveredAmount.toLocaleString()}
                  </div>
                </div>

                {/* 6. Prepaid Summary */}
                <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2">
                    <h3 className="font-bold text-blue-600 uppercase tracking-wider text-xs flex items-center gap-1.5">
                      <CreditCard className="h-4 w-4" /> Prepaid Summary
                    </h3>
                    <span className="font-mono font-bold text-blue-600">FAD: {paymentMetrics.prepaidFadPercent}%</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-neutral-400 block">Prepaid OFD</span><span className="font-bold font-mono text-neutral-900 dark:text-neutral-100">{paymentMetrics.prepaidOfd}</span></div>
                    <div><span className="text-neutral-400 block">Delivered</span><span className="font-bold font-mono text-emerald-600">{paymentMetrics.prepaidDelivered}</span></div>
                  </div>
                  <div className="pt-1 font-mono font-bold text-neutral-700 dark:text-neutral-300">
                    Total Value: ₹{paymentMetrics.prepaidTotalAmount.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: EMPLOYEE PAGE (DEFAULT SORT OVERALL % DESC)       */}
          {/* ========================================================= */}
          {activeTab === 'EMPLOYEE' && (
            <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm overflow-hidden text-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800 sticky top-0">
                    <tr>
                      <th className="px-4 py-3">Rank</th>
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3 font-bold">OFD</th>
                      <th className="px-4 py-3 font-bold text-emerald-600">Delivered</th>
                      <th className="px-4 py-3 font-bold text-rose-600">Pending</th>
                      <th className="px-4 py-3 font-semibold text-blue-600">1st Attempt %</th>
                      <th className="px-4 py-3 font-semibold text-purple-600">Reattempt %</th>
                      <th className="px-4 py-3 font-black text-emerald-600">Overall %</th>
                      <th className="px-4 py-3 text-right">COD</th>
                      <th className="px-4 py-3 text-right">Prepaid</th>
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
                        <td className="px-4 py-3 font-mono font-semibold text-neutral-400">#{idx + 1}</td>
                        <td className="px-4 py-3 font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-brand-600" /> {e.employee_name}
                        </td>
                        <td className="px-4 py-3 font-bold font-mono">{e.total_ofd}</td>
                        <td className="px-4 py-3 font-bold font-mono text-emerald-600">{e.total_delivered}</td>
                        <td className="px-4 py-3 font-semibold font-mono text-rose-600">{e.total_undel}</td>
                        <td className="px-4 py-3 font-mono font-bold text-blue-600">{e.first_attempt_delivery_pct}%</td>
                        <td className="px-4 py-3 font-mono font-bold text-purple-600">{e.reattempt_delivery_pct}%</td>
                        <td className="px-4 py-3 font-mono font-black text-emerald-600">{e.overall_delivery_pct}%</td>
                        <td className="px-4 py-3 font-mono text-right">₹{e.cod_value_delivered.toLocaleString()}</td>
                        <td className="px-4 py-3 font-mono text-right">{e.prepaid_ofd} AWBs</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: FIRST ATTEMPT PAGE                                 */}
          {/* ========================================================= */}
          {activeTab === 'FIRST_ATTEMPT' && filteredSummary && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-1">
                  <span className="text-neutral-500 font-semibold block text-xs">First Attempt OFD</span>
                  <span className="text-2xl font-black text-neutral-900 dark:text-neutral-100 font-mono">{filteredSummary.firstAttemptOfd}</span>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 shadow-sm space-y-1">
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold block text-xs">Delivered</span>
                  <span className="text-2xl font-black text-emerald-600 font-mono">{filteredSummary.firstAttemptDelivered}</span>
                </div>
                <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 shadow-sm space-y-1">
                  <span className="text-rose-700 dark:text-rose-400 font-semibold block text-xs">Pending</span>
                  <span className="text-2xl font-black text-rose-600 font-mono">{filteredSummary.firstAttemptUndel}</span>
                </div>
                <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 shadow-sm space-y-1">
                  <span className="text-blue-700 dark:text-blue-400 font-semibold block text-xs">Delivery %</span>
                  <span className="text-2xl font-black text-blue-600 font-mono">{filteredSummary.firstAttemptDeliveryPct}%</span>
                </div>
              </div>

              {/* Employee Table */}
              <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm overflow-hidden text-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800">
                      <tr>
                        <th className="px-4 py-3">Rank</th>
                        <th className="px-4 py-3">Employee</th>
                        <th className="px-4 py-3 font-bold">1st OFD</th>
                        <th className="px-4 py-3 font-bold text-emerald-600">1st Delivered</th>
                        <th className="px-4 py-3 font-bold text-rose-600">1st Pending</th>
                        <th className="px-4 py-3 font-black text-blue-600">1st Delivery %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {filteredEmployeeMetrics.map((e, idx) => (
                        <tr key={e.employee_name} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                          <td className="px-4 py-3 font-mono font-semibold text-neutral-400">#{idx + 1}</td>
                          <td className="px-4 py-3 font-bold text-neutral-900 dark:text-neutral-100">{e.employee_name}</td>
                          <td className="px-4 py-3 font-bold font-mono">{e.first_attempt_ofd}</td>
                          <td className="px-4 py-3 font-bold font-mono text-emerald-600">{e.first_attempt_delivered}</td>
                          <td className="px-4 py-3 font-semibold font-mono text-rose-600">{e.first_attempt_undel}</td>
                          <td className="px-4 py-3 font-mono font-black text-blue-600">{e.first_attempt_delivery_pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 4: REATTEMPT PAGE                                     */}
          {/* ========================================================= */}
          {activeTab === 'REATTEMPT' && filteredSummary && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-1">
                  <span className="text-neutral-500 font-semibold block text-xs">Reattempt OFD</span>
                  <span className="text-2xl font-black text-neutral-900 dark:text-neutral-100 font-mono">{filteredSummary.reattemptOfd}</span>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 shadow-sm space-y-1">
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold block text-xs">Delivered</span>
                  <span className="text-2xl font-black text-emerald-600 font-mono">{filteredSummary.reattemptDelivered}</span>
                </div>
                <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 shadow-sm space-y-1">
                  <span className="text-rose-700 dark:text-rose-400 font-semibold block text-xs">Pending</span>
                  <span className="text-2xl font-black text-rose-600 font-mono">{filteredSummary.reattemptUndel}</span>
                </div>
                <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/20 shadow-sm space-y-1">
                  <span className="text-purple-700 dark:text-purple-400 font-semibold block text-xs">Delivery %</span>
                  <span className="text-2xl font-black text-purple-600 font-mono">{filteredSummary.reattemptDeliveryPct}%</span>
                </div>
              </div>

              {/* Employee Table */}
              <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm overflow-hidden text-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800">
                      <tr>
                        <th className="px-4 py-3">Rank</th>
                        <th className="px-4 py-3">Employee</th>
                        <th className="px-4 py-3 font-bold">Reattempt OFD</th>
                        <th className="px-4 py-3 font-bold text-emerald-600">Reattempt Delivered</th>
                        <th className="px-4 py-3 font-bold text-rose-600">Reattempt Pending</th>
                        <th className="px-4 py-3 font-black text-purple-600">Reattempt Delivery %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {filteredEmployeeMetrics.map((e, idx) => (
                        <tr key={e.employee_name} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                          <td className="px-4 py-3 font-mono font-semibold text-neutral-400">#{idx + 1}</td>
                          <td className="px-4 py-3 font-bold text-neutral-900 dark:text-neutral-100">{e.employee_name}</td>
                          <td className="px-4 py-3 font-bold font-mono">{e.reattempt_ofd}</td>
                          <td className="px-4 py-3 font-bold font-mono text-emerald-600">{e.reattempt_delivered}</td>
                          <td className="px-4 py-3 font-semibold font-mono text-rose-600">{e.reattempt_undel}</td>
                          <td className="px-4 py-3 font-mono font-black text-purple-600">{e.reattempt_delivery_pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 5: COD PAGE                                           */}
          {/* ========================================================= */}
          {activeTab === 'COD' && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-1">
                  <span className="text-neutral-500 font-semibold block text-xs">COD OFD</span>
                  <span className="text-2xl font-black text-neutral-900 dark:text-neutral-100 font-mono">{paymentMetrics.codOfd}</span>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 shadow-sm space-y-1">
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold block text-xs">COD Delivered</span>
                  <span className="text-2xl font-black text-emerald-600 font-mono">{paymentMetrics.codDelivered}</span>
                </div>
                <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 shadow-sm space-y-1">
                  <span className="text-rose-700 dark:text-rose-400 font-semibold block text-xs">COD Pending</span>
                  <span className="text-2xl font-black text-rose-600 font-mono">{paymentMetrics.codPending}</span>
                </div>
                <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/20 shadow-sm space-y-1">
                  <span className="text-purple-700 dark:text-purple-400 font-semibold block text-xs">COD FAD %</span>
                  <span className="text-2xl font-black text-purple-600 font-mono">{paymentMetrics.codFadPercent}%</span>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-600/10 border border-emerald-600/20 shadow-sm space-y-1">
                  <span className="text-emerald-800 dark:text-emerald-300 font-bold block text-xs">COD Amount</span>
                  <span className="text-xl font-black text-emerald-600 font-mono">₹{paymentMetrics.codDeliveredAmount.toLocaleString()}</span>
                </div>
              </div>

              {/* Employee Table */}
              <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm overflow-hidden text-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800">
                      <tr>
                        <th className="px-4 py-3">Rank</th>
                        <th className="px-4 py-3">Employee</th>
                        <th className="px-4 py-3 font-bold">COD OFD</th>
                        <th className="px-4 py-3 font-bold text-emerald-600">COD Delivered</th>
                        <th className="px-4 py-3 font-bold text-rose-600">COD Pending</th>
                        <th className="px-4 py-3 font-black text-purple-600">COD FAD %</th>
                        <th className="px-4 py-3 text-right">COD Collection (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {filteredEmployeeMetrics.map((e, idx) => (
                        <tr key={e.employee_name} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                          <td className="px-4 py-3 font-mono font-semibold text-neutral-400">#{idx + 1}</td>
                          <td className="px-4 py-3 font-bold text-neutral-900 dark:text-neutral-100">{e.employee_name}</td>
                          <td className="px-4 py-3 font-bold font-mono">{e.cod_ofd}</td>
                          <td className="px-4 py-3 font-bold font-mono text-emerald-600">{e.cod_delivered}</td>
                          <td className="px-4 py-3 font-semibold font-mono text-rose-600">{e.cod_pending}</td>
                          <td className="px-4 py-3 font-mono font-black text-purple-600">{e.cod_fad_percent}%</td>
                          <td className="px-4 py-3 font-mono font-bold text-right">₹{e.cod_value_delivered.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 6: PREPAID PAGE                                       */}
          {/* ========================================================= */}
          {activeTab === 'PREPAID' && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-1">
                  <span className="text-neutral-500 font-semibold block text-xs">Prepaid OFD</span>
                  <span className="text-2xl font-black text-neutral-900 dark:text-neutral-100 font-mono">{paymentMetrics.prepaidOfd}</span>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 shadow-sm space-y-1">
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold block text-xs">Delivered</span>
                  <span className="text-2xl font-black text-emerald-600 font-mono">{paymentMetrics.prepaidDelivered}</span>
                </div>
                <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 shadow-sm space-y-1">
                  <span className="text-rose-700 dark:text-rose-400 font-semibold block text-xs">Pending</span>
                  <span className="text-2xl font-black text-rose-600 font-mono">{paymentMetrics.prepaidPending}</span>
                </div>
                <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 shadow-sm space-y-1">
                  <span className="text-blue-700 dark:text-blue-400 font-semibold block text-xs">FAD %</span>
                  <span className="text-2xl font-black text-blue-600 font-mono">{paymentMetrics.prepaidFadPercent}%</span>
                </div>
                <div className="p-4 rounded-2xl bg-blue-600/10 border border-blue-600/20 shadow-sm space-y-1">
                  <span className="text-blue-800 dark:text-blue-300 font-bold block text-xs">Amount</span>
                  <span className="text-xl font-black text-blue-600 font-mono">₹{paymentMetrics.prepaidTotalAmount.toLocaleString()}</span>
                </div>
              </div>

              {/* Employee Table */}
              <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm overflow-hidden text-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800">
                      <tr>
                        <th className="px-4 py-3">Rank</th>
                        <th className="px-4 py-3">Employee</th>
                        <th className="px-4 py-3 font-bold">Prepaid OFD</th>
                        <th className="px-4 py-3 font-bold text-emerald-600">Delivered</th>
                        <th className="px-4 py-3 font-bold text-rose-600">Pending</th>
                        <th className="px-4 py-3 font-black text-blue-600">FAD %</th>
                        <th className="px-4 py-3 text-right">Prepaid Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {filteredEmployeeMetrics.map((e, idx) => (
                        <tr key={e.employee_name} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                          <td className="px-4 py-3 font-mono font-semibold text-neutral-400">#{idx + 1}</td>
                          <td className="px-4 py-3 font-bold text-neutral-900 dark:text-neutral-100">{e.employee_name}</td>
                          <td className="px-4 py-3 font-bold font-mono">{e.prepaid_ofd}</td>
                          <td className="px-4 py-3 font-bold font-mono text-emerald-600">{e.prepaid_delivered}</td>
                          <td className="px-4 py-3 font-semibold font-mono text-rose-600">{e.prepaid_pending}</td>
                          <td className="px-4 py-3 font-mono font-black text-blue-600">{e.prepaid_fad_percent}%</td>
                          <td className="px-4 py-3 font-mono font-bold text-right">₹{e.prepaid_amount_total.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 7: CLIENT PAGE                                        */}
          {/* ========================================================= */}
          {activeTab === 'CLIENT' && (
            <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm overflow-hidden text-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800">
                    <tr>
                      <th className="px-4 py-3">Client Name</th>
                      <th className="px-4 py-3 font-bold">Total OFD</th>
                      <th className="px-4 py-3 font-bold text-emerald-600">Delivered</th>
                      <th className="px-4 py-3 font-bold text-rose-600">Undelivered</th>
                      <th className="px-4 py-3 font-black text-emerald-600">Overall Delivery %</th>
                      <th className="px-4 py-3">COD OFD / DEL</th>
                      <th className="px-4 py-3">Prepaid OFD / DEL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {clientMetrics.map((c) => (
                      <tr key={c.client_name} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                        <td className="px-4 py-3 font-bold text-neutral-900 dark:text-neutral-100">{c.client_name}</td>
                        <td className="px-4 py-3 font-bold font-mono">{c.total_ofd}</td>
                        <td className="px-4 py-3 font-bold font-mono text-emerald-600">{c.total_delivered}</td>
                        <td className="px-4 py-3 font-semibold font-mono text-rose-600">{c.total_undel}</td>
                        <td className="px-4 py-3 font-mono font-black text-emerald-600">{c.overall_delivery_pct}%</td>
                        <td className="px-4 py-3 font-mono text-purple-600">{c.cod_ofd} / {c.cod_delivered}</td>
                        <td className="px-4 py-3 font-mono text-blue-600">{c.prepaid_ofd} / {c.prepaid_delivered}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 8: REPORT HISTORY PAGE                                */}
          {/* ========================================================= */}
          {activeTab === 'HISTORY' && (
            <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm p-5 space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
                <span className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="h-4 w-4 text-neutral-500" /> Permanent Saved Reports ({historyList.length})
                </span>

                <button
                  onClick={handleOpenComparison}
                  className="px-3.5 py-1.5 rounded-xl bg-brand-600 text-white font-bold transition shadow-sm active:scale-95 flex items-center gap-1.5"
                >
                  <Columns className="h-3.5 w-3.5" /> Compare 2 Reports
                </button>
              </div>

              {historyList.length === 0 ? (
                <div className="p-8 text-center text-neutral-500">No report snapshots saved yet. Upload a DRS report to create automatic snapshots.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Hub</th>
                        <th className="px-4 py-3">File Name</th>
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
                              isActive ? 'bg-brand-500/5 dark:bg-brand-950/20 font-semibold' : ''
                            }`}
                          >
                            <td className="px-4 py-3 font-bold font-mono text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                              {isActive && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                              {h.reportDate}
                            </td>
                            <td className="px-4 py-3">{h.hubName}</td>
                            <td className="px-4 py-3 truncate max-w-[200px]">{h.fileName}</td>
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
                                    : 'bg-brand-600 text-white hover:bg-brand-500'
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
        </>
      )}

      {/* COMPARE SNAPSHOTS MODAL */}
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

      {/* Enterprise Reset Confirmation Modal */}
      <DRSResetModal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        level={resetLevel}
        currentReport={activeItem}
        selectedReports={historyList.filter((h) => selectedReportIds.includes(h.id))}
        onConfirm={handleConfirmReset}
      />

      {/* Enterprise Recycle Bin Drawer */}
      <DRSRecycleBinDrawer
        isOpen={recycleBinOpen}
        onClose={() => setRecycleBinOpen(false)}
        onRestoreSuccess={async () => {
          const restoredHist = await fetchDRSHistoryFromDB();
          setHistoryList(restoredHist);
          if (restoredHist.length > 0) {
            handleOpenHistoryItem(restoredHist[0]);
          }
          setToastMsg('Report & NDR cases restored from Recycle Bin!');
        }}
      />

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
