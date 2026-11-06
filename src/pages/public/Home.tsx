import SEO from '@/components/SEO';
import AdSlot from '@/components/ui/AdSlot';
import { clsx } from 'clsx';
import {
  ArrowRight,
  Banknote,
  BarChart3,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Database,
  FileSpreadsheet,
  FileText,
  Layers,
  Lock,
  RotateCcw,
  Scale,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tag,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

const LIFETIME_PRICE = 999;
const MONTHLY_PRICE = 99;

const BUY_FEATURES = [
  'Lifetime access — pay once, use forever',
  'Unlimited hubs, delivery riders & daily DRS runs',
  'Daily collection reconciliation (Cash & Online/UPI)',
  'Employee dues ledger & recovery tracking',
  'One-click Day Closing reports & Excel exports',
  'Offline-resilient local sync & cloud backup',
  'Full multi-hub role hierarchy (Admin, Hub Admin, Supervisor)',
  'Free updates, priority support & new features included',
];

// Interactive Showcase Tabs
type ShowcaseTab = 'register' | 'dues' | 'multihub' | 'analytics';

export default function Home() {
  const [activeTab, setActiveTab] = useState<ShowcaseTab>('register');

  const softwareSchema = [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'HubVault',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'All modern web browsers, desktop and mobile',
      offers: {
        '@type': 'Offer',
        price: '999',
        priceCurrency: 'INR',
        availability: 'https://schema.org/InStock',
      },
      description:
        'HubVault is a digital collection reconciliation platform built for logistics and last-mile delivery businesses. Track cash and online collections, manage employee dues, and reconcile collections across multiple hubs in real time.',
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.9',
        reviewCount: '128',
      },
    },
  ];

  return (
    <>
      <SEO
        title="HubVault — Collection Reconciliation Suite for Logistics & Delivery"
        description="Digital collection reconciliation platform for logistics and last-mile delivery businesses. Track COD and online collections, manage employee dues, monitor hub-wise performance, and reconcile collections across multiple hubs in real time."
        path="/"
        structuredData={softwareSchema}
      />

      {/* ============================================================
          SECTION 2: HERO SECTION
          ============================================================ */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white via-slate-50/70 to-white dark:from-slate-950 dark:via-slate-900/60 dark:to-slate-950 pt-10 pb-20 lg:pt-16 lg:pb-28 border-b border-slate-200/80 dark:border-slate-800/80">
        {/* Subtle background tech grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.12]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, #94a3b8 1px, transparent 0)',
            backgroundSize: '36px 36px',
          }}
          aria-hidden="true"
        />

        {/* Ambient subtle glow (Navy & subtle amber) */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-br from-indigo-500/10 via-blue-600/5 to-amber-500/5 blur-[120px] rounded-full" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Column: Value Proposition */}
            <div className="lg:col-span-6 space-y-6 text-left">
              {/* Category Badge */}
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/5 dark:bg-white/10 border border-slate-900/10 dark:border-white/15 px-3.5 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20 animate-pulse" />
                Digital Collection Reconciliation Platform
              </div>

              {/* Exact Requested Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-950 dark:text-white leading-[1.12]">
                Complete Control Over{' '}
                <span className="bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 dark:from-white dark:via-slate-200 dark:to-blue-300 bg-clip-text text-transparent">
                  Every Collection.
                </span>
              </h1>

              {/* Exact Requested Subheadline */}
              <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                One powerful platform to track collections, manage dues and reconcile cash across all your logistics
                hubs — in real time.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                <Link
                  to="/trial-signup"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 hover:bg-slate-850 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 px-6 py-3.5 text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95"
                >
                  Start Free Trial
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#features"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-900/80 px-6 py-3.5 text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
                >
                  Explore Features
                </a>
                <Link
                  to="/tools/cash-calculator"
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-3.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Free Cash Calculator
                </Link>
              </div>

              {/* Trust Indicators (Section 2 Required) */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800/80">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
                  Enterprise Operational Standard
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Built for Last-Mile Logistics</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Multi-Hub Management</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Real-Time Reconciliation</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Realistic High-Fidelity Product Dashboard Preview */}
            <div className="lg:col-span-6">
              <div className="relative rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden transition-all duration-300 hover:shadow-3xl">
                {/* Mock Application Top Navigation Bar */}
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-900 text-white px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                    </div>
                    <div className="h-4 w-px bg-slate-700 mx-1 hidden sm:block" />
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-amber-400" />
                      <span className="text-xs font-semibold text-slate-200">
                        North Delhi Central Hub <span className="text-slate-400 font-mono text-[11px]">(#ND-104)</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Shift Active · Reconciled 98.8%
                    </span>
                  </div>
                </div>

                {/* Dashboard Inner Body */}
                <div className="p-4 sm:p-5 space-y-4 bg-slate-50/50 dark:bg-slate-900/60">
                  {/* KPI Cards Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {/* Total Collection */}
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 shadow-sm">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                        Total Collection
                      </span>
                      <p className="mt-1 text-base sm:text-lg font-bold text-slate-900 dark:text-white tabular-nums tracking-tight">
                        ₹14,82,450
                      </p>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5 mt-0.5">
                        <TrendingUp className="h-2.5 w-2.5" /> +12.4% vs yest.
                      </span>
                    </div>

                    {/* Cash Collection */}
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 shadow-sm">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                        Cash in Safe
                      </span>
                      <p className="mt-1 text-base sm:text-lg font-bold text-slate-900 dark:text-white tabular-nums tracking-tight">
                        ₹9,42,100
                      </p>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">100% Notes Counted</span>
                    </div>

                    {/* Online (UPI / QR) */}
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 shadow-sm">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                        Online (UPI)
                      </span>
                      <p className="mt-1 text-base sm:text-lg font-bold text-slate-900 dark:text-white tabular-nums tracking-tight">
                        ₹5,40,350
                      </p>
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                        342 Verified UTRs
                      </span>
                    </div>

                    {/* Pending Dues */}
                    <div className="p-3 rounded-xl bg-white dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 shadow-sm">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                        Pending Dues
                      </span>
                      <p className="mt-1 text-base sm:text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums tracking-tight">
                        ₹18,400
                      </p>
                      <span className="text-[10px] text-amber-600/90 dark:text-amber-400/90">3 Riders in Recovery</span>
                    </div>
                  </div>

                  {/* Reconciliation Status Overview Bar */}
                  <div className="p-3.5 rounded-xl bg-white dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Daily Handover Reconciliation Status
                      </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">98.8% Reconciled</span>
                    </div>
                    {/* Visual Segmented Progress */}
                    <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-750 rounded-full overflow-hidden flex">
                      <div className="h-full bg-emerald-500" style={{ width: '98.8%' }} title="Reconciled Collections" />
                      <div className="h-full bg-amber-400" style={{ width: '1.2%' }} title="Pending Rider Handover" />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Reconciled: ₹14,64,050
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-amber-400" />
                        Handover Pending: ₹18,400
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-slate-400" />
                        Discrepancy: ₹0.00
                      </span>
                    </div>
                  </div>

                  {/* Active Rider DRS Run-Sheet Settlement Feed */}
                  <div className="p-3.5 rounded-xl bg-white dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 pb-2 border-b border-slate-100 dark:border-slate-800">
                      <span>Evening Check-In &amp; DRS Settlement</span>
                      <span className="text-[11px] font-normal text-slate-400">Live Counter Feed</span>
                    </div>
                    <div className="mt-2.5 space-y-2">
                      {/* Rider 1 */}
                      <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-750">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">
                            VS
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                              Vikas Sharma <span className="font-mono text-[10px] text-slate-400">· DRS-48291</span>
                            </p>
                            <p className="text-[10px] text-slate-500">Rohini Sec 14 · 48/50 Delivered</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                            ₹18,650 <span className="text-[10px] font-normal text-slate-400">(Cash + UPI)</span>
                          </p>
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <Check className="h-3 w-3" /> Reconciled
                          </span>
                        </div>
                      </div>

                      {/* Rider 2 */}
                      <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-750">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">
                            RY
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                              Rahul Yadav <span className="font-mono text-[10px] text-slate-400">· DRS-48294</span>
                            </p>
                            <p className="text-[10px] text-slate-500">Pitampura Hub · 36/38 Delivered</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                            ₹14,200 <span className="text-[10px] font-normal text-slate-400">(UPI Verified)</span>
                          </p>
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <Check className="h-3 w-3" /> Reconciled
                          </span>
                        </div>
                      </div>

                      {/* Rider 3 (With Dues Detection) */}
                      <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px] font-bold">
                            AK
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                              Amit Kumar <span className="font-mono text-[10px] text-slate-400">· DRS-48301</span>
                            </p>
                            <p className="text-[10px] text-amber-700 dark:text-amber-300">
                              Shortage ₹1,200 recorded to rider dues
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                            ₹16,400 <span className="text-[10px] font-normal text-slate-400">/ ₹17,600</span>
                          </p>
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                            <Clock className="h-3 w-3" /> In Recovery Ledger
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Cash Drawer Denomination Strip */}
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900 text-white text-[11px] font-mono">
                    <span className="text-amber-400 font-semibold">Vault Safe Denomination:</span>
                    <span className="text-slate-300">₹500 × 1,420 | ₹200 × 850 | ₹100 × 621</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 3: TRUST / SOCIAL PROOF SECTION
          ============================================================ */}
      <section className="py-16 sm:py-20 bg-white dark:bg-slate-950 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Operational Reliability at Scale
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white">
              Built for Modern Logistics Operations
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
              Engineered specifically for the daily operating cadence of last-mile delivery centers, 3PL partners, and
              high-volume courier distribution networks handling millions in daily COD.
            </p>
          </div>

          {/* 4 Authentic Operational Pillars */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm mb-4">
                <Building2 className="h-5 w-5 text-amber-400" />
              </div>
              <h3 className="text-base font-bold text-slate-950 dark:text-white">Multi-Hub Operational Scale</h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Connect 5 to 100+ delivery stations to a single centralized dashboard without spreadsheets, delayed
                WhatsApp photos, or server bottlenecks.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm mb-4">
                <Truck className="h-5 w-5 text-amber-400" />
              </div>
              <h3 className="text-base font-bold text-slate-950 dark:text-white">Courier Network Compatible</h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Seamlessly handles standard Delivery Run Sheet (DRS) structures and handover procedures used across
                Delhivery, Shadowfax, Xpressbees, Ekart, and Valmo partner hubs.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm mb-4">
                <Scale className="h-5 w-5 text-amber-400" />
              </div>
              <h3 className="text-base font-bold text-slate-950 dark:text-white">Zero-Variance Cash Desk</h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Structured note-by-note denomination counting with live mathematical validation eliminates counting
                arguments between cashiers and delivery associates.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm mb-4">
                <Database className="h-5 w-5 text-amber-400" />
              </div>
              <h3 className="text-base font-bold text-slate-950 dark:text-white">Offline-Resilient Architecture</h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Local storage caching ensures evening collections continue smoothly even during local hub internet
                outages, auto-syncing securely when reconnected.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 4: PROBLEM & SOLUTION SECTION
          ============================================================ */}
      <section
        id="solutions"
        className="py-20 lg:py-28 bg-slate-50/70 dark:bg-slate-900/40 border-b border-slate-200/80 dark:border-slate-800/80 scroll-mt-16"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 px-3 py-1 text-xs font-bold uppercase tracking-wider border border-rose-500/20">
              The Collection Problem &amp; The Solution
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950 dark:text-white">
              Why Traditional Logistics Cash Desks Leak Revenue
            </h2>
            <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed">
              When 50+ delivery associates return to the hub at 7:30 PM with bags of cash and digital payment slips,
              manual tallying creates errors, delayed closings, and untracked rider shortages.
            </p>
          </div>

          {/* 5 Problem vs Solution Comparison Cards */}
          <div className="mt-14 space-y-4">
            {[
              {
                title: 'Manual Paper & Excel Registers',
                problem:
                  'Cashiers scribble counts on paper run sheets and manually re-enter numbers into Excel late at night, leading to transcription typos and missing rows.',
                solution:
                  'Structured digital collection registers with instantaneous totals, keyboard-first navigation, and error-proof validation.',
                impact: 'Eliminates 1.5 hours of manual data entry every evening.',
              },
              {
                title: 'Unverified COD Shortages at Handover',
                problem:
                  'Cash bundles are accepted hurriedly; counting mistakes are caught only hours later after the delivery associate has already left the hub.',
                solution:
                  'Note-by-note denomination counter matches cash in hand against expected COD before the rider leaves the counter.',
                impact: '100% mathematical certainty before the handover receipt is finalized.',
              },
              {
                title: 'Unmanaged Employee Dues Left for Days',
                problem:
                  'Shortages and partial handovers sit in memory, paper notebooks, or sticky notes, turning into accumulated unpaid losses.',
                solution:
                  'Centralized Dues & Recovery ledger that tracks every rupee owed by employee, with historical recovery audit trails and supervisor approvals.',
                impact: 'Direct recovery accountability for every outstanding rupee.',
              },
              {
                title: 'Multi-Hub Reconciliation Confusion',
                problem:
                  'Corporate finance spends entire mornings calling 20 different hub managers and waiting for emailed spreadsheets to verify bank deposits.',
                solution:
                  'Consolidated multi-hub visibility where corporate leadership sees live collections, cash-in-safe, and closing status across all branches.',
                impact: 'Instant company-wide financial control with independent station autonomy.',
              },
              {
                title: 'Lack of Real-Time Management Visibility',
                problem:
                  'Operations directors discover cash leakage, delayed bank deposits, and high delivery failure rates days after the closing cycle.',
                solution:
                  'Live executive dashboards displaying collection speed, pending amounts, and closing status across every hub in real time.',
                impact: 'Proactive decisions instead of reactive end-of-month fire drills.',
              },
            ].map((item, index) => (
              <div
                key={item.title}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  <div className="lg:col-span-3">
                    <span className="text-xs font-mono font-bold text-slate-400">0{index + 1} / CHALLENGE</span>
                    <h3 className="text-base font-bold text-slate-950 dark:text-white mt-1">{item.title}</h3>
                    <span className="inline-block mt-2 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      {item.impact}
                    </span>
                  </div>

                  {/* The Problem */}
                  <div className="lg:col-span-4 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 p-4">
                    <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 text-xs font-bold uppercase tracking-wider mb-1">
                      <XCircle className="h-3.5 w-3.5" />
                      Manual Operation (Problem)
                    </div>
                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {item.problem}
                    </p>
                  </div>

                  {/* Arrow Indicator */}
                  <div className="hidden lg:flex lg:col-span-1 justify-center">
                    <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>

                  {/* The HubVault Solution */}
                  <div className="lg:col-span-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 p-4">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      HubVault Solution
                    </div>
                    <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {item.solution}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 5: KEY FEATURES SECTION (8 REQUIRED CARDS)
          ============================================================ */}
      <section
        id="features"
        className="py-20 lg:py-28 bg-white dark:bg-slate-950 border-b border-slate-200/80 dark:border-slate-800/80 scroll-mt-16"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Core System Capabilities
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950 dark:text-white">
              Everything You Need to Reconcile Collections
            </h2>
            <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed">
              Purpose-built for the high-velocity requirements of delivery hub cash desks, supervisor closing shifts,
              and executive finance audits.
            </p>
          </div>

          {/* 8 Feature Cards Grid */}
          <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* 1. Smart Collection Tracking */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/70 p-6 hover:border-slate-400 dark:hover:border-slate-700 transition-all">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm mb-4">
                <Wallet className="h-5 w-5 text-amber-400" />
              </div>
              <h3 className="text-base font-bold text-slate-950 dark:text-white">Smart Collection Tracking</h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Track COD cash and digital collections per rider, per DRS, and per delivery trip with automatic totals
                and zero manual arithmetic.
              </p>
            </div>

            {/* 2. Cash & Online Reconciliation */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/70 p-6 hover:border-slate-400 dark:hover:border-slate-700 transition-all">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm mb-4">
                <Smartphone className="h-5 w-5 text-emerald-400" />
              </div>
              <h3 className="text-base font-bold text-slate-950 dark:text-white">Cash &amp; Online Reconciliation</h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Separate physical currency notes from UPI / QR / payment link collections with individual UTR logging
                and instant reconciliation proof.
              </p>
            </div>

            {/* 3. Multi-Hub Management */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/70 p-6 hover:border-slate-400 dark:hover:border-slate-700 transition-all">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm mb-4">
                <Building2 className="h-5 w-5 text-indigo-400" />
              </div>
              <h3 className="text-base font-bold text-slate-950 dark:text-white">Multi-Hub Management</h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Operate decentralized delivery stations with independent cash desks while giving regional leadership
                unified multi-hub oversight.
              </p>
            </div>

            {/* 4. Employee Dues & Recovery */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/70 p-6 hover:border-slate-400 dark:hover:border-slate-700 transition-all">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm mb-4">
                <RotateCcw className="h-5 w-5 text-amber-400" />
              </div>
              <h3 className="text-base font-bold text-slate-950 dark:text-white">Employee Dues &amp; Recovery</h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Track outstanding rider balances, partial payments, and recovery schedules with an auditable historical
                dues ledger and receipts.
              </p>
            </div>

            {/* 5. Real-Time Performance Reports */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/70 p-6 hover:border-slate-400 dark:hover:border-slate-700 transition-all">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm mb-4">
                <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
              </div>
              <h3 className="text-base font-bold text-slate-950 dark:text-white">Real-Time Performance Reports</h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Generate instant daily closing summaries, supervisor shift logs, and employee leaderboard reports
                exportable to Excel in seconds.
              </p>
            </div>

            {/* 6. Role-Based Access Control */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/70 p-6 hover:border-slate-400 dark:hover:border-slate-700 transition-all">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm mb-4">
                <Users className="h-5 w-5 text-indigo-400" />
              </div>
              <h3 className="text-base font-bold text-slate-950 dark:text-white">Role-Based Access Control</h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Strict role hierarchies (Super Admin, Hub Admin, Hub Supervisor, Cashier) ensuring staff access only
                authorized hub records and actions.
              </p>
            </div>

            {/* 7. Collection Analytics */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/70 p-6 hover:border-slate-400 dark:hover:border-slate-700 transition-all">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm mb-4">
                <BarChart3 className="h-5 w-5 text-amber-400" />
              </div>
              <h3 className="text-base font-bold text-slate-950 dark:text-white">Collection Analytics</h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Spot cash trends, track delivery-to-collection ratios, monitor recurring shortages, and identify
                top-performing routes and riders.
              </p>
            </div>

            {/* 8. Digital Cash Calculator */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/70 p-6 hover:border-slate-400 dark:hover:border-slate-700 transition-all">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm mb-4">
                <Banknote className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-950 dark:text-white">Digital Cash Calculator</h3>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full">
                  Free Tool
                </span>
              </div>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Built-in high-speed denomination counter with keyboard navigation, slip generation, and instant error
                prevention.
              </p>
              <Link
                to="/tools/cash-calculator"
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-900 dark:text-white hover:underline"
              >
                Try Free Calculator &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 6: HOW IT WORKS SECTION (3 CLEAR STEPS)
          ============================================================ */}
      <section
        id="how-it-works"
        className="py-20 lg:py-28 bg-slate-50/70 dark:bg-slate-900/40 border-b border-slate-200/80 dark:border-slate-800/80 scroll-mt-16"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              <Layers className="h-4 w-4 text-emerald-500" />
              Standardized Hub Workflow
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950 dark:text-white">
              Reconcile Daily Collections in Three Clear Steps
            </h2>
            <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed">
              Transform chaotic evening check-ins into an organized, mathematically verified procedure that wraps up in
              minutes instead of hours.
            </p>
          </div>

          {/* 3 Steps Timeline Cards */}
          <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Step 1 */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <span className="absolute -top-3 -right-2 text-7xl font-black text-slate-100 dark:text-slate-800/60 select-none pointer-events-none">
                01
              </span>
              <div className="relative">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm mb-5">
                  <FileText className="h-6 w-6 text-amber-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-950 dark:text-white">1. Record Daily Collections</h3>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Delivery associates hand over cash and digital payment proof at the hub counter. The cashier enters
                  note denominations (₹500, ₹200, ₹100, etc.) and logs UPI reference IDs in a fast, keyboard-first form.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 font-medium">
                &bull; Instant note tallying &bull; UPI UTR logging
              </div>
            </div>

            {/* Step 2 */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <span className="absolute -top-3 -right-2 text-7xl font-black text-slate-100 dark:text-slate-800/60 select-none pointer-events-none">
                02
              </span>
              <div className="relative">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm mb-5">
                  <Scale className="h-6 w-6 text-emerald-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-950 dark:text-white">2. Monitor Dues &amp; Auto-Reconcile</h3>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  HubVault cross-references actual cash and UPI collected against expected DRS delivery values. Any
                  shortage or excess is instantly flagged and attributed to the specific rider's ledger.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 font-medium">
                &bull; Gap detection &bull; Automatic rider dues entry
              </div>
            </div>

            {/* Step 3 */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm relative overflow-hidden flex flex-col justify-between">
              <span className="absolute -top-3 -right-2 text-7xl font-black text-slate-100 dark:text-slate-800/60 select-none pointer-events-none">
                03
              </span>
              <div className="relative">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm mb-5">
                  <BarChart3 className="h-6 w-6 text-indigo-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-950 dark:text-white">3. Settle Hub &amp; Export Reports</h3>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Generate the official Day Closing Report with one click. Cashiers balance the physical safe, finance
                  verifies bank deposits, and management reviews multi-hub numbers in real time.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 font-medium">
                &bull; Day-closing summary &bull; One-click Excel export
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 7: DASHBOARD SHOWCASE (INTERACTIVE PRODUCT TABS)
          ============================================================ */}
      <section
        id="showcase"
        className="py-20 lg:py-28 bg-white dark:bg-slate-950 border-b border-slate-200/80 dark:border-slate-800/80 scroll-mt-16"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              <Building2 className="h-4 w-4 text-amber-500" />
              Live Product Experience
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950 dark:text-white">
              Experience the HubVault Operations Suite
            </h2>
            <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed">
              Switch between the core operational modules used by hub managers, supervisors, and finance teams every
              day.
            </p>
          </div>

          {/* Tab Selector Buttons */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
            {[
              { id: 'register', label: '1. Daily Collection Register', icon: Wallet },
              { id: 'dues', label: '2. Dues & Recovery Ledger', icon: RotateCcw },
              { id: 'multihub', label: '3. Multi-Hub Performance', icon: Building2 },
              { id: 'analytics', label: '4. DRS Delivery Analytics', icon: BarChart3 },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as ShowcaseTab)}
                  className={clsx(
                    'flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all cursor-pointer',
                    isActive
                      ? 'bg-slate-950 text-white shadow-md dark:bg-white dark:text-slate-950'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 dark:bg-slate-850 dark:text-slate-300 dark:hover:bg-slate-800'
                  )}
                >
                  <Icon className={clsx('h-4 w-4', isActive ? 'text-amber-400 dark:text-amber-500' : 'text-slate-400')} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Interactive Screen Display */}
          <div className="mt-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-900 text-white shadow-2xl overflow-hidden">
            {/* Screen Header Bar */}
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-5 py-3.5">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-rose-500/80" />
                  <span className="h-3 w-3 rounded-full bg-amber-500/80" />
                  <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
                </div>
                <div className="h-4 w-px bg-slate-800" />
                <span className="text-xs font-mono text-slate-300">
                  app.hubvault.in / {activeTab === 'register' && 'collections/daily-register'}
                  {activeTab === 'dues' && 'employee-dues/ledger'}
                  {activeTab === 'multihub' && 'hubs/performance-matrix'}
                  {activeTab === 'analytics' && 'reports/drs-analytics'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="hidden sm:inline-block">Status: Live Sync Active</span>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
            </div>

            {/* TAB CONTENT 1: DAILY COLLECTION REGISTER */}
            {activeTab === 'register' && (
              <div className="p-5 sm:p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <h3 className="text-lg font-bold text-white">Daily Collection Register</h3>
                    <p className="text-xs text-slate-400">
                      North Delhi Hub &bull; Shift Closing: Today &bull; 48 Delivery Associates Checked In
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
                      Total Expected: ₹14,82,450
                    </span>
                    <span className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-semibold">
                      Collected: ₹14,82,450
                    </span>
                  </div>
                </div>

                {/* Table Mockup */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300 border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                        <th className="py-2.5 px-3">Rider</th>
                        <th className="py-2.5 px-3">DRS No.</th>
                        <th className="py-2.5 px-3">Delivered</th>
                        <th className="py-2.5 px-3 text-right">Expected COD</th>
                        <th className="py-2.5 px-3 text-right">Cash Handover</th>
                        <th className="py-2.5 px-3 text-right">Online (UPI)</th>
                        <th className="py-2.5 px-3 text-right">Variance</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                      <tr>
                        <td className="py-3 px-3 font-sans font-semibold text-white">Vikas Sharma</td>
                        <td className="py-3 px-3 text-slate-400">DRS-48291</td>
                        <td className="py-3 px-3">48 / 50</td>
                        <td className="py-3 px-3 text-right text-slate-200">₹22,850</td>
                        <td className="py-3 px-3 text-right text-emerald-400">₹18,650</td>
                        <td className="py-3 px-3 text-right text-indigo-400">₹4,200</td>
                        <td className="py-3 px-3 text-right text-emerald-400">₹0.00</td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold">
                            Reconciled
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 px-3 font-sans font-semibold text-white">Rahul Yadav</td>
                        <td className="py-3 px-3 text-slate-400">DRS-48294</td>
                        <td className="py-3 px-3">36 / 38</td>
                        <td className="py-3 px-3 text-right text-slate-200">₹21,300</td>
                        <td className="py-3 px-3 text-right text-emerald-400">₹12,400</td>
                        <td className="py-3 px-3 text-right text-indigo-400">₹8,900</td>
                        <td className="py-3 px-3 text-right text-emerald-400">₹0.00</td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold">
                            Reconciled
                          </span>
                        </td>
                      </tr>
                      <tr className="bg-amber-500/5">
                        <td className="py-3 px-3 font-sans font-semibold text-white">Amit Kumar</td>
                        <td className="py-3 px-3 text-slate-400">DRS-48301</td>
                        <td className="py-3 px-3">42 / 45</td>
                        <td className="py-3 px-3 text-right text-slate-200">₹17,600</td>
                        <td className="py-3 px-3 text-right text-emerald-400">₹16,400</td>
                        <td className="py-3 px-3 text-right text-slate-500">₹0</td>
                        <td className="py-3 px-3 text-right text-amber-400">-₹1,200</td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-semibold">
                            Due Incurred
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 px-3 font-sans font-semibold text-white">Rajesh Meena</td>
                        <td className="py-3 px-3 text-slate-400">DRS-48305</td>
                        <td className="py-3 px-3">52 / 55</td>
                        <td className="py-3 px-3 text-right text-slate-200">₹31,400</td>
                        <td className="py-3 px-3 text-right text-emerald-400">₹24,000</td>
                        <td className="py-3 px-3 text-right text-indigo-400">₹7,400</td>
                        <td className="py-3 px-3 text-right text-emerald-400">₹0.00</td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold">
                            Reconciled
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Vault Safe Denomination Strip */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-emerald-400" />
                    <span className="font-semibold text-slate-200">Physical Cash Vault Drawer:</span>
                    <span className="text-emerald-400 font-bold tabular-nums">₹9,42,100</span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-400 space-x-2">
                    <span>₹500: 1,420</span> &bull; <span>₹200: 850</span> &bull; <span>₹100: 621</span> &bull;{' '}
                    <span>₹50: 0</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT 2: DUES & RECOVERY LEDGER */}
            {activeTab === 'dues' && (
              <div className="p-5 sm:p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <h3 className="text-lg font-bold text-white">Employee Dues &amp; Recovery Ledger</h3>
                    <p className="text-xs text-slate-400">
                      Track outstanding rider shortages, daily recovery deductions, and settlement history.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-semibold">
                      Total Active Dues: ₹18,400
                    </span>
                    <span className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-semibold">
                      Recovered Today: ₹6,500
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300 border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                        <th className="py-2.5 px-3">Rider Name</th>
                        <th className="py-2.5 px-3">Date Incurred</th>
                        <th className="py-2.5 px-3">Original Due</th>
                        <th className="py-2.5 px-3">Recovered Amount</th>
                        <th className="py-2.5 px-3 text-right">Balance Due</th>
                        <th className="py-2.5 px-3">Recovery Status</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                      <tr>
                        <td className="py-3 px-3 font-sans font-semibold text-white">Amit Kumar</td>
                        <td className="py-3 px-3 text-slate-400">Today (DRS-48301)</td>
                        <td className="py-3 px-3 text-slate-300">₹1,200</td>
                        <td className="py-3 px-3 text-emerald-400">₹0</td>
                        <td className="py-3 px-3 text-right font-bold text-amber-400">₹1,200</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px]">
                            Under Recovery
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-sans">
                          <button className="text-xs text-indigo-400 hover:text-indigo-300">Record Recovery</button>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 px-3 font-sans font-semibold text-white">Suresh Patel</td>
                        <td className="py-3 px-3 text-slate-400">Yesterday</td>
                        <td className="py-3 px-3 text-slate-300">₹5,000</td>
                        <td className="py-3 px-3 text-emerald-400">₹2,500</td>
                        <td className="py-3 px-3 text-right font-bold text-amber-400">₹2,500</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px]">
                            Partial Recovery
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-sans">
                          <button className="text-xs text-indigo-400 hover:text-indigo-300">Record Recovery</button>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 px-3 font-sans font-semibold text-white">Mohd. Irfan</td>
                        <td className="py-3 px-3 text-slate-400">3 Days Ago</td>
                        <td className="py-3 px-3 text-slate-300">₹4,000</td>
                        <td className="py-3 px-3 text-emerald-400">₹4,000</td>
                        <td className="py-3 px-3 text-right font-bold text-emerald-400">₹0</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px]">
                            Fully Settled
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-sans">
                          <span className="text-xs text-slate-500">Audited</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                  <span>Audited by: Supervisor Sunita Verma</span>
                  <span className="text-emerald-400 font-semibold">&bull; All recoveries auto-credited to hub safe</span>
                </div>
              </div>
            )}

            {/* TAB CONTENT 3: MULTI-HUB PERFORMANCE */}
            {activeTab === 'multihub' && (
              <div className="p-5 sm:p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <h3 className="text-lg font-bold text-white">Multi-Hub Operations Matrix</h3>
                    <p className="text-xs text-slate-400">
                      Consolidated view across regional stations with local cashier independence.
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">Total Active Stations: 4 Hubs</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { name: 'North Delhi Central', riders: 48, col: '₹14,82,450', rate: '98.8%', status: 'Active' },
                    { name: 'West Gurugram Hub', riders: 35, col: '₹11,40,200', rate: '99.4%', status: 'Active' },
                    { name: 'Bengaluru South', riders: 62, col: '₹19,85,600', rate: '97.9%', status: 'Shift End' },
                    { name: 'Mumbai Bhiwandi Hub', riders: 54, col: '₹17,20,900', rate: '99.1%', status: 'Reconciled' },
                  ].map((hub) => (
                    <div key={hub.name} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{hub.name}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                          {hub.status}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Total Collection</span>
                        <p className="text-base font-bold text-white font-mono">{hub.col}</p>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-850">
                        <span>{hub.riders} Active Riders</span>
                        <span className="text-emerald-400 font-bold">{hub.rate} Reconciled</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB CONTENT 4: DRS DELIVERY ANALYTICS */}
            {activeTab === 'analytics' && (
              <div className="p-5 sm:p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <h3 className="text-lg font-bold text-white">DRS &amp; Last-Mile Delivery Analytics</h3>
                    <p className="text-xs text-slate-400">
                      Track delivery conversion, First Attempt Delivery (FAD %), and cash collection ratios.
                    </p>
                  </div>
                  <span className="px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 text-xs font-semibold">
                    Overall FAD Delivery: 88.4%
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-xs text-slate-400 block">Total Out on Road (OFD)</span>
                    <p className="text-2xl font-bold text-white font-mono mt-1">2,480</p>
                    <span className="text-[10px] text-slate-500">Across 48 Riders</span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-xs text-slate-400 block">Delivered Shipments</span>
                    <p className="text-2xl font-bold text-emerald-400 font-mono mt-1">2,342</p>
                    <span className="text-[10px] text-emerald-500 font-semibold">94.4% Success Rate</span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-xs text-slate-400 block">Undelivered (UNDEL)</span>
                    <p className="text-2xl font-bold text-amber-400 font-mono mt-1">138</p>
                    <span className="text-[10px] text-amber-500">Returned to Hub Safe</span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-xs text-slate-400 block">COD FAD %</span>
                    <p className="text-2xl font-bold text-indigo-400 font-mono mt-1">87.2%</p>
                    <span className="text-[10px] text-indigo-400 font-semibold">First Attempt Cash</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 8: WHO CAN USE HUBVAULT? (5 TARGETED CARDS)
          ============================================================ */}
      <section
        id="solutions-audience"
        className="py-20 lg:py-28 bg-slate-50/70 dark:bg-slate-900/40 border-b border-slate-200/80 dark:border-slate-800/80 scroll-mt-16"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              <Users className="h-4 w-4 text-emerald-500" />
              Built for Your Operational Role
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950 dark:text-white">
              Tailored for Every Level of Logistics Operations
            </h2>
            <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed">
              From on-ground hub cashiers to regional finance directors, HubVault brings speed, clarity, and accountability
              to every collection handover.
            </p>
          </div>

          {/* 5 Targeted Cards */}
          <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* 1. Logistics Companies & 3PLs */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm mb-4">
                <Truck className="h-5 w-5 text-amber-400" />
              </div>
              <h3 className="text-base font-bold text-slate-950 dark:text-white">Logistics Companies &amp; 3PLs</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Consolidate cash flows across regional distribution centers, eliminate leakage, and achieve same-day
                reconciliation across the entire courier network.
              </p>
              <ul className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-emerald-500" /> Multi-branch consolidated balance sheet
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-emerald-500" /> Zero end-of-month reconciliation backlog
                </li>
              </ul>
            </div>

            {/* 2. Last-Mile Delivery Partners (DSPs) */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm mb-4">
                <Building2 className="h-5 w-5 text-emerald-400" />
              </div>
              <h3 className="text-base font-bold text-slate-950 dark:text-white">Last-Mile Delivery Partners</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Manage franchised delivery stations, track courier run sheet settlements, and protect working capital
                against uncollected COD and client debit notes.
              </p>
              <ul className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-emerald-500" /> Prevent client COD debit penalties
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-emerald-500" /> Transparent rider settlement history
                </li>
              </ul>
            </div>

            {/* 3. Delivery Centers & Franchises */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm mb-4">
                <Layers className="h-5 w-5 text-indigo-400" />
              </div>
              <h3 className="text-base font-bold text-slate-950 dark:text-white">Delivery Centers &amp; Franchises</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Replace manual counter logbooks with a standardized counter software that trains cashiers in minutes
                and prevents counting mistakes under rush.
              </p>
              <ul className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-emerald-500" /> Faster evening check-in per associate
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-emerald-500" /> Automated cash-in-safe calculation
                </li>
              </ul>
            </div>

            {/* 4. Hub Managers & Cashiers */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm mb-4">
                <Wallet className="h-5 w-5 text-amber-400" />
              </div>
              <h3 className="text-base font-bold text-slate-950 dark:text-white">Hub Managers &amp; Cashiers</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Speed up evening rider settlement by 70%, eliminate cash discrepancy disputes at the counter, and close
                the physical safe with 100% confidence.
              </p>
              <ul className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-emerald-500" /> Built-in denomination counter
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-emerald-500" /> One-click Day Closing PDF &amp; print
                </li>
              </ul>
            </div>

            {/* 5. Operations & Finance Teams */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-sm md:col-span-2 lg:col-span-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm mb-4">
                <BarChart3 className="h-5 w-5 text-emerald-400" />
              </div>
              <h3 className="text-base font-bold text-slate-950 dark:text-white">Operations &amp; Finance Teams</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Gain instant auditability into cash-in-transit, track bank deposits against system collection records,
                and maintain an indisputable rider dues ledger with zero paperwork.
              </p>
              <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400">
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-emerald-500" /> Real-time bank deposit verification
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-emerald-500" /> Immutable historical audit logs
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-emerald-500" /> Instant Excel export for any hub &amp; date
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-emerald-500" /> Role-based permission controls
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 9: SECURITY & ACCESS CONTROL
          ============================================================ */}
      <section
        id="security"
        className="py-20 lg:py-28 bg-white dark:bg-slate-950 border-b border-slate-200/80 dark:border-slate-800/80 scroll-mt-16"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              <Lock className="h-4 w-4 text-emerald-500" />
              Enterprise Governance &amp; Security
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950 dark:text-white">
              Enterprise-Grade Protection for Every Rupee
            </h2>
            <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed">
              Your financial records and rider dues require uncompromising data security, strict role permissions, and
              tamper-proof audit trails.
            </p>
          </div>

          {/* 4 Security Pillars */}
          <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm mb-4">
                <Users className="h-5 w-5 text-amber-400" />
              </div>
              <h3 className="text-base font-bold text-slate-950 dark:text-white">Role-Based Access (RBAC)</h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Super Admins, Hub Admins, Supervisors, and Cashiers each get strictly scoped permissions. Cashiers cannot
                modify previous days or other hubs.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm mb-4">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
              </div>
              <h3 className="text-base font-bold text-slate-950 dark:text-white">Immutable Audit Trails</h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Every cash entry, dues adjustment, and day closing event is stamped with employee identity, timestamp, and
                IP attribution.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm mb-4">
                <Lock className="h-5 w-5 text-indigo-400" />
              </div>
              <h3 className="text-base font-bold text-slate-950 dark:text-white">End-to-End Encryption</h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Data is encrypted in transit via TLS 1.3 and at rest with AES-256 standard encryption on enterprise-grade
                cloud infrastructure.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm mb-4">
                <Database className="h-5 w-5 text-amber-400" />
              </div>
              <h3 className="text-base font-bold text-slate-950 dark:text-white">Multi-Hub Data Isolation</h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Strict multi-tenant architecture ensures each logistics partner and branch operates in safe, isolated data
                environments.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Discrete In-content Ad Slot */}
      <section className="py-6 bg-slate-50 dark:bg-slate-900/60">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <AdSlot slot="1111111111" className="rounded-2xl overflow-hidden" />
        </div>
      </section>

      {/* ============================================================
          SECTION 10: PRICING SECTION
          ============================================================ */}
      <section
        id="pricing"
        className="py-20 lg:py-28 bg-slate-50/70 dark:bg-slate-900/40 border-b border-slate-200/80 dark:border-slate-800/80 scroll-mt-16"
      >
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/5 dark:bg-white/10 border border-slate-900/10 dark:border-white/15 px-3 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <Tag className="h-3.5 w-3.5 text-amber-500" />
              Transparent, Direct Pricing
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950 dark:text-white">
              Invest Once, Reconcile Forever
            </h2>
            <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed">
              No complex tiered billing, no hidden fees. Choose lifetime access or flexible monthly subscriptions.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
            {/* Lifetime License Card */}
            <div className="relative rounded-3xl bg-slate-950 text-white p-8 sm:p-10 shadow-xl border border-slate-800 flex flex-col justify-between overflow-hidden">
              <div className="absolute top-0 right-0 h-40 w-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
              <div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 text-amber-300 px-3 py-1 text-xs font-bold border border-amber-500/30">
                    <Sparkles className="h-3.5 w-3.5" /> Most Popular &bull; Lifetime
                  </span>
                  <span className="text-xs text-slate-400 font-medium">Pay Once &bull; Use Forever</span>
                </div>

                <div className="mt-6 flex items-baseline gap-2">
                  <span className="text-5xl font-extrabold tracking-tight text-white">₹{LIFETIME_PRICE}</span>
                  <span className="text-lg text-slate-500 line-through">₹2,999</span>
                  <span className="text-xs text-emerald-400 font-semibold ml-2">Save ₹2,000</span>
                </div>
                <p className="mt-2 text-xs text-slate-400">One-time payment for lifetime access across unlimited hubs.</p>

                <div className="mt-8 space-y-3">
                  {BUY_FEATURES.map((feat) => (
                    <div key={feat} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-300">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 mt-0.5">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-800 space-y-3">
                <Link
                  to="/buy-now"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-bold px-6 py-3.5 text-sm shadow-md transition-all active:scale-95"
                >
                  Buy Lifetime License — ₹{LIFETIME_PRICE}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <p className="text-center text-[11px] text-slate-400">
                  Instant activation &bull; 7-Day Money-Back Guarantee
                </p>
              </div>
            </div>

            {/* Monthly Subscription Card */}
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 sm:p-10 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Monthly Plan
                  </span>
                  <span className="text-xs text-slate-500 font-medium">Cancel Anytime</span>
                </div>

                <div className="mt-6 flex items-baseline gap-2">
                  <span className="text-5xl font-extrabold tracking-tight text-slate-950 dark:text-white">
                    ₹{MONTHLY_PRICE}
                  </span>
                  <span className="text-slate-500 text-sm">/ month</span>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Ideal for single hubs or testing HubVault in active production.
                </p>

                <div className="mt-8 space-y-3">
                  {[
                    'Full access to all collection reconciliation tools',
                    'Cash & UPI denomination counters',
                    'Employee dues & recovery ledger',
                    'Day-end closing reports & Excel export',
                    'Email & WhatsApp customer support',
                  ].map((feat) => (
                    <div key={feat} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 mt-0.5">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <Link
                  to="/buy-now?plan=monthly"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold px-6 py-3.5 text-sm shadow-sm transition-all"
                >
                  Choose Monthly — ₹{MONTHLY_PRICE}/mo
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <div className="text-center">
                  <Link to="/trial-signup" className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
                    Or start with 30 days free trial &rarr;
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 10: FINAL CTA SECTION
          ============================================================ */}
      <section className="relative py-20 lg:py-24 bg-gradient-to-b from-white to-slate-100/80 dark:from-slate-950 dark:to-slate-900 overflow-hidden">
        {/* Glow */}
        <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-t from-indigo-500/10 via-amber-500/5 to-transparent blur-[100px] rounded-full" />

        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/5 dark:bg-white/10 px-3.5 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 border border-slate-900/10 dark:border-white/15">
            <Wallet className="h-3.5 w-3.5 text-amber-500" />
            Ready for Effortless Daily Reconciliations?
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-950 dark:text-white leading-tight">
            Take Control of Your Logistics Collections.
          </h2>

          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Simplify reconciliation. Reduce collection gaps. Manage every hub with confidence.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link
              to="/trial-signup"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 hover:bg-slate-850 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 px-8 py-4 text-base font-bold shadow-lg transition-all active:scale-95"
            >
              Start Free Trial
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/contact"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-900 px-8 py-4 text-base font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
            >
              Contact Us
            </Link>
          </div>

          <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-500" /> 30-Day Free Access
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-500" /> No Credit Card Required
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-500" /> Setup in Under 5 Minutes
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-500" /> Multi-Hub Ready
            </span>
          </div>
        </div>
      </section>
    </>
  );
}
