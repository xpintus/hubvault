import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BookOpen, Plus, Search, Calendar, Download, Printer, Filter, Edit3, Trash2, Layers
} from 'lucide-react';
import { Party, PartyTransaction, PartyLedgerEntry } from '@/types';
import { useAuth } from '@/lib/auth';
import { useHub } from '@/lib/hubContext';
import { useToast } from '@/components/ui/Toast';
import { confirm } from '@/lib/confirm';
import { Button, Card, Select, Input, EmptyState, Skeleton, Badge } from '@/components/ui/primitives';
import {
  fetchParties,
  fetchPartyTransactions,
  calculateRunningLedger,
  deletePartyTransaction,
  formatINRNumber,
} from '@/lib/khatabook';
import { exportPartyLedgerToExcel, printKhataBookReport } from '@/lib/khatabookExport';
import TransactionModal from '@/components/khatabook/TransactionModal';
import AdjustmentDetailModal from '@/components/khatabook/AdjustmentDetailModal';

export default function Ledger() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useAuth();
  const hubCtx = useHub();
  const isSuperAdmin = profile?.role === 'super_admin';
  const effectiveHubId = isSuperAdmin ? hubCtx.selectedHubId : profile?.hub_id ?? null;

  const initialPartyId = searchParams.get('party_id') || '';

  const [loading, setLoading] = useState(true);
  const [parties, setParties] = useState<Party[]>([]);
  const [transactions, setTransactions] = useState<PartyTransaction[]>([]);

  // Filter state
  const [selectedPartyId, setSelectedPartyId] = useState<string>(initialPartyId);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'excess' | 'settled' | 'cash' | 'online'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [showTxModal, setShowTxModal] = useState(false);
  const [editingTx, setEditingTx] = useState<PartyTransaction | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const pData = await fetchParties(effectiveHubId);
      const tData = await fetchPartyTransactions(undefined, effectiveHubId);
      setParties(pData);
      setTransactions(tData);
    } catch (err) {
      toast.error('Failed to load ledger data');
    } finally {
      setLoading(false);
    }
  }, [effectiveHubId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Selected Party object
  const selectedParty = useMemo(() => {
    return parties.find((p) => p.id === selectedPartyId) || null;
  }, [parties, selectedPartyId]);

  // Filter transactions
  const filteredTx = useMemo(() => {
    return transactions.filter((tx) => {
      if (selectedPartyId && tx.party_id !== selectedPartyId) return false;
      if (fromDate && tx.transaction_date < fromDate) return false;
      if (toDate && tx.transaction_date > toDate) return false;

      if (statusFilter === 'cash' && Number(tx.cash_paid || 0) <= 0) return false;
      if (statusFilter === 'online' && Number(tx.online_paid || 0) <= 0) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const p = tx.party;
        const nameMatch = (p?.name || '').toLowerCase().includes(q);
        const compMatch = (p?.company_name || '').toLowerCase().includes(q);
        const mobileMatch = (p?.mobile || '').includes(q);
        const refMatch = (tx.payment_reference || '').toLowerCase().includes(q);
        const remMatch = (tx.remarks || '').toLowerCase().includes(q);
        if (!nameMatch && !compMatch && !mobileMatch && !refMatch && !remMatch) return false;
      }

      return true;
    });
  }, [transactions, selectedPartyId, fromDate, toDate, statusFilter, searchQuery]);

  // Compute calculated running ledger entries
  const ledgerEntries: PartyLedgerEntry[] = useMemo(() => {
    if (!selectedParty) {
      // Aggregate calculation across all parties
      const dummyParty: Party = {
        id: 'all',
        hub_id: null,
        name: 'All Parties',
        company_name: null,
        mobile: null,
        address: null,
        gstin: null,
        opening_balance: 0,
        opening_balance_type: 'receivable',
        notes: null,
        created_by: null,
        updated_by: null,
        created_at: '',
        updated_at: '',
      };
      return calculateRunningLedger(dummyParty, filteredTx);
    }
    return calculateRunningLedger(selectedParty, filteredTx);
  }, [selectedParty, filteredTx]);

  // Final filtered ledger rows according to status badge (pending/excess/settled)
  const displayLedgerEntries = useMemo(() => {
    return ledgerEntries.filter((entry) => {
      if (statusFilter === 'pending') return entry.status === 'pending' || entry.status === 'partial';
      if (statusFilter === 'excess') return entry.status === 'excess';
      if (statusFilter === 'settled') return entry.status === 'settled';
      return true;
    });
  }, [ledgerEntries, statusFilter]);

  const handleDeleteTx = async (tx: PartyTransaction) => {
    const ok = await confirm({
      title: 'Delete Transaction Entry?',
      message: 'This will remove the transaction from the running ledger and recalculate balances.',
      confirmLabel: 'Delete Entry',
    });
    if (!ok) return;

    try {
      await deletePartyTransaction(tx.id, profile?.id, tx.hub_id || undefined);
      toast.success('Transaction deleted');
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete transaction');
    }
  };

  const handleExportExcel = () => {
    exportPartyLedgerToExcel(
      selectedParty,
      displayLedgerEntries,
      selectedParty ? `${selectedParty.name}-ledger.xlsx` : 'khata-ledger-statement.xlsx'
    );
    toast.success('Ledger statement exported to Excel');
  };

  const handlePrint = () => {
    printKhataBookReport(
      selectedParty ? `Party Ledger: ${selectedParty.name}` : 'All Parties Ledger Statement',
      selectedParty,
      displayLedgerEntries
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Running Ledger View</h2>
          <p className="text-xs text-neutral-500">Date-wise running ledger with FIFO settlement tracking</p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={handleExportExcel} icon={<Download className="h-4 w-4" />}>
            Export Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} icon={<Printer className="h-4 w-4" />}>
            Print Statement
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditingTx(null);
              setShowTxModal(true);
            }}
            icon={<Plus className="h-4 w-4" />}
          >
            Record Entry
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card className="p-4 border border-neutral-200 dark:border-neutral-800 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <Select
            label="Filter by Party"
            value={selectedPartyId}
            onChange={(e) => {
              setSelectedPartyId(e.target.value);
              setSearchParams(e.target.value ? { party_id: e.target.value } : {});
            }}
          >
            <option value="">All Parties</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.company_name ? `(${p.company_name})` : ''}
              </option>
            ))}
          </Select>

          <Input
            label="From Date"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />

          <Input
            label="To Date"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />

          <Select
            label="Status / Mode Filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="all">All Transactions</option>
            <option value="pending">Pending Only</option>
            <option value="excess">Excess Only</option>
            <option value="settled">Settled Only</option>
            <option value="cash">Cash Paid Only</option>
            <option value="online">Online Paid Only</option>
          </Select>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <div className="relative w-full sm:w-80">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by party, remarks, reference..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-base pl-9 py-1.5 text-xs w-full"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {(fromDate || toDate || searchQuery || statusFilter !== 'all' || selectedPartyId) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedPartyId('');
                  setFromDate('');
                  setToDate('');
                  setStatusFilter('all');
                  setSearchQuery('');
                  setSearchParams({});
                }}
              >
                Reset Filters
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDetailModalOpen(true)}
              icon={<Layers className="h-3.5 w-3.5" />}
            >
              FIFO Breakdown
            </Button>
          </div>
        </div>
      </Card>

      {/* Selected Party Summary Bar */}
      {selectedParty && (
        <div className="p-4 rounded-2xl bg-brand-50/70 dark:bg-brand-600/10 border border-brand-200 dark:border-brand-600/20 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">{selectedParty.name}</h3>
            <p className="text-xs text-neutral-500">
              {selectedParty.company_name ? `Company: ${selectedParty.company_name} | ` : ''}
              {selectedParty.mobile ? `Mobile: ${selectedParty.mobile} | ` : ''}
              Opening: {formatINRNumber(selectedParty.opening_balance)} ({selectedParty.opening_balance_type.toUpperCase()})
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-neutral-400 font-semibold block uppercase text-[10px]">Total Entries</span>
              <span className="font-bold text-neutral-800 dark:text-neutral-200 text-sm">{displayLedgerEntries.length}</span>
            </div>
            <div>
              <span className="text-neutral-400 font-semibold block uppercase text-[10px]">Final Balance</span>
              <span
                className={`font-bold text-sm ${
                  displayLedgerEntries.length > 0 && displayLedgerEntries[displayLedgerEntries.length - 1].running_balance > 0
                    ? 'text-red-600 dark:text-red-400'
                    : displayLedgerEntries.length > 0 && displayLedgerEntries[displayLedgerEntries.length - 1].running_balance < 0
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {displayLedgerEntries.length > 0
                  ? formatINRNumber(displayLedgerEntries[displayLedgerEntries.length - 1].running_balance)
                  : formatINRNumber(selectedParty.opening_balance_type === 'payable' ? -selectedParty.opening_balance : selectedParty.opening_balance)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Professional Ledger Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : displayLedgerEntries.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-8 w-8" />}
          title="No Ledger Transactions Found"
          message="No records match your selected filters or search criteria."
          action={
            <Button
              size="sm"
              onClick={() => {
                setEditingTx(null);
                setShowTxModal(true);
              }}
              icon={<Plus className="h-4 w-4" />}
            >
              Record First Entry
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden border border-neutral-200 dark:border-neutral-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 uppercase tracking-wider font-semibold">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Party Name</th>
                  <th className="px-4 py-3 text-right">Received</th>
                  <th className="px-4 py-3 text-right">Cash Paid</th>
                  <th className="px-4 py-3 text-right">Online Paid</th>
                  <th className="px-4 py-3 text-right">Total Paid</th>
                  <th className="px-4 py-3 text-right">Difference</th>
                  <th className="px-4 py-3 text-right">Running Balance</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3">Remarks</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {displayLedgerEntries.map((e) => (
                  <tr key={e.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40 transition">
                    <td className="px-4 py-3.5 whitespace-nowrap font-medium text-neutral-800 dark:text-neutral-200">
                      {e.transaction_date}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-neutral-900 dark:text-neutral-100 whitespace-nowrap">
                      {e.party?.name || (selectedParty ? selectedParty.name : '-')}
                    </td>
                    <td className="px-4 py-3.5 text-right font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      {e.amount_received > 0 ? formatINRNumber(e.amount_received) : '-'}
                    </td>
                    <td className="px-4 py-3.5 text-right text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                      {e.cash_paid > 0 ? formatINRNumber(e.cash_paid) : '-'}
                    </td>
                    <td className="px-4 py-3.5 text-right text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                      {e.online_paid > 0 ? formatINRNumber(e.online_paid) : '-'}
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-brand-600 dark:text-brand-400 whitespace-nowrap">
                      {formatINRNumber(e.total_paid)}
                    </td>
                    <td className={`px-4 py-3.5 text-right font-semibold whitespace-nowrap ${e.difference >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                      {formatINRNumber(e.difference)}
                    </td>
                    <td
                      className={`px-4 py-3.5 text-right font-bold whitespace-nowrap ${
                        e.running_balance > 0
                          ? 'text-red-600 dark:text-red-400'
                          : e.running_balance < 0
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {formatINRNumber(e.running_balance)}
                    </td>
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      <Badge
                        color={
                          e.status === 'settled'
                            ? 'green'
                            : e.status === 'pending'
                            ? 'red'
                            : e.status === 'excess'
                            ? 'blue'
                            : 'yellow'
                        }
                      >
                        {e.status_label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-neutral-500 truncate max-w-[160px]">
                      {e.remarks || e.payment_reference || '-'}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingTx(e);
                            setShowTxModal(true);
                          }}
                          icon={<Edit3 className="h-3.5 w-3.5" />}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTx(e)}
                          icon={<Trash2 className="h-3.5 w-3.5 text-red-500" />}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modals */}
      <TransactionModal
        open={showTxModal}
        onClose={() => {
          setShowTxModal(false);
          setEditingTx(null);
        }}
        parties={parties}
        editingTx={editingTx}
        defaultPartyId={selectedPartyId}
        selectedHubId={effectiveHubId}
        onSave={async (input) => {
          const { createPartyTransaction, updatePartyTransaction } = await import('@/lib/khatabook');
          if (editingTx) {
            await updatePartyTransaction(editingTx.id, input, profile?.id);
          } else {
            await createPartyTransaction(input, profile?.id);
          }
          loadData();
        }}
      />

      <AdjustmentDetailModal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        party={selectedParty}
        ledgerEntries={displayLedgerEntries}
        filterType={statusFilter === 'pending' ? 'pending' : statusFilter === 'excess' ? 'excess' : 'all'}
      />
    </div>
  );
}
