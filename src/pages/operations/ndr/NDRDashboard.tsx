import React, { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useHub } from '@/lib/hubContext';
import { fetchNDRMetrics } from '@/lib/ndr/ndrService';
import { NDRMetrics } from '@/types/ndr';
import {
  Archive,
  ArrowRight,
  CheckCircle2,
  Clock,
  PhoneCall,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Truck,
} from 'lucide-react';

export default function NDRDashboard() {
  const { selectedHub } = useHub();
  const { refreshTrigger } = useOutletContext<{ refreshTrigger: number }>();
  const navigate = useNavigate();

  const [metrics, setMetrics] = useState<NDRMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchNDRMetrics(selectedHub?.id || null)
      .then((data) => {
        console.log('Dashboard Data', data);
        setMetrics(data);
      })
      .finally(() => setLoading(false));
  }, [selectedHub, refreshTrigger]);

  if (loading || !metrics) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3 text-neutral-500">
        <RefreshCw className="h-8 w-8 animate-spin text-brand-600" />
        <p className="text-sm font-medium">Loading NDR Dashboard Analytics...</p>
      </div>
    );
  }

  const kpiCards = [
    {
      label: 'Total Active NDR',
      value: metrics.totalActive,
      icon: Archive,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10 border-blue-500/20',
      route: '/operations/ndr/shipments',
    },
    {
      label: 'Calling Pending',
      value: metrics.callingPending,
      icon: PhoneCall,
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-500/10 border-cyan-500/20',
      route: '/operations/ndr/my-queue',
    },
    {
      label: 'Supervisor Pending',
      value: metrics.supervisorPending,
      icon: ShieldCheck,
      color: 'text-rose-500',
      bgColor: 'bg-rose-500/10 border-rose-500/20',
      route: '/operations/ndr/shipments?workflowStatus=Supervisor Pending',
    },
    {
      label: 'Follow-up Today',
      value: metrics.followUpToday,
      icon: Clock,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10 border-purple-500/20',
      route: '/operations/ndr/shipments?workflowStatus=Follow-up',
    },
    {
      label: 'Delivered After NDR',
      value: metrics.deliveredAfterNdr,
      icon: CheckCircle2,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10 border-emerald-500/20',
      route: '/operations/ndr/shipments?workflowStatus=Delivered',
    },
    {
      label: 'RTO Closed',
      value: metrics.rtoClosed,
      icon: RotateCcw,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10 border-red-500/20',
      route: '/operations/ndr/shipments?workflowStatus=RTO',
    },
  ];

  const attemptBreakdown = [
    {
      label: '1st Attempt',
      count: metrics.attempt1Count,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-500/10 border-emerald-500/20',
      route: '/operations/ndr/shipments?attempts=1',
    },
    {
      label: '2nd Attempt',
      count: metrics.attempt2Count,
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-500/10 border-orange-500/20',
      route: '/operations/ndr/shipments?attempts=2',
    },
    {
      label: '3rd Attempt',
      count: metrics.attempt3Count,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-500/10 border-red-500/20',
      route: '/operations/ndr/shipments?attempts=3',
    },
    {
      label: '4th+ Attempt',
      count: metrics.attempt4PlusCount,
      color: 'text-rose-700 dark:text-rose-400',
      bgColor: 'bg-rose-500/10 border-rose-500/20',
      route: '/operations/ndr/shipments?attempts=3+',
    },
  ];

  return (
    <div className="space-y-6">
      {/* 6 Essential Operational Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              onClick={() => navigate(card.route)}
              className={`p-6 rounded-2xl border transition-all cursor-pointer group flex flex-col justify-between hover:shadow-lg ${card.bgColor}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-wider uppercase text-neutral-600 dark:text-neutral-400">
                  {card.label}
                </span>
                <Icon className={`h-6 w-6 ${card.color} group-hover:scale-110 transition-transform`} />
              </div>
              <div className="mt-4 flex items-baseline justify-between">
                <span className={`text-4xl font-black ${card.color}`}>
                  {card.value}
                </span>
                <span className="text-xs font-semibold text-neutral-500 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  View Queue <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Today's OFD Attempts Section */}
      <div className="p-6 rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
                Today's OFD Attempts Breakdown
              </h2>
              <p className="text-xs text-neutral-500">Delivery attempt distribution calculated from imported DRS files.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold">
            Total OFD Attempts Today: <span className="text-sm font-black">{metrics.totalOfdAttemptsToday}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {attemptBreakdown.map((item) => (
            <div
              key={item.label}
              onClick={() => navigate(item.route)}
              className={`p-4 rounded-xl border transition cursor-pointer group flex flex-col justify-between hover:shadow-md ${item.bgColor}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400">{item.label}</span>
                <ArrowRight className="h-3.5 w-3.5 text-neutral-400 group-hover:translate-x-1 transition-transform" />
              </div>
              <span className={`text-2xl font-black mt-2 ${item.color}`}>{item.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
