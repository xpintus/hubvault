import { useAuth } from '@/lib/auth';
import { formatDateLong } from '@/lib/format';
import { useHub } from '@/lib/hubContext';
import { useNotifications } from '@/lib/notifications';
import { useSettings } from '@/lib/settings';
import { getSubscriptionDetails } from '@/lib/subscription';
import { ROLE_LABELS } from '@/types';
import { clsx } from 'clsx';
import { AlertTriangle,Building2,Calendar,Check,ChevronDown,KeyRound,Layers,LogOut,Menu } from 'lucide-react';
import { useCallback,useEffect,useRef,useState } from 'react';
import { Link,Outlet,useLocation,useNavigate } from 'react-router-dom';
import LicenseActivationModal from './LicenseActivationModal';
import ConflictResolver from './offline/ConflictResolver';
import SyncIndicator from './offline/SyncIndicator';
import Sidebar from './Sidebar';
import { FullPageSpinner } from './ui/primitives';
import { ThemeToggle } from './ui/ThemeToggle';
import { useToast } from './ui/Toast';

const TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/reports': 'Reports & Analytics',
  '/hubs': 'Hub Management',
  '/collectors': 'Employee Management',
  '/dues': 'Dues Management',
  '/recovery': 'Recovery Management',
  '/deposits': 'CMS Deposition',
  '/daily-closing': 'Daily Closing',
  '/users': 'User & Access Management',
  '/messages': 'Messages',
  '/purchases': 'Purchase Requests',
  '/audit-logs': 'Audit Logs',
  '/licenses': 'License Management',
  '/activation-status': 'License & Subscription',
  '/operations': 'Hub Operations',
  '/mail-campaigns': 'Mail Campaigns',
};

