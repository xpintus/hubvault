import PurchaseFormModal from '@/components/PurchaseFormModal';
import { Card } from '@/components/ui/primitives';
import { useAuth } from '@/lib/auth';
import { formatDateLong,formatINR } from '@/lib/format';
import { clsx } from 'clsx';
import {
AlertCircle,
ArrowRight,
BadgeCheck,
Banknote,
Building2,Calendar,CheckCircle2,Clock,
Lock,Phone,
Receipt,
RotateCcw,
Scale,
ShoppingBag,
Smartphone,
Sparkles,
Target,
TrendingDown,TrendingUp,
Wallet,
X,
} from 'lucide-react';
import { useCallback,useEffect,useState } from 'react';

const DUMMY_KPIS = [
  { label: 'Total Expected COD', value: 485200, icon: Target, accent: 'slate', sub: '12 entries' },
  { label: 'Total Collection', value: 472800, icon: Wallet, accent: 'brand', sub: '12 entries today' },
  { label: 'Cash Collected', value: 318500, icon: Banknote, accent: 'emerald', sub: '67% of total' },
  { label: 'Online Collected', value: 154300, icon: Smartphone, accent: 'blue', sub: '33% of total' },
  { label: 'On Track', value: -12400, icon: Scale, accent: 'red', sub: 'vs Expected: ₹4,85,200' },
];

const DUMMY_DUES = [
  { label: 'Pending Today', value: 12400, icon: AlertCircle, accent: 'amber', sub: 'unpaid from today' },
  { label: 'Outstanding Dues', value: 38600, icon: TrendingDown, accent: 'red', sub: 'total across all dates' },
  { label: 'Recovery Today', value: 8500, icon: RotateCcw, accent: 'blue', sub: '3 transactions' },
  { label: 'Recovery This Month', value: 42500, icon: CheckCircle2, accent: 'brand', sub: 'total recovered' },
];

const DUMMY_ENTRIES = [
  { collector: 'Rajesh Kumar', empId: 'EMP-001', phone: '+91 98765 43210', expected: 48500, cash: 32000, online: 15500, total: 47500, status: 'shortage', gap: -1000 },
  { collector: 'Priya Sharma', empId: 'EMP-002', phone: '+91 98765 11122', expected: 52000, cash: 36000, online: 16000, total: 52000, status: 'reconciled', gap: 0 },
  { collector: 'Mohammed Ali', empId: 'EMP-003', phone: '+91 98765 33344', expected: 41000, cash: 28000, online: 13500, total: 41500, status: 'excess', gap: 500 },
  { collector: 'Sneha Patel', empId: 'EMP-004', phone: '+91 98765 55566', expected: 38000, cash: 25500, online: 12000, total: 37500, status: 'shortage', gap: -500 },
  { collector: 'Arjun Singh', empId: 'EMP-005', phone: '+91 98765 77788', expected: 45000, cash: 30000, online: 15000, total: 45000, status: 'reconciled', gap: 0 },
  { collector: 'Deepika Rao', empId: 'EMP-006', phone: '+91 98765 99900', expected: 36000, cash: 24000, online: 11500, total: 35500, status: 'pending', gap: -500 },
];

const STATUS_STYLES: Record<string, string> = {
  reconciled: 'bg-brand-600/15 text-brand-600 ring-brand-600/30',
  pending: 'bg-amber-500/15 text-amber-600 ring-amber-500/30',
  shortage: 'bg-red-500/15 text-red-500 ring-red-500/30',
  excess: 'bg-blue-500/15 text-blue-500 ring-blue-500/30',
};

