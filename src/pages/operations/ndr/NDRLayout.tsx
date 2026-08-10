import React, { useCallback, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useHub } from '@/lib/hubContext';
import {
  BarChart3,
  ChevronRight,
  CircleDot,
  LayoutDashboard,
  ListFilter,
  PhoneCall,
  Sparkles,
  Truck,
} from 'lucide-react';
import { clsx } from 'clsx';

const NAV_TABS = [
  { to: '/operations/ndr/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/operations/ndr/my-queue', label: 'Calling Queue', icon: PhoneCall },
  { to: '/operations/ndr/shipments', label: 'All Shipments', icon: ListFilter },
  { to: '/operations/ndr/reports', label: 'Reports', icon: BarChart3 },
];



export default function NDRLayout() {
  const { selectedHub } = useHub();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleWorkspaceWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (!event.deltaY || event.ctrlKey) return;
    const target = event.target as HTMLElement;
    const nestedVerticalScroller = target.closest<HTMLElement>('[data-ndr-vertical-scroll]');
    if (nestedVerticalScroller && nestedVerticalScroller.scrollHeight > nestedVerticalScroller.clientHeight) return;

    const appScroller = event.currentTarget.closest<HTMLElement>('.app-content');
    if (!appScroller || appScroller.scrollHeight <= appScroller.clientHeight) return;
    event.preventDefault();
    appScroller.scrollTop += event.deltaY;
  }, []);

  return (
    <div className="ndr-pro space-y-5" onWheel={handleWorkspaceWheel}>
      {/* Top Operations Header */}
      <div className="ndr-masthead relative overflow-hidden rounded-[30px] border border-indigo-400/20 bg-gradient-to-br from-[#071127] via-[#17245f] to-[#4c1d95] p-5 text-white shadow-[0_28px_80px_-42px_rgba(49,46,129,.95)] sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-violet-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div className="flex min-w-0 items-start gap-3.5">
          <div className="rounded-[20px] border border-white/20 bg-gradient-to-br from-white/20 to-white/5 p-3.5 text-cyan-200 shadow-xl backdrop-blur-sm">
            <Truck className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.18em] text-cyan-100">
              <CircleDot className="h-3 w-3" /> Live resolution intelligence
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black tracking-[-.035em] text-white sm:text-3xl">NDR Operations</h1>
              {selectedHub && (
                <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-bold text-indigo-100 backdrop-blur-sm">
                  {selectedHub.name}
                </span>
              )}
            </div>

            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-indigo-100/70 sm:text-sm">
              Resolve undelivered shipments faster with calling, supervisor review and complete activity history.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <span className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.08] px-3 py-2.5 text-[10px] font-bold text-indigo-100 backdrop-blur-xl">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.8)]" /> System Live
          </span>
          <span className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.08] px-3 py-2.5 text-[10px] font-bold text-indigo-100 backdrop-blur-xl">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" /> Smart Workflow
          </span>
        </div></div>
      </div>

      {/* Operations Sub-Navigation Bar */}
      <div className="ndr-nav no-scrollbar sticky top-1 z-10 overflow-x-auto rounded-2xl border border-neutral-200/80 bg-white/90 p-1.5 shadow-[0_16px_45px_-32px_rgba(15,23,42,.65)] backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/90">
        <nav className="flex min-w-max gap-1">
          {NAV_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  clsx(
                    'group flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all duration-200',
                    isActive
                      ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white font-bold shadow-md shadow-indigo-500/20'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800/50'
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{tab.label}</span>
                <ChevronRight className="h-3 w-3 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-70" />
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Main NDR View Outlet */}
      <main className="ndr-workspace min-w-0">
        <Outlet context={{ refreshTrigger, setRefreshTrigger }} />
      </main>

    </div>
  );
}
