import SEO from '@/components/SEO';
import AdSlot from '@/components/ui/AdSlot';
import Modal from '@/components/ui/Modal';
import {
ArrowRight,
Banknote,
BarChart3,
Building2,
Check,
CheckCircle2,
Coins,
FileText,
RotateCcw,
Scale,
Send,
ShieldCheck,
Smartphone,
Sparkles,
Tag,
TrendingUp,
Users,
Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

const PRICE = 999;
const BUY_FEATURES = [
  'Lifetime access — pay once, use forever',
  'Unlimited hubs, collectors & transactions',
  'Daily reconciliation, dues & recovery tracking',
  'Real-time dashboards & one-click reports',
  'Free updates and bug fixes included',
];

const FEATURES = [
  { icon: BarChart3, title: 'Real-Time Dashboards', desc: 'Track daily collections, shortages, and excesses across all hubs with live dashboards and trend analysis.' },
  { icon: Banknote, title: 'Denomination Tracking', desc: 'Capture cash note-by-note with automatic total calculation. Eliminate counting errors at the source.' },
  { icon: Smartphone, title: 'Online Payment Tracking', desc: 'Record UPI, bank transfers, and digital payments separately from cash for accurate mixed-mode reconciliation.' },
  { icon: Scale, title: 'Automated Gap Detection', desc: 'The system instantly flags shortages, excesses, and exact matches — no manual comparison needed.' },
  { icon: RotateCcw, title: 'Dues & Recovery Management', desc: 'Track pending dues from employees and manage recovery with clear, auditable records.' },
  { icon: Building2, title: 'Multi-Hub Management', desc: 'Operate multiple hubs independently while management sees a consolidated view across all locations.' },
  { icon: Users, title: 'Role-Based Access', desc: 'Super Admin, Hub Admin, and Hub Supervisor roles ensure each person sees only what they need.' },
  { icon: FileText, title: 'Automated Reports', desc: 'Generate daily, weekly, and monthly reconciliation reports with one click. Export to Excel anytime.' },
];

const STATS = [
  {
    value: '100%',
    label: 'Reconciliation Accuracy',
    icon: Scale,
    title: 'Every rupee accounted for',
    desc: 'HubVault compares expected COD amounts against actual collections — note by note — so shortages and excesses are caught the moment data is entered. No manual tallying, no end-of-day surprises.',
    points: [
      'Automatic gap detection between expected and collected amounts',
      'Note-level denomination validation eliminates counting errors',
      'Color-coded status flags: matched, shortage, or excess',
    ],
  },
  {
    value: '50+',
    label: 'Hubs Managed',
    icon: Building2,
    title: 'One platform, every location',
    desc: 'Operate multiple hubs independently while management sees a single consolidated view. Each hub keeps its own collectors and records, yet leadership gets the full picture in real time.',
    points: [
      'Independent hub operations with shared oversight',
      'Consolidated dashboards across all locations',
      'Per-hub collectors, entries, and reconciliation reports',
    ],
  },
  {
    value: '10x',
    label: 'Faster Reconciliation',
    icon: TrendingUp,
    title: 'Minutes instead of hours',
    desc: 'Manual reconciliation across spreadsheets and WhatsApp messages takes hours every evening. HubVault turns that into a structured, validated flow that closes out in minutes.',
    points: [
      'Structured entry forms with built-in validation',
      'Instant totals from denomination breakdowns',
      'One-click Excel export for any date range',
    ],
  },
  {
    value: '24/7',
    label: 'Real-Time Visibility',
    icon: BarChart3,
    title: 'Know where you stand, anytime',
    desc: 'Live dashboards update as collections are recorded, so you always know the day\'s status — whether you are at the hub, at home, or on the road.',
    points: [
      'Live dashboards refresh as entries are saved',
      'Track dues and recoveries across staff and hubs',
      'Access from any device — desktop, tablet, or phone',
    ],
  },
];

export default function Home() {
  const [statOpen, setStatOpen] = useState<number | null>(null);
  const activeStat = statOpen !== null ? STATS[statOpen] : null;
  return (
    <>
      <SEO
        title="HubVault — Collection Reconciliation Suite"
        description="Digital collection reconciliation platform for logistics and delivery businesses. Track cash and online collections, manage dues, and reconcile across multiple hubs in real time."
        path="/"
      />

      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden">
        {/* Background — light: soft lavender; dark: deep purple */}
        <div className="absolute inset-0 bg-[#F8FAFC] dark:bg-[#0F172A]" />
        {/* Gradient glow blobs */}
        <div className="absolute top-0 -right-32 w-[500px] h-[500px] rounded-full bg-brand-400/20 dark:bg-brand-600/20 blur-[120px]" />
        <div className="absolute -bottom-32 -left-20 w-[450px] h-[450px] rounded-full bg-accent-400/20 dark:bg-accent-600/20 blur-[120px]" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-brand-300/10 dark:bg-brand-500/10 blur-[100px]" />
        {/* Dot pattern */}
        <div
          className="absolute inset-0 opacity-[0.15] dark:opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(circle at 25% 25%, #6366F1 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        {/* Floating decorative elements */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute top-[15%] left-[8%] animate-sway">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-400 text-white shadow-lg shadow-brand-600/30 ring-4 ring-brand-400/20">
              <Coins className="h-7 w-7" />
            </div>
          </div>
          <div className="absolute top-[20%] right-[10%] animate-sway-reverse">
            <div className="flex h-12 w-20 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-lg shadow-brand-600/30 ring-2 ring-brand-400/20">
              <Banknote className="h-6 w-6" />
            </div>
          </div>
          <div className="absolute top-[55%] left-[12%] animate-sway-reverse" style={{ animationDelay: '1.2s' }}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-md ring-2 ring-accent-400/20">
              <Coins className="h-5 w-5" />
            </div>
          </div>
          <div className="absolute bottom-[18%] right-[14%] animate-sway" style={{ animationDelay: '0.8s' }}>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/80 dark:bg-white/10 backdrop-blur text-brand-600 shadow-lg ring-2 ring-brand-400/20">
              <Wallet className="h-6 w-6" />
            </div>
          </div>
          <div className="absolute top-[45%] right-[8%] animate-sway" style={{ animationDelay: '2s' }}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 dark:bg-white/10 backdrop-blur text-accent-500 shadow-md ring-2 ring-accent-400/20">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="absolute bottom-0 left-[20%] animate-float-coin" style={{ animationDelay: '0s' }}>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-400/40 text-brand-600 shadow-md ring-1 ring-brand-400/20">
              <Coins className="h-4 w-4" />
            </div>
          </div>
          <div className="absolute bottom-0 right-[22%] animate-float-note" style={{ animationDelay: '2.5s' }}>
            <div className="flex h-7 w-12 items-center justify-center rounded-md bg-accent-400/40 text-accent-600 shadow-md ring-1 ring-accent-400/20">
              <Banknote className="h-4 w-4" />
            </div>
          </div>
          <div className="absolute bottom-0 left-[40%] animate-float-coin" style={{ animationDelay: '4s' }}>
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-300/50 text-brand-600 shadow-md ring-1 ring-brand-400/20">
              <Coins className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-600/10 border border-brand-600/20 px-4 py-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              Trusted by logistics teams across India
            </span>
            <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] text-neutral-800 dark:text-neutral-200">
              Reconcile daily COD collections
              <span className="block mt-1 gradient-text">with precision.</span>
            </h1>
            <p className="mt-6 text-lg text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-2xl mx-auto">
              Track cash and online collections across hubs, verify note denominations, and close every day
              with a clear picture of shortages, excesses, and reconciliation rates.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/buy-now"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-400 px-6 py-3.5 text-sm font-bold text-white shadow-glow hover:shadow-glow transition-all active:scale-95"
              >
                Buy Now
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/about"
                className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-brand-600/20 bg-white/60 dark:bg-white/5 backdrop-blur px-6 py-3.5 text-sm font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-white dark:hover:bg-white/10 transition-all"
              >
                Learn More
              </Link>
              <Link
                to="/login"
                className="sm:hidden w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-400 px-6 py-3.5 text-sm font-bold text-white shadow-glow hover:shadow-glow transition-all active:scale-95"
              >
                Login
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {STATS.map((stat, i) => (
              <button
                key={stat.label}
                type="button"
                onClick={() => setStatOpen(i)}
                className="card p-5 text-center animate-count-up group/stat cursor-pointer transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <p className="text-2xl lg:text-3xl font-bold gradient-text tabular-nums">{stat.value}</p>
                <p className="mt-1 text-xs lg:text-sm text-neutral-400 font-medium">{stat.label}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 dark:text-brand-400 opacity-0 -translate-y-1 transition-all duration-300 group-hover/stat:opacity-100 group-hover/stat:translate-y-0">
                  View details
                  <ArrowRight className="h-3 w-3" />
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section id="features" className="py-20 lg:py-28 bg-[#F1F5F9] dark:bg-[#1E293B]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-wide">Features</span>
            <h2 className="mt-2 text-3xl lg:text-4xl font-bold tracking-tight text-neutral-800 dark:text-neutral-200">
              Everything you need to reconcile collections
            </h2>
            <p className="mt-4 text-lg text-neutral-500 dark:text-neutral-400">
              A complete toolkit for collection management — from denomination tracking to multi-hub reporting.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="card-hover p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600/10 text-brand-600 dark:text-brand-400 ring-1 ring-brand-600/20">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-neutral-800 dark:text-neutral-200">{f.title}</h3>
                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FREE TOOLS ===== */}
      <section id="tools" className="py-20 lg:py-24 bg-[#F8FAFC] dark:bg-[#0F172A]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-brand-600/15 bg-gradient-to-br from-white to-brand-50 p-7 shadow-soft dark:from-neutral-900 dark:to-brand-950/30 dark:border-brand-500/20 sm:p-10 lg:flex lg:items-center lg:justify-between lg:gap-10">
            <div className="max-w-2xl">
              <span className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">Free Tools</span>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Count cash without calculation mistakes</h2>
              <p className="mt-3 text-neutral-500 dark:text-neutral-400">Use our free Cash Denomination Calculator to count ₹500 to ₹1 notes, see the live total, and copy or print the summary. No login required.</p>
            </div>
            <a href="/tools/cash-calculator" className="mt-6 inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-6 py-3 text-sm font-bold text-white shadow-glow transition active:scale-95 lg:mt-0"><Banknote className="h-5 w-5" />Open Cash Calculator<ArrowRight className="h-4 w-4" /></a>
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="py-20 lg:py-28 bg-[#F8FAFC] dark:bg-[#0F172A]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-wide">How It Works</span>
            <h2 className="mt-2 text-3xl lg:text-4xl font-bold tracking-tight text-neutral-800 dark:text-neutral-200">
              Reconcile in three simple steps
            </h2>
          </div>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: '01', icon: FileText, title: 'Record Collections', desc: 'Enter daily cash denominations and online payments with structured, validated forms.' },
              { step: '02', icon: Scale, title: 'Auto-Reconcile', desc: 'The system compares expected vs. actual, flagging shortages, excesses, and exact matches instantly.' },
              { step: '03', icon: BarChart3, title: 'Review & Report', desc: 'Check real-time dashboards, track dues, and export reports for any period in one click.' },
            ].map((s) => (
              <div key={s.step} className="card p-8 relative overflow-hidden">
                <span className="absolute -top-4 -right-4 text-7xl font-black text-brand-600/5 dark:text-brand-400/10 select-none">{s.step}</span>
                <div className="relative">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-400 text-white shadow-glow">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-neutral-800 dark:text-neutral-200">{s.title}</h3>
                  <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== In-content ad ===== */}
      <section className="py-6 bg-white dark:bg-[#0F172A]">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <AdSlot slot="1111111111" className="rounded-2xl overflow-hidden" />
        </div>
      </section>

      {/* ===== BUY — LIFETIME LICENSE ===== */}
      <section id="pricing" className="py-20 lg:py-28 bg-[#F1F5F9] dark:bg-[#1E293B]">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-600/10 border border-brand-600/20 px-4 py-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400">
              <Tag className="h-3.5 w-3.5" />
              Lifetime Deal
            </span>
            <h2 className="mt-4 text-3xl lg:text-4xl font-bold tracking-tight text-neutral-800 dark:text-neutral-200">
              Buy HubVault for just ₹{PRICE}
            </h2>
            <p className="mt-4 text-lg text-neutral-500 dark:text-neutral-400">
              One-time payment. Lifetime access. No subscriptions, no recurring fees — pay once and use it forever.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch">
            {/* Price card */}
            <div className="lg:col-span-2 relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-accent-600 p-8 text-white shadow-card-hover">
              <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-white/70" />
                  <span className="text-sm font-semibold uppercase tracking-wide text-white/80">Lifetime License</span>
                </div>
                <div className="mt-5 flex items-baseline gap-2">
                  <span className="text-5xl font-bold tracking-tight">₹{PRICE}</span>
                  <span className="text-lg text-white/50 line-through">₹2,999</span>
                </div>
                <p className="mt-2 text-sm text-white/70">One-time payment · No recurring fees</p>

                <div className="mt-8 space-y-3">
                  {BUY_FEATURES.map((f) => (
                    <div key={f} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-sm text-white/90 leading-snug">{f}</span>
                    </div>
                  ))}
                </div>

                <Link
                  to="/buy-now"
                  className="mt-8 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-brand-700 shadow-lg hover:bg-white/90 transition-all active:scale-95"
                >
                  Buy Now — ₹{PRICE}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* How it works card */}
            <div className="lg:col-span-3 card p-8">
              <h3 className="text-lg font-bold text-neutral-800 dark:text-neutral-200">How buying works</h3>
              <p className="mt-1.5 text-sm text-neutral-400">
                Simple, transparent, and secure — no payment gateway, no hidden charges.
              </p>
              <div className="mt-6 space-y-5">
                {[
                  { icon: Send, title: 'Fill in your details', desc: 'Click Buy Now and enter your name, email, phone, and a password. Your Hub Admin account is created instantly.' },
                  { icon: ShieldCheck, title: 'Get full access', desc: 'Your account gets Hub Admin role with hub creation access. You can immediately create hubs and start managing collections.' },
                  { icon: CheckCircle2, title: 'Start reconciling', desc: 'Sign in with your new credentials and you are all set to reconcile collections across unlimited hubs.' },
                ].map((s, i) => (
                  <div key={s.title} className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600/10 text-brand-600 dark:text-brand-400 ring-1 ring-brand-600/20">
                      <s.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                        <span className="text-brand-600 dark:text-brand-400">{i + 1}.</span> {s.title}
                      </p>
                      <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-xl bg-brand-600/5 border border-brand-600/15 p-4 flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-brand-600 dark:text-brand-400 shrink-0" />
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200">100% money-back guarantee</span> within 7 days if you are not satisfied.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="relative py-20 overflow-hidden bg-[#F8FAFC] dark:bg-[#0F172A]">
        <div className="absolute top-0 -right-32 w-[400px] h-[400px] rounded-full bg-brand-400/15 dark:bg-brand-600/15 blur-[120px]" />
        <div className="absolute -bottom-20 -left-20 w-[350px] h-[350px] rounded-full bg-accent-400/15 dark:bg-accent-600/15 blur-[100px]" />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-neutral-800 dark:text-neutral-200">
            Ready to reconcile with precision?
          </h2>
          <p className="mt-4 text-lg text-neutral-500 dark:text-neutral-400">
            Join logistics teams that have eliminated collection errors and gained real-time visibility across all hubs.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/buy-now"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-400 px-6 py-3.5 text-sm font-bold text-white shadow-glow hover:shadow-glow transition-all active:scale-95"
            >
              Buy Now
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded-xl border border-brand-600/20 bg-white/60 dark:bg-white/5 backdrop-blur px-6 py-3.5 text-sm font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-white dark:hover:bg-white/10 transition-all"
            >
              Book a Demo
            </Link>
          </div>
        </div>
      </section>

      {activeStat && (
        <Modal
          open={statOpen !== null}
          onClose={() => setStatOpen(null)}
          title={activeStat.title}
          subtitle={activeStat.label}
          size="md"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-400 text-white shadow-glow ring-1 ring-brand-600/20">
              <activeStat.icon className="h-7 w-7" />
            </div>
            <div>
              <p className="text-3xl font-bold gradient-text tabular-nums">{activeStat.value}</p>
              <p className="text-sm text-neutral-400 font-medium">{activeStat.label}</p>
            </div>
          </div>
          <p className="mt-5 text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">{activeStat.desc}</p>
          <ul className="mt-5 space-y-2.5">
            {activeStat.points.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm text-neutral-600 dark:text-neutral-300">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600/15 text-brand-600 dark:text-brand-400">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <span className="leading-relaxed">{p}</span>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </>
  );
}
