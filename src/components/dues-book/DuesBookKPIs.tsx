import { formatINR } from '@/lib/format';
import { RiderDuesKPIs } from '@/types';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import React from 'react';

interface DuesBookKPIsProps {
  kpis: RiderDuesKPIs;
  loading?: boolean;
}

export default function DuesBookKPIs({ kpis, loading = false }: DuesBookKPIsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 animate-pulse"
          >
            <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded mb-3" />
            <div className="h-7 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: 'Riders with Dues',
      value: kpis.totalRidersWithDues.toLocaleString('en-IN'),
      subtext: 'Active field staff with balance',
      icon: Users,
      color: 'text-indigo-600 dark:text-indigo-400',
      bgColor: 'bg-indigo-50 dark:bg-indigo-950/40',
      borderColor: 'border-indigo-100 dark:border-indigo-900/50',
    },
    {
      title: 'Total Outstanding',
      value: formatINR(kpis.totalOutstandingAmount),
      subtext: 'Pending collection balance',
      icon: AlertTriangle,
      color: 'text-rose-600 dark:text-rose-400',
      bgColor: 'bg-rose-50 dark:bg-rose-950/40',
      borderColor: 'border-rose-100 dark:border-rose-900/50',
      isPrimaryRed: true,
    },
    {
      title: 'Total Dues Generated',
      value: formatINR(kpis.totalDuesGenerated),
      subtext: 'All recorded short/due entries',
      icon: Wallet,
      color: 'text-slate-800 dark:text-slate-200',
      bgColor: 'bg-slate-50 dark:bg-slate-800/60',
      borderColor: 'border-slate-200 dark:border-slate-800',
    },
    {
      title: 'Total Recovered',
      value: formatINR(kpis.totalAmountRecovered),
      subtext: `${
        kpis.totalDuesGenerated > 0
          ? ((kpis.totalAmountRecovered / kpis.totalDuesGenerated) * 100).toFixed(1)
          : '0'
      }% recovery rate`,
      icon: CheckCircle2,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
      borderColor: 'border-emerald-100 dark:border-emerald-900/50',
      isPrimaryGreen: true,
    },
    {
      title: "Today's Recovery",
      value: formatINR(kpis.todaysRecovery),
      subtext: 'Recovered today so far',
      icon: TrendingUp,
      color: 'text-teal-600 dark:text-teal-400',
      bgColor: 'bg-teal-50 dark:bg-teal-950/40',
      borderColor: 'border-teal-100 dark:border-teal-900/50',
    },
    {
      title: 'Overdue Amount',
      value: formatINR(kpis.overdueAmount),
      subtext: 'Unsettled dues > 7 days',
      icon: Clock,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-950/40',
      borderColor: 'border-amber-100 dark:border-amber-900/50',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className={`relative rounded-2xl bg-white dark:bg-slate-900 border ${card.borderColor} p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-tight">
                {card.title}
              </span>
              <div className={`p-1.5 rounded-xl ${card.bgColor} ${card.color}`}>
                <Icon className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-1">
              <div
                className={`text-xl font-bold tracking-tight ${
                  card.isPrimaryRed
                    ? 'text-rose-600 dark:text-rose-400'
                    : card.isPrimaryGreen
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-900 dark:text-white'
                }`}
              >
                {card.value}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {card.subtext}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
