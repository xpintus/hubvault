import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, DollarSign, Wallet, CreditCard, ArrowDownLeft, ArrowUpRight,
  CheckCircle2, Clock, Calendar, Plus, ChevronRight, Search, Layers, RefreshCw
} from 'lucide-react';
import { Party, PartyTransaction, PartySummaryCardData } from '@/types';
import { useAuth } from '@/lib/auth';
import { useHub } from '@/lib/hubContext';
import { useToast } from '@/components/ui/Toast';
import { Button, Card, Spinner, Skeleton, EmptyState, Badge } from '@/components/ui/primitives';
import {
  fetchParties,
  fetchPartyTransactions,
  calculatePartyCardData,
  calculateRunningLedger,
  calculateKhataBookSummary,
  formatINRNumber,
} from '@/lib/khatabook';
import PartyModal from '@/components/khatabook/PartyModal';
import TransactionModal from '@/components/khatabook/TransactionModal';
import AdjustmentDetailModal from '@/components/khatabook/AdjustmentDetailModal';

export default function Dashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const { profile } = useAuth();
  const hubCtx = useHub();
  const isSuperAdmin = profile?.role === 'super_admin';
  const effectiveHubId = isSuperAdmin ? hubCtx.selectedHubId : profile?.hub_id ?? null;

  const [loading, setLoading] = useState(true);
  const [parties, setParties] = useState<Party[]>([]);
  const [transactions, setTransactions] = useState<PartyTransaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'excess' | 'settled'>('all');

  // Modals state
  const [showPartyModal, setShowPartyModal] = useState(false);
  const [showTxModal, setShowTxModal] = useState(false);
  const [selectedPartyForTx, setSelectedPartyForTx] = useState<string | undefined>(undefined);

  // Detail Modal state
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailParty, setDetailParty] = useState<Party | null>(null);
  const [detailFilter, setDetailFilter] = useState<'pending' | 'excess' | 'all'>('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const partyData = await fetchParties(effectiveHubId);
      const txData = await fetchPartyTransactions(undefined, effectiveHubId);
      setParties(partyData);
      setTransactions(txData);
    } catch (err) {
      toast.error('Failed to load KhataBook dashboard data');
    } finally {
      setLoading(false);
    }
  }, [effectiveHubId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Group transactions by party_id
  const transactionsMap = useMemo(() => {
    const map: Record<string, PartyTransaction[]> = {};
    for (const tx of transactions) {
      if (!map[tx.party_id]) map[tx.party_id] = [];
      map[tx.party_id].push(tx);
    }
    return map;
  }, [transactions]);

  // Summary Metrics
  const summary = useMemo(() => {
    return calculateKhataBookSummary(parties, transactionsMap);
  }, [parties, transactionsMap]);

  // Party Cards Data
  const partyCardsData: PartySummaryCardData[] = useMemo(() => {
    return parties.map((p) => calculatePartyCardData(p, transactionsMap[p.id] || []));
  }, [parties, transactionsMap]);

  // Filtered Cards
  const filteredPartyCards = useMemo(() => {
    return partyCardsData.filter((card) => {
      const q = searchQuery.toLowerCase();
      const nameMatch = card.party.name.toLowerCase().includes(q);
      const companyMatch = (card.party.company_name || '').toLowerCase().includes(q);
      const mobileMatch = (card.party.mobile || '').includes(q);
      const matchesSearch = nameMatch || companyMatch || mobileMatch;

      if (!matchesSearch) return false;
      if (statusFilter !== 'all' && card.status !== statusFilter) return false;
      return true;
    });
  }, [partyCardsData, searchQuery, statusFilter]);

  const openAdjustmentDetail = (party: Party, filter: 'pending' | 'excess' | 'all') => {
    setDetailParty(party);
    setDetailFilter(filter);
    setDetailModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Summary Dashboard</h2>
          <p className="text-xs text-neutral-500">Real-time overview of party ledgers and balances</p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={loadData} icon={<RefreshCw className="h-4 w-4" />}>
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowPartyModal(true)} icon={<Plus className="h-4 w-4" />}>
            Add Party
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setSelectedPartyForTx(undefined);
              setShowTxModal(true);
            }}
            icon={<Plus className="h-4 w-4" />}
          >
            New Transaction
          </Button>
        </div>
      </div>

      {/* Summary Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <Card
            hover
            onClick={() => navigate('/khatabook/parties')}
            className="p-4 cursor-pointer border-l-4 border-l-brand-600 transition"
          >
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-bold uppercase tracking-wider">Total Parties</span>
              <Users className="h-4 w-4 text-brand-600" />
            </div>
            <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mt-2">{summary.total_parties}</p>
            <p className="text-[11px] text-neutral-500 mt-1 flex items-center gap-1">
              Active ledger accounts <ChevronRight className="h-3 w-3" />
            </p>
          </Card>

          <Card
            hover
            onClick={() => navigate('/khatabook/ledger')}
            className="p-4 cursor-pointer border-l-4 border-l-emerald-500 transition"
          >
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-bold uppercase tracking-wider">Total Received</span>
              <ArrowDownLeft className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">{formatINRNumber(summary.total_received)}</p>
            <p className="text-[11px] text-neutral-500 mt-1">From all parties</p>
          </Card>

          <Card
            hover
            onClick={() => navigate('/khatabook/ledger')}
            className="p-4 cursor-pointer border-l-4 border-l-amber-500 transition"
          >
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-bold uppercase tracking-wider">Cash Paid</span>
              <Wallet className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-2">{formatINRNumber(summary.total_cash_paid)}</p>
            <p className="text-[11px] text-neutral-500 mt-1">Physical cash payments</p>
          </Card>

          <Card
            hover
            onClick={() => navigate('/khatabook/ledger')}
            className="p-4 cursor-pointer border-l-4 border-l-blue-500 transition"
          >
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-bold uppercase tracking-wider">Online Paid</span>
              <CreditCard className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-2">{formatINRNumber(summary.total_online_paid)}</p>
            <p className="text-[11px] text-neutral-500 mt-1">UPI / Bank payments</p>
          </Card>

          <Card
            hover
            onClick={() => navigate('/khatabook/ledger')}
            className="p-4 cursor-pointer border-l-4 border-l-indigo-500 transition"
          >
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-bold uppercase tracking-wider">Total Paid</span>
              <DollarSign className="h-4 w-4 text-indigo-500" />
            </div>
            <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-2">{formatINRNumber(summary.total_paid)}</p>
            <p className="text-[11px] text-neutral-500 mt-1">Cash + Online total</p>
          </Card>

          <Card
            hover
            onClick={() => setStatusFilter('pending')}
            className={`p-4 cursor-pointer border-l-4 border-l-red-500 transition ${statusFilter === 'pending' ? 'ring-2 ring-red-500' : ''}`}
          >
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-bold uppercase tracking-wider">Current Pending</span>
              <Clock className="h-4 w-4 text-red-500" />
            </div>
            <p className="text-xl font-bold text-red-600 dark:text-red-400 mt-2">{formatINRNumber(summary.current_pending)}</p>
            <p className="text-[11px] text-neutral-500 mt-1">Pending dues to pay</p>
          </Card>

          <Card
            hover
            onClick={() => setStatusFilter('excess')}
            className={`p-4 cursor-pointer border-l-4 border-l-blue-600 transition ${statusFilter === 'excess' ? 'ring-2 ring-blue-600' : ''}`}
          >
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-bold uppercase tracking-wider">Current Excess</span>
              <ArrowUpRight className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-2">{formatINRNumber(summary.current_excess)}</p>
            <p className="text-[11px] text-neutral-500 mt-1">Excess paid to receive</p>
          </Card>

          <Card
            hover
            onClick={() => setStatusFilter('settled')}
            className={`p-4 cursor-pointer border-l-4 border-l-emerald-600 transition ${statusFilter === 'settled' ? 'ring-2 ring-emerald-600' : ''}`}
          >
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-bold uppercase tracking-wider">Settled Parties</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">{summary.settled_parties}</p>
            <p className="text-[11px] text-neutral-500 mt-1">Zero balance accounts</p>
          </Card>

          <Card
            hover
            onClick={() => navigate('/khatabook/ledger')}
            className="p-4 cursor-pointer border-l-4 border-l-purple-500 transition col-span-2 sm:col-span-1"
          >
            <div className="flex items-center justify-between text-neutral-500">
              <span className="text-xs font-bold uppercase tracking-wider">Today's Txns</span>
              <Calendar className="h-4 w-4 text-purple-500" />
            </div>
            <p className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-2">{summary.today_transactions_count}</p>
            <p className="text-[11px] text-neutral-500 mt-1">Recorded today</p>
          </Card>
        </div>
      )}

      {/* Party Dashboard Grid Header */}
      <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">Party Accounts</h3>
          <p className="text-xs text-neutral-500">Individual ledger status cards</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px]">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Search party, company, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-base pl-9 py-1.5 text-xs w-full"
            />
          </div>

          <div className="flex items-center rounded-xl bg-neutral-100 dark:bg-neutral-800 p-1 border border-neutral-200 dark:border-neutral-700 text-xs">
            {(['all', 'pending', 'excess', 'settled'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-lg font-semibold capitalize transition ${
                  statusFilter === st
                    ? 'bg-white dark:bg-neutral-900 text-brand-600 dark:text-brand-400 shadow-soft'
                    : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Party Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      ) : filteredPartyCards.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="No Party Accounts Found"
          message="Create your first party or change the filter criteria."
          action={
            <Button size="sm" onClick={() => setShowPartyModal(true)} icon={<Plus className="h-4 w-4" />}>
              Create Party
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPartyCards.map((card) => {
            const p = card.party;
            const pTxs = transactionsMap[p.id] || [];
            return (
              <Card
                key={p.id}
                className="p-5 flex flex-col justify-between space-y-4 hover:shadow-soft-lg transition border border-neutral-200 dark:border-neutral-800"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-base font-bold text-neutral-900 dark:text-neutral-100 leading-tight">
                      {p.name}
                    </h4>
                    {p.company_name && (
                      <p className="text-xs font-medium text-neutral-500 mt-0.5">{p.company_name}</p>
                    )}
                    {p.mobile && <p className="text-[11px] text-neutral-400 mt-0.5">📞 {p.mobile}</p>}
                  </div>
                  <Badge
                    color={
                      card.status === 'pending'
                        ? 'red'
                        : card.status === 'excess'
                        ? 'blue'
                        : 'green'
                    }
                  >
                    {card.status.toUpperCase()}
                  </Badge>
                </div>

                {/* Amount Totals */}
                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200/60 dark:border-neutral-800/60 text-xs">
                  <div>
                    <span className="text-[10px] text-neutral-400 font-semibold uppercase">Total Received</span>
                    <p className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {formatINRNumber(card.total_received)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 font-semibold uppercase">Total Paid</span>
                    <p className="font-semibold text-brand-600 dark:text-brand-400 mt-0.5">
                      {formatINRNumber(card.total_paid)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 font-semibold uppercase">Cash Paid</span>
                    <p className="font-medium text-neutral-700 dark:text-neutral-300 mt-0.5">
                      {formatINRNumber(card.cash_paid)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 font-semibold uppercase">Online Paid</span>
                    <p className="font-medium text-neutral-700 dark:text-neutral-300 mt-0.5">
                      {formatINRNumber(card.online_paid)}
                    </p>
                  </div>
                </div>

                {/* Balance Text Callout */}
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                    card.status === 'pending'
                      ? 'bg-red-50/60 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400'
                      : card.status === 'excess'
                      ? 'bg-blue-50/60 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400'
                      : 'bg-emerald-50/60 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                  }`}
                  onClick={() => openAdjustmentDetail(p, card.status === 'pending' ? 'pending' : card.status === 'excess' ? 'excess' : 'all')}
                >
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Current Balance</p>
                    <p className="text-sm font-bold mt-0.5">{card.balance_text}</p>
                  </div>
                  <Layers className="h-4 w-4 shrink-0 opacity-70" />
                </div>

                {/* Footer Actions */}
                <div className="pt-2 flex items-center justify-between text-xs border-t border-neutral-100 dark:border-neutral-800">
                  <span className="text-neutral-400">
                    {card.last_transaction_date ? `Last: ${card.last_transaction_date}` : 'No transactions'}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedPartyForTx(p.id);
                        setShowTxModal(true);
                      }}
                    >
                      + Entry
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/khatabook/ledger?party_id=${p.id}`)}
                    >
                      Ledger
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <PartyModal
        open={showPartyModal}
        onClose={() => setShowPartyModal(false)}
        selectedHubId={effectiveHubId}
        onSave={async (input) => {
          const { createParty } = await import('@/lib/khatabook');
          await createParty(input, profile?.id);
          loadData();
        }}
      />

      <TransactionModal
        open={showTxModal}
        onClose={() => setShowTxModal(false)}
        parties={parties}
        defaultPartyId={selectedPartyForTx}
        selectedHubId={effectiveHubId}
        onSave={async (input) => {
          const { createPartyTransaction } = await import('@/lib/khatabook');
          await createPartyTransaction(input, profile?.id);
          loadData();
        }}
      />

      {detailParty && (
        <AdjustmentDetailModal
          open={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          party={detailParty}
          filterType={detailFilter}
          ledgerEntries={calculateRunningLedger(detailParty, transactionsMap[detailParty.id] || [])}
        />
      )}
    </div>
  );
}
