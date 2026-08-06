import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useHub } from '@/lib/hubContext';
import { NDRImportModal } from '@/components/ndr/NDRImportModal';
import {
  AlertCircle,
  Archive,
  BarChart3,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  ListFilter,
  PhoneCall,
  RotateCcw,
  ShieldCheck,
  Truck,
  Upload,
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
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleImportSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      {/* Top Operations Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--card-bg)] p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-soft">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-glow">
            <Truck className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">NDR Management Module</h1>
              {selectedHub && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-50 dark:bg-brand-600/15 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800/40">
                  {selectedHub.name}
                </span>
              )}
            </div>

            <p className="text-xs text-neutral-500 mt-0.5">
              Operations & Undelivered (UNDEL) shipment resolution pipeline with complete calling, supervisor review, and timeline history.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setImportModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-glow transition flex items-center gap-2 active:scale-95"
          >
            <Upload className="h-4 w-4" /> Import Daily NDR File
          </button>
        </div>
      </div>

      {/* Operations Sub-Navigation Bar */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto no-scrollbar">
        <nav className="flex space-x-1 min-w-max pb-1">
          {NAV_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-150',
                    isActive
                      ? 'bg-brand-50 dark:bg-brand-600/15 text-brand-600 dark:text-brand-400 font-bold border border-brand-200 dark:border-brand-800/40'
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

      {/* NDR Import Modal */}
      <NDRImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={handleImportSuccess}
        hubId={selectedHub?.id || null}

      />
    </div>
  );
}
