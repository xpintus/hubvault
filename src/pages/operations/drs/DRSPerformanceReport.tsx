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
  Copy,
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
  | 'TOTAL_SHIPMENTS'
  | 'OFD'
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
  const [copyingEmployeeSnapshot, setCopyingEmployeeSnapshot] = useState(false);

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
        } else {
          setActiveItem(null);
          setSummary(null);
          setUniqueRows([]);
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
    console.log(`[DRS Upload Started] File: ${uploadedFile.name}`);
    setParsingProgress('Reading DRS file...');
    try {
      setParsingProgress('Parsing AWBs...');
      const parsed = await parseDRSFile(uploadedFile);
      console.log(`[Rows Parsed] Raw Count: ${parsed.rawRowCount}, Valid Rows: ${parsed.rows.length}, Unique AWBs: ${parsed.uniqueRows.length}`);

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
      console.log(`[Sync Started] Triggering syncDRSUndelToNDR for ${parsed.uniqueRows.length} unique rows.`);
      const syncResult = await syncDRSUndelToNDR(parsed.uniqueRows, selectedHub?.id, profile, {
        fileName: uploadedFile.name,
        reportDate: dateStr,
      });
      setNdrSyncResult(syncResult);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('ndr-data-updated'));
        window.dispatchEvent(new Event('drs-data-updated'));
      }

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

  // OFD pending means the shipment has no final delivery outcome yet.
  // Delivered, Undelivered, RTO and Cancelled shipments are excluded.
  const pendingOfdRows = useMemo(
    () => filteredUniqueRows.filter((row) => row.shipment_status_normalized === 'Unknown'),
    [filteredUniqueRows]
  );

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

  const handleCopyEmployeeSnapshot = async () => {
    if (copyingEmployeeSnapshot || filteredEmployeeMetrics.length === 0) return;
    setCopyingEmployeeSnapshot(true);

    const textSnapshot = [
      `Employee Performance${filteredSummary?.reportDate ? ` - ${filteredSummary.reportDate}` : ''}`,
      `Hub: ${selectedHub?.name || 'All hubs'}`,
      ...filteredEmployeeMetrics.map(
        (employee, index) =>
          `#${index + 1} ${employee.employee_name} | OFD ${employee.total_ofd} | Delivered ${employee.total_delivered} | Pending ${employee.total_undel} | Overall ${employee.overall_delivery_pct}% | COD ${employee.cod_shipments_count} | COD Collected ₹${employee.cod_value_delivered.toLocaleString('en-IN')} | Prepaid ${employee.prepaid_ofd}`
      ),
    ].join('\n');

    try {
      const width = 1400;
      const rowHeight = 58;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = 250 + filteredEmployeeMetrics.length * rowHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas is unavailable');

      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const gradient = ctx.createLinearGradient(0, 0, width, 180);
      gradient.addColorStop(0, '#4338ca');
      gradient.addColorStop(0.55, '#6d28d9');
      gradient.addColorStop(1, '#a21caf');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, 180);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 16px Arial';
      ctx.fillText('TEAM LEADERBOARD', 38, 42);
      ctx.font = '800 30px Arial';
      ctx.fillText('Employee Performance', 38, 82);
      ctx.font = '400 14px Arial';
      ctx.fillStyle = '#e0e7ff';
      ctx.fillText(`${selectedHub?.name || 'All hubs'} • ${filteredSummary?.reportDate || 'Current report'}`, 38, 108);

      const cards = [
        ['EMPLOYEES', String(filteredEmployeeMetrics.length)],
        ['TOTAL OFD', String(filteredSummary?.totalOfd ?? 0)],
        ['DELIVERY', `${filteredSummary?.overallDeliveryPct ?? 0}%`],
        ['COD SHIPMENTS', String(paymentMetrics.codOfd)],
      ];
      cards.forEach(([label, value], index) => {
        const x = 38 + index * 190;
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.fillRect(x, 124, 174, 42);
        ctx.fillStyle = '#ddd6fe'; ctx.font = '700 10px Arial'; ctx.fillText(label, x + 12, 140);
        ctx.fillStyle = '#ffffff'; ctx.font = '800 17px Arial'; ctx.fillText(value, x + 12, 160);
      });

      const columns = [
        ['RANK', 35], ['EMPLOYEE', 105], ['OFD', 360], ['DEL.', 440], ['PENDING', 525],
        ['1ST %', 625], ['RETRY %', 735], ['OVERALL %', 855], ['COD COUNT', 990],
        ['COD COLLECTED', 1110], ['PREPAID', 1280],
      ] as const;
      ctx.fillStyle = '#eef2ff'; ctx.fillRect(0, 180, width, 48);
      ctx.fillStyle = '#64748b'; ctx.font = '700 11px Arial';
      columns.forEach(([label, x]) => ctx.fillText(label, x, 210));

      filteredEmployeeMetrics.forEach((employee, index) => {
        const y = 228 + index * rowHeight;
        ctx.fillStyle = index % 2 === 0 ? '#ffffff' : '#f8fafc'; ctx.fillRect(0, y, width, rowHeight);
        ctx.fillStyle = '#e2e8f0'; ctx.fillRect(0, y + rowHeight - 1, width, 1);
        ctx.font = '700 14px Arial'; ctx.fillStyle = index < 3 ? '#b45309' : '#64748b'; ctx.fillText(`#${index + 1}`, 35, y + 34);
        ctx.fillStyle = '#0f172a'; ctx.fillText(employee.employee_name, 105, y + 34);
        ctx.font = '700 13px Arial'; ctx.fillText(String(employee.total_ofd), 360, y + 34);
        ctx.fillStyle = '#059669'; ctx.fillText(String(employee.total_delivered), 440, y + 34);
        ctx.fillStyle = '#e11d48'; ctx.fillText(String(employee.total_undel), 525, y + 34);
        ctx.fillStyle = '#2563eb'; ctx.fillText(`${employee.first_attempt_delivery_pct}%`, 625, y + 34);
        ctx.fillStyle = '#7c3aed'; ctx.fillText(`${employee.reattempt_delivery_pct}%`, 735, y + 34);
        ctx.fillStyle = '#059669'; ctx.fillText(`${employee.overall_delivery_pct}%`, 855, y + 34);
        ctx.fillStyle = '#0f172a'; ctx.fillText(String(employee.cod_shipments_count), 990, y + 34);
        ctx.fillText(`₹${employee.cod_value_delivered.toLocaleString('en-IN')}`, 1110, y + 34);
        ctx.fillText(String(employee.prepaid_ofd), 1280, y + 34);
      });
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));

      if (!blob || !navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
        throw new Error('Image clipboard is not supported');
      }

      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setToastMsg('Employee performance snapshot copied!');
    } catch {
      try {
        await navigator.clipboard.writeText(textSnapshot);
        setToastMsg('Performance summary copied as text.');
      } catch {
        setToastMsg('Snapshot copy failed. Please allow clipboard permission.');
      }
    } finally {
      setCopyingEmployeeSnapshot(false);
    }
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
    <div className="mx-auto min-h-screen max-w-[1700px] space-y-5 bg-neutral-50 p-4 font-sans text-neutral-900 antialiased transition-colors dark:bg-neutral-950 dark:text-neutral-100 md:p-8">
      {/* ========================================================= */}
      {/* HEADER: REPORT METADATA & ACTION CONTROLS                */}
      {/* ========================================================= */}
      <header className="relative overflow-hidden rounded-[28px] border border-indigo-800/60 bg-gradient-to-br from-slate-950 via-indigo-950 to-brand-900 p-5 text-white shadow-xl shadow-indigo-950/10 sm:p-7">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-violet-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <div className="min-w-0 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white shadow-lg backdrop-blur-sm">
              <BarChart3 className="h-5 w-5" />
            </div>
            <h1 className="max-w-3xl break-words text-lg font-black leading-tight tracking-tight text-white sm:text-xl">
              {summary?.fileName || 'DRS Performance Analytics Dashboard'}
            </h1>
            <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-indigo-100">
              Power BI Edition
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-indigo-100/80">
            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-indigo-300" /> Report Date: <strong className="text-white">{summary?.reportDate || 'N/A'}</strong></span>
            <span>•</span>
            <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5 text-indigo-300" /> Hub: <strong className="text-white">{selectedHub?.name || activeItem?.hubName || 'Main Hub'}</strong></span>
            <span>•</span>
            <span className="flex max-w-xl items-center gap-1"><FileText className="h-3.5 w-3.5 shrink-0 text-indigo-300" /> File: <strong className="truncate text-white">{summary?.fileName || 'N/A'}</strong></span>
            <span>•</span>
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-indigo-300" /> Updated: <strong className="text-white">{activeItem?.uploadTimestamp || 'Just now'}</strong></span>
          </div>
        </div>

        {/* Action Controls & Enterprise Reset Buttons */}
        <div className="flex max-w-xl flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm xl:justify-end">
          {summary && (
            <div className="relative w-full sm:min-w-[200px] sm:w-auto">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-neutral-400" />
              <input
                type="text"
                placeholder="Search AWBs, Executive..."
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                className="w-full rounded-xl border border-white/15 bg-white/10 py-2.5 pl-9 pr-3 text-xs font-medium text-white outline-none placeholder:text-indigo-200/60 focus:border-white/30 focus:ring-4 focus:ring-white/10"
              />
            </div>
          )}

          <label className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-white px-3.5 py-2.5 text-xs font-black text-indigo-950 shadow-md transition hover:bg-indigo-50 active:scale-95">
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
                className="flex items-center gap-1.5 rounded-xl border border-violet-300/30 bg-violet-500/80 px-3.5 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-violet-500 active:scale-95"
              >
                <Save className="h-4 w-4" /> Save Snapshot
              </button>

              <button
                onClick={handleOpenComparison}
                className="flex items-center gap-1.5 rounded-xl border border-indigo-300/30 bg-indigo-500/80 px-3.5 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-indigo-500 active:scale-95"
              >
                <Columns className="h-4 w-4" /> Compare
              </button>

              <button
                onClick={() => handleOpenResetModal(1)}
                className="flex items-center gap-1.5 rounded-xl border border-amber-300/30 bg-amber-500/80 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-amber-500 active:scale-95"
                title="Reset Current Opened Report"
              >
                <Trash2 className="h-4 w-4" /> Reset Current
              </button>
            </>
          )}

          {selectedReportIds.length > 0 && (
            <button
              onClick={() => handleOpenResetModal(2)}
              className="flex items-center gap-1.5 rounded-xl border border-orange-300/30 bg-orange-500/80 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-orange-500 active:scale-95"
            >
              <Trash2 className="h-4 w-4" /> Delete Selected ({selectedReportIds.length})
            </button>
          )}

          <button
            onClick={() => handleOpenResetModal(3)}
            className="flex items-center gap-1.5 rounded-xl border border-rose-300/30 bg-rose-500/80 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-rose-500 active:scale-95"
            title="Admin Delete ALL Reports"
          >
            <ShieldAlert className="h-4 w-4" /> Delete All
          </button>

          <button
            onClick={() => setRecycleBinOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-white/20 active:scale-95"
          >
            <RotateCcw className="h-4 w-4 text-orange-500" /> Recycle Bin
          </button>
        </div></div>
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
      <div className="no-scrollbar overflow-x-auto rounded-2xl border border-neutral-200/80 bg-white p-1.5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <nav className="flex min-w-max space-x-1">
          {[
            { id: 'OVERVIEW', label: 'Overview' },
            { id: 'TOTAL_SHIPMENTS', label: `Total Shipments (${filteredUniqueRows.length})` },
            { id: 'OFD', label: `OFD Pending (${pendingOfdRows.length})` },
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
              className={`rounded-xl px-4 py-2.5 text-xs font-bold transition-all duration-200 ${
                activeTab === t.id
                  ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md shadow-indigo-500/20'
                  : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'
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
            <div className="space-y-5 rounded-[28px] border border-neutral-200/70 bg-gradient-to-br from-slate-50 via-white to-indigo-50/50 p-4 shadow-sm dark:border-neutral-800 dark:from-neutral-950 dark:via-neutral-950 dark:to-indigo-950/20 sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-600">Performance snapshot</p>
                  <h2 className="mt-1 text-xl font-black tracking-tight text-neutral-950 dark:text-white sm:text-2xl">Delivery Overview</h2>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Live operational health across OFD, attempts and payment modes.</p>
                </div>
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                  {filteredSummary.overallDeliveryPct >= 80 ? 'On track' : 'Needs attention'}
                </div>
              </div>
              {/* ----------------------------------------------------- */}
              {/* 6 PRIMARY KPI CARDS (HEIGHT: 135–140PX, VALUE: 42PX BOLD) */}
              {/* ----------------------------------------------------- */}
              <div className="no-scrollbar grid snap-x snap-mandatory grid-flow-col auto-cols-[minmax(158px,78vw)] gap-3 overflow-x-auto pb-2 sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-4 sm:overflow-visible sm:pb-0 xl:grid-cols-7">
                {/* 1. Total Shipments */}
                <button type="button" onClick={() => setActiveTab('TOTAL_SHIPMENTS')} className="group relative min-h-[142px] snap-start overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-brand-300 hover:shadow-lg dark:border-neutral-800 dark:bg-neutral-900 sm:p-5">
                  <div className="absolute inset-x-0 top-0 h-1 bg-slate-400" />
                  <div className="flex h-full flex-col justify-between gap-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center justify-between">
                    <span>Total Shipments</span>
                    <span className="rounded-xl bg-slate-100 p-2 dark:bg-neutral-800"><Package className="h-4 w-4 text-slate-500" /></span>
                  </div>
                  <span className="font-mono text-3xl font-black leading-none tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-4xl">
                    {filteredSummary.totalOfd}
                  </span>
                  <span className="flex items-center justify-between text-[10px] font-semibold text-neutral-400"><span>Unique AWBs</span><span className="text-brand-600 transition-transform group-hover:translate-x-1">View shipments →</span></span>
                  </div>
                </button>

                {/* 2. Pending OFD */}
                <button type="button" onClick={() => setActiveTab('OFD')} className="group relative min-h-[142px] snap-start overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-br from-white to-amber-50 p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-amber-300 hover:shadow-lg dark:border-amber-900/60 dark:from-neutral-900 dark:to-amber-950/30 sm:p-5">
                  <div className="absolute inset-x-0 top-0 h-1 bg-amber-500" />
                  <div className="flex h-full flex-col justify-between gap-4">
                    <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                      <span>OFD Pending</span>
                      <span className="rounded-xl bg-amber-100 p-2 dark:bg-amber-950"><Truck className="h-4 w-4 text-amber-600" /></span>
                    </div>
                    <span className="font-mono text-3xl font-black leading-none tracking-tight text-amber-600 dark:text-amber-400 sm:text-4xl">{pendingOfdRows.length}</span>
                    <span className="text-[10px] font-bold text-amber-600">Neither DEL nor UNDEL — view →</span>
                  </div>
                </button>

                {/* 3. Delivered */}
                <div className="relative min-h-[142px] overflow-hidden rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-white to-emerald-50 p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg dark:border-emerald-900/60 dark:from-neutral-900 dark:to-emerald-950/30 sm:p-5">
                  <div className="absolute inset-x-0 top-0 h-1 bg-emerald-500" /><div className="flex h-full flex-col justify-between gap-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center justify-between">
                    <span>Delivered</span>
                    <span className="rounded-xl bg-emerald-100 p-2 dark:bg-emerald-950"><CheckCircle2 className="h-4 w-4 text-emerald-600" /></span>
                  </div>
                  <span className="font-mono text-3xl font-black leading-none tracking-tight text-emerald-600 dark:text-emerald-400 sm:text-4xl">
                    {filteredSummary.totalDelivered}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-600">{filteredSummary.overallDeliveryPct}% success rate</span></div>
                </div>

                {/* 3. Pending */}
                <div className="relative min-h-[142px] overflow-hidden rounded-2xl border border-rose-200/70 bg-gradient-to-br from-white to-rose-50 p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg dark:border-rose-900/60 dark:from-neutral-900 dark:to-rose-950/30 sm:p-5">
                  <div className="absolute inset-x-0 top-0 h-1 bg-rose-500" /><div className="flex h-full flex-col justify-between gap-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center justify-between">
                    <span>Undelivered</span>
                    <span className="rounded-xl bg-rose-100 p-2 dark:bg-rose-950"><Clock className="h-4 w-4 text-rose-600" /></span>
                  </div>
                  <span className="font-mono text-3xl font-black leading-none tracking-tight text-rose-600 dark:text-rose-400 sm:text-4xl">
                    {filteredSummary.totalUndel}
                  </span>
                  <span className="text-[10px] font-bold text-rose-600">Active undelivered</span></div>
                </div>

                {/* 4. Overall Delivery % */}
                <div className="relative min-h-[142px] overflow-hidden rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-white to-indigo-50 p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg dark:border-indigo-900/60 dark:from-neutral-900 dark:to-indigo-950/30 sm:p-5">
                  <div className="absolute inset-x-0 top-0 h-1 bg-indigo-500" /><div className="flex h-full flex-col justify-between gap-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center justify-between">
                    <span>Overall %</span>
                    <span className="rounded-xl bg-indigo-100 p-2 dark:bg-indigo-950"><TrendingUp className="h-4 w-4 text-indigo-600" /></span>
                  </div>
                  <span className="font-mono text-3xl font-black leading-none tracking-tight text-indigo-600 dark:text-indigo-400 sm:text-4xl">
                    {filteredSummary.overallDeliveryPct}%
                  </span>
                  <span className="text-[10px] font-semibold text-neutral-400">Overall efficiency</span></div>
                </div>

                {/* 5. First Attempt % */}
                <div className="relative min-h-[142px] overflow-hidden rounded-2xl border border-blue-200/70 bg-gradient-to-br from-white to-blue-50 p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg dark:border-blue-900/60 dark:from-neutral-900 dark:to-blue-950/30 sm:p-5">
                  <div className="absolute inset-x-0 top-0 h-1 bg-blue-500" /><div className="flex h-full flex-col justify-between gap-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center justify-between">
                    <span>1st Attempt %</span>
                    <span className="rounded-xl bg-blue-100 p-2 dark:bg-blue-950"><Target className="h-4 w-4 text-blue-600" /></span>
                  </div>
                  <span className="font-mono text-3xl font-black leading-none tracking-tight text-blue-600 dark:text-blue-400 sm:text-4xl">
                    {filteredSummary.firstAttemptDeliveryPct}%
                  </span>
                  <span className="text-[10px] font-bold text-blue-600">{filteredSummary.firstAttemptDelivered} / {filteredSummary.firstAttemptOfd} delivered</span></div>
                </div>

                {/* 6. Reattempt % */}
                <div className="relative min-h-[142px] overflow-hidden rounded-2xl border border-violet-200/70 bg-gradient-to-br from-white to-violet-50 p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg dark:border-violet-900/60 dark:from-neutral-900 dark:to-violet-950/30 sm:p-5">
                  <div className="absolute inset-x-0 top-0 h-1 bg-violet-500" /><div className="flex h-full flex-col justify-between gap-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center justify-between">
                    <span>Reattempt %</span>
                    <span className="rounded-xl bg-violet-100 p-2 dark:bg-violet-950"><RotateCcw className="h-4 w-4 text-violet-600" /></span>
                  </div>
                  <span className="font-mono text-3xl font-black leading-none tracking-tight text-violet-600 dark:text-violet-400 sm:text-4xl">
                    {filteredSummary.reattemptDeliveryPct}%
                  </span>
                  <span className="text-[10px] font-bold text-violet-600">{filteredSummary.reattemptDelivered} / {filteredSummary.reattemptOfd} delivered</span></div>
                </div>
              </div>

              {/* ----------------------------------------------------- */}
              {/* EXECUTIVE SECTIONS (TREND, DONUT, EMPLOYEES, NDR, COD, PREPAID) */}
              {/* ----------------------------------------------------- */}
              <div className="grid grid-cols-1 gap-4 text-xs md:grid-cols-2 xl:grid-cols-3">
                {/* 1. Delivery Trend Chart */}
                <div className="min-h-[220px] space-y-4 rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900">
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
                    <div className="h-3 w-full overflow-hidden rounded-full bg-neutral-100 p-0.5 dark:bg-neutral-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 shadow-sm transition-all duration-500"
                        style={{ width: `${Math.min(filteredSummary.overallDeliveryPct, 100)}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-neutral-400 block font-mono">Average Attempts per AWB: {filteredSummary.averageAttempts}</span>
                  </div>
                </div>

                {/* 2. Delivery Status Donut / Pie Breakdown */}
                <div className="min-h-[220px] space-y-4 rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900">
                  <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2">
                    <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-xs flex items-center gap-2">
                      <PieIcon className="h-4 w-4 text-brand-600" /> Delivery Status Breakdown
                    </h3>
                  </div>
                  <div className="space-y-3 pt-1">
                    <div className="flex h-3 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                      <div className="bg-emerald-500" style={{ width: `${Math.min(filteredSummary.overallDeliveryPct, 100)}%` }} />
                      <div className="bg-rose-500" style={{ width: `${Math.min((filteredSummary.totalUndel / Math.max(filteredSummary.totalOfd, 1)) * 100, 100)}%` }} />
                      <div className="bg-violet-500" style={{ width: `${Math.min((filteredSummary.totalRto / Math.max(filteredSummary.totalOfd, 1)) * 100, 100)}%` }} />
                    </div>
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
                <div className="min-h-[220px] space-y-3 rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900">
                  <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2">
                    <h3 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-xs flex items-center gap-1.5">
                      <User className="h-4 w-4 text-brand-600" /> Top 5 Employees
                    </h3>
                    <button onClick={() => setActiveTab('EMPLOYEE')} className="text-[11px] font-semibold text-brand-600 hover:underline">View All</button>
                  </div>
                  <div className="space-y-1.5">
                    {filteredEmployeeMetrics.slice(0, 5).map((e, idx) => (
                      <div key={e.employee_name} className="flex items-center justify-between rounded-xl bg-neutral-50 px-2.5 py-2 dark:bg-neutral-800/50">
                        <span className="flex min-w-0 items-center gap-2 font-bold text-neutral-900 dark:text-neutral-100"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-white text-[10px] text-brand-600 shadow-sm dark:bg-neutral-900">{idx + 1}</span><span className="truncate">{e.employee_name}</span></span>
                        <span className="font-mono font-bold text-emerald-600">{e.overall_delivery_pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Top NDR Reasons */}
                <div className="min-h-[190px] space-y-3 rounded-2xl border border-rose-200/70 bg-gradient-to-br from-white to-rose-50/60 p-5 shadow-sm transition hover:shadow-md dark:border-rose-900/50 dark:from-neutral-900 dark:to-rose-950/20">
                  <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2">
                    <h3 className="font-bold text-rose-600 uppercase tracking-wider text-xs flex items-center gap-1.5">
                      <ShieldAlert className="h-4 w-4" /> Top NDR Reasons
                    </h3>
                  </div>
                  <div className="space-y-1.5">
                    {reasonMetrics.slice(0, 5).map((r) => (
                      <div key={r.reason} className="flex items-center justify-between rounded-xl border border-rose-100 bg-white/80 px-2.5 py-2 dark:border-rose-900/40 dark:bg-neutral-900/60">
                        <span className="truncate max-w-[170px] font-semibold text-neutral-800 dark:text-neutral-200">{r.reason}</span>
                        <span className="font-bold font-mono text-rose-600">{r.count} AWBs</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 5. COD Summary */}
                <div className="min-h-[190px] space-y-4 rounded-2xl border border-violet-200/70 bg-gradient-to-br from-white to-violet-50 p-5 shadow-sm transition hover:shadow-md dark:border-violet-900/50 dark:from-neutral-900 dark:to-violet-950/30">
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
                <div className="min-h-[190px] space-y-4 rounded-2xl border border-blue-200/70 bg-gradient-to-br from-white to-blue-50 p-5 shadow-sm transition hover:shadow-md dark:border-blue-900/50 dark:from-neutral-900 dark:to-blue-950/30">
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
          {/* TAB 2: UNIQUE OFD SHIPMENTS                              */}
          {/* ========================================================= */}
          {(activeTab === 'TOTAL_SHIPMENTS' || activeTab === 'OFD') && filteredSummary && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200/80 bg-gradient-to-r from-slate-950 via-indigo-950 to-brand-900 p-5 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-200">Shipment register</p>
                  <h2 className="mt-1 text-xl font-black">{activeTab === 'OFD' ? 'OFD Pending Shipments' : 'Total Shipments'}</h2>
                  <p className="mt-1 text-xs text-indigo-100/70">{activeTab === 'OFD' ? 'Shipments awaiting a final Delivered or Undelivered update.' : 'All unique AWB-level records from the active DRS report.'}</p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-center backdrop-blur-sm">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-indigo-200">{activeTab === 'OFD' ? 'OFD Pending' : 'Total Shipments'}</span>
                  <strong className="mt-1 block font-mono text-3xl font-black">{activeTab === 'OFD' ? pendingOfdRows.length : filteredUniqueRows.length}</strong>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1050px] text-left text-xs">
                    <thead className="border-b border-neutral-200 bg-neutral-50 font-bold uppercase tracking-wider text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950/60">
                      <tr>
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">AWB</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Employee</th>
                        <th className="px-4 py-3">Customer / Client</th>
                        <th className="px-4 py-3">Payment</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                        <th className="px-4 py-3 text-center">Attempts</th>
                        <th className="px-4 py-3">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {(activeTab === 'OFD' ? pendingOfdRows : filteredUniqueRows).map((row, index) => (
                        <tr key={row.waybill_no} className="transition hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20">
                          <td className="px-4 py-3 font-mono text-neutral-400">{index + 1}</td>
                          <td className="px-4 py-3 font-mono font-black text-brand-600">{row.waybill_no}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black ${
                              row.shipment_status_normalized === 'Delivered'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : row.shipment_status_normalized === 'Undelivered'
                                  ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300'
                                  : 'border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                            }`}>{row.shipment_status_normalized}</span>
                          </td>
                          <td className="px-4 py-3"><strong className="block text-neutral-900 dark:text-white">{row.employee_name || '-'}</strong><span className="text-[10px] text-neutral-400">{row.partner_name || '-'}</span></td>
                          <td className="px-4 py-3"><strong className="block max-w-[180px] truncate text-neutral-800 dark:text-neutral-200">{row.consignee || '-'}</strong><span className="block max-w-[180px] truncate text-[10px] text-neutral-400">{row.customer_name || '-'}</span></td>
                          <td className="px-4 py-3 font-bold text-neutral-700 dark:text-neutral-300">{row.payment_type || '-'}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold">₹{row.amount_payable.toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3 text-center"><span className="rounded-lg bg-neutral-100 px-2 py-1 font-mono font-bold dark:bg-neutral-800">{row.total_attempts || 1}</span></td>
                          <td className="max-w-[220px] truncate px-4 py-3 text-neutral-500" title={row.reason}>{row.reason || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-neutral-200 bg-neutral-50/70 px-4 py-3 text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950/30">
                  Showing <strong className="text-neutral-900 dark:text-white">{activeTab === 'OFD' ? pendingOfdRows.length : filteredUniqueRows.length}</strong> {activeTab === 'OFD' ? 'pending OFD' : 'total'} shipments
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: EMPLOYEE PAGE (DEFAULT SORT OVERALL % DESC)       */}
          {/* ========================================================= */}
          {activeTab === 'EMPLOYEE' && (
            <div className="overflow-hidden rounded-3xl border border-neutral-200/80 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <div className="relative overflow-hidden bg-gradient-to-br from-indigo-700 via-violet-700 to-fuchsia-700 px-5 py-6 text-white sm:px-7">
                <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
                <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-100">
                      <BarChart3 className="h-4 w-4" /> Team leaderboard
                    </div>
                    <h2 className="text-xl font-black sm:text-2xl">Employee Performance</h2>
                    <p className="mt-1 text-xs text-indigo-100">Ranked delivery performance for the selected report and filters.</p>
                  </div>
                  <button
                    type="button"
                    data-html2canvas-ignore="true"
                    onClick={handleCopyEmployeeSnapshot}
                    disabled={copyingEmployeeSnapshot || filteredEmployeeMetrics.length === 0}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white px-4 py-2.5 text-xs font-black text-indigo-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {copyingEmployeeSnapshot ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                    {copyingEmployeeSnapshot ? 'Copying...' : 'Copy Snapshot'}
                  </button>
                </div>
                <div className="relative mt-5 grid grid-cols-2 gap-2 sm:max-w-3xl sm:grid-cols-4 sm:gap-3">
                  {[
                    ['Employees', filteredEmployeeMetrics.length],
                    ['Total OFD', filteredSummary?.totalOfd ?? 0],
                    ['Delivery', `${filteredSummary?.overallDeliveryPct ?? 0}%`],
                    ['COD Shipments', paymentMetrics.codOfd],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-white/15 bg-white/10 px-3 py-3 backdrop-blur-sm">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-indigo-100 sm:text-[10px]">{label}</div>
                      <div className="mt-1 font-mono text-lg font-black sm:text-xl">{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left">
                  <thead className="border-b border-neutral-200 bg-neutral-50/90 text-[10px] font-black uppercase tracking-wider text-neutral-500 dark:border-neutral-800 dark:bg-neutral-800/60">
                    <tr>
                      <th className="px-4 py-3">Rank</th>
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3 font-bold">OFD</th>
                      <th className="px-4 py-3 font-bold text-emerald-600">Delivered</th>
                      <th className="px-4 py-3 font-bold text-rose-600">Pending</th>
                      <th className="px-4 py-3 font-semibold text-blue-600">1st Attempt %</th>
                      <th className="px-4 py-3 font-semibold text-purple-600">Reattempt %</th>
                      <th className="px-4 py-3 font-black text-emerald-600">Overall %</th>
                      <th className="px-4 py-3 text-right">COD Collected</th>
                      <th className="px-4 py-3 text-right">COD Shipments</th>
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
                        className="cursor-pointer transition hover:bg-indigo-50/60 dark:hover:bg-indigo-950/20"
                      >
                        <td className="px-4 py-3"><span className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 font-mono font-black ${idx < 3 ? 'bg-amber-100 text-amber-700' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800'}`}>#{idx + 1}</span></td>
                        <td className="px-4 py-3 font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-brand-600" /> {e.employee_name}
                        </td>
                        <td className="px-4 py-3 font-bold font-mono">{e.total_ofd}</td>
                        <td className="px-4 py-3 font-bold font-mono text-emerald-600">{e.total_delivered}</td>
                        <td className="px-4 py-3 font-semibold font-mono text-rose-600">{e.total_undel}</td>
                        <td className="px-4 py-3 font-mono font-bold text-blue-600">{e.first_attempt_delivery_pct}%</td>
                        <td className="px-4 py-3 font-mono font-bold text-purple-600">{e.reattempt_delivery_pct}%</td>
                        <td className="min-w-32 px-4 py-3">
                          <div className="mb-1 flex justify-between font-mono font-black text-emerald-600"><span>{e.overall_delivery_pct}%</span></div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800"><div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" style={{ width: `${Math.min(e.overall_delivery_pct, 100)}%` }} /></div>
                        </td>
                        <td className="px-4 py-3 font-mono text-right">₹{e.cod_value_delivered.toLocaleString()}</td>
                        <td className="px-4 py-3 font-mono font-bold text-right">{e.cod_shipments_count}</td>
                        <td className="px-4 py-3 font-mono text-right">{e.prepaid_ofd} AWBs</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 bg-neutral-50/70 p-3 md:hidden dark:bg-neutral-950/30">
                {filteredEmployeeMetrics.map((employee, index) => (
                  <button
                    type="button"
                    key={employee.employee_name}
                    onClick={() => { setSelectedEmployee(employee); setDrawerOpen(true); }}
                    className="w-full rounded-2xl border border-neutral-200 bg-white p-4 text-left shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={`inline-flex h-9 min-w-9 items-center justify-center rounded-xl font-mono text-xs font-black ${index < 3 ? 'bg-amber-100 text-amber-700' : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40'}`}>#{index + 1}</span>
                        <div className="min-w-0"><div className="truncate text-sm font-black text-neutral-900 dark:text-white">{employee.employee_name}</div><div className="mt-0.5 text-[10px] font-semibold text-neutral-400">{employee.total_ofd} OFD shipments</div></div>
                      </div>
                      <span className="font-mono text-base font-black text-emerald-600">{employee.overall_delivery_pct}%</span>
                    </div>
                    <div className="my-3 h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800"><div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" style={{ width: `${Math.min(employee.overall_delivery_pct, 100)}%` }} /></div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {[
                        ['Delivered', employee.total_delivered, 'text-emerald-600'],
                        ['Pending', employee.total_undel, 'text-rose-600'],
                        ['1st %', `${employee.first_attempt_delivery_pct}%`, 'text-blue-600'],
                        ['Retry %', `${employee.reattempt_delivery_pct}%`, 'text-violet-600'],
                      ].map(([label, value, color]) => <div key={label} className="rounded-lg bg-neutral-50 px-1 py-2 dark:bg-neutral-800/60"><div className={`font-mono text-xs font-black ${color}`}>{value}</div><div className="mt-0.5 text-[8px] font-bold uppercase text-neutral-400">{label}</div></div>)}
                    </div>
                    <div className="mt-3 flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2 text-[10px] dark:bg-amber-950/20">
                      <span className="font-bold text-amber-700 dark:text-amber-400">COD: {employee.cod_shipments_count} shipments</span>
                      <span className="font-mono font-black text-neutral-800 dark:text-neutral-100">₹{employee.cod_value_delivered.toLocaleString('en-IN')} collected</span>
                    </div>
                  </button>
                ))}
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
