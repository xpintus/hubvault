import { Button } from '@/components/ui/primitives';
import { formatDate, formatINR } from '@/lib/format';
import { exportRecoveryReportsExcel } from '@/lib/riderDuesService';
import { RiderDue, RiderDueRecovery, RiderLedgerSummary } from '@/types';
import {
  AlertTriangle,
  Building2,
  FileSpreadsheet,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';

interface RecoveryReportsViewProps {
  riderSummaries: RiderLedgerSummary[];
  allDues: RiderDue[];
  allRecoveries: RiderDueRecovery[];
}

type ReportSubTab =
  | 'daily'
  | 'monthly'
  | 'riderWise'
  | 'hubWise'
  | 'categoryWise'
  | 'pending'
  | 'overdue';

export default function RecoveryReportsView({
  riderSummaries,
  allDues,
  allRecoveries,
}: RecoveryReportsViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<ReportSubTab>('daily');

  // Non-reversed recoveries only
  const validRecoveries = useMemo(
    () => allRecoveries.filter((r) => !r.is_reversed),
    [allRecoveries]
  );

  // 1. Daily Recovery Aggregation
  const dailyReport = useMemo(() => {
    const map = new Map<string, { amount: number; count: number }>();
    for (const r of validRecoveries) {
      const d = r.recovery_date;
      const current = map.get(d) || { amount: 0, count: 0 };
      current.amount += r.amount;
      current.count += 1;
      map.set(d, current);
    }
    return Array.from(map.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [validRecoveries]);

  // 2. Monthly Recovery Aggregation
  const monthlyReport = useMemo(() => {
    const map = new Map<string, { amount: number; count: number }>();
    for (const r of validRecoveries) {
      const month = r.recovery_date.slice(0, 7); // YYYY-MM
      const current = map.get(month) || { amount: 0, count: 0 };
      current.amount += r.amount;
      current.count += 1;
      map.set(month, current);
    }
    return Array.from(map.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [validRecoveries]);

  // 3. Rider-Wise Recovery (Leaderboard)
  const riderWiseReport = useMemo(() => {
    return riderSummaries
      .filter((s) => s.totalRecovered > 0 || s.totalDues > 0)
      .sort((a, b) => b.totalRecovered - a.totalRecovered)
      .map((s) => ({
        riderName: s.riderName,
        feId: s.feId,
        phone: s.phone,
        hubName: s.hubName,
        recovered: s.totalRecovered,
        totalDues: s.totalDues,
        outstanding: s.outstandingBalance,
        rate: s.totalDues > 0 ? Math.round((s.totalRecovered / s.totalDues) * 100) : 100,
      }));
  }, [riderSummaries]);

  // 4. Hub-Wise Recovery Aggregation
  const hubWiseReport = useMemo(() => {
    const map = new Map<
      string,
      { hubName: string; totalDues: number; recovered: number; outstanding: number }
    >();
    for (const s of riderSummaries) {
      const hubName = s.hubName || 'Main Hub';
      const current = map.get(hubName) || {
        hubName,
        totalDues: 0,
        recovered: 0,
        outstanding: 0,
      };
      current.totalDues += s.totalDues;
      current.recovered += s.totalRecovered;
      current.outstanding += s.outstandingBalance;
      map.set(hubName, current);
    }
    return Array.from(map.values()).sort((a, b) => b.recovered - a.recovered);
  }, [riderSummaries]);

  // 5. Category-Wise Dues Aggregation
  const categoryWiseReport = useMemo(() => {
    const map = new Map<string, { count: number; totalAmount: number; recovered: number }>();
    for (const d of allDues) {
      if (d.status === 'cancelled') continue;
      const cat = d.category || 'Other';
      const current = map.get(cat) || { count: 0, totalAmount: 0, recovered: 0 };
      current.count += 1;
      current.totalAmount += d.amount;
      current.recovered += d.recovered_amount;
      map.set(cat, current);
    }
    return Array.from(map.entries())
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [allDues]);

  // 6. Pending Dues Report (All riders with balance > 0)
  const pendingReport = useMemo(() => {
    return riderSummaries
      .filter((s) => s.outstandingBalance > 0)
      .sort((a, b) => b.outstandingBalance - a.outstandingBalance);
  }, [riderSummaries]);

  // 7. Overdue Dues Report (Riders with active dues > 7 days old)
  const overdueReport = useMemo(() => {
    return riderSummaries
      .filter((s) => s.status === 'Overdue' && s.outstandingBalance > 0)
      .map((s) => {
        let daysOverdue = 0;
        if (s.oldestDueDate) {
          const diff = new Date().getTime() - new Date(s.oldestDueDate).getTime();
          daysOverdue = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
        }
        return {
          riderName: s.riderName,
          feId: s.feId,
          phone: s.phone,
          hubName: s.hubName,
          amount: s.outstandingBalance,
          oldestDueDate: s.oldestDueDate || 'N/A',
          daysOverdue,
        };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [riderSummaries]);

  const handleExportAll = () => {
    exportRecoveryReportsExcel({
      daily: dailyReport,
      riderWise: riderWiseReport,
      hubWise: hubWiseReport,
      categoryWise: categoryWiseReport,
      overdueList: overdueReport,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Controls & Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Sub Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveSubTab('daily')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'daily'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Daily Recovery
          </button>
          <button
            onClick={() => setActiveSubTab('monthly')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'monthly'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Monthly Trends
          </button>
          <button
            onClick={() => setActiveSubTab('riderWise')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'riderWise'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Rider Leaderboard
          </button>
          <button
            onClick={() => setActiveSubTab('hubWise')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'hubWise'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Hub-Wise Matrix
          </button>
          <button
            onClick={() => setActiveSubTab('categoryWise')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'categoryWise'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Category Dues
          </button>
          <button
            onClick={() => setActiveSubTab('pending')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'pending'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Pending Dues ({pendingReport.length})
          </button>
          <button
            onClick={() => setActiveSubTab('overdue')}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'overdue'
                ? 'bg-rose-600 text-white'
                : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
            }`}
          >
            Overdue Dues ({overdueReport.length})
          </button>
        </div>

        {/* Global Excel Export */}
        <Button
          variant="secondary"
          size="sm"
          onClick={handleExportAll}
          className="inline-flex items-center gap-1.5 shrink-0"
        >
          <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
          <span>Export All Recovery Reports (.xlsx)</span>
        </Button>
      </div>

      {/* REPORT 1: Daily Recovery */}
      {activeSubTab === 'daily' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Daily Recovery Collection Register
              </h3>
              <p className="text-xs text-slate-500">Day-by-day recovered dues amounts</p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
              Total Days: {dailyReport.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Recovery Count</th>
                  <th className="py-3 px-4 text-right">Total Recovered (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {dailyReport.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-400 font-sans">
                      No recovery payments recorded in this period.
                    </td>
                  </tr>
                ) : (
                  dailyReport.map((row) => (
                    <tr key={row.date} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-sans font-semibold text-slate-900 dark:text-white">
                        {formatDate(row.date)}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {row.count} recoveries
                      </td>
                      <td className="py-3 px-4 text-right font-black text-emerald-600 dark:text-emerald-400">
                        {formatINR(row.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 2: Monthly Trends */}
      {activeSubTab === 'monthly' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Monthly Dues Recovery Summary
            </h3>
            <p className="text-xs text-slate-500">Month-over-month recovery totals</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Month</th>
                  <th className="py-3 px-4">Transactions</th>
                  <th className="py-3 px-4 text-right">Total Recovered (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {monthlyReport.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-400 font-sans">
                      No recovery records found.
                    </td>
                  </tr>
                ) : (
                  monthlyReport.map((row) => (
                    <tr key={row.month} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-sans font-bold text-slate-900 dark:text-white">
                        {row.month}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {row.count} entries
                      </td>
                      <td className="py-3 px-4 text-right font-black text-emerald-600 dark:text-emerald-400">
                        {formatINR(row.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 3: Rider Leaderboard */}
      {activeSubTab === 'riderWise' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Rider Dues &amp; Recovery Leaderboard
              </h3>
              <p className="text-xs text-slate-500">Ranked by total amount recovered</p>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              {riderWiseReport.length} riders
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Rider Name</th>
                  <th className="py-3 px-4">FE ID</th>
                  <th className="py-3 px-4">Hub</th>
                  <th className="py-3 px-4 text-right">Total Dues</th>
                  <th className="py-3 px-4 text-right">Recovered</th>
                  <th className="py-3 px-4 text-right">Outstanding</th>
                  <th className="py-3 px-4 text-right">Recovery Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {riderWiseReport.map((r, i) => (
                  <tr key={r.feId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-bold text-slate-400 font-sans">#{i + 1}</td>
                    <td className="py-3 px-4 font-sans font-bold text-slate-900 dark:text-white">
                      {r.riderName}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{r.feId}</td>
                    <td className="py-3 px-4 font-sans text-slate-500">{r.hubName}</td>
                    <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">
                      {formatINR(r.totalDues)}
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400 font-bold">
                      {formatINR(r.recovered)}
                    </td>
                    <td className="py-3 px-4 text-right text-rose-600 dark:text-rose-400 font-bold">
                      {formatINR(r.outstanding)}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-indigo-600 dark:text-indigo-400">
                      {r.rate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 4: Hub-Wise Matrix */}
      {activeSubTab === 'hubWise' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Hub-Wise Dues &amp; Recovery Matrix
            </h3>
            <p className="text-xs text-slate-500">Cross-station performance and recovery totals</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Hub / Station</th>
                  <th className="py-3 px-4 text-right">Total Dues (₹)</th>
                  <th className="py-3 px-4 text-right">Total Recovered (₹)</th>
                  <th className="py-3 px-4 text-right">Outstanding (₹)</th>
                  <th className="py-3 px-4 text-right">Recovery Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {hubWiseReport.map((h) => {
                  const rate =
                    h.totalDues > 0 ? Math.round((h.recovered / h.totalDues) * 100) : 100;
                  return (
                    <tr key={h.hubName} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-sans font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-indigo-500" />
                        {h.hubName}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">
                        {formatINR(h.totalDues)}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400 font-bold">
                        {formatINR(h.recovered)}
                      </td>
                      <td className="py-3 px-4 text-right text-rose-600 dark:text-rose-400 font-bold">
                        {formatINR(h.outstanding)}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-indigo-600 dark:text-indigo-400">
                        {rate}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 5: Category Dues */}
      {activeSubTab === 'categoryWise' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Category-Wise Dues Distribution
            </h3>
            <p className="text-xs text-slate-500">Breakdown of root causes for rider shortages</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Dues Category</th>
                  <th className="py-3 px-4">Entries Count</th>
                  <th className="py-3 px-4 text-right">Total Dues (₹)</th>
                  <th className="py-3 px-4 text-right">Recovered (₹)</th>
                  <th className="py-3 px-4 text-right">Pending (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {categoryWiseReport.map((c) => (
                  <tr key={c.category} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-sans font-bold text-slate-900 dark:text-white">
                      {c.category}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{c.count}</td>
                    <td className="py-3 px-4 text-right text-slate-900 dark:text-white font-bold">
                      {formatINR(c.totalAmount)}
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400">
                      {formatINR(c.recovered)}
                    </td>
                    <td className="py-3 px-4 text-right text-rose-600 dark:text-rose-400 font-bold">
                      {formatINR(c.totalAmount - c.recovered)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 6: Pending Dues */}
      {activeSubTab === 'pending' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              All Riders With Pending Dues
            </h3>
            <p className="text-xs text-slate-500">Active balances awaiting full settlement</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Rider</th>
                  <th className="py-3 px-4">FE ID</th>
                  <th className="py-3 px-4">Mobile</th>
                  <th className="py-3 px-4">Hub</th>
                  <th className="py-3 px-4 text-right">Total Dues</th>
                  <th className="py-3 px-4 text-right">Recovered</th>
                  <th className="py-3 px-4 text-right">Pending Balance (₹)</th>
                  <th className="py-3 px-4">Oldest Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {pendingReport.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                      All rider accounts are fully reconciled! No pending dues.
                    </td>
                  </tr>
                ) : (
                  pendingReport.map((s) => (
                    <tr key={s.riderId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-sans font-bold text-slate-900 dark:text-white">
                        {s.riderName}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{s.feId}</td>
                      <td className="py-3 px-4 text-slate-500">{s.phone}</td>
                      <td className="py-3 px-4 font-sans text-slate-500">{s.hubName}</td>
                      <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">
                        {formatINR(s.totalDues)}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-600 dark:text-emerald-400">
                        {formatINR(s.totalRecovered)}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-rose-600 dark:text-rose-400">
                        {formatINR(s.outstandingBalance)}
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-500">
                        {s.oldestDueDate ? formatDate(s.oldestDueDate) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 7: Overdue Dues */}
      {activeSubTab === 'overdue' && (
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-rose-100 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
              <div>
                <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200">
                  Critical Overdue Dues Report
                </h3>
                <p className="text-xs text-rose-600 dark:text-rose-400">
                  Dues unpaid for more than 7 days from origination date
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/50 px-2.5 py-1 rounded-full">
              {overdueReport.length} riders overdue
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Rider</th>
                  <th className="py-3 px-4">FE ID</th>
                  <th className="py-3 px-4">Mobile</th>
                  <th className="py-3 px-4">Hub</th>
                  <th className="py-3 px-4 text-right">Overdue Balance (₹)</th>
                  <th className="py-3 px-4">Oldest Due Date</th>
                  <th className="py-3 px-4 text-right">Days Past Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {overdueReport.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                      Awesome! Zero overdue dues beyond 7 days across all riders.
                    </td>
                  </tr>
                ) : (
                  overdueReport.map((o) => (
                    <tr
                      key={o.feId}
                      className="hover:bg-rose-50/40 dark:hover:bg-rose-950/20 transition"
                    >
                      <td className="py-3 px-4 font-sans font-bold text-slate-900 dark:text-white">
                        {o.riderName}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{o.feId}</td>
                      <td className="py-3 px-4 text-slate-500">{o.phone}</td>
                      <td className="py-3 px-4 font-sans text-slate-500">{o.hubName}</td>
                      <td className="py-3 px-4 text-right font-black text-rose-600 dark:text-rose-400">
                        {formatINR(o.amount)}
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-500">
                        {formatDate(o.oldestDueDate)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-rose-600 dark:text-rose-400">
                        {o.daysOverdue} days
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
