import AppLayout from '@/components/AppLayout';
import PublicLayout from '@/components/PublicLayout';
import { FullPageSpinner } from '@/components/ui/primitives';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { ToastProvider } from '@/components/ui/Toast';
import { AuthProvider,useAuth } from '@/lib/auth';
import { HubProvider } from '@/lib/hubContext';
import { NotificationProvider } from '@/lib/notifications';
import { SyncProvider } from '@/lib/offline/SyncContext';
import { SettingsProvider } from '@/lib/settings';
import { ThemeProvider } from '@/lib/theme';
import ForgotPassword from '@/pages/ForgotPassword';
import GuestDashboard from '@/pages/GuestDashboard';
import Login from '@/pages/Login';
import { lazy,Suspense,useEffect,useState } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter,HashRouter,Link,Navigate,Route,Routes,useLocation,useNavigate } from 'react-router-dom';

import PaymentPage from '@/pages/PaymentPage';
import About from '@/pages/public/About';
import BlogList from '@/pages/public/BlogList';
import BlogPost from '@/pages/public/BlogPost';
import BuyNow from '@/pages/public/BuyNow';
import CashCalculator from '@/pages/public/CashCalculator';
import CollectionReconciliationSoftware from '@/pages/public/CollectionReconciliationSoftware';
import CodReconciliationSoftware from '@/pages/public/CodReconciliationSoftware';
import DailyClosingSoftware from '@/pages/public/DailyClosingSoftware';
import LogisticsCashCollectionSoftware from '@/pages/public/LogisticsCashCollectionSoftware';
import Contact from '@/pages/public/Contact';
import FAQ from '@/pages/public/FAQ';
import Home from '@/pages/public/Home';
import Privacy from '@/pages/public/Privacy';
import Terms from '@/pages/public/Terms';
import TrialSignup from '@/pages/public/TrialSignup';

const Dashboard = lazy(() => import('@/pages/Dashboard'));
const ActivateLicense = lazy(() => import('@/pages/ActivateLicense'));
const Reports = lazy(() => import('@/pages/Reports'));
const Hubs = lazy(() => import('@/pages/Hubs'));
const Collectors = lazy(() => import('@/pages/Collectors'));
const Users = lazy(() => import('@/pages/Users'));
const TrialUsers = lazy(() => import('@/pages/TrialUsers'));
const Dues = lazy(() => import('@/pages/Dues'));
const Recovery = lazy(() => import('@/pages/Recovery'));
const Messages = lazy(() => import('@/pages/Messages'));
const Purchases = lazy(() => import('@/pages/Purchases'));
const AuditLogs = lazy(() => import('@/pages/AuditLogs'));
const Deposits = lazy(() => import('@/pages/Deposits'));
const DailyClosing = lazy(() => import('@/pages/DailyClosing'));
const Licenses = lazy(() => import('@/pages/Licenses'));
const ReferEarn = lazy(() => import('@/pages/ReferEarn'));
const Payouts = lazy(() => import('@/pages/Payouts'));
const SettingsPage = lazy(() => import('@/pages/Settings'));

const KhataBookLayout = lazy(() => import('@/pages/khatabook/KhataBookLayout'));
const KhataBookDashboard = lazy(() => import('@/pages/khatabook/Dashboard'));
const KhataBookParties = lazy(() => import('@/pages/khatabook/Parties'));
const KhataBookLedger = lazy(() => import('@/pages/khatabook/Ledger'));
const KhataBookReports = lazy(() => import('@/pages/khatabook/Reports'));

import { formatDateLong } from '@/lib/format';
import {
AlertCircle,
Building2,
Calendar,
FileBarChart,
LayoutDashboard,
Lock,LogOut,Menu,
RotateCcw,UserCog,
Users as UsersIcon,
Wallet
} from 'lucide-react';

