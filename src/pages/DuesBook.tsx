import DuesBookKPIs from '@/components/dues-book/DuesBookKPIs';
import ManualDuesModal from '@/components/dues-book/ManualDuesModal';
import RecoveryModal from '@/components/dues-book/RecoveryModal';
import RecoveryReportsView from '@/components/dues-book/RecoveryReportsView';
import RiderProfileStatementModal from '@/components/dues-book/RiderProfileStatementModal';
import WhatsAppReminderModal from '@/components/dues-book/WhatsAppReminderModal';
import SEO from '@/components/SEO';
import { useToast } from '@/components/ui/Toast';
import { Button, Spinner } from '@/components/ui/primitives';
import { useAuth } from '@/lib/auth';
import { formatDate, formatINR } from '@/lib/format';
import { useHub } from '@/lib/hubContext';
import {
  exportAllRidersLedgerExcel,
  fetchRiderDuesData,
} from '@/lib/riderDuesService';
import {
  Collector,
  Hub,
  RiderDue,
  RiderDueRecovery,
  RiderDuesKPIs,
  RiderLedgerSummary,
} from '@/types';
import {
  AlertCircle,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileSpreadsheet,
  MessageCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

type ViewMode = 'ledger' | 'reports';

const STATUS_FILTERS = [
  'All Statuses',
  'Pending',
  'Partially Recovered',
  'Fully Recovered',
  'Overdue',
];

const CATEGORY_FILTERS = [
  'All Categories',
  'COD Short',
  'Cash Short',
  'Penalty',
  'Damage',
  'Advance',
  'Salary Adjustment',
  'Other',
];

export default function DuesBook() {
  const { profile } = useAuth();
  const hubCtx = useHub();
  const toast = useToast();

  const [viewMode, setViewMode] = useState<ViewMode>('ledger');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Raw Data State
  const [kpis, setKpis] = useState<RiderDuesKPIs>({
    totalRidersWithDues: 0,
    totalOutstandingAmount: 0,
    totalDuesGenerated: 0,
    totalAmountRecovered: 0,
    todaysRecovery: 0,
    overdueAmount: 0,
  });
  const [riderSummaries, setRiderSummaries] = useState<RiderLedgerSummary[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [allDues, setAllDues] = useState<RiderDue[]>([]);
  const [allRecoveries, setAllRecoveries] = useState<RiderDueRecovery[]>([]);

  // Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHubFilter, setSelectedHubFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('All Statuses');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All Categories');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Modals State
  const [addDuesModalOpen, setAddDuesModalOpen] = useState(false);
  const [recoveryModalOpen, setRecoveryModalOpen] = useState(false);
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [statementModalOpen, setStatementModalOpen] = useState(false);
  const [selectedRiderSummary, setSelectedRiderSummary] = useState<RiderLedgerSummary | null>(null);

  // Scope permissions
  const canManage = ['super_admin', 'hub_admin', 'supervisor'].includes(profile?.role ?? '');
  const effectiveHubId = hubCtx.selectedHubId;

  const loadData = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await fetchRiderDuesData(effectiveHubId);
      setKpis(data.kpis);
      setRiderSummaries(data.riderSummaries);
      setCollectors(data.collectors);
      setAllDues(data.allDues);
      setAllRecoveries(data.allRecoveries);

      // If a rider was currently selected in statement modal, refresh their summary object
      if (selectedRiderSummary) {
        const updated = data.riderSummaries.find((s) => s.riderId === selectedRiderSummary.riderId);
        if (updated) setSelectedRiderSummary(updated);
      }
    } catch (err: any) {
      console.error('Error fetching rider dues data:', err);
      toast.error('Failed to load rider dues data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [effectiveHubId, selectedRiderSummary, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered Riders List
  const filteredSummaries = useMemo(() => {
    return riderSummaries.filter((rider) => {
      // Hub filter
      if (selectedHubFilter !== 'all' && rider.hubId !== selectedHubFilter) {
        return false;
      }

      // Status filter
      if (selectedStatusFilter !== 'All Statuses') {
        if (selectedStatusFilter === 'Overdue') {
          if (rider.status !== 'Overdue') return false;
        } else if (rider.status !== selectedStatusFilter) {
          return false;
        }
      }

      // Category filter (checks if rider has at least one due in this category)
      if (selectedCategoryFilter !== 'All Categories') {
        const hasCategory = rider.dues.some((d) => d.category === selectedCategoryFilter);
        if (!hasCategory) return false;
      }

      // Search Query filter (matches name, FE ID, or phone)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = rider.riderName.toLowerCase().includes(q);
        const matchFeId = rider.feId.toLowerCase().includes(q);
        const matchPhone = rider.phone.toLowerCase().includes(q);
        if (!matchName && !matchFeId && !matchPhone) return false;
      }

      return true;
    });
  }, [riderSummaries, selectedHubFilter, selectedStatusFilter, selectedCategoryFilter, searchQuery]);

  // Paginated Rows
  const totalPages = Math.ceil(filteredSummaries.length / pageSize) || 1;
  const paginatedSummaries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSummaries.slice(start, start + pageSize);
  }, [filteredSummaries, currentPage, pageSize]);

  // Handlers
  const handleOpenStatement = (summary: RiderLedgerSummary) => {
    setSelectedRiderSummary(summary);
    setStatementModalOpen(true);
  };

  const handleOpenRecovery = (summary: RiderLedgerSummary) => {
    setSelectedRiderSummary(summary);
    setRecoveryModalOpen(true);
  };

  const handleOpenWhatsApp = (summary: RiderLedgerSummary) => {
    setSelectedRiderSummary(summary);
    setWhatsAppModalOpen(true);
  };

  const handleExportLedgerExcel = () => {
    try {
      exportAllRidersLedgerExcel(filteredSummaries);
      toast.success(
        `Exported ${filteredSummaries.length} rider records to HubVault_Rider_Dues_Book.xlsx`
      );
    } catch {
      toast.error('Failed to export ledger to Excel');
    }
  };

  return (
    <>
      <SEO
        title="Rider Dues Book & Recovery Management — HubVault"
        description="Comprehensive rider dues book, manual shortage tracking, FIFO recovery allocations, and WhatsApp reminder reminders for delivery logistics."
      />

      <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Top Header & Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-sm">
                <BookOpen className="h-5 w-5 text-amber-400 dark:text-indigo-600" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  Rider Dues Book
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    Live Ledger
                  </span>
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Track individual rider dues, manual shortages, recoveries, and WhatsApp statements
                </p>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={loadData}
              disabled={refreshing}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition active:scale-95 cursor-pointer"
              title="Refresh live ledger"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            <Button
              variant="secondary"
              onClick={handleExportLedgerExcel}
              className="inline-flex items-center gap-2 text-xs"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>Export Ledger (.xlsx)</span>
            </Button>

            {canManage && (
              <Button
                variant="primary"
                onClick={() => setAddDuesModalOpen(true)}
                className="bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 text-white inline-flex items-center gap-2 shadow-sm text-xs font-bold"
              >
                <Plus className="h-4 w-4" />
                <span>+ Add New Dues</span>
              </Button>
            )}
          </div>
        </div>

        {/* Live KPI Cards */}
        <DuesBookKPIs kpis={kpis} loading={loading} />

        {/* View Mode Switcher: Main Ledger vs Recovery Reports */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setViewMode('ledger')}
              className={`py-3 text-sm font-bold border-b-2 transition cursor-pointer flex items-center gap-2 ${
                viewMode === 'ledger'
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Rider Dues Ledger</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {riderSummaries.length}
              </span>
            </button>

            <button
              onClick={() => setViewMode('reports')}
              className={`py-3 text-sm font-bold border-b-2 transition cursor-pointer flex items-center gap-2 ${
                viewMode === 'reports'
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Recovery Reports &amp; Analytics</span>
            </button>
          </div>
        </div>

        {/* VIEW 1: RIDER DUES LEDGER TABLE */}
        {viewMode === 'ledger' && (
          <div className="space-y-4">
            {/* Filter & Search Ribbon */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
              {/* Search Box */}
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search rider name, FE ID or mobile..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900 pl-9 pr-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Dropdown Filters */}
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                {/* Hub Filter (if user has access to multiple hubs) */}
                {profile?.role === 'super_admin' && (
                  <select
                    value={selectedHubFilter}
                    onChange={(e) => {
                      setSelectedHubFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">All Hubs</option>
                    {hubCtx.accessibleHubs.map((h: Hub) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                )}

                {/* Status Filter */}
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => {
                    setSelectedStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {STATUS_FILTERS.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>

                {/* Category Filter */}
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => {
                    setSelectedCategoryFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {CATEGORY_FILTERS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>

                {/* Reset Filters */}
                {(searchQuery ||
                  selectedStatusFilter !== 'All Statuses' ||
                  selectedCategoryFilter !== 'All Categories' ||
                  selectedHubFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedStatusFilter('All Statuses');
                      setSelectedCategoryFilter('All Categories');
                      setSelectedHubFilter('all');
                      setCurrentPage(1);
                    }}
                    className="text-xs font-bold text-rose-600 hover:underline px-2 py-1"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </div>

            {/* Table Container */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/90 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-800 z-10 backdrop-blur-sm">
                    <tr>
                      <th className="py-3 px-3 text-center w-12">#</th>
                      <th className="py-3 px-4">Rider Name</th>
                      <th className="py-3 px-3">FE ID</th>
                      <th className="py-3 px-3">Mobile Number</th>
                      <th className="py-3 px-3">Hub</th>
                      <th className="py-3 px-3 text-right">Total Dues</th>
                      <th className="py-3 px-3 text-right">Total Recovered</th>
                      <th className="py-3 px-4 text-right">Outstanding Balance</th>
                      <th className="py-3 px-3">Last Recovery</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                    {loading ? (
                      <tr>
                        <td colSpan={11} className="py-12 text-center text-slate-400">
                          <Spinner className="h-6 w-6 mx-auto mb-2 text-indigo-500" />
                          <span>Loading rider dues book...</span>
                        </td>
                      </tr>
                    ) : paginatedSummaries.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-12 text-center font-sans text-slate-400">
                          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            No riders found matching filters
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            Try adjusting your search criteria or add a new dues entry.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      paginatedSummaries.map((rider, index) => {
                        const serialNum = (currentPage - 1) * pageSize + index + 1;
                        return (
                          <tr
                            key={rider.riderId}
                            className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition group"
                          >
                            <td className="py-3 px-3 text-center text-slate-400 font-sans">
                              {serialNum}
                            </td>

                            {/* Rider Name (Clickable) */}
                            <td className="py-3 px-4 font-sans">
                              <button
                                onClick={() => handleOpenStatement(rider)}
                                className="font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline cursor-pointer text-left block"
                              >
                                {rider.riderName}
                              </button>
                              <span className="text-[11px] text-slate-400 block font-normal">
                                {rider.duesCount} dues recorded
                              </span>
                            </td>

                            {/* FE ID */}
                            <td className="py-3 px-3">
                              <button
                                onClick={() => handleOpenStatement(rider)}
                                className="font-mono font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                              >
                                {rider.feId}
                              </button>
                            </td>

                            {/* Mobile */}
                            <td className="py-3 px-3 font-sans text-slate-600 dark:text-slate-300">
                              {rider.phone}
                            </td>

                            {/* Hub */}
                            <td className="py-3 px-3 font-sans text-slate-500 dark:text-slate-400">
                              {rider.hubName}
                            </td>

                            {/* Total Dues */}
                            <td className="py-3 px-3 text-right text-slate-800 dark:text-slate-200 font-bold">
                              {formatINR(rider.totalDues)}
                            </td>

                            {/* Total Recovered (Green) */}
                            <td className="py-3 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                              {formatINR(rider.totalRecovered)}
                            </td>

                            {/* Outstanding Balance (Bold Red) */}
                            <td className="py-3 px-4 text-right">
                              <span
                                className={`text-sm font-black ${
                                  rider.outstandingBalance > 0
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : 'text-slate-400 dark:text-slate-500'
                                }`}
                              >
                                {formatINR(rider.outstandingBalance)}
                              </span>
                            </td>

                            {/* Last Recovery Date */}
                            <td className="py-3 px-3 font-sans text-slate-500 text-[11px]">
                              {rider.lastRecoveryDate ? formatDate(rider.lastRecoveryDate) : 'Never'}
                            </td>

                            {/* Status Badge */}
                            <td className="py-3 px-3 text-center font-sans">
                              <span
                                className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                                  rider.status === 'Fully Recovered'
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                    : rider.status === 'Overdue'
                                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 animate-pulse'
                                    : rider.status === 'Partially Recovered'
                                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                {rider.status}
                              </span>
                            </td>

                            {/* Action Buttons */}
                            <td className="py-3 px-4 text-right font-sans">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* View Statement */}
                                <button
                                  onClick={() => handleOpenStatement(rider)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 transition cursor-pointer"
                                  title="View complete rider profile & statement"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>

                                {/* WhatsApp Reminder */}
                                <button
                                  onClick={() => handleOpenWhatsApp(rider)}
                                  className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition cursor-pointer"
                                  title="Send WhatsApp dues reminder"
                                >
                                  <MessageCircle className="h-4 w-4" />
                                </button>

                                {/* Record Recovery */}
                                {canManage && (
                                  <button
                                    onClick={() => handleOpenRecovery(rider)}
                                    className="p-1.5 rounded-lg text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition cursor-pointer"
                                    title="Record recovery payment"
                                  >
                                    <RotateCcw className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Pagination Bar */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <span>Showing</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 py-1 text-slate-900 dark:text-white"
                  >
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span>of {filteredSummaries.length} riders</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 p-1.5 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 p-1.5 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: RECOVERY REPORTS & ANALYTICS */}
        {viewMode === 'reports' && (
          <RecoveryReportsView
            riderSummaries={riderSummaries}
            allDues={allDues}
            allRecoveries={allRecoveries}
          />
        )}
      </div>

      {/* ============================================================
          MODALS INTEGRATION
          ============================================================ */}

      {/* 1. Manual Dues Entry Modal */}
      <ManualDuesModal
        open={addDuesModalOpen}
        onClose={() => setAddDuesModalOpen(false)}
        onSuccess={loadData}
        collectors={collectors}
        hubs={hubCtx.accessibleHubs}
        currentUserId={profile?.id}
      />

      {/* 2. Recovery Modal */}
      <RecoveryModal
        open={recoveryModalOpen}
        onClose={() => setRecoveryModalOpen(false)}
        onSuccess={loadData}
        riderSummary={selectedRiderSummary}
        currentUserName={profile?.name}
        currentUserRole={profile?.role}
        currentUserId={profile?.id}
      />

      {/* 3. WhatsApp Reminder Modal */}
      <WhatsAppReminderModal
        open={whatsAppModalOpen}
        onClose={() => setWhatsAppModalOpen(false)}
        onSuccess={loadData}
        riderSummary={selectedRiderSummary}
        currentUserId={profile?.id}
      />

      {/* 4. Complete Rider Profile & Statement Modal */}
      <RiderProfileStatementModal
        open={statementModalOpen}
        onClose={() => setStatementModalOpen(false)}
        riderSummary={selectedRiderSummary}
        onOpenRecovery={() => {
          setStatementModalOpen(false);
          setRecoveryModalOpen(true);
        }}
        onOpenWhatsApp={() => {
          setStatementModalOpen(false);
          setWhatsAppModalOpen(true);
        }}
        onDataChanged={loadData}
        currentUserId={profile?.id}
        currentUserRole={profile?.role}
      />
    </>
  );
}
