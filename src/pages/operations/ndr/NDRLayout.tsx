import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useHub } from '@/lib/hubContext';
import {
  AlertCircle,
  Archive,
  BarChart3,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  History,
  LayoutDashboard,
  ListFilter,
  PhoneCall,
  RotateCcw,
  ShieldCheck,
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

  return (
    <div className="space-y-5">
      {/* Top Operations Header */}
      <div className="relative overflow-hidden rounded-[28px] border border-indigo-200/70 bg-gradient-to-br from-slate-950 via-indigo-950 to-brand-900 p-5 text-white shadow-xl shadow-indigo-950/10 sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-center">
        <div className="flex items-center gap-3.5">
          <div className="rounded-2xl border border-white/20 bg-white/10 p-3.5 text-white shadow-lg backdrop-blur-sm">
            <Truck className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">NDR Operations</h1>
              {selectedHub && (
                <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-bold text-indigo-100 backdrop-blur-sm">
                  {selectedHub.name}
                </span>
              )}
            </div>

            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-indigo-100/75">
              Resolve undelivered shipments faster with calling, supervisor review and complete activity history.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-[11px] font-bold text-emerald-200 lg:flex">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Live operations
          </span>
        </div></div>
      </div>

      {/* Operations Sub-Navigation Bar */}
      <div className="no-scrollbar overflow-x-auto rounded-2xl border border-neutral-200/80 bg-white p-1.5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <nav className="flex min-w-max space-x-1">
          {NAV_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all duration-150',
                    isActive
                      ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white font-bold shadow-md shadow-indigo-500/20'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800/50'
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{tab.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Main NDR View Outlet */}
      <main>
        <Outlet context={{ refreshTrigger, setRefreshTrigger }} />
      </main>

    </div>
  );
}
