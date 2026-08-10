import React, { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useHub } from '@/lib/hubContext';
import { fetchNDRMetrics } from '@/lib/ndr/ndrService';
import {
  deleteAllDRSReports,
  resetCurrentDRSReport,
} from '@/lib/drs/drsResetManager';
import { DRSResetModal } from '@/components/drs/DRSResetModal';
import { DRSRecycleBinDrawer } from '@/components/drs/DRSRecycleBinDrawer';
import { loadActiveDRSReport } from '@/lib/drs/drsHistoryManager';
import { NDRMetrics } from '@/types/ndr';
import {
  Archive,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Download,
  HelpCircle,
  MapPin,
  MessageSquareX,
  PhoneCall,
  PhoneOff,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Truck,
  UserX,
  Wallet,
  XCircle,
} from 'lucide-react';

export default function NDRDashboard() {
  const { selectedHub } = useHub();
  const { profile } = useAuth();
  const { refreshTrigger, handleImportSuccess } = useOutletContext<{ refreshTrigger?: number; handleImportSuccess?: () => void }>();
  const navigate = useNavigate();

  const [metrics, setMetrics] = useState<NDRMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  // Reset & Data Management State
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetLevel, setResetLevel] = useState<1 | 2 | 3>(1);
  const [recycleBinOpen, setRecycleBinOpen] = useState(false);

  const loadData = () => {
    setLoading(true);
    fetchNDRMetrics(selectedHub?.id || null)
      .then((data) => {
        setMetrics(data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => {
      loadData();
    };

    window.addEventListener('ndr-data-updated', handleUpdate);
    return () => {
      window.removeEventListener('ndr-data-updated', handleUpdate);
    };
  }, [selectedHub, refreshTrigger]);

  const handleConfirmReset = async (options: { reason: string; exportBeforeDelete: boolean }) => {
    if (resetLevel === 1) {
      const { activeReport } = await loadActiveDRSReport();
      if (activeReport) {
        await resetCurrentDRSReport(activeReport, profile, selectedHub?.id, options);
      }
    } else if (resetLevel === 3) {
      await deleteAllDRSReports(profile, selectedHub?.id, options.reason);
    }
    loadData();
    if (handleImportSuccess) handleImportSuccess();
  };

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
      label: "Today's Upload",
      value: metrics.todaysUpload,
      icon: Download,
      color: 'text-indigo-500 font-bold',
      bgColor: 'bg-indigo-500/10 border-indigo-500/20',
      route: '/operations/ndr/shipments?isToday=true',
    },
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
      color: 'text-purple-600 font-bold',
      bgColor: 'bg-purple-500/10 border-purple-500/20 shadow-sm',
      route: '/operations/ndr/my-queue',
      badge: 'Action Required',
    },
    {
      label: 'Supervisor Pending',
      value: metrics.supervisorPending,
      icon: ShieldCheck,
      color: 'text-rose-500 font-bold',
      bgColor: 'bg-rose-500/10 border-rose-500/20',
      route: '/operations/ndr/shipments?workflowStatus=Supervisor%20Pending',
    },
    {
      label: 'Follow-up Today',
      value: metrics.followUpToday,
      icon: Clock,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10 border-amber-500/20',
      route: '/operations/ndr/shipments?workflowStatus=Follow-up',
    },
    {
      label: 'Reattempt Pending',
      value: metrics.reattemptPending,
      icon: Truck,
      color: 'text-orange-500 font-bold',
      bgColor: 'bg-orange-500/10 border-orange-500/20',
      route: '/operations/ndr/shipments?attempts=reattempt',
    },
    {
      label: 'Delivered After NDR',
      value: metrics.deliveredToday,
      icon: CheckCircle2,
      color: 'text-emerald-600',
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

  const reasonKpis = [
    {
      label: 'Customer Refused to Accept',
      count: metrics.customerRefusedToAccept,
      icon: UserX,
      color: 'text-red-600',
      bgColor: 'bg-red-500/10 border-red-500/20',
      reason: 'Customer Refused to Accept',
    },
    {
      label: 'Customer Refused OTP',
      count: metrics.customerRefusedOtp,
      icon: MessageSquareX,
      color: 'text-orange-600',
      bgColor: 'bg-orange-500/10 border-orange-500/20',
      reason: 'Customer Refused OTP',
    },
    {
      label: 'Customer Not Reachable',
      count: metrics.customerNotReachable,
      icon: PhoneOff,
      color: 'text-amber-600',
      bgColor: 'bg-amber-500/10 border-amber-500/20',
      reason: 'Customer Not Reachable',
    },
    {
      label: 'Phone Switched Off',
      count: metrics.phoneSwitchedOff,
      icon: PhoneOff,
      color: 'text-purple-600',
      bgColor: 'bg-purple-500/10 border-purple-500/20',
      reason: 'Phone Switched Off',
    },
    {
      label: 'Future Delivery Requested',
      count: metrics.futureDeliveryRequested,
      icon: Clock,
      color: 'text-blue-600',
      bgColor: 'bg-blue-500/10 border-blue-500/20',
      reason: 'Future Delivery Requested',
    },
    {
      label: 'Fake Order',
      count: metrics.fakeOrder,
      icon: ShieldAlert,
      color: 'text-rose-600',
      bgColor: 'bg-rose-500/10 border-rose-500/20',
      reason: 'Fake Order',
    },
    {
      label: 'Address Issue',
      count: metrics.addressIssue,
      icon: MapPin,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-500/10 border-indigo-500/20',
      reason: 'Address Issue',
    },
    {
      label: 'Payment Issue',
      count: metrics.paymentIssue,
      icon: Wallet,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-500/10 border-emerald-500/20',
      reason: 'Payment Issue',
    },
    {
      label: 'OTP Issue',
      count: metrics.otpIssue,
      icon: MessageSquareX,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-500/10 border-cyan-500/20',
      reason: 'OTP Issue',
    },
    {
      label: 'DE Did Not Visit',
      count: metrics.deDidNotVisit,
      icon: XCircle,
      color: 'text-red-700',
      bgColor: 'bg-red-600/10 border-red-600/20',
      reason: 'Delivery Executive Did Not Visit',
    },
    {
      label: 'Other Reasons',
      count: metrics.otherReasons,
      icon: HelpCircle,
      color: 'text-neutral-600',
      bgColor: 'bg-neutral-500/10 border-neutral-500/20',
      reason: 'Other',
    },
  ];

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white px-5 py-5 shadow-[0_20px_60px_-46px_rgba(15,23,42,.65)] dark:border-white/10 dark:bg-slate-900 sm:px-6">
        <div className="pointer-events-none absolute right-0 top-0 h-full w-72 bg-gradient-to-l from-indigo-50/80 to-transparent dark:from-indigo-500/5" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-indigo-600 dark:text-indigo-300"><span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,.12)]" /> Operations overview</div>
          <h2 className="text-xl font-black tracking-[-.025em] text-slate-950 dark:text-white sm:text-2xl">Today&apos;s NDR Command Center</h2>
          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Live workload, resolution queues and exception intelligence.</p>
        </div>
        <button onClick={loadData} className="inline-flex min-h-10 w-fit items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-indigo-500/10">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh data
        </button>
      </div></section>
      {/* Enterprise Data Management Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-950 p-3 text-white shadow-[0_18px_45px_-30px_rgba(15,23,42,.9)] dark:border-white/10 sm:px-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/10"><Archive className="h-4 w-4 text-indigo-300" /></span>
          <span>Data controls</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={() => {
              setResetLevel(1);
              setResetModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-amber-300/20 bg-amber-400/10 px-3.5 py-2 font-bold text-amber-200 transition hover:bg-amber-400/20 active:scale-95"
          >
            Reset Current Report
          </button>
          <button
            onClick={() => {
              setResetLevel(3);
              setResetModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-rose-300/20 bg-rose-400/10 px-3.5 py-2 font-bold text-rose-200 transition hover:bg-rose-400/20 active:scale-95"
          >
            Delete All
          </button>
          <button
            onClick={() => setRecycleBinOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/10 px-3.5 py-2 font-bold text-slate-200 transition hover:bg-white/15 active:scale-95"
          >
            Recycle Bin
          </button>
        </div>
      </div>
      {/* 8 Operational Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-3 min-[440px]:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              type="button"
              key={card.label}
              onClick={() => navigate(card.route)}
              aria-label={`Open ${card.label}: ${card.value}`}
              className={`group relative min-h-[138px] w-full cursor-pointer overflow-hidden rounded-2xl border bg-white p-4 text-left shadow-[0_16px_40px_-34px_rgba(15,23,42,.7)] transition-all hover:-translate-y-1 hover:border-indigo-300 hover:shadow-[0_24px_55px_-35px_rgba(79,70,229,.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 active:scale-[.98] dark:bg-slate-900 sm:p-5 ${card.bgColor}`}
            >
              <div className="absolute inset-x-0 top-0 h-[3px] bg-current opacity-70" />
              <div className="flex h-full flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 sm:text-[11px]">
                  {card.label}
                </span>
                <span className="rounded-xl border border-slate-200/80 bg-slate-50 p-2.5 dark:border-white/10 dark:bg-white/5"><Icon className={`h-5 w-5 ${card.color} transition-transform group-hover:scale-110`} /></span>
              </div>

              {card.badge && (
                <span className="inline-block mt-2 self-start px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-600 text-white uppercase tracking-wider">
                  {card.badge}
                </span>
              )}

              <div className="flex items-end justify-between">
                <span className={`font-mono text-3xl font-black leading-none sm:text-4xl ${card.color}`}>
                  {card.value}
                </span>
                <span className="flex items-center gap-1 text-[10px] font-bold text-neutral-500 transition-transform group-hover:translate-x-1 sm:text-xs">
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div></div>
            </button>
          );
        })}
      </div>

      {/* 11 Reason-Wise KPI Cards */}
      <div className="space-y-4 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-[0_20px_60px_-48px_rgba(15,23,42,.7)] dark:border-white/10 dark:bg-slate-900 sm:p-6">
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-600">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-950 dark:text-white uppercase tracking-wider">
                Exception Intelligence
              </h2>
              <p className="text-xs text-neutral-500">Click any reason card to view filtered NDR shipments.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {reasonKpis.map((r) => {
            const Icon = r.icon;
            return (
              <button
                type="button"
                key={r.label}
                onClick={() => navigate(`/operations/ndr/shipments?reason=${encodeURIComponent(r.reason)}`)}
                aria-label={`Filter by ${r.label}: ${r.count}`}
                className={`group min-h-[108px] w-full cursor-pointer rounded-2xl border bg-slate-50/70 p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-white hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 active:scale-[.98] dark:bg-white/[.035] ${r.bgColor}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-neutral-600 dark:text-neutral-400 line-clamp-1">{r.label}</span>
                  <span className="rounded-lg bg-white/70 p-1.5 shadow-sm dark:bg-neutral-900/50"><Icon className={`h-4 w-4 ${r.color} transition-transform group-hover:scale-110`} /></span>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className={`font-mono text-2xl font-black ${r.color}`}>{r.count}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-neutral-400 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      <DRSResetModal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        level={resetLevel}
        onConfirm={handleConfirmReset}
      />

      {/* Recycle Bin Drawer */}
      <DRSRecycleBinDrawer
        isOpen={recycleBinOpen}
        onClose={() => setRecycleBinOpen(false)}
        onRestoreSuccess={() => {
          loadData();
          if (handleImportSuccess) handleImportSuccess();
        }}
      />
    </div>
  );
}
