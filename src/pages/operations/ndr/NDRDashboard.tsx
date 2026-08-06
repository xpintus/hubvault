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
      route: '/operations/ndr/calling-queue',
      badge: 'Action Required',
    },
    {
      label: 'Supervisor Pending',
      value: metrics.supervisorPending,
      icon: ShieldCheck,
      color: 'text-rose-500 font-bold',
      bgColor: 'bg-rose-500/10 border-rose-500/20',
      route: '/operations/ndr/supervisor-review',
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
      route: '/operations/ndr/delivered-after-ndr',
    },
    {
      label: 'RTO Closed',
      value: metrics.rtoClosed,
      icon: RotateCcw,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10 border-red-500/20',
      route: '/operations/ndr/rto-queue',
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
    <div className="space-y-6">
      {/* Enterprise Data Management Action Bar */}
      <div className="p-4 rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-neutral-800 dark:text-neutral-200">
          <Archive className="h-4 w-4 text-brand-600" />
          <span>NDR Operational Data Management</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={() => {
              setResetLevel(1);
              setResetModalOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold transition shadow-sm active:scale-95 flex items-center gap-1.5"
          >
            Reset Current Report
          </button>
          <button
            onClick={() => {
              setResetLevel(3);
              setResetModalOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition shadow-sm active:scale-95 flex items-center gap-1.5"
          >
            Delete All
          </button>
          <button
            onClick={() => setRecycleBinOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 font-bold transition shadow-sm active:scale-95 flex items-center gap-1.5"
          >
            Recycle Bin
          </button>
        </div>
      </div>
      {/* 8 Operational Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              onClick={() => navigate(card.route)}
              className={`p-6 rounded-2xl border transition-all cursor-pointer group flex flex-col justify-between hover:shadow-lg ${card.bgColor}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-wider uppercase text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5">
                  {card.label}
                </span>
                <Icon className={`h-6 w-6 ${card.color} group-hover:scale-110 transition-transform`} />
              </div>

              {card.badge && (
                <span className="inline-block mt-2 self-start px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-600 text-white uppercase tracking-wider">
                  {card.badge}
                </span>
              )}

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

      {/* 11 Reason-Wise KPI Cards */}
      <div className="p-6 rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-600">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
                Reason-Wise NDR Analytics
              </h2>
              <p className="text-xs text-neutral-500">Click any reason card to view filtered NDR shipments.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {reasonKpis.map((r) => {
            const Icon = r.icon;
            return (
              <div
                key={r.label}
                onClick={() => navigate(`/operations/ndr/shipments?reason=${encodeURIComponent(r.reason)}`)}
                className={`p-4 rounded-xl border transition cursor-pointer group flex flex-col justify-between hover:shadow-md ${r.bgColor}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-neutral-600 dark:text-neutral-400 line-clamp-1">{r.label}</span>
                  <Icon className={`h-4 w-4 ${r.color} group-hover:scale-110 transition-transform`} />
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className={`text-2xl font-black ${r.color}`}>{r.count}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-neutral-400 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
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