export default function AppLayout() {
  const { profile, loading, signOut, user, refreshProfile } = useAuth();
  const { settings } = useSettings();
  const hub = useHub();
  const { pendingPayments, unreadBuyerNotifications } = useNotifications();
  const toast = useToast();
  const navigate = useNavigate();
  const prevPendingRef = useRef<number | null>(null);
  const prevBuyerRef = useRef<number | null>(null);
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hubMenuOpen, setHubMenuOpen] = useState(false);
  const [licenseModalOpen, setLicenseModalOpen] = useState(false);
  const [licenseBannerDismissed, setLicenseBannerDismissed] = useState(false);
  const [licenseCountdown, setLicenseCountdown] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const hubMenuRef = useRef<HTMLDivElement>(null);

  const subDetails = getSubscriptionDetails(profile, settings.subscription_grace_days);

  const isHubAdminPending = profile?.role === 'hub_admin' && profile?.license_status === 'pending';
  const isHubAdminExpired = profile?.role === 'hub_admin' && profile?.license_status === 'expired';

  const handleLicenseExpired = useCallback(async () => {
    setLicenseModalOpen(false);
    await refreshProfile();
    await signOut();
    navigate('/login', { replace: true });
  }, [refreshProfile, signOut, navigate]);

  // Only prompt near the end of the 30-day free-access period.
  useEffect(() => {
    const remaining = profile?.license_expires_at ? new Date(profile.license_expires_at).getTime() - Date.now() : Number.POSITIVE_INFINITY;
    if (!loading && isHubAdminPending && !licenseBannerDismissed && remaining <= 3 * 24 * 60 * 60 * 1000) {
      setLicenseModalOpen(true);
    }
  }, [loading, isHubAdminPending, licenseBannerDismissed, profile?.license_expires_at]);

  // Live countdown + periodic expiry check for pending hub_admins
  useEffect(() => {
    if (!isHubAdminPending || !profile?.license_expires_at) return;

    const checkExpiry = () => {
      const diff = new Date(profile.license_expires_at!).getTime() - Date.now();
      if (diff <= 0) {
        setLicenseCountdown(null);
        handleLicenseExpired();
        return;
      }
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setLicenseCountdown(`${d}d ${h}h ${m}m ${s}s`);
    };

    checkExpiry();
    const interval = setInterval(checkExpiry, 1000);
    return () => clearInterval(interval);
  }, [isHubAdminPending, profile?.license_expires_at, handleLicenseExpired]);

  // Block expired hub_admins from the dashboard
  useEffect(() => {
    if (!loading && isHubAdminExpired) {
      signOut();
      navigate('/login', { replace: true });
    }
  }, [loading, isHubAdminExpired, signOut, navigate]);

  useEffect(() => {
    if (!loading && (!user || !profile)) {
      navigate('/login', { replace: true });
    }
  }, [loading, user, profile, navigate]);

  useEffect(() => {
    if (prevPendingRef.current !== null && pendingPayments > prevPendingRef.current) {
      toast.info(`New UPI payment request received! ${pendingPayments - prevPendingRef.current} new request(s) pending verification.`);
    }
    prevPendingRef.current = pendingPayments;
  }, [pendingPayments, toast]);

  useEffect(() => {
    if (prevBuyerRef.current !== null && unreadBuyerNotifications > prevBuyerRef.current) {
      toast.info('A new buyer registered from the Buy Now page.');
    }
    prevBuyerRef.current = unreadBuyerNotifications;
  }, [unreadBuyerNotifications, toast]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (hubMenuRef.current && !hubMenuRef.current.contains(e.target as Node)) setHubMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (loading) return <FullPageSpinner message="Loading your workspace…" />;
  if (!profile) return <FullPageSpinner message="Preparing your workspace…" />;

  const title = TITLES[location.pathname] ?? 'HubVault';

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const showHubSelector = hub.accessibleHubs.length > 0;
  const isSuperAdmin = profile.role === 'super_admin';

  return (
    <div className="app-shell flex h-dvh max-w-full overflow-hidden bg-[var(--page-bg)]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} collapsed={collapsed} onToggleCollapse={() => setCollapsed((c) => !c)} />
      <div className="app-frame flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-20 flex h-20 shrink-0 items-center justify-between gap-3 border-b border-white/70 bg-white/75 px-4 shadow-[0_8px_30px_-28px_rgba(15,23,42,.55)] backdrop-blur-2xl dark:border-white/5 dark:bg-slate-950/70 lg:px-7">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 p-2 -ml-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition active:scale-95">
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[.2em] text-brand-500">HubVault Workspace</p>
              <h1 className="truncate text-lg font-black tracking-tight text-neutral-950 dark:text-white lg:text-xl">{title}</h1>
              <p className="hidden items-center gap-1.5 text-[11px] font-semibold text-neutral-500 sm:flex">
                <Calendar className="h-3 w-3" />
                {formatDateLong(new Date())}
              </p>
            </div>
          </div>

                <div className="flex items-center gap-2 lg:gap-3">
            {/* Sync status indicator */}
            <div className="hidden sm:block"><SyncIndicator /></div>
            {/* Theme toggle */}
            <ThemeToggle />
            {/* Hub Selector */}
            {showHubSelector && (
              <div className="relative hidden min-[480px]:block" ref={hubMenuRef}>
                <button
                  onClick={() => hub.canSwitchHub && setHubMenuOpen((o) => !o)}
                  disabled={!hub.canSwitchHub}
                  className={clsx(
                    'flex items-center gap-2 rounded-xl border px-3 py-2 transition',
                    hub.canSwitchHub
                      ? 'bg-brand-50 dark:bg-brand-600/10 border-brand-600/30 hover:border-brand-600/50 cursor-pointer'
                      : 'bg-[var(--card-bg)] border-neutral-200 dark:border-neutral-800 cursor-default'
                  )}
                >
                  {hub.isAllHubs ? (
                    <Layers className="h-4 w-4 text-brand-600" />
                  ) : (
                    <Building2 className="h-4 w-4 text-brand-600" />
                  )}
                  <div className="text-left">
                    <p className="text-[10px] text-brand-600/80 leading-none uppercase tracking-wider font-bold">
                      {isSuperAdmin ? 'View' : 'Hub'}
                    </p>
                    <p className="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-neutral-100 leading-tight mt-0.5 max-w-[90px] sm:max-w-[160px] truncate">
                      {hub.isAllHubs ? 'All Hubs' : hub.selectedHub?.name ?? 'Select Hub'}
                    </p>
                  </div>
                  {hub.canSwitchHub && (
                    <ChevronDown className={clsx('h-4 w-4 text-neutral-500 dark:text-neutral-400 transition-transform', hubMenuOpen && 'rotate-180')} />
                  )}
                </button>
                {hubMenuOpen && hub.canSwitchHub && (
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-[var(--card-bg)] shadow-dropdown border border-neutral-200 dark:border-neutral-800 overflow-hidden animate-scale-in origin-top-right max-h-96 overflow-y-auto">
                    {isSuperAdmin && (
                      <button
                        onClick={() => { hub.selectAllHubs(); setHubMenuOpen(false); }}
                        className={clsx(
                          'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition hover:bg-neutral-100 dark:hover:bg-neutral-800',
                          hub.isAllHubs ? 'text-brand-600 bg-brand-50 dark:bg-brand-600/10' : 'text-neutral-700 dark:text-neutral-300'
                        )}
                      >
                        <Layers className="h-4 w-4 text-neutral-500" />
                        All Hubs
                        {hub.isAllHubs && <Check className="h-4 w-4 ml-auto text-brand-600" />}
                      </button>
                    )}
                    <div className={clsx(isSuperAdmin && 'border-t border-neutral-200 dark:border-neutral-800')}>
                      {hub.accessibleHubs.map((h) => (
                        <button
                          key={h.id}
                          onClick={() => { hub.selectHub(h.id); setHubMenuOpen(false); }}
                          className={clsx(
                            'w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition hover:bg-neutral-100 dark:hover:bg-neutral-800',
                            hub.selectedHubId === h.id && !hub.isAllHubs ? 'text-brand-600 bg-brand-50 dark:bg-brand-600/10' : 'text-neutral-700 dark:text-neutral-300'
                          )}
                        >
                          <Building2 className="h-4 w-4 text-neutral-500" />
                          <div className="min-w-0 flex-1 text-left">
                            <p className="truncate">{h.name}</p>
                            <p className="text-[11px] text-neutral-500 font-mono">{h.code}</p>
                          </div>
                          {hub.selectedHubId === h.id && !hub.isAllHubs && <Check className="h-4 w-4 text-brand-600" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* User menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 px-2 py-1.5 transition active:scale-95"
              >
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-brand-600 to-brand-400 text-white flex items-center justify-center font-bold text-sm shadow-glow">
                  {profile.name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 leading-tight max-w-[140px] truncate">{profile.name}</p>
                  <p className="text-xs text-neutral-500 leading-tight">{ROLE_LABELS[profile.role]}</p>
                </div>
                <ChevronDown className={`hidden md:block h-4 w-4 text-neutral-500 dark:text-neutral-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-[var(--card-bg)] shadow-dropdown border border-neutral-200 dark:border-neutral-800 overflow-hidden animate-scale-in origin-top-right">
                  <div className="px-4 py-3.5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/60">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-full bg-gradient-to-br from-brand-600 to-brand-400 text-white flex items-center justify-center font-bold text-base shadow-glow shrink-0">
                        {profile.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 truncate">{profile.name}</p>
                        <p className="text-xs text-neutral-500 truncate">{profile.email}</p>
                      </div>
                    </div>
                    <span className="mt-3 inline-flex items-center gap-1 rounded-lg bg-brand-600/15 text-brand-600 px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ring-brand-600/30">
                      {ROLE_LABELS[profile.role]}
                    </span>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-500/10 transition active:scale-[0.98]"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="app-content min-h-0 min-w-0 w-full max-w-full flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain p-3 sm:p-5 lg:p-7">
          <div className="mx-auto w-full min-w-0 max-w-[1500px]">
            {/* Subscription Warning / Expired Banner for monthly users */}
            {profile?.role !== 'super_admin' && subDetails.isNearExpiry && (
              <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                      ⚠️ Your subscription expires in {subDetails.daysRemaining} day{subDetails.daysRemaining === 1 ? '' : 's'}.
                    </p>
                    <p className="text-xs text-amber-600/80 dark:text-amber-400/70">
                      Renew your monthly plan to keep uninterrupted access to HubVault.
                    </p>
                  </div>
                </div>
                <Link
                  to="/payment"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-semibold transition active:scale-95 shrink-0"
                >
                  Renew Now
                </Link>
              </div>
            )}

            {profile?.role !== 'super_admin' && subDetails.status === 'expired' && (
              <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-red-700 dark:text-red-400">
                      🔴 Subscription Expired
                    </p>
                    <p className="text-xs text-red-600/80 dark:text-red-400/70">
                      Your monthly subscription has ended. Renew your plan to unlock your workspace.
                    </p>
                  </div>
                </div>
                <Link
                  to="/payment"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-sm font-semibold transition active:scale-95 shrink-0"
                >
                  Renew Now
                </Link>
              </div>
            )}

            {/* License activation banner for pending hub_admins */}
            {isHubAdminPending && (
              <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                      30-day free access active
                    </p>
                    <p className="text-xs text-amber-600/80 dark:text-amber-400/70">
                      {licenseCountdown ? (
                        <>Free time remaining: <strong className="font-mono">{licenseCountdown}</strong> — choose a plan before it ends.</>
                      ) : (
                        'Your free-access period is ending soon.'
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setLicenseModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 text-sm font-semibold transition active:scale-95 shrink-0"
                >
                  <KeyRound className="h-4 w-4" />
                  Activate Now
                </button>
                {licenseBannerDismissed ? (
                  <button
                    onClick={() => setLicenseBannerDismissed(false)}
                    className="text-xs text-amber-600 dark:text-amber-400 hover:underline shrink-0"
                  >
                    Show banner
                  </button>
                ) : (
                  <button
                    onClick={() => setLicenseBannerDismissed(true)}
                    className="text-xs text-amber-600/70 dark:text-amber-400/70 hover:underline shrink-0"
                  >
                    Dismiss
                  </button>
                )}
              </div>
            )}
            <Outlet />
          </div>
        </main>
      </div>

      {/* License Activation Modal */}
      {isHubAdminPending && (
        <LicenseActivationModal
          open={licenseModalOpen}
          onClose={() => { setLicenseModalOpen(false); setLicenseBannerDismissed(true); }}
          profile={profile}
          onActivated={() => { setLicenseModalOpen(false); refreshProfile(); }}
          onExpired={handleLicenseExpired}
        />
      )}

      {/* Sync Conflict Resolver Modal */}
      <ConflictResolver />
    </div>
  );
}
