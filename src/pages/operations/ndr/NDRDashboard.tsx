import React, { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useHub } from '@/lib/hubContext';
import { fetchNDRMetrics } from '@/lib/ndr/ndrService';
import { NDR_REASON_FILTERS, NDR_WORKFLOW_STATUS } from '@/lib/ndr/ndrConstants';
import { NDRMetrics } from '@/types/ndr';

import {
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowRight,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  FileBarChart2,
  History,
  PackageCheck,
  PhoneCall,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Truck,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

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
        console.log("Dashboard Data", data);
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

  // Chart Mock Data Derived from Real Metrics
  const chartPipeline = [
    { name: 'Imported', count: metrics.totalImported, fill: '#3b82f6' },
    { name: 'Pending Call', count: metrics.callingPending, fill: '#60a5fa' },
    { name: 'Contacted', count: metrics.contacted, fill: '#06b6d4' },
    { name: 'Supervisor', count: metrics.supervisorPending, fill: '#f43f5e' },
    { name: 'Reattempt Appr.', count: metrics.reattemptApproved, fill: '#6366f1' },
    { name: 'Delivered NDR', count: metrics.deliveredAfterNdr, fill: '#10b981' },
    { name: 'RTO', count: metrics.rto, fill: '#ef4444' },
  ];

  const reasonPieData = [
    { name: 'Customer Refused', value: metrics.customerRefused || 1, color: '#f97316' },
    { name: 'Not Reachable', value: metrics.customerNotReachable || 1, color: '#06b6d4' },
    { name: 'OTP Issues', value: metrics.otpIssues || 1, color: '#eab308' },
    { name: 'Fake Attempt', value: metrics.fakeAttempt || 1, color: '#ef4444' },
    { name: 'Future Delivery', value: metrics.futureDelivery || 1, color: '#8b5cf6' },
  ];

  const kpiCards = [


    { label: 'Total Imported', value: metrics.totalImported, icon: Archive, color: 'text-blue-500', route: '/operations/ndr/shipments' },
    { label: 'Calling Pending', value: metrics.callingPending, icon: PhoneCall, color: 'text-cyan-500', route: `/operations/ndr/shipments?workflowStatus=${encodeURIComponent(NDR_WORKFLOW_STATUS.CALLING_PENDING)}` },
    { label: 'Contacted', value: metrics.contacted, icon: UserCheck, color: 'text-indigo-500', route: `/operations/ndr/shipments?workflowStatus=${encodeURIComponent(NDR_WORKFLOW_STATUS.CUSTOMER_CONTACTED)}` },
    { label: 'Supervisor Pending', value: metrics.supervisorPending, icon: ShieldCheck, color: 'text-rose-500', route: '/operations/ndr/supervisor-review' },
    { label: 'Follow-up Due', value: metrics.followUpDue, icon: Clock, color: 'text-purple-500', route: '/operations/ndr/follow-up' },
    { label: 'Reattempt Approved', value: metrics.reattemptApproved, icon: Truck, color: 'text-amber-500', route: '/operations/ndr/reattempt-queue' },
    { label: 'Out For Delivery', value: metrics.outForDelivery, icon: PackageCheck, color: 'text-orange-500', route: '/operations/ndr/reattempt-queue' },
    { label: 'Delivered After NDR', value: metrics.deliveredAfterNdr, icon: CheckCircle2, color: 'text-emerald-500 font-bold', route: '/operations/ndr/delivered' },
    { label: 'RTO Queue', value: metrics.rto, icon: RotateCcw, color: 'text-red-500 font-bold', route: '/operations/ndr/rto-queue' },
    { label: 'OTP Issues', value: metrics.otpIssues, icon: AlertTriangle, color: 'text-yellow-500', route: `/operations/ndr/shipments?otpStatus=${NDR_REASON_FILTERS.OTP}` },
    { label: 'Fake Attempt', value: metrics.fakeAttempt, icon: AlertCircle, color: 'text-rose-600 font-bold', route: `/operations/ndr/shipments?reason=${NDR_REASON_FILTERS.FAKE}` },
    { label: 'Wrong NDR', value: metrics.wrongNdr, icon: AlertCircle, color: 'text-pink-500', route: `/operations/ndr/shipments?reason=${NDR_REASON_FILTERS.WRONG}` },
    { label: 'Future Delivery', value: metrics.futureDelivery, icon: CalendarCheck2, color: 'text-purple-600', route: `/operations/ndr/shipments?reason=${NDR_REASON_FILTERS.FUTURE}` },
    { label: 'Customer Refused', value: metrics.customerRefused, icon: AlertTriangle, color: 'text-amber-600', route: `/operations/ndr/shipments?reason=${NDR_REASON_FILTERS.REFUSED}` },
    { label: 'Customer Unreachable', value: metrics.customerNotReachable, icon: PhoneCall, color: 'text-blue-400', route: `/operations/ndr/shipments?reason=${NDR_REASON_FILTERS.UNREACHABLE}` },
    { label: 'Aging > 24 Hours', value: metrics.above24Hours, icon: Clock, color: 'text-yellow-600 font-bold', route: '/operations/ndr/shipments?aging=24' },
    { label: 'Aging > 48 Hours', value: metrics.above48Hours, icon: Clock, color: 'text-orange-600 font-bold', route: '/operations/ndr/shipments?aging=48' },
    { label: 'Aging > 72 Hours', value: metrics.above72Hours, icon: Clock, color: 'text-red-600 font-bold', route: '/operations/ndr/shipments?aging=72' },
  ];



  return (
    <div className="space-y-6">
      {/* 18+ Interactive KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              onClick={() => navigate(card.route)}
              className="p-4 rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 hover:border-brand-500 dark:hover:border-brand-400 shadow-sm hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-neutral-500 truncate">{card.label}</span>
                <Icon className={`h-4 w-4 ${card.color} shrink-0 group-hover:scale-110 transition`} />
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className={`text-2xl font-black text-neutral-900 dark:text-neutral-100 ${card.color}`}>
                  {card.value}
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-neutral-400 opacity-0 group-hover:opacity-100 transition" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Visual Analytics Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Bar Chart */}
        <div className="p-6 rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
              NDR Workflow Pipeline
            </h3>
            <span className="text-xs text-neutral-500 font-mono">Live Volume</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartPipeline}>
                <XAxis dataKey="name" stroke="#888888" fontSize={10} tickLine={false} />
                <YAxis stroke="#888888" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card-bg)',
                    borderColor: 'rgba(128,128,128,0.2)',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {chartPipeline.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Reason Distribution Pie Chart */}
        <div className="p-6 rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
              Original NDR Reason Share
            </h3>
            <span className="text-xs text-neutral-500">Categorization</span>
          </div>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={reasonPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {reasonPieData.map((entry, index) => (
                    <Cell key={`pie-cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card-bg)',
                    borderColor: 'rgba(128,128,128,0.2)',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Legend iconSize={10} layout="vertical" verticalAlign="middle" align="right" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