const accentMap: Record<string, { icon: string; ring: string }> = {
  brand: { icon: 'bg-brand-600/15 text-brand-600', ring: 'ring-brand-600/30' },
  emerald: { icon: 'bg-emerald-500/10 text-emerald-500', ring: 'ring-emerald-500/30' },
  blue: { icon: 'bg-blue-500/10 text-blue-500', ring: 'ring-blue-500/30' },
  red: { icon: 'bg-red-500/10 text-red-500', ring: 'ring-red-500/30' },
  amber: { icon: 'bg-amber-500/10 text-amber-600', ring: 'ring-amber-500/30' },
  slate: { icon: 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400', ring: 'ring-neutral-300 dark:ring-neutral-700' },
};

function DummyRowHoverPopup({ entry }: { entry: typeof DUMMY_ENTRIES[0] }) {
  const dummyDenoms = [
    { label: '₹500', qty: Math.floor(entry.cash / 500) },
    { label: '₹200', qty: Math.floor((entry.cash % 500) / 200) },
    { label: '₹100', qty: Math.floor(((entry.cash % 500) % 200) / 100) },
  ];
  const hasDenoms = dummyDenoms.some((d) => d.qty > 0);

  return (
    <div className="pointer-events-none absolute z-50 left-0 top-full mt-1 w-80 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 ease-out">
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-[var(--card-bg)] shadow-2xl shadow-black/50 p-4 text-left">
        <div className="flex items-center gap-3 pb-3 border-b border-neutral-200 dark:border-neutral-800">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-600/20 to-brand-600/10 text-brand-600 flex items-center justify-center font-bold text-sm shrink-0">
            {entry.collector.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-neutral-900 dark:text-neutral-100 truncate">{entry.collector}</p>
            <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
              <span className="flex items-center gap-1">
                <BadgeCheck className="h-3 w-3" />
                {entry.empId}
              </span>
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {entry.phone}
              </span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="rounded-lg bg-neutral-100 dark:bg-neutral-950 px-3 py-2">
            <p className="text-[11px] text-neutral-500">Expected COD</p>
            <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200 tabular-nums">{formatINR(entry.expected)}</p>
          </div>
          <div className="rounded-lg bg-neutral-100 dark:bg-neutral-950 px-3 py-2">
            <p className="text-[11px] text-neutral-500">Total Collection</p>
            <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200 tabular-nums">{formatINR(entry.total)}</p>
          </div>
          <div className="rounded-lg bg-emerald-500/5 px-3 py-2">
            <p className="text-[11px] text-neutral-500">Cash</p>
            <p className="text-sm font-bold text-emerald-400 tabular-nums">{formatINR(entry.cash)}</p>
          </div>
          <div className="rounded-lg bg-blue-500/5 px-3 py-2">
            <p className="text-[11px] text-neutral-500">Online</p>
            <p className="text-sm font-bold text-blue-400 tabular-nums">{formatINR(entry.online)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 rounded-lg bg-neutral-100 dark:bg-neutral-950 px-3 py-2 text-center">
            <p className="text-[11px] text-neutral-500">Gap</p>
            <p className={clsx('text-sm font-bold tabular-nums', entry.gap < 0 ? 'text-red-400' : entry.gap > 0 ? 'text-amber-400' : 'text-brand-600')}>
              {entry.gap < 0 ? '-' : entry.gap > 0 ? '+' : ''}{formatINR(Math.abs(entry.gap))}
            </p>
          </div>
          {entry.gap < 0 && (
            <div className="flex-1 rounded-lg bg-amber-500/5 px-3 py-2 text-center">
              <p className="text-[11px] text-neutral-500">Pending</p>
              <p className="text-sm font-bold text-amber-400 tabular-nums">{formatINR(Math.abs(entry.gap))}</p>
            </div>
          )}
          {entry.gap > 0 && (
            <div className="flex-1 rounded-lg bg-brand-600/5 px-3 py-2 text-center">
              <p className="text-[11px] text-neutral-500">Excess</p>
              <p className="text-sm font-bold text-brand-600 tabular-nums">{formatINR(entry.gap)}</p>
            </div>
          )}
        </div>
        {hasDenoms && (
          <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
            <p className="flex items-center gap-1.5 text-xs font-bold text-neutral-500 dark:text-neutral-400 mb-2">
              <Receipt className="h-3.5 w-3.5" />
              Denomination Breakdown
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {dummyDenoms.map((d) => d.qty > 0 && (
                <div key={d.label} className="rounded-lg bg-neutral-100 dark:bg-neutral-950 px-2 py-1.5 text-center">
                  <p className="text-[10px] text-neutral-500">{d.label}</p>
                  <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200 tabular-nums">{d.qty}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GuestDashboard() {
  const { profile } = useAuth();
  const [showBuyBanner, setShowBuyBanner] = useState(false);
  const [_bannerDismissed, setBannerDismissed] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(3);

  const showBanner = useCallback(() => {
    setShowBuyBanner(true);
    setBannerDismissed(false);
    setSecondsLeft(3);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!purchaseOpen) {
        showBanner();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [showBanner, purchaseOpen]);

  useEffect(() => {
    if (!showBuyBanner || purchaseOpen) return;
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [showBuyBanner, secondsLeft, purchaseOpen]);

  const dismissBanner = () => {
    setShowBuyBanner(false);
    setBannerDismissed(true);
  };

  const openPurchase = () => {
    setPurchaseOpen(true);
    setShowBuyBanner(false);
  };

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Dashboard</h1>
          <p className="mt-1 text-sm text-neutral-500">Monitor daily collections and reconciliation status.</p>
          <div className="mt-2 flex items-center gap-2 text-sm text-neutral-500">
            <Calendar className="h-4 w-4 text-neutral-400" />
            {formatDateLong(new Date())}
            <span className="text-neutral-400">·</span>
            <Building2 className="h-4 w-4 text-neutral-400" />
            <span className="font-medium text-neutral-400">Mumbai Central Hub</span>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 ring-1 ring-inset ring-amber-500/30">
          <Lock className="h-4 w-4 text-amber-600" />
          <span className="text-xs font-semibold text-amber-600">Trial Preview</span>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {DUMMY_KPIS.map((c) => {
          const a = accentMap[c.accent];
          const isGap = c.label === 'Shortage' || c.label === 'Excess' || c.label === 'On Track';
          return (
            <Card key={c.label} hover className="p-5 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className={clsx('flex h-11 w-11 items-center justify-center rounded-xl ring-1', a.icon, a.ring)}>
                  <c.icon className="h-5 w-5" />
                </div>
                {isGap && c.value !== 0 && (
                  <span className={clsx(
                    'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold',
                    c.value < 0 ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
                  )}>
                    {c.value < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                    {c.value < 0 ? 'SHORT' : 'OVER'}
                  </span>
                )}
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium text-neutral-500">{c.label}</p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 tabular-nums">
                  {isGap && c.value < 0 ? '-' : isGap && c.value > 0 ? '+' : ''}
                  {formatINR(Math.abs(c.value))}
                </p>
                <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">{c.sub}</p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Dues & Recovery KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {DUMMY_DUES.map((c) => {
          const a = accentMap[c.accent];
          return (
            <Card key={c.label} hover className="p-5 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className={clsx('flex h-11 w-11 items-center justify-center rounded-xl ring-1', a.icon, a.ring)}>
                  <c.icon className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium text-neutral-500">{c.label}</p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 tabular-nums">
                  {formatINR(c.value)}
                </p>
                <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">{c.sub}</p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Collection entries table */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">Today's Collections</h2>
          <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
            <Clock className="h-3.5 w-3.5" />
            <span>6 entries</span>
          </div>
        </div>
        <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {DUMMY_ENTRIES.map((e, i) => (
            <div
              key={i}
              className="group flex items-center gap-4 px-5 py-3.5 hover:bg-neutral-100 dark:hover:bg-neutral-950/70 transition-colors relative"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{e.collector}</p>
                  <span className={clsx('inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset capitalize', STATUS_STYLES[e.status])}>
                    {e.status}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {e.empId} · {e.phone}
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-6 text-right">
                <div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Expected</p>
                  <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 tabular-nums">{formatINR(e.expected)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-neutral-400">Cash</p>
                  <p className="text-sm font-medium text-emerald-500 tabular-nums">{formatINR(e.cash)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-neutral-400">Online</p>
                  <p className="text-sm font-medium text-blue-400 tabular-nums">{formatINR(e.online)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-neutral-400">Gap</p>
                  <p className={clsx('text-sm font-bold tabular-nums', e.gap < 0 ? 'text-red-400' : e.gap > 0 ? 'text-amber-400' : 'text-neutral-700 dark:text-neutral-300')}>
                    {e.gap < 0 ? '-' : e.gap > 0 ? '+' : ''}{formatINR(Math.abs(e.gap))}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Total</p>
                <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">{formatINR(e.total)}</p>
              </div>
              <DummyRowHoverPopup entry={e} />
            </div>
          ))}
        </div>
      </Card>

      {/* Lock overlay hint */}
      <Card className="p-8 text-center">
        <div className="mx-auto max-w-md">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600/15 text-brand-600 ring-1 ring-brand-600/20">
            <Lock className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">You're viewing a demo preview</h3>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
            This is a sample of what HubVault looks like for a Hub Admin. Purchase a lifetime license
            to unlock full access — manage real collections, employees, dues, and reports.
          </p>
          <button
            onClick={openPurchase}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-400 px-6 py-3 text-sm font-bold text-white shadow-glow hover:shadow-glow transition-all active:scale-95"
          >
            <ShoppingBag className="h-4 w-4" />
            Buy Now — ₹999 Lifetime
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </Card>

      {/* Floating Buy Now banner — appears every 10 seconds */}
      {showBuyBanner && !purchaseOpen && (
        <div className="fixed bottom-6 right-6 z-40 max-w-sm animate-slide-up">
          <div className="relative rounded-2xl bg-gradient-to-br from-brand-600 to-brand-400 p-5 shadow-glow text-white overflow-hidden">
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 blur-2xl" />
            <button
              onClick={dismissBanner}
              className="absolute top-3 right-3 rounded-lg p-1 text-white/70 hover:text-white hover:bg-white/10 transition"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Limited Time Offer</span>
              </div>
              <h3 className="text-lg font-bold leading-tight">Unlock HubVault for just ₹999</h3>
              <p className="mt-1.5 text-sm text-white/80 leading-relaxed">
                Lifetime license. All features. No subscriptions.
              </p>
              <div className="mt-2 flex items-center gap-2 text-xs text-white/70">
                <Clock className="h-3.5 w-3.5" />
                <span>Offer refreshes in {secondsLeft}s</span>
              </div>
              <button
                onClick={openPurchase}
                className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl bg-white text-brand-600 px-4 py-2.5 text-sm font-bold hover:bg-white/90 transition active:scale-95"
              >
                <ShoppingBag className="h-4 w-4" />
                Buy Now
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <PurchaseFormModal
        open={purchaseOpen}
        onClose={() => setPurchaseOpen(false)}
        prefillName={profile?.name}
        prefillEmail={profile?.email}
      />
    </div>
  );
}
