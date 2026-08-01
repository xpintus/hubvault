import { useToast } from '@/components/ui/Toast';
import { Badge,Button,Card,EmptyState,Input,Select,Skeleton } from '@/components/ui/primitives';
import { useAuth } from '@/lib/auth';
import { useHub } from '@/lib/hubContext';
import {
calculatePartyCardData,
calculateRunningLedger,
fetchParties,
fetchPartyTransactions,
formatINRNumber,
} from '@/lib/khatabook';
import { exportPartyLedgerToExcel,exportPartySummaryToExcel,printKhataBookReport } from '@/lib/khatabookExport';
import { Party,PartySummaryCardData,PartyTransaction } from '@/types';
import {
Download,
FileText,
Printer
} from 'lucide-react';
import { useCallback,useEffect,useMemo,useState } from 'react';

export type ReportType =
  | 'party_statement'
  | 'ledger_statement'
  | 'pending_report'
  | 'excess_report'
  | 'cash_report'
  | 'online_report'
  | 'monthly_report';

export default function Reports() {
  const toast = useToast();
  const { profile } = useAuth();
  const hubCtx = useHub();
  const isSuperAdmin = profile?.role === 'super_admin';
  const effectiveHubId = hubCtx.selectedHubId || null;

  const [loading, setLoading] = useState(true);
  const [parties, setParties] = useState<Party[]>([]);
  const [transactions, setTransactions] = useState<PartyTransaction[]>([]);

  // Report filters
  const [reportType, setReportType] = useState<ReportType>('party_statement');
  const [selectedPartyId, setSelectedPartyId] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const loadData = useCallback(async () => {
    setLoading(true);
    if (!isSuperAdmin && !effectiveHubId) {
      setParties([]);
      setTransactions([]);
      setLoading(false);
      return;
    }
    try {
      const pData = await fetchParties(effectiveHubId);
      const tData = await fetchPartyTransactions(undefined, effectiveHubId);
      setParties(pData);
      setTransactions(tData);
      } catch (_err) {
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  }, [effectiveHubId, isSuperAdmin, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Group transactions by party_id
  const txMap = useMemo(() => {
    const map: Record<string, PartyTransaction[]> = {};
    for (const t of transactions) {
      if (!map[t.party_id]) map[t.party_id] = [];
      map[t.party_id].push(t);
    }
    return map;
  }, [transactions]);

  // Selected party object
  const selectedParty = useMemo(() => {
    return parties.find((p) => p.id === selectedPartyId) || null;
  }, [parties, selectedPartyId]);

  // Compute card summaries for all parties
  const partySummaries: PartySummaryCardData[] = useMemo(() => {
    return parties.map((p) => calculatePartyCardData(p, txMap[p.id] || []));
  }, [parties, txMap]);

  // Filtered transactions according to date range and party selection
  const filteredTxs = useMemo(() => {
    return transactions.filter((t) => {
      if (selectedPartyId && t.party_id !== selectedPartyId) return false;
      if (fromDate && t.transaction_date < fromDate) return false;
      if (toDate && t.transaction_date > toDate) return false;
      return true;
    });
  }, [transactions, selectedPartyId, fromDate, toDate]);

  // Calculated ledger entries
  const ledgerEntries = useMemo(() => {
    if (selectedParty) {
      return calculateRunningLedger(selectedParty, filteredTxs);
    }
    const dummy: Party = {
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
    return calculateRunningLedger(dummy, filteredTxs);
  }, [selectedParty, filteredTxs]);

  // Report-specific display entries
  const reportDisplayEntries = useMemo(() => {
    switch (reportType) {
      case 'pending_report':
        return ledgerEntries.filter((e) => e.running_balance > 0);
      case 'excess_report':
        return ledgerEntries.filter((e) => e.running_balance < 0);
      case 'cash_report':
        return ledgerEntries.filter((e) => e.cash_paid > 0);
      case 'online_report':
        return ledgerEntries.filter((e) => e.online_paid > 0);
      case 'monthly_report': {
        const startOfMonthStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        return ledgerEntries.filter((e) => e.transaction_date >= startOfMonthStr);
      }
      default:
        return ledgerEntries;
    }
  }, [reportType, ledgerEntries]);

  // Report-specific summary cards
  const reportDisplaySummaries = useMemo(() => {
    switch (reportType) {
      case 'pending_report':
        return partySummaries.filter((s) => s.status === 'pending');
      case 'excess_report':
        return partySummaries.filter((s) => s.status === 'excess');
      default:
        return partySummaries;
    }
  }, [reportType, partySummaries]);

  const handleExportExcel = () => {
    if (reportType === 'party_statement' && !selectedPartyId) {
      exportPartySummaryToExcel(reportDisplaySummaries, 'parties-summary-report.xlsx');
    } else {
      exportPartyLedgerToExcel(
        selectedParty,
        reportDisplayEntries,
        `${reportType}-${selectedParty ? selectedParty.name : 'statement'}.xlsx`
      );
    }
    toast.success('Report exported to Excel successfully');
  };

  const handlePrint = () => {
    printKhataBookReport(
      `KhataBook Report: ${reportType.replace('_', ' ').toUpperCase()}`,
      selectedParty,
      reportDisplayEntries
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Reports Hub</h2>
          <p className="text-xs text-neutral-500">Generate Party Statements, Pending/Excess Dues, Cash & Online Reports</p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={handleExportExcel} icon={<Download className="h-4 w-4" />}>
            Export Excel
          </Button>
          <Button size="sm" onClick={handlePrint} icon={<Printer className="h-4 w-4" />}>
            Print Report
          </Button>
        </div>
      </div>

      {/* Report Selector Controls */}
      <Card className="p-4 border border-neutral-200 dark:border-neutral-800 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <Select
            label="Select Report Type"
            value={reportType}
            onChange={(e) => setReportType(e.target.value as ReportType)}
          >
            <option value="party_statement">Party Statement</option>
            <option value="ledger_statement">Detailed Ledger Statement</option>
            <option value="pending_report">Pending Dues Report</option>
            <option value="excess_report">Excess Payments Report</option>
            <option value="cash_report">Cash Payments Report</option>
            <option value="online_report">Online Payments Report</option>
            <option value="monthly_report">Current Month Report</option>
          </Select>

          <Select
            label="Select Party (Optional)"
            value={selectedPartyId}
            onChange={(e) => setSelectedPartyId(e.target.value)}
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
        </div>
      </Card>

      {/* Report Data Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : reportDisplayEntries.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="No Data Available for Report"
          message="Adjust date ranges or filters to generate the report view."
        />
      ) : (
        <Card className="overflow-hidden border border-neutral-200 dark:border-neutral-800">
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wide">
              {reportType.replace(/_/g, ' ')} ({reportDisplayEntries.length} entries)
            </h3>
            {selectedParty && (
              <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">
                {selectedParty.name}
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 uppercase tracking-wider font-semibold">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Party Name</th>
                  <th className="px-4 py-3 text-right">Received Amount</th>
                  <th className="px-4 py-3 text-right">Cash Paid</th>
                  <th className="px-4 py-3 text-right">Online Paid</th>
                  <th className="px-4 py-3 text-right">Total Paid</th>
                  <th className="px-4 py-3 text-right">Running Balance</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3">Remarks / Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {reportDisplayEntries.map((e) => (
                  <tr key={e.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40 transition">
                    <td className="px-4 py-3.5 font-medium whitespace-nowrap text-neutral-800 dark:text-neutral-200">
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
                    <td className="px-4 py-3.5 text-neutral-500 truncate max-w-[180px]">
                      {e.remarks || e.payment_reference || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