function ProtectedRoutes() {
  const { user, profile, loading, signOut } = useAuth();
  useEffect(() => {
    if (!loading && user && !profile) {
      const timer = setTimeout(() => signOut(), 2000);
      return () => clearTimeout(timer);
    }
  }, [loading, user, profile, signOut]);
  if (loading) return <FullPageSpinner message="Loading…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <FullPageSpinner message="Loading…" />;
  // Only redirect expired hub_admins to activation page (pending ones use the dashboard with a popup)
  if (profile.role === 'hub_admin' && profile.license_status === 'expired') {
    return <Navigate to="/activate-license" replace />;
  }
  if (profile.role === 'guest' || profile.role === 'trial_user') {
    return (
      <HubProvider>
        <GuestAppLayout />
      </HubProvider>
    );
  }
  return (
    <HubProvider>
      <AppLayout />
    </HubProvider>
  );
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageSpinner message="Loading…" />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  const isCleanPublicSeoUrl = ['/tools/cash-calculator','/collection-reconciliation-software','/cod-reconciliation-software','/daily-closing-software','/logistics-cash-collection-software'].includes(window.location.pathname);
  return (
    <HelmetProvider>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <NotificationProvider>
              <SettingsProvider>
                <SyncProvider>
                {isCleanPublicSeoUrl ? <BrowserRouter>
                  <Routes>
                    <Route element={<PublicLayout />}>
                      <Route path="/tools/cash-calculator" element={<CashCalculator />} />
                      <Route path="/collection-reconciliation-software" element={<CollectionReconciliationSoftware />} />
                      <Route path="/cod-reconciliation-software" element={<CodReconciliationSoftware />} />
                      <Route path="/daily-closing-software" element={<DailyClosingSoftware />} />
                      <Route path="/logistics-cash-collection-software" element={<LogisticsCashCollectionSoftware />} />
                    </Route>
                    <Route path="*" element={<HashAppRedirect />} />
                  </Routes>
                </BrowserRouter> : <HashRouter>
              <Routes>
                {/* Public routes */}
                <Route element={<PublicLayout />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/contact" element={<Contact />} />
                  <Route path="/trial-signup" element={<TrialSignup />} />
                  <Route path="/buy-now" element={<BuyNow />} />
                  <Route path="/payment" element={<PaymentPage />} />
                  <Route path="/faq" element={<FAQ />} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/blog" element={<BlogList />} />
                  <Route path="/blog/:slug" element={<BlogPost />} />
                  <Route path="/tools/cash-calculator" element={<CashCalculator />} />
                </Route>

                {/* Login */}
                <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/activate-license" element={<ActivateLicense />} />

                {/* Protected app routes */}
                <Route element={<ProtectedRoutes />}>
                  <Route path="/dashboard" element={<Suspense fallback={<FullPageSpinner message="Loading dashboard…" />}><Dashboard /></Suspense>} />
                  <Route path="/khatabook" element={<Suspense fallback={<FullPageSpinner message="Loading KhataBook…" />}><KhataBookLayout /></Suspense>}>
                    <Route index element={<Navigate to="/khatabook/dashboard" replace />} />
                    <Route path="dashboard" element={<KhataBookDashboard />} />
                    <Route path="parties" element={<KhataBookParties />} />
                    <Route path="ledger" element={<KhataBookLedger />} />
                    <Route path="reports" element={<KhataBookReports />} />
                  </Route>
                  <Route path="/reports" element={<Suspense fallback={<FullPageSpinner message="Loading reports…" />}><Reports /></Suspense>} />
                  <Route path="/hubs" element={<Suspense fallback={<FullPageSpinner message="Loading hubs…" />}><Hubs /></Suspense>} />
                  <Route path="/collectors" element={<Suspense fallback={<FullPageSpinner message="Loading employees…" />}><Collectors /></Suspense>} />
                  <Route path="/dues" element={<Suspense fallback={<FullPageSpinner message="Loading dues…" />}><Dues /></Suspense>} />
                  <Route path="/recovery" element={<Suspense fallback={<FullPageSpinner message="Loading recovery…" />}><Recovery /></Suspense>} />
                  <Route path="/users" element={<Suspense fallback={<FullPageSpinner message="Loading users…" />}><Users /></Suspense>} />
                  <Route path="/trial-users" element={<Suspense fallback={<FullPageSpinner message="Loading trial users…" />}><TrialUsers /></Suspense>} />
                  <Route path="/messages" element={<Suspense fallback={<FullPageSpinner message="Loading messages…" />}><Messages /></Suspense>} />
                  <Route path="/purchases" element={<Suspense fallback={<FullPageSpinner message="Loading purchases…" />}><Purchases /></Suspense>} />
                  <Route path="/audit-logs" element={<Suspense fallback={<FullPageSpinner message="Loading audit logs…" />}><AuditLogs /></Suspense>} />
                  <Route path="/licenses" element={<Suspense fallback={<FullPageSpinner message="Loading licenses…" />}><Licenses /></Suspense>} />
                  <Route path="/refer-earn" element={<Suspense fallback={<FullPageSpinner message="Loading referrals…" />}><ReferEarn /></Suspense>} />
                  <Route path="/payouts" element={<Suspense fallback={<FullPageSpinner message="Loading payouts…" />}><Payouts /></Suspense>} />
                  <Route path="/settings" element={<Suspense fallback={<FullPageSpinner message="Loading settings…" />}><SettingsPage /></Suspense>} />
                  <Route path="/deposits" element={<Suspense fallback={<FullPageSpinner message="Loading deposits…" />}><Deposits /></Suspense>} />
                  <Route path="/daily-closing" element={<Suspense fallback={<FullPageSpinner message="Loading daily closing…" />}><DailyClosing /></Suspense>} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
                </HashRouter>}
                </SyncProvider>
              </SettingsProvider>
            </NotificationProvider>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </HelmetProvider>
  );
}

function HashAppRedirect() {
  const location = useLocation();
  useEffect(() => {
    window.location.replace(`/#${location.pathname}${location.search}${location.hash}`);
  }, [location]);
  return <FullPageSpinner message="Opening HubVault…" />;
}

function GuestAppLayout() {
  const { profile, loading, signOut, user } = useAuth();
  const navigate = useNavigate();
  const _location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && (!user || !profile)) {
      navigate('/login', { replace: true });
    }
  }, [loading, user, profile, navigate]);

  if (loading) return <FullPageSpinner message="Loading your workspace…" />;
  if (!profile) return null;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--page-bg)' }}>
      {/* Simplified sidebar for guest */}
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden animate-fade-in" onClick={() => setSidebarOpen(false)} />}
      <aside className="fixed lg:sticky top-0 z-40 h-screen w-64 border-r border-neutral-200 dark:border-neutral-800 flex flex-col shrink-0" style={{ background: 'var(--card-bg)' }}>
        <Link to="/" className="flex items-center gap-2.5 h-16 px-5 border-b border-neutral-200 dark:border-neutral-800 shrink-0 rounded-xl transition active:scale-95" title="Go to homepage">
          <div className="rounded-xl bg-gradient-to-br from-brand-600 to-brand-400 p-2 text-white shadow-glow shrink-0">
            <Wallet className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-neutral-900 dark:text-neutral-100 text-sm leading-tight truncate">HubVault</p>
            <p className="text-[11px] text-neutral-500 leading-tight">Reconciliation Suite</p>
          </div>
        </Link>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Menu</p>
          <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium bg-brand-50 dark:bg-brand-600/15 text-brand-600 relative">
            <span className="absolute left-0 w-1 h-6 rounded-r-full bg-brand-600 shadow-glow" />
            <LayoutDashboard className="h-[18px] w-[18px] text-brand-600" />
            <span>Dashboard</span>
          </div>
          <p className="px-3 pt-4 pb-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Locked Features</p>
          {[
            { label: 'Reports', icon: FileBarChart },
            { label: 'Hub Management', icon: Building2 },
            { label: 'Employees', icon: UsersIcon },
            { label: 'Dues', icon: AlertCircle },
            { label: 'Recovery', icon: RotateCcw },
            { label: 'Users & Access', icon: UserCog },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-600 dark:text-neutral-400 cursor-not-allowed">
              <item.icon className="h-[18px] w-[18px] text-neutral-700 dark:text-neutral-300" />
              <span>{item.label}</span>
              <Lock className="h-3.5 w-3.5 text-neutral-700 dark:text-neutral-300 ml-auto" />
            </div>
          ))}
        </nav>
        <div className="border-t border-neutral-200 dark:border-neutral-800 p-3 shrink-0" style={{ background: 'var(--card-bg)' }}>
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-brand-600 to-brand-400 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-glow">
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 truncate">{profile.name}</p>
              <p className="text-[11px] text-neutral-500 truncate">Guest User</p>
            </div>
            <button onClick={handleSignOut} title="Sign out" className="text-neutral-500 hover:text-red-500 p-2 rounded-lg hover:bg-red-500/10 transition active:scale-90">
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 backdrop-blur-xl border-b border-neutral-200 dark:border-neutral-800 h-16 flex items-center justify-between px-4 lg:px-6 gap-3" style={{ background: 'color-mix(in srgb, var(--page-bg) 90%, transparent)' }}>
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 p-2 -ml-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition active:scale-95">
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base lg:text-lg font-bold text-neutral-900 dark:text-neutral-100 truncate tracking-tight">Dashboard</h1>
              <p className="hidden sm:flex items-center gap-1.5 text-xs text-neutral-500 font-medium">
                <Calendar className="h-3 w-3" />
                {formatDateLong(new Date())}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 rounded-xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 px-3 py-2">
              <Building2 className="h-4 w-4 text-brand-600" />
              <div className="text-left">
                <p className="text-[10px] text-brand-600/80 leading-none uppercase tracking-wider font-bold">Hub / Branch</p>
                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 leading-tight mt-0.5">Mumbai Central</p>
              </div>
            </div>
            <ThemeToggle />
            <div className="flex items-center gap-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 px-2 py-1.5 transition">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-brand-600 to-brand-400 text-white flex items-center justify-center font-bold text-sm shadow-glow">
                {profile.name.charAt(0).toUpperCase()}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 leading-tight max-w-[140px] truncate">{profile.name}</p>
                <p className="text-xs text-neutral-500 leading-tight">Guest User</p>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="max-w-7xl mx-auto">
            <GuestDashboard />
          </div>
        </main>
      </div>
    </div>
  );
}
