import React, { useMemo } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Award,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  CreditCard,
  Crown,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Medal,
  Package,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { EmployeeDRSMetrics, OverallDRSSummary, PaymentAnalyticsMetrics } from '@/types/drs';

interface EmployeePerformanceLeaderboardProps {
  hubName: string;
  reportDate: string;
  employeeMetrics: EmployeeDRSMetrics[];
  summary: OverallDRSSummary | null;
  paymentMetrics: PaymentAnalyticsMetrics;
  onSelectEmployee: (employee: EmployeeDRSMetrics) => void;
  onExportExcel: () => void;
  onExportPDF: () => Promise<void>;
  onCopySnapshot: () => Promise<void>;
  isCopyingSnapshot: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  minOfdThreshold: number;
  onMinOfdChange: (threshold: number) => void;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSortChange: (column: string) => void;
  onResetFilters: () => void;
  availableDates?: string[];
  selectedDate?: string;
  onDateChange?: (date: string) => void;
}

// Generate 2-letter uppercase initials for employee avatar
function getInitials(name: string): string {
  if (!name) return 'EX';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Subtle pastel avatar background palettes
const AVATAR_PALETTES = [
  'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
  'bg-indigo-50 text-indigo-700 border-indigo-200/80 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800',
  'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  'bg-sky-50 text-sky-700 border-sky-200/80 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
  'bg-violet-50 text-violet-700 border-violet-200/80 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800',
  'bg-teal-50 text-teal-700 border-teal-200/80 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800',
];

function getAvatarPalette(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
}

export const EmployeePerformanceLeaderboard: React.FC<EmployeePerformanceLeaderboardProps> = ({
  hubName,
  reportDate,
  employeeMetrics,
  summary,
  onSelectEmployee,
  onExportExcel,
  onExportPDF,
  onCopySnapshot,
  isCopyingSnapshot,
  searchQuery,
  onSearchChange,
  minOfdThreshold,
  onMinOfdChange,
  sortBy,
  sortOrder,
  onSortChange,
  onResetFilters,
  availableDates,
  selectedDate,
  onDateChange,
}) => {
  // Top performer (Rank #1)
  const topPerformer = useMemo(() => {
    return employeeMetrics.length > 0 ? employeeMetrics[0] : null;
  }, [employeeMetrics]);

  // Sort direction icon helper
  const renderSortIndicator = (columnKey: string) => {
    if (sortBy !== columnKey) {
      return <ArrowUpDown className="h-3 w-3 opacity-30 group-hover:opacity-70 transition-opacity" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-brand-600 dark:text-brand-400" />
    ) : (
      <ArrowDown className="h-3 w-3 text-brand-600 dark:text-brand-400" />
    );
  };

  // Safe pending count calculation
  const totalPending = summary?.totalPending ?? (summary ? Math.max(summary.totalOfd - summary.totalDelivered, 0) : 0);

  return (
    <div className="space-y-6">
      {/* ========================================================= */}
      {/* 1. REPORT HEADER & INFORMATION BANNER                     */}
      {/* ========================================================= */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-7">
        {/* Subtle decorative background tint */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-blue-500/5 blur-3xl dark:bg-blue-500/10" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 h-56 w-56 rounded-full bg-indigo-500/5 blur-3xl dark:bg-indigo-500/10" />

        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          {/* Header Title & Subtitle */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-blue-50/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
              HubVault Operations • Collection Reconciliation Suite
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                Employee Performance
              </h1>
              <p className="mt-0.5 text-sm font-semibold text-slate-500 dark:text-neutral-400">
                Team Leaderboard
              </p>
            </div>

            {/* Hub and Report Date Metadata */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-1.5 font-medium text-slate-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                <Building2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                Hub: <strong className="font-bold text-slate-900 dark:text-white">{hubName || 'Main Hub'}</strong>
              </span>

              <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-1.5 font-medium text-slate-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                Report Date: <strong className="font-bold text-slate-900 dark:text-white">{reportDate || 'N/A'}</strong>
              </span>

              {availableDates && availableDates.length > 1 && onDateChange && (
                <div className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 px-2 py-1 text-slate-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                  <span className="text-[11px] font-semibold text-slate-500">Filter Date:</span>
                  <select
                    value={selectedDate || ''}
                    onChange={(e) => onDateChange(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
                  >
                    <option value="">All Report Dates</option>
                    {availableDates.map((date) => (
                      <option key={date} value={date} className="dark:bg-neutral-900">
                        {date}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/70 bg-white px-3 py-1.5 font-medium text-slate-600 dark:border-neutral-700 dark:bg-neutral-800/60 dark:text-neutral-300">
                <Users className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                <strong className="font-bold text-slate-900 dark:text-white">{employeeMetrics.length}</strong> Executives Evaluated
              </span>
            </div>
          </div>

          {/* Export Controls & Share Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input In Header */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search employee..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pl-9 pr-8 text-xs font-medium text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:placeholder:text-neutral-500 dark:focus:ring-blue-950"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Export Excel Button */}
            <button
              type="button"
              onClick={onExportExcel}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200/90 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 shadow-sm transition hover:bg-emerald-100 hover:border-emerald-300 active:scale-95 dark:border-emerald-800/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
              title="Export complete DRS report to Excel workbook"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              Export Excel
            </button>

            {/* Export PDF Button */}
            <button
              type="button"
              onClick={onExportPDF}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:border-slate-300 active:scale-95 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
              title="Export executive summary to PDF"
            >
              <FileText className="h-3.5 w-3.5 text-rose-500" />
              Export PDF
            </button>

            {/* Share / Copy Snapshot Button */}
            <button
              type="button"
              onClick={onCopySnapshot}
              disabled={isCopyingSnapshot || employeeMetrics.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-600 bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              title="Copy shareable image snapshot or text summary to clipboard"
            >
              {isCopyingSnapshot ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {isCopyingSnapshot ? 'Copying...' : 'Share Snapshot'}
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 2A. SHIPMENT VOLUME OVERVIEW (6 CARDS)                    */}
      {/* ========================================================= */}
      <section className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
        {/* Card 1: Total Employees */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-neutral-400">
                Total Employees
              </p>
              <div className="mt-2 font-mono text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                {employeeMetrics.length}
              </div>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/60 dark:text-blue-300">
              <Users className="h-4.5 w-4.5" />
            </span>
          </div>
          <div className="mt-3 text-[10px] font-semibold text-slate-500 dark:text-neutral-400">
            <span>Active executives</span>
          </div>
        </div>

        {/* Card 2: Total OFD */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-neutral-400">
                Total OFD
              </p>
              <div className="mt-2 font-mono text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                {summary?.totalOfd ?? 0}
              </div>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/60 dark:text-indigo-300">
              <Package className="h-4.5 w-4.5" />
            </span>
          </div>
          <div className="mt-3 text-[10px] font-semibold text-slate-500 dark:text-neutral-400">
            <span>Total assigned shipments</span>
          </div>
        </div>

        {/* Card 3: Shipment Status OFD */}
        <div className="group relative overflow-hidden rounded-2xl border border-amber-200/90 bg-gradient-to-br from-white to-amber-50/30 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-md dark:border-amber-900/60 dark:from-neutral-900 dark:to-amber-950/20 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-700 dark:text-amber-400">
                Status OFD
              </p>
              <div className="mt-2 font-mono text-2xl font-black tracking-tight text-amber-600 dark:text-amber-400 sm:text-3xl">
                {summary?.statusOfd ?? 0}
              </div>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              <Truck className="h-4.5 w-4.5" />
            </span>
          </div>
          <div className="mt-3 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
            <span>Active Out on Road</span>
          </div>
        </div>

        {/* Card 4: Delivered */}
        <div className="group relative overflow-hidden rounded-2xl border border-emerald-200/90 bg-gradient-to-br from-white to-emerald-50/30 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md dark:border-emerald-900/60 dark:from-neutral-900 dark:to-emerald-950/20 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">
                Delivered
              </p>
              <div className="mt-2 font-mono text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400 sm:text-3xl">
                {summary?.totalDelivered ?? 0}
              </div>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              <CheckCircle2 className="h-4.5 w-4.5" />
            </span>
          </div>
          <div className="mt-3 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
            <span>Successfully completed</span>
          </div>
        </div>

        {/* Card 5: UNDEL */}
        <div className="group relative overflow-hidden rounded-2xl border border-rose-200/90 bg-gradient-to-br from-white to-rose-50/30 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-rose-400 hover:shadow-md dark:border-rose-900/60 dark:from-neutral-900 dark:to-rose-950/20 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-rose-700 dark:text-rose-400">
                UNDEL
              </p>
              <div className="mt-2 font-mono text-2xl font-black tracking-tight text-rose-600 dark:text-rose-400 sm:text-3xl">
                {summary?.totalUndel ?? 0}
              </div>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
              <Clock className="h-4.5 w-4.5" />
            </span>
          </div>
          <div className="mt-3 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
            <span>Failed attempt / NDR</span>
          </div>
        </div>

        {/* Card 6: Pending */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-neutral-400">
                Pending
              </p>
              <div className="mt-2 font-mono text-2xl font-black tracking-tight text-slate-800 dark:text-neutral-200 sm:text-3xl">
                {totalPending}
              </div>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
              <AlertCircle className="h-4.5 w-4.5" />
            </span>
          </div>
          <div className="mt-3 text-[10px] font-semibold text-slate-500 dark:text-neutral-400">
            <span>UNDEL + Status OFD</span>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 2B. COMPLETE PERFORMANCE PERCENTAGE METRICS (4 CARDS)     */}
      {/* Required: COD FAD %, Prepaid FAD %, Overall %, FAD %     */}
      {/* ========================================================= */}
      <section className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: COD FAD % (Blue) */}
        <div className="group relative overflow-hidden rounded-2xl border border-blue-200/90 bg-gradient-to-br from-white to-blue-50/40 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md dark:border-blue-900/60 dark:from-neutral-900 dark:to-blue-950/20 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-600"></span>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-700 dark:text-blue-400">
                  COD FAD %
                </p>
              </div>
              <div className="mt-2 font-mono text-2xl font-black tracking-tight text-blue-600 dark:text-blue-400 sm:text-3xl">
                {summary?.codFadPercent ?? 0}%
              </div>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
              <CreditCard className="h-4.5 w-4.5" />
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] font-semibold text-blue-700 dark:text-blue-400">
            <span>COD 1st Attempt Delivery</span>
            <span className="font-mono">{summary?.codFirstAttemptDel ?? 0}/{summary?.codFirstAttemptOfd ?? 0}</span>
          </div>
        </div>

        {/* Card 2: Prepaid FAD % (Purple) */}
        <div className="group relative overflow-hidden rounded-2xl border border-purple-200/90 bg-gradient-to-br from-white to-purple-50/40 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-purple-400 hover:shadow-md dark:border-purple-900/60 dark:from-neutral-900 dark:to-purple-950/20 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-purple-600"></span>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-purple-700 dark:text-purple-400">
                  Prepaid FAD %
                </p>
              </div>
              <div className="mt-2 font-mono text-2xl font-black tracking-tight text-purple-600 dark:text-purple-400 sm:text-3xl">
                {summary?.prepaidFadPercent ?? 0}%
              </div>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-purple-200 bg-purple-100 text-purple-700 dark:border-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
              <Award className="h-4.5 w-4.5" />
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] font-semibold text-purple-700 dark:text-purple-400">
            <span>Prepaid 1st Attempt Delivery</span>
            <span className="font-mono">{summary?.prepaidFirstAttemptDel ?? 0}/{summary?.prepaidFirstAttemptOfd ?? 0}</span>
          </div>
        </div>

        {/* Card 3: Overall Delivery % (Green) */}
        <div className="group relative overflow-hidden rounded-2xl border border-emerald-200/90 bg-gradient-to-br from-white to-emerald-50/40 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md dark:border-emerald-900/60 dark:from-neutral-900 dark:to-emerald-950/20 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-600"></span>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">
                  Overall Delivery %
                </p>
              </div>
              <div className="mt-2 font-mono text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400 sm:text-3xl">
                {summary?.overallDeliveryPct ?? 0}%
              </div>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              <TrendingUp className="h-4.5 w-4.5" />
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
            <span>Total Completed Delivery</span>
            <span className="font-mono">{summary?.totalDelivered ?? 0}/{summary?.totalOfd ?? 0}</span>
          </div>
        </div>

        {/* Card 4: FAD Delivery % (Gold / Orange) */}
        <div className="group relative overflow-hidden rounded-2xl border border-amber-200/90 bg-gradient-to-br from-white to-amber-50/40 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-md dark:border-amber-900/60 dark:from-neutral-900 dark:to-amber-950/20 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-600"></span>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-700 dark:text-amber-400">
                  FAD Delivery %
                </p>
              </div>
              <div className="mt-2 font-mono text-2xl font-black tracking-tight text-amber-600 dark:text-amber-400 sm:text-3xl">
                {summary?.firstAttemptDeliveryPct ?? 0}%
              </div>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              <Sparkles className="h-4.5 w-4.5" />
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] font-semibold text-amber-700 dark:text-amber-400">
            <span>Overall 1st Attempt Delivery</span>
            <span className="font-mono">{summary?.firstAttemptDelivered ?? 0}/{summary?.firstAttemptOfd ?? 0}</span>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 3. TABLE CONTROLS & FILTER BAR                            */}
      {/* ========================================================= */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-neutral-300">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <span>Min Total OFD:</span>
          </div>
          {[0, 5, 10, 20].map((threshold) => (
            <button
              key={threshold}
              type="button"
              onClick={() => onMinOfdChange(threshold)}
              className={clsx(
                'rounded-lg px-2.5 py-1 text-xs font-bold transition',
                minOfdThreshold === threshold
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
              )}
            >
              {threshold === 0 ? 'All' : `≥ ${threshold} OFD`}
            </button>
          ))}
          {(searchQuery || minOfdThreshold > 0) && (
            <button
              type="button"
              onClick={onResetFilters}
              className="ml-2 text-xs font-bold text-blue-600 hover:underline dark:text-blue-400"
            >
              Reset filters
            </button>
          )}
        </div>

        <div className="text-xs font-semibold text-slate-500 dark:text-neutral-400">
          Showing <strong className="font-bold text-slate-900 dark:text-white">{employeeMetrics.length}</strong> delivery executives
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4. EMPLOYEE LEADERBOARD TABLE (DESKTOP & TABLET)          */}
      {/* ========================================================= */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        {/* Table Container with Horizontal Scroll */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-xs">
            {/* Table Header with 15 columns including all 4 performance percentages */}
            <thead className="border-b border-slate-200/90 bg-slate-50/90 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:border-neutral-800 dark:bg-neutral-800/80 dark:text-neutral-400">
              <tr>
                {/* 1. Rank */}
                <th className="px-3 py-3.5 w-14 text-center">Rank</th>

                {/* 2. Employee */}
                <th
                  onClick={() => onSortChange('employee_name')}
                  className="group cursor-pointer px-3.5 py-3.5 transition hover:text-slate-900 dark:hover:text-white"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Employee</span>
                    {renderSortIndicator('employee_name')}
                  </div>
                </th>

                {/* 3. Total OFD */}
                <th
                  onClick={() => onSortChange('total_ofd')}
                  className="group cursor-pointer px-3 py-3.5 text-right font-bold transition hover:text-slate-900 dark:hover:text-white"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Total OFD</span>
                    {renderSortIndicator('total_ofd')}
                  </div>
                </th>

                {/* 4. Status OFD */}
                <th
                  onClick={() => onSortChange('status_ofd')}
                  className="group cursor-pointer px-3 py-3.5 text-right font-bold text-amber-700 transition hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Status OFD</span>
                    {renderSortIndicator('status_ofd')}
                  </div>
                </th>

                {/* 5. Delivered */}
                <th
                  onClick={() => onSortChange('total_delivered')}
                  className="group cursor-pointer px-3 py-3.5 text-right font-bold text-emerald-700 transition hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Delivered</span>
                    {renderSortIndicator('total_delivered')}
                  </div>
                </th>

                {/* 6. UNDEL */}
                <th
                  onClick={() => onSortChange('total_undel')}
                  className="group cursor-pointer px-3 py-3.5 text-right font-bold text-rose-700 transition hover:text-rose-900 dark:text-rose-400 dark:hover:text-rose-300"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>UNDEL</span>
                    {renderSortIndicator('total_undel')}
                  </div>
                </th>

                {/* 7. Pending */}
                <th
                  onClick={() => onSortChange('pending')}
                  className="group cursor-pointer px-3 py-3.5 text-right font-bold text-slate-700 transition hover:text-slate-900 dark:text-neutral-300 dark:hover:text-white"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Pending</span>
                    {renderSortIndicator('pending')}
                  </div>
                </th>

                {/* 8. FAD Delivery % */}
                <th
                  onClick={() => onSortChange('first_attempt_delivery_pct')}
                  className="group cursor-pointer px-3 py-3.5 text-right font-bold text-amber-700 transition hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>FAD %</span>
                    {renderSortIndicator('first_attempt_delivery_pct')}
                  </div>
                </th>

                {/* 9. COD FAD % */}
                <th
                  onClick={() => onSortChange('cod_fad_percent')}
                  className="group cursor-pointer px-3 py-3.5 text-right font-bold text-blue-700 transition hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>COD FAD %</span>
                    {renderSortIndicator('cod_fad_percent')}
                  </div>
                </th>

                {/* 10. Prepaid FAD % */}
                <th
                  onClick={() => onSortChange('prepaid_fad_percent')}
                  className="group cursor-pointer px-3 py-3.5 text-right font-bold text-purple-700 transition hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Prepaid FAD %</span>
                    {renderSortIndicator('prepaid_fad_percent')}
                  </div>
                </th>

                {/* 11. Retry Count */}
                <th
                  onClick={() => onSortChange('reattempt_ofd')}
                  className="group cursor-pointer px-3 py-3.5 text-right font-bold text-slate-600 transition hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Retry</span>
                    {renderSortIndicator('reattempt_ofd')}
                  </div>
                </th>

                {/* 12. Retry % */}
                <th
                  onClick={() => onSortChange('reattempt_delivery_pct')}
                  className="group cursor-pointer px-3 py-3.5 text-right font-bold text-purple-700 transition hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Retry %</span>
                    {renderSortIndicator('reattempt_delivery_pct')}
                  </div>
                </th>

                {/* 13. Overall % */}
                <th
                  onClick={() => onSortChange('overall_delivery_pct')}
                  className="group cursor-pointer px-3.5 py-3.5 text-right font-black text-emerald-800 min-w-32 transition hover:text-emerald-950 dark:text-emerald-300"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Overall %</span>
                    {renderSortIndicator('overall_delivery_pct')}
                  </div>
                </th>

                {/* 14. COD Count */}
                <th
                  onClick={() => onSortChange('cod_shipments_count')}
                  className="group cursor-pointer px-3 py-3.5 text-right font-bold transition hover:text-slate-900 dark:hover:text-white"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>COD</span>
                    {renderSortIndicator('cod_shipments_count')}
                  </div>
                </th>

                {/* 15. Prepaid */}
                <th
                  onClick={() => onSortChange('prepaid_ofd')}
                  className="group cursor-pointer px-3 py-3.5 text-right font-bold transition hover:text-slate-900 dark:hover:text-white"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Prepaid</span>
                    {renderSortIndicator('prepaid_ofd')}
                  </div>
                </th>
              </tr>
            </thead>

            {/* Table Body with Fine Dividers and Subtle Alternating Rows */}
            <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
              {employeeMetrics.length === 0 ? (
                <tr>
                  <td colSpan={15} className="py-12 text-center text-slate-500 dark:text-neutral-400">
                    <p className="text-sm font-semibold">No employee records match the active criteria.</p>
                    <button
                      type="button"
                      onClick={onResetFilters}
                      className="mt-2 text-xs font-bold text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Reset filters
                    </button>
                  </td>
                </tr>
              ) : (
                employeeMetrics.map((e, idx) => {
                  const rank = idx + 1;
                  const initials = getInitials(e.employee_name);
                  const avatarColor = getAvatarPalette(e.employee_name);

                  // Rank Badge Accents: Gold (#1), Silver (#2), Bronze (#3)
                  const rankBadge =
                    rank === 1 ? (
                      <span className="inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 font-mono text-xs font-black text-amber-700 shadow-sm dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                        <Crown className="h-3 w-3 text-amber-600" />
                        #1
                      </span>
                    ) : rank === 2 ? (
                      <span className="inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2 font-mono text-xs font-black text-slate-700 shadow-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200">
                        <Medal className="h-3 w-3 text-slate-500" />
                        #2
                      </span>
                    ) : rank === 3 ? (
                      <span className="inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-full border border-orange-300 bg-orange-50 px-2 font-mono text-xs font-black text-orange-800 shadow-sm dark:border-orange-800 dark:bg-orange-950/60 dark:text-orange-300">
                        <Award className="h-3 w-3 text-orange-600" />
                        #3
                      </span>
                    ) : (
                      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-100 px-1.5 font-mono text-[11px] font-bold text-slate-500 dark:bg-neutral-800 dark:text-neutral-400">
                        #{rank}
                      </span>
                    );

                  return (
                    <tr
                      key={e.employee_name}
                      onClick={() => onSelectEmployee(e)}
                      className={clsx(
                        'group cursor-pointer transition-colors duration-150',
                        idx % 2 === 0 ? 'bg-white dark:bg-neutral-900' : 'bg-slate-50/40 dark:bg-neutral-900/50',
                        'hover:bg-blue-50/50 dark:hover:bg-blue-950/20'
                      )}
                      title={`Click to view shipment drill-down for ${e.employee_name}`}
                    >
                      {/* 1. Rank */}
                      <td className="px-3 py-3.5 text-center">{rankBadge}</td>

                      {/* 2. Employee with Avatar */}
                      <td className="px-3.5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={clsx(
                              'flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-black shadow-xs',
                              avatarColor
                            )}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <span className="block truncate font-bold text-slate-900 group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400">
                              {e.employee_name}
                            </span>
                            <span className="block text-[10px] font-medium text-slate-400 dark:text-neutral-500">
                              {e.total_ofd} OFD • {e.status_ofd} on road
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 3. Total OFD */}
                      <td className="px-3 py-3.5 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                        {e.total_ofd}
                      </td>

                      {/* 4. Status OFD */}
                      <td className="px-3 py-3.5 text-right font-mono font-bold">
                        <span
                          className={clsx(
                            'inline-flex items-center rounded-md px-1.5 py-0.5',
                            e.status_ofd > 0
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                              : 'text-slate-400 dark:text-neutral-600'
                          )}
                        >
                          {e.status_ofd}
                        </span>
                      </td>

                      {/* 5. Delivered */}
                      <td className="px-3 py-3.5 text-right">
                        <span className="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 font-mono font-black text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                          {e.total_delivered}
                        </span>
                      </td>

                      {/* 6. UNDEL */}
                      <td className="px-3 py-3.5 text-right">
                        <span
                          className={clsx(
                            'inline-flex items-center rounded-md px-1.5 py-0.5 font-mono font-black',
                            e.total_undel > 0
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                              : 'text-slate-400 dark:text-neutral-600'
                          )}
                        >
                          {e.total_undel}
                        </span>
                      </td>

                      {/* 7. Pending */}
                      <td className="px-3 py-3.5 text-right">
                        <span
                          className={clsx(
                            'inline-flex items-center rounded-md px-1.5 py-0.5 font-mono font-bold',
                            e.pending > 0
                              ? 'bg-slate-100 text-slate-700 dark:bg-neutral-800 dark:text-neutral-300'
                              : 'text-slate-400 dark:text-neutral-600'
                          )}
                        >
                          {e.pending}
                        </span>
                      </td>

                      {/* 8. FAD Delivery % */}
                      <td className="px-3 py-3.5 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                        {e.first_attempt_delivery_pct}%
                      </td>

                      {/* 9. COD FAD % */}
                      <td className="px-3 py-3.5 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                        {e.cod_fad_percent}%
                      </td>

                      {/* 10. Prepaid FAD % */}
                      <td className="px-3 py-3.5 text-right font-mono font-bold text-purple-600 dark:text-purple-400">
                        {e.prepaid_fad_percent}%
                      </td>

                      {/* 11. Retry Count */}
                      <td className="px-3 py-3.5 text-right font-mono font-bold text-slate-600 dark:text-neutral-400">
                        {e.reattempt_ofd}
                      </td>

                      {/* 12. Retry % */}
                      <td className="px-3 py-3.5 text-right font-mono font-bold text-purple-600 dark:text-purple-400">
                        {e.reattempt_delivery_pct}%
                      </td>

                      {/* 13. Overall Delivery % with Progress Bar */}
                      <td className="min-w-32 px-3.5 py-3.5">
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-neutral-800">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                              style={{ width: `${Math.min(e.overall_delivery_pct, 100)}%` }}
                            />
                          </div>
                          <span className="shrink-0 font-mono text-xs font-black text-emerald-600 dark:text-emerald-400">
                            {e.overall_delivery_pct}%
                          </span>
                        </div>
                      </td>

                      {/* 14. COD Count */}
                      <td className="px-3 py-3.5 text-right font-mono font-bold text-slate-700 dark:text-neutral-300">
                        {e.cod_shipments_count}
                      </td>

                      {/* 15. Prepaid */}
                      <td className="px-3 py-3.5 text-right font-mono font-semibold text-slate-600 dark:text-neutral-400">
                        {e.prepaid_ofd}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ========================================================= */}
        {/* RESPONSIVE MOBILE EMPLOYEE CARDS (FOR MOBILE VIEWPORTS)   */}
        {/* ========================================================= */}
        <div className="space-y-3 bg-slate-50/70 p-3.5 md:hidden dark:bg-neutral-950/40">
          {employeeMetrics.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No employee records match the active criteria.
            </div>
          ) : (
            employeeMetrics.map((e, idx) => {
              const rank = idx + 1;
              const initials = getInitials(e.employee_name);
              const avatarColor = getAvatarPalette(e.employee_name);

              return (
                <button
                  type="button"
                  key={e.employee_name}
                  onClick={() => onSelectEmployee(e)}
                  className="w-full rounded-2xl border border-slate-200/90 bg-white p-4 text-left shadow-xs transition hover:border-blue-300 active:scale-[0.99] dark:border-neutral-800 dark:bg-neutral-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {/* Avatar */}
                      <div
                        className={clsx(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border font-mono text-xs font-black shadow-xs',
                          avatarColor
                        )}
                      >
                        {initials}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={clsx(
                              'font-mono text-xs font-black',
                              rank === 1
                                ? 'text-amber-600'
                                : rank === 2
                                ? 'text-slate-600'
                                : rank === 3
                                ? 'text-orange-600'
                                : 'text-slate-400'
                            )}
                          >
                            #{rank}
                          </span>
                          <span className="truncate text-sm font-bold text-slate-900 dark:text-white">
                            {e.employee_name}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10px] font-semibold text-slate-400">
                          {e.total_ofd} Total OFD • {e.status_ofd} Status OFD
                        </p>
                      </div>
                    </div>

                    <span className="font-mono text-base font-black text-emerald-600 dark:text-emerald-400">
                      {e.overall_delivery_pct}%
                    </span>
                  </div>

                  {/* Overall % Progress Bar */}
                  <div className="my-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-neutral-800">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${Math.min(e.overall_delivery_pct, 100)}%` }}
                    />
                  </div>

                  {/* Grid of 4 Key Percentage Badges */}
                  <div className="my-2 grid grid-cols-4 gap-1.5 text-center text-[10px]">
                    <div className="rounded-lg bg-emerald-50 p-1.5 dark:bg-emerald-950/40">
                      <div className="font-mono font-black text-emerald-700 dark:text-emerald-300">
                        {e.overall_delivery_pct}%
                      </div>
                      <div className="text-[8px] font-bold uppercase text-emerald-600">Overall</div>
                    </div>

                    <div className="rounded-lg bg-amber-50 p-1.5 dark:bg-amber-950/40">
                      <div className="font-mono font-black text-amber-700 dark:text-amber-300">
                        {e.first_attempt_delivery_pct}%
                      </div>
                      <div className="text-[8px] font-bold uppercase text-amber-600">FAD %</div>
                    </div>

                    <div className="rounded-lg bg-blue-50 p-1.5 dark:bg-blue-950/40">
                      <div className="font-mono font-black text-blue-700 dark:text-blue-300">
                        {e.cod_fad_percent}%
                      </div>
                      <div className="text-[8px] font-bold uppercase text-blue-600">COD FAD</div>
                    </div>

                    <div className="rounded-lg bg-purple-50 p-1.5 dark:bg-purple-950/40">
                      <div className="font-mono font-black text-purple-700 dark:text-purple-300">
                        {e.prepaid_fad_percent}%
                      </div>
                      <div className="text-[8px] font-bold uppercase text-purple-600">Prep FAD</div>
                    </div>
                  </div>

                  {/* Grid of Key Employee Counts */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-xl bg-slate-50 p-2 dark:bg-neutral-800/60">
                      <div className="font-mono font-black text-slate-800 dark:text-slate-200">
                        {e.total_ofd}
                      </div>
                      <div className="mt-0.5 text-[9px] font-bold uppercase text-slate-400">Total OFD</div>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-2 dark:bg-neutral-800/60">
                      <div className="font-mono font-black text-amber-600 dark:text-amber-400">
                        {e.status_ofd}
                      </div>
                      <div className="mt-0.5 text-[9px] font-bold uppercase text-slate-400">Status OFD</div>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-2 dark:bg-neutral-800/60">
                      <div className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                        {e.total_delivered}
                      </div>
                      <div className="mt-0.5 text-[9px] font-bold uppercase text-slate-400">Delivered</div>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-2 dark:bg-neutral-800/60">
                      <div className="font-mono font-black text-rose-600 dark:text-rose-400">
                        {e.total_undel}
                      </div>
                      <div className="mt-0.5 text-[9px] font-bold uppercase text-slate-400">UNDEL</div>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-2 dark:bg-neutral-800/60">
                      <div className="font-mono font-black text-slate-700 dark:text-neutral-300">
                        {e.pending}
                      </div>
                      <div className="mt-0.5 text-[9px] font-bold uppercase text-slate-400">Pending</div>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-2 dark:bg-neutral-800/60">
                      <div className="font-mono font-bold text-purple-600 dark:text-purple-400">
                        {e.reattempt_ofd}
                      </div>
                      <div className="mt-0.5 text-[9px] font-bold uppercase text-slate-400">Retry Count</div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5. REPORT SUMMARY SECTION                                 */}
      {/* ========================================================= */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Top Performer Card */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-neutral-800">
            <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
              <Crown className="h-4 w-4 text-amber-500" />
              Top Performer
            </h3>
            {topPerformer && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                Rank #1 Executive
              </span>
            )}
          </div>

          {topPerformer ? (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className={clsx(
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border font-mono text-sm font-black shadow-xs',
                    getAvatarPalette(topPerformer.employee_name)
                  )}
                >
                  {getInitials(topPerformer.employee_name)}
                </div>
                <div className="min-w-0">
                  <h4 className="truncate text-base font-black text-slate-900 dark:text-white">
                    {topPerformer.employee_name}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-neutral-400">
                    {topPerformer.total_delivered} delivered of {topPerformer.total_ofd} Total OFD ({topPerformer.status_ofd} on road)
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3 dark:border-emerald-950 dark:bg-emerald-950/30">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    Overall Performance
                  </span>
                  <span className="font-mono text-xl font-black text-emerald-600 dark:text-emerald-400">
                    {topPerformer.overall_delivery_pct}%
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-emerald-200/60 dark:bg-emerald-900/60">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${Math.min(topPerformer.overall_delivery_pct, 100)}%` }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => onSelectEmployee(topPerformer)}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100 active:scale-95 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
              >
                <span>View Executive Details</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <p className="mt-4 text-xs text-slate-400">No active performer data.</p>
          )}
        </div>

        {/* Key Insights Card */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-neutral-800">
            <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
              <Sparkles className="h-4 w-4 text-blue-600" />
              Key Insights
            </h3>
            <span className="text-[10px] font-semibold text-slate-400">Operations Pulse</span>
          </div>

          <div className="mt-4 space-y-2.5">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-2 dark:bg-neutral-800/60">
              <span className="text-xs font-semibold text-slate-600 dark:text-neutral-300">
                Overall Delivery Rate
              </span>
              <span className="font-mono text-sm font-black text-emerald-600 dark:text-emerald-400">
                {summary?.overallDeliveryPct ?? 0}%
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-2 dark:bg-neutral-800/60">
              <span className="text-xs font-semibold text-slate-600 dark:text-neutral-300">
                FAD Delivery Rate (1st Attempt)
              </span>
              <span className="font-mono text-sm font-black text-amber-600 dark:text-amber-400">
                {summary?.firstAttemptDeliveryPct ?? 0}%
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-2 dark:bg-neutral-800/60">
              <span className="text-xs font-semibold text-slate-600 dark:text-neutral-300">
                COD FAD %
              </span>
              <span className="font-mono text-sm font-black text-blue-600 dark:text-blue-400">
                {summary?.codFadPercent ?? 0}%
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-2 dark:bg-neutral-800/60">
              <span className="text-xs font-semibold text-slate-600 dark:text-neutral-300">
                Prepaid FAD %
              </span>
              <span className="font-mono text-sm font-black text-purple-600 dark:text-purple-400">
                {summary?.prepaidFadPercent ?? 0}%
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-2 dark:bg-neutral-800/60">
              <span className="text-xs font-semibold text-slate-600 dark:text-neutral-300">
                Active on Road (Status OFD)
              </span>
              <span className="font-mono text-sm font-black text-amber-600 dark:text-amber-400">
                {summary?.statusOfd ?? 0}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-2 dark:bg-neutral-800/60">
              <span className="text-xs font-semibold text-slate-600 dark:text-neutral-300">
                Pending Shipments (UNDEL + OFD)
              </span>
              <span className="font-mono text-sm font-black text-rose-600 dark:text-rose-400">
                {totalPending}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions Card */}
        <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-neutral-800">
            <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
              <Download className="h-4 w-4 text-indigo-600" />
              Quick Actions
            </h3>
            <span className="text-[10px] font-semibold text-slate-400">Report Exports</span>
          </div>

          <div className="mt-4 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onExportExcel}
              className="inline-flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-xs font-bold text-slate-800 transition hover:border-emerald-300 hover:bg-emerald-50/50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
            >
              <span className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <span>Export Detailed Excel Report</span>
              </span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>

            <button
              type="button"
              onClick={onExportPDF}
              className="inline-flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-xs font-bold text-slate-800 transition hover:border-blue-300 hover:bg-blue-50/50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
            >
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-rose-500" />
                <span>Export Printable PDF Leaderboard</span>
              </span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>

            <button
              type="button"
              onClick={onCopySnapshot}
              disabled={isCopyingSnapshot || employeeMetrics.length === 0}
              className="inline-flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-xs font-bold text-slate-800 transition hover:border-blue-300 hover:bg-blue-50/50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
            >
              <span className="flex items-center gap-2">
                <Copy className="h-4 w-4 text-blue-600" />
                <span>Share Performance Snapshot</span>
              </span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
