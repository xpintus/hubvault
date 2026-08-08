import { BarChart3, Truck } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';

const OPERATION_TABS = [
  {
    to: '/operations/ndr/dashboard',
    label: 'NDR Operations',
    description: 'Calling, follow-up and resolution',
    icon: Truck,
    match: '/operations/ndr',
  },
  {
    to: '/operations/drs-performance',
    label: 'DRS Performance',
    description: 'Delivery performance analytics',
    icon: BarChart3,
    match: '/operations/drs-performance',
  },
];

export default function HubOperationsLayout() {
  const location = useLocation();
  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-[28px] border border-neutral-200/80 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-col gap-4 bg-gradient-to-r from-slate-950 via-indigo-950 to-brand-900 p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-200">Operations workspace</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight">Hub Operations</h1>
            <p className="mt-1 text-xs text-indigo-100/70">Manage NDR resolution and DRS performance from one workspace.</p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-[11px] font-bold text-emerald-200">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Live operations
          </span>
        </div>

        <nav className="grid gap-2 p-2 sm:grid-cols-2">
          {OPERATION_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={() =>
                  clsx(
                    'group flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all',
                    location.pathname.startsWith(tab.match)
                      ? 'border-brand-200 bg-brand-50 text-brand-700 shadow-sm dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-300'
                      : 'border-transparent text-neutral-500 hover:border-neutral-200 hover:bg-neutral-50 dark:hover:border-neutral-800 dark:hover:bg-neutral-800/50'
                  )
                }
              >
                <span className="rounded-xl bg-white p-2 shadow-sm dark:bg-neutral-900"><Icon className="h-5 w-5" /></span>
                <span>
                  <strong className="block text-sm">{tab.label}</strong>
                  <span className="block text-[10px] font-medium opacity-70">{tab.description}</span>
                </span>
              </NavLink>
            );
          })}
        </nav>
      </section>

      <Outlet />
    </div>
  );
}
