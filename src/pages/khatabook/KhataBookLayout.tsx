import SEO from '@/components/SEO';
import { clsx } from 'clsx';
import { BookOpen,FileText,LayoutDashboard,Users } from 'lucide-react';
import { NavLink,Outlet,useLocation } from 'react-router-dom';

const SUB_NAV = [
  { to: '/khatabook/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/khatabook/parties', label: 'Parties', icon: Users },
  { to: '/khatabook/ledger', label: 'Ledger', icon: BookOpen },
  { to: '/khatabook/reports', label: 'Reports', icon: FileText },
];

export default function KhataBookLayout() {
  const location = useLocation();

  return (
    <div className="space-y-6 animate-fade-in">
      <SEO
        title="KhataBook (Party Ledger) - HubVault"
        description="Professional accounting party ledger system with automated FIFO adjustments, running balances, and reports."
      />

      {/* Sub-navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-600 text-white shadow-glow">
              <BookOpen className="h-5 w-5" />
            </div>
            KhataBook <span className="text-xs font-semibold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-600/15 px-2 py-0.5 rounded-md">Party Ledger</span>
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            Track party payments, cash & online entries, date-wise dues/excess with automated FIFO adjustment.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200/80 dark:border-neutral-700/60 self-start sm:self-auto overflow-x-auto max-w-full">
          {SUB_NAV.map((nav) => (
            <NavLink
              key={nav.to}
              to={nav.to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap',
                  isActive || (nav.to === '/khatabook/dashboard' && location.pathname === '/khatabook')
                    ? 'bg-white dark:bg-neutral-900 text-brand-600 dark:text-brand-400 shadow-soft'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
                )
              }
            >
              <nav.icon className="h-4 w-4 shrink-0" />
              <span>{nav.label}</span>
            </NavLink>
          ))}
        </div>
      </div>

      {/* Main Submodule Content */}
      <Outlet />
    </div>
  );
}
