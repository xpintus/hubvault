import { useAuth } from '@/lib/auth';
import { useHub } from '@/lib/hubContext';
import { supportsHubOperations } from '@/lib/logisticsCompany';
import { confirm } from '@/lib/confirm';
import { useNotifications } from '@/lib/notifications';
import { toISODate } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { ROLE_LABELS, UserRole } from '@/types';
import { clsx } from 'clsx';
import {
  AlertCircle,
  Banknote,
  BookOpen,
  Building2,
  CalendarCheck2,
  ChevronLeft,
  FileBarChart,
  Gift,
  KeyRound,
  Landmark,
  LayoutDashboard,
  LogOut,
  Mail,
  RotateCcw,
  Send,
  Settings as SettingsIcon,
  ShieldAlert,
  ShoppingBag,
  Truck,
  UserCog,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: UserRole[];
}

const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['super_admin', 'hub_admin', 'supervisor', 'collector'] },
  { to: '/operations', label: 'Hub Operations', icon: Truck, roles: ['super_admin', 'hub_admin', 'supervisor', 'collector'] },
  { to: '/khatabook', label: 'KhataBook', icon: BookOpen, roles: ['super_admin', 'hub_admin', 'supervisor', 'collector'] },

  { to: '/reports', label: 'Reports', icon: FileBarChart, roles: ['super_admin', 'hub_admin', 'supervisor'] },
  { to: '/hubs', label: 'Hub Management', icon: Building2, roles: ['super_admin', 'hub_admin'] },
  { to: '/collectors', label: 'Employees', icon: Users, roles: ['super_admin', 'hub_admin', 'supervisor'] },
  { to: '/dues', label: 'Dues', icon: AlertCircle, roles: ['super_admin', 'hub_admin', 'supervisor'] },
  { to: '/deposits', label: 'CMS Deposition', icon: Landmark, roles: ['super_admin', 'hub_admin', 'supervisor'] },
  { to: '/daily-closing', label: 'Daily Closing', icon: CalendarCheck2, roles: ['super_admin', 'hub_admin', 'supervisor', 'collector'] },
  { to: '/recovery', label: 'Recovery', icon: RotateCcw, roles: ['super_admin', 'hub_admin', 'supervisor', 'collector'] },
  { to: '/users', label: 'Users & Access', icon: UserCog, roles: ['super_admin', 'hub_admin'] },
  { to: '/activation-status', label: 'License & Plan', icon: KeyRound, roles: ['hub_admin'] },
  { to: '/trial-users', label: 'Trial Users', icon: UserPlus, roles: ['super_admin'] },
  { to: '/messages', label: 'Messages', icon: Mail, roles: ['super_admin'] },
  { to: '/mail-campaigns', label: 'Mail Campaigns', icon: Send, roles: ['super_admin'] },
  { to: '/purchases', label: 'Purchase Requests', icon: ShoppingBag, roles: ['super_admin'] },
  { to: '/audit-logs', label: 'Audit Logs', icon: ShieldAlert, roles: ['super_admin'] },
  { to: '/licenses', label: 'Licenses', icon: KeyRound, roles: ['super_admin'] },
  { to: '/refer-earn', label: 'Refer & Earn', icon: Gift, roles: ['super_admin', 'hub_admin', 'supervisor', 'collector'] },
  { to: '/payouts', label: 'Payouts', icon: Banknote, roles: ['super_admin'] },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, roles: ['super_admin'] },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({ open, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const { profile, signOut } = useAuth();
  const { selectedHub } = useHub();
  const { pendingPayments, unreadHubNotifications, unreadBuyerNotifications, pendingPayouts } = useNotifications();
  const navigate = useNavigate();
  const [dailyClosingPending, setDailyClosingPending] = useState(false);

  useEffect(() => {
    if (!profile || profile.role !== 'hub_admin') {
      setDailyClosingPending(false);
      return;
    }
    const hubId = selectedHub?.id || profile.hub_id;
    if (!hubId) return;
    let cancelled = false;
    const today = toISODate(new Date());
    const checkDailyClosing = async () => {
      const [{ count: codEntries }, { data: finalization }] = await Promise.all([
        supabase.from('collection_entries').select('id', { count: 'exact', head: true }).eq('hub_id', hubId).eq('collection_date', today).gt('expected_cod', 0),
        supabase.from('daily_closing_finalizations').select('id').eq('hub_id', hubId).eq('closing_date', today).maybeSingle(),
      ]);
      if (!cancelled) setDailyClosingPending((codEntries ?? 0) > 0 && !finalization);
    };
    void checkDailyClosing();
    const refresh = () => { void checkDailyClosing(); };
    window.addEventListener('hubvault:daily-closing-finalized', refresh);
    return () => {
      cancelled = true;
      window.removeEventListener('hubvault:daily-closing-finalized', refresh);
    };
  }, [profile, selectedHub?.id]);

  const handleSignOut = async () => {
    const ok = await confirm({
      title: 'Sign out?',
      message: 'You will be returned to the login screen.',
      confirmLabel: 'Sign out',
    });
    if (!ok) return;
    await signOut();
    navigate('/login');
  };

  const items = NAV.filter((i) => profile && i.roles.includes(profile.role) && (i.to !== '/operations' || supportsHubOperations(selectedHub?.logistics_company)));

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden animate-fade-in" onClick={onClose} />}

      <aside
        className={clsx(
          'fixed lg:sticky top-0 z-40 flex h-dvh flex-col border-r border-white/60 bg-white/85 shadow-[8px_0_30px_-24px_rgba(15,23,42,.35)] backdrop-blur-2xl transition-all duration-300 dark:border-white/5 dark:bg-slate-950/85',
          collapsed ? 'lg:w-[76px] w-[280px]' : 'w-[280px]',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className={clsx('flex h-20 shrink-0 items-center gap-3 border-b border-neutral-200/70 dark:border-white/5', collapsed ? 'lg:justify-center px-2 justify-between px-4' : 'px-5 justify-between')}>
          <Link to="/" className={clsx('flex items-center gap-2.5 min-w-0 rounded-xl transition active:scale-95', collapsed && 'lg:hidden')} title="Go to homepage">
            <div className="shrink-0 rounded-2xl bg-gradient-to-br from-brand-600 via-brand-500 to-violet-400 p-2.5 text-white shadow-glow transition-transform group-hover:scale-105">
              <Wallet className="h-5 w-5" strokeWidth={2.4} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-black tracking-tight text-neutral-950 dark:text-white">HubVault</p>
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-brand-500">Operations OS</p>
            </div>
          </Link>
          <button onClick={onClose} className="lg:hidden text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition active:scale-90">
            <X className="h-5 w-5" />
          </button>
          <button onClick={onToggleCollapse} className={clsx('hidden lg:flex text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition active:scale-90', collapsed && 'lg:hidden')}>
            <ChevronLeft className="h-5 w-5" />
          </button>
          {collapsed && (
            <Link to="/" className="hidden lg:block rounded-xl transition active:scale-95 hover:shadow-glow" title="Go to homepage">
              <div className="rounded-xl bg-gradient-to-br from-brand-600 to-brand-400 p-2 text-white shadow-glow transition-transform hover:scale-105">
                <Wallet className="h-5 w-5" />
              </div>
            </Link>
          )}
        </div>

        {/* Expand button when collapsed (desktop) */}
        {collapsed && (
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex absolute -right-3 top-20 z-10 h-6 w-6 items-center justify-center rounded-full bg-[var(--card-bg)] border border-neutral-300 dark:border-neutral-700 text-neutral-500 hover:text-brand-600 hover:border-brand-600 shadow-soft transition"
          >
            <ChevronLeft className="h-3.5 w-3.5 rotate-180" />
          </button>
        )}

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
          <p className={clsx('px-3 pb-2 text-[10px] font-black uppercase tracking-[.18em] text-neutral-400', collapsed && 'lg:hidden')}>Workspace</p>
          {items.map((item) => {
            const needsDailyClose = item.to === '/daily-closing' && dailyClosingPending;
            return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              onClick={onClose}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                clsx(
                  'group relative flex min-h-11 items-center gap-3 rounded-2xl px-2.5 py-2 text-sm font-semibold transition-all duration-200',
                  collapsed && 'lg:justify-center lg:px-0',
                  isActive
                    ? 'bg-gradient-to-r from-brand-50 to-violet-50/70 text-brand-700 shadow-sm ring-1 ring-inset ring-brand-200/60 dark:from-brand-500/20 dark:to-violet-500/10 dark:text-brand-200 dark:ring-brand-400/20'
                    : needsDailyClose
                      ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-300 shadow-sm shadow-red-500/10 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/50'
                    : 'text-neutral-500 hover:bg-neutral-100/80 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-white'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className={clsx(
                    'absolute left-0 w-1 rounded-r-full transition-all',
                    isActive ? 'h-6 bg-brand-600 shadow-glow' : 'h-0',
                    collapsed && 'lg:hidden'
                  )} />
                  <span className={clsx('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-all', isActive ? 'bg-brand-600 text-white shadow-glow' : 'bg-neutral-100 text-neutral-500 group-hover:bg-white group-hover:text-brand-600 group-hover:shadow-sm dark:bg-white/5 dark:text-neutral-400 dark:group-hover:bg-white/10 dark:group-hover:text-brand-300')}>
                    <item.icon className="h-4 w-4" strokeWidth={2.2} />
                  </span>
                  <span className={clsx(collapsed && 'lg:hidden')}>{item.label}</span>
                  {needsDailyClose && (
                    <span className={clsx('ml-auto inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-white shadow-sm shadow-red-500/40 animate-pulse', collapsed && 'lg:absolute lg:right-0 lg:top-0 lg:h-2 lg:w-2 lg:p-0 lg:text-transparent')}>
                      Attention
                    </span>
                  )}
                  {item.to === '/licenses' && pendingPayments > 0 && (
                    <span className={clsx('inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold animate-pulse', collapsed && 'lg:absolute lg:top-1 lg:right-1')}>
                      {pendingPayments}
                    </span>
                  )}
                  {item.to === '/purchases' && unreadBuyerNotifications > 0 && (
                    <span className={clsx('inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-violet-500 text-white text-[10px] font-bold animate-pulse', collapsed && 'lg:absolute lg:top-1 lg:right-1')}>
                      {unreadBuyerNotifications}
                    </span>
                  )}
                  {item.to === '/hubs' && unreadHubNotifications > 0 && (
                    <span className={clsx('inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-blue-500 text-white text-[10px] font-bold', collapsed && 'lg:absolute lg:top-1 lg:right-1')}>
                      {unreadHubNotifications}
                    </span>
                  )}
                  {item.to === '/payouts' && pendingPayouts > 0 && (
                    <span className={clsx('inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold animate-pulse', collapsed && 'lg:absolute lg:top-1 lg:right-1')}>
                      {pendingPayouts}
                    </span>
                  )}
                </>
              )}
            </NavLink>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="shrink-0 border-t border-neutral-200/70 p-3 dark:border-white/5">
          <div className={clsx('flex items-center gap-3 rounded-2xl border border-neutral-200/70 bg-neutral-50/80 px-2.5 py-2.5 transition hover:border-brand-200 hover:bg-white dark:border-white/5 dark:bg-white/[.035] dark:hover:border-brand-400/20', collapsed && 'lg:justify-center lg:px-0')}>
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-brand-600 to-brand-400 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-glow">
              {profile?.name?.charAt(0).toUpperCase() ?? 'U'}
            </div>
            <div className={clsx('min-w-0 flex-1', collapsed && 'lg:hidden')}>
              <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 truncate">{profile?.name}</p>
              <p className="text-[11px] text-neutral-500 truncate">{profile ? ROLE_LABELS[profile.role] : ''}</p>
            </div>
            <button onClick={handleSignOut} title="Sign out" className={clsx('text-neutral-500 hover:text-red-500 p-2 rounded-lg hover:bg-red-500/10 transition active:scale-90', collapsed && 'lg:hidden')}>
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
