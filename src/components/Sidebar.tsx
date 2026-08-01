import { clsx } from 'clsx';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileBarChart,
  Building2,
  Users,
  UserCog,
  Wallet,
  LogOut,
  X,
  ChevronLeft,
  AlertCircle,
  RotateCcw,
  ShieldAlert,
  Mail,
  ShoppingBag,
  UserPlus,
  Landmark,
  KeyRound,
  Gift,
  Banknote,
  BookOpen,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useNotifications } from '@/lib/notifications';
import { UserRole, ROLE_LABELS } from '@/types';
import { confirm } from '@/lib/confirm';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: UserRole[];
}

const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['super_admin', 'hub_admin', 'supervisor', 'collector'] },
  { to: '/khatabook', label: 'KhataBook', icon: BookOpen, roles: ['super_admin', 'hub_admin', 'supervisor', 'collector'] },
  { to: '/reports', label: 'Reports', icon: FileBarChart, roles: ['super_admin', 'hub_admin', 'supervisor'] },
  { to: '/hubs', label: 'Hub Management', icon: Building2, roles: ['super_admin', 'hub_admin'] },
  { to: '/collectors', label: 'Employees', icon: Users, roles: ['super_admin', 'hub_admin', 'supervisor'] },
  { to: '/dues', label: 'Dues', icon: AlertCircle, roles: ['super_admin', 'hub_admin', 'supervisor'] },
  { to: '/deposits', label: 'CMS Deposition', icon: Landmark, roles: ['super_admin', 'hub_admin', 'supervisor'] },
  { to: '/recovery', label: 'Recovery', icon: RotateCcw, roles: ['super_admin', 'hub_admin', 'supervisor', 'collector'] },
  { to: '/users', label: 'Users & Access', icon: UserCog, roles: ['super_admin', 'hub_admin'] },
  { to: '/trial-users', label: 'Trial Users', icon: UserPlus, roles: ['super_admin'] },
  { to: '/messages', label: 'Messages', icon: Mail, roles: ['super_admin'] },
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
  const { pendingPayments, unreadHubNotifications, pendingPayouts } = useNotifications();
  const navigate = useNavigate();

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

  const items = NAV.filter((i) => profile && i.roles.includes(profile.role));

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden animate-fade-in" onClick={onClose} />}

      <aside
        className={clsx(
          'fixed lg:sticky top-0 z-40 h-screen border-r border-neutral-200 dark:border-neutral-800 flex flex-col transition-all duration-300',
          collapsed ? 'lg:w-[68px] w-64' : 'w-64',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        style={{ background: 'var(--card-bg)' }}
      >
        {/* Logo */}
        <div className={clsx('flex items-center gap-2.5 h-16 border-b border-neutral-200 dark:border-neutral-800 shrink-0', collapsed ? 'lg:justify-center px-2 justify-between px-4' : 'px-5 justify-between')} style={{ background: 'var(--card-bg)' }}>
          <Link to="/" className={clsx('flex items-center gap-2.5 min-w-0 rounded-xl transition active:scale-95', collapsed && 'lg:hidden')} title="Go to homepage">
            <div className="rounded-xl bg-gradient-to-br from-brand-600 to-brand-400 p-2 text-white shadow-glow shrink-0 transition-transform group-hover:scale-105">
              <Wallet className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-neutral-900 dark:text-neutral-100 text-sm leading-tight truncate">HubVault</p>
              <p className="text-[11px] text-neutral-500 leading-tight">Reconciliation Suite</p>
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
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <p className={clsx('px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400', collapsed && 'lg:hidden')}>Menu</p>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              onClick={onClose}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                clsx(
                  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                  collapsed && 'lg:justify-center lg:px-0',
                  isActive
                    ? 'bg-brand-50 dark:bg-brand-600/15 text-brand-600 dark:text-brand-400'
                    : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100/60 dark:hover:bg-neutral-800/60 hover:text-neutral-900 dark:hover:text-neutral-100'
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
                  <item.icon className={clsx('h-[18px] w-[18px] shrink-0 transition-colors', isActive ? 'text-brand-600 dark:text-brand-400' : 'text-neutral-500 group-hover:text-neutral-700 dark:group-hover:text-neutral-300')} />
                  <span className={clsx(collapsed && 'lg:hidden')}>{item.label}</span>
                  {item.to === '/licenses' && pendingPayments > 0 && (
                    <span className={clsx('inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold animate-pulse', collapsed && 'lg:absolute lg:top-1 lg:right-1')}>
                      {pendingPayments}
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
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-neutral-200 dark:border-neutral-800 p-3 shrink-0" style={{ background: 'var(--card-bg)' }}>
          <div className={clsx('flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-neutral-100/60 dark:hover:bg-neutral-800/60 transition', collapsed && 'lg:justify-center lg:px-0')}>
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
