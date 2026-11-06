import SEO from '@/components/SEO';
import {
  FestiveStyles,
  HangingFairyLights,
  HeroDiya,
  MarigoldToran,
  RangoliMandala,
  SkyLantern,
} from '@/components/home/DiwaliDecorations';
import DiwaliHeroCanvas from '@/components/home/DiwaliFireworksCanvas';
import AdSlot from '@/components/ui/AdSlot';
import { clsx } from 'clsx';
import {
  ArrowRight,
  Banknote,
  BarChart3,
  Building2,
  Check,
  CheckCircle2,
  Compass,
  FileSpreadsheet,
  Flame,
  Layers,
  Scale,
  Sparkles,
  Tag,
  TrendingUp,
  Wallet,
  XCircle,
  Zap,
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
  'Free updates, priority support & festive feature drops',
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

  const handleSmoothScroll = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <>
      <FestiveStyles />
      <SEO
        title="HubVault — Collection Reconciliation Suite for Logistics & Delivery | Happy Diwali"
        description="Celebrate Diwali with HubVault. Digital collection reconciliation platform for logistics and last-mile delivery businesses. Track COD & UPI collections, manage employee dues, and illuminate operations."
        path="/"
        structuredData={softwareSchema}
      />

      {/* ============================================================
          SECTION 1: GRAND DIWALI HERO SECTION
          Cinematic fireworks, traditional diyas, hanging toran & lanterns
          ============================================================ */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#030614] via-[#090726] to-[#04081c] text-white pt-10 pb-20 lg:pt-14 lg:pb-32 border-b border-amber-500/20">
        {/* HTML5 Fireworks Animation Engine */}
        <DiwaliHeroCanvas />

        {/* Traditional Hanging Marigold Toran Garland along the top */}
        <MarigoldToran />

        {/* Decorative String Fairy Lights */}
        <HangingFairyLights />

        {/* Floating Sky Lanterns (Kandils) in top corners */}
        <div className="absolute top-12 left-4 sm:left-12 z-10 pointer-events-none hidden md:block">
          <SkyLantern className="animate-festive-lantern" color="gold" />
        </div>
        <div
          className="absolute top-16 right-4 sm:right-12 z-10 pointer-events-none hidden md:block"
          style={{ animationDelay: '1.8s' }}
        >
          <SkyLantern className="animate-festive-lantern" color="crimson" />
        </div>

        {/* Rangoli Watermark Motifs in Background */}
        <div className="absolute -top-10 -left-10 w-96 h-96 pointer-events-none opacity-15">
          <RangoliMandala className="w-full h-full" />
        </div>
        <div className="absolute -bottom-16 -right-16 w-96 h-96 pointer-events-none opacity-15">
          <RangoliMandala className="w-full h-full" />
        </div>

        {/* Ambient Golden & Indigo Radial Glow */}
        <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[480px] bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-indigo-600/15 blur-[140px] rounded-full" />

        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Top Festive Badge */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-amber-500/20 border border-amber-400/40 px-4 py-1.5 text-xs sm:text-sm font-bold tracking-widest text-amber-300 uppercase shadow-[0_0_20px_rgba(245,158,11,0.25)] backdrop-blur-md">
              <Sparkles className="h-4 w-4 text-amber-300 animate-pulse" />
              <span>SHUBH DEEPAVALI 2026</span>
              <span className="text-amber-500">·</span>
              <span className="text-amber-200">FESTIVAL OF GROWTH &amp; LIGHTS</span>
              <Sparkles className="h-4 w-4 text-amber-300 animate-pulse" />
            </div>
          </div>

          {/* Main Festive Banner with Traditional Glowing Diyas on Both Sides */}
          <div className="relative rounded-3xl border border-amber-400/40 bg-gradient-to-r from-[#030614]/85 via-[#0c1033]/90 to-[#030614]/85 p-6 sm:p-10 lg:p-12 shadow-[0_0_50px_rgba(245,158,11,0.22)] backdrop-blur-xl mb-12">
            {/* Top & Bottom Golden Accent Hairlines */}
            <div className="pointer-events-none absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
            <div className="pointer-events-none absolute bottom-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/70 to-transparent" />

            {/* Traditional Corner Ornaments */}
            <div className="pointer-events-none absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-amber-400 rounded-tl" />
            <div className="pointer-events-none absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-amber-400 rounded-tr" />
            <div className="pointer-events-none absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-amber-400 rounded-bl" />
            <div className="pointer-events-none absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-amber-400 rounded-br" />

            <div className="flex flex-col lg:flex-row items-center justify-between gap-6 lg:gap-8">
              {/* Left Diya (Large glowing diya) */}
              <div className="shrink-0 flex items-center justify-center">
                <HeroDiya side="left" size="lg" />
              </div>

              {/* Center Hero Content */}
              <div className="flex-1 text-center space-y-4 max-w-3xl mx-auto">
                {/* 1. Main Festive Greeting Heading */}
                <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight uppercase leading-none select-none">
                  <span className="inline-block mr-2 sm:mr-3 text-amber-400 drop-shadow-[0_0_20px_rgba(245,158,11,0.9)]">
                    🪔
                  </span>
                  <span className="bg-gradient-to-r from-amber-100 via-yellow-200 via-amber-300 to-amber-100 bg-clip-text text-transparent drop-shadow-[0_4px_24px_rgba(245,158,11,0.85)] font-serif animate-gold-shimmer">
                    HAPPY DIWALI
                  </span>
                  <span className="inline-block ml-2 sm:mr-3 text-amber-400 drop-shadow-[0_0_20px_rgba(245,158,11,0.9)]">
                    🪔
                  </span>
                </h1>

                {/* Festival of Lights Tagline */}
                <p className="text-base sm:text-xl md:text-2xl font-bold text-amber-200 tracking-wide drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                  &ldquo;Celebrate the Festival of Lights&rdquo;
                </p>

                {/* Subtitle */}
                <p className="text-sm sm:text-base md:text-lg font-semibold text-amber-100/90 tracking-normal drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
                  Wishing You Prosperity, Happiness, Growth &amp; New Beginnings.
                </p>

                {/* Small Inspirational Festive Message */}
                <p className="text-xs sm:text-sm text-slate-300/90 italic max-w-xl mx-auto leading-relaxed pt-1">
                  &ldquo;This Diwali, let&rsquo;s illuminate new possibilities and celebrate success together with
                  flawless logistics reconciliation.&rdquo;
                </p>

                {/* Festive Dual CTAs */}
                <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                  <button
                    onClick={() => handleSmoothScroll('festival-of-growth')}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 px-6 py-3.5 text-sm sm:text-base font-extrabold shadow-[0_0_25px_rgba(245,158,11,0.55)] transition-all transform hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <Compass className="h-5 w-5 text-slate-950" />
                    Explore HubVault
                    <ArrowRight className="h-4 w-4 text-slate-950" />
                  </button>

                  <Link
                    to="/trial-signup"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-amber-400/50 hover:border-amber-300 text-amber-200 hover:text-white px-6 py-3.5 text-sm sm:text-base font-bold shadow-md transition-all active:scale-95"
                  >
                    <Sparkles className="h-4 w-4 text-amber-300" />
                    Start Free Trial
                  </Link>

                  <Link
                    to="/buy-hubvault"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-400/30 text-amber-300 px-5 py-3.5 text-sm font-semibold transition-all"
                  >
                    <Tag className="h-4 w-4 text-amber-400" />
                    Lifetime Deal · ₹{LIFETIME_PRICE}
                  </Link>
                </div>
              </div>

              {/* Right Diya (Large glowing diya) */}
              <div className="shrink-0 flex items-center justify-center">
                <HeroDiya side="right" size="lg" />
              </div>
            </div>
          </div>

          {/* Social Proof / Trust Metrics Ribbon */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="rounded-2xl border border-amber-400/20 bg-slate-900/60 p-4 text-center backdrop-blur-md">
              <div className="text-2xl sm:text-3xl font-black text-amber-300">₹45+ Cr</div>
              <div className="text-xs text-slate-400 font-medium mt-1">Reconciled Collections</div>
            </div>
            <div className="rounded-2xl border border-amber-400/20 bg-slate-900/60 p-4 text-center backdrop-blur-md">
              <div className="text-2xl sm:text-3xl font-black text-amber-300">100%</div>
              <div className="text-xs text-slate-400 font-medium mt-1">Cash &amp; Online Audit</div>
            </div>
            <div className="rounded-2xl border border-amber-400/20 bg-slate-900/60 p-4 text-center backdrop-blur-md">
              <div className="text-2xl sm:text-3xl font-black text-amber-300">0%</div>
              <div className="text-xs text-slate-400 font-medium mt-1">Discrepancy Tolerance</div>
            </div>
            <div className="rounded-2xl border border-amber-400/20 bg-slate-900/60 p-4 text-center backdrop-blur-md">
              <div className="text-2xl sm:text-3xl font-black text-amber-300">₹999</div>
              <div className="text-xs text-slate-400 font-medium mt-1">Festive Lifetime Access</div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION A: FESTIVAL OF GROWTH — ILLUMINATE YOUR BUSINESS OPERATIONS
          5 Core Capabilities Cards with Gold Accents
          ============================================================ */}
      <section id="festival-of-growth" className="relative py-20 lg:py-28 bg-white dark:bg-slate-950 transition-colors">
        {/* Subtle decorative rangoli background watermark */}
        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-80 h-80 pointer-events-none opacity-5 dark:opacity-10">
          <RangoliMandala className="w-full h-full text-amber-500" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 border border-amber-500/30 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-3">
              <Flame className="h-3.5 w-3.5 text-amber-500" />
              <span>Section A · Festival of Growth</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
              Illuminate Your Business Operations
            </h2>
            <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
              Just as Diwali lights up every home, HubVault brings radiant clarity, accountability, and effortless
              reconciliation to your daily last-mile operations.
            </p>
          </div>

          {/* 5 Core Capability Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {/* Card 1: Digital Collection Tracking */}
            <div className="group rounded-3xl border border-amber-500/30 hover:border-amber-400 bg-gradient-to-b from-amber-500/[0.04] via-white to-white dark:from-amber-500/[0.06] dark:via-slate-900 dark:to-slate-900 p-8 shadow-sm hover:shadow-[0_10px_35px_rgba(245,158,11,0.18)] transition-all duration-300 hover:-translate-y-1">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 mb-6 group-hover:scale-110 transition-transform">
                <Banknote className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Digital Collection Tracking</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                Record Cash on Delivery (COD) and Online/UPI collections in real time for every delivery rider as runs
                finish.
              </p>
              <ul className="space-y-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  Instant payment mode breakdown (Cash vs UPI)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  Denomination note counter with auto-totaling
                </li>
              </ul>
            </div>

            {/* Card 2: Cash & Online Reconciliation */}
            <div className="group rounded-3xl border border-amber-500/30 hover:border-amber-400 bg-gradient-to-b from-amber-500/[0.04] via-white to-white dark:from-amber-500/[0.06] dark:via-slate-900 dark:to-slate-900 p-8 shadow-sm hover:shadow-[0_10px_35px_rgba(245,158,11,0.18)] transition-all duration-300 hover:-translate-y-1">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 mb-6 group-hover:scale-110 transition-transform">
                <Scale className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Cash &amp; Online Reconciliation</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                Achieve zero discrepancy between rider field submissions, supervisor handovers, and final bank deposits.
              </p>
              <ul className="space-y-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  Automated short/excess calculation
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  UPI transaction reference cross-checking
                </li>
              </ul>
            </div>

            {/* Card 3: Multi-Hub Management */}
            <div className="group rounded-3xl border border-amber-500/30 hover:border-amber-400 bg-gradient-to-b from-amber-500/[0.04] via-white to-white dark:from-amber-500/[0.06] dark:via-slate-900 dark:to-slate-900 p-8 shadow-sm hover:shadow-[0_10px_35px_rgba(245,158,11,0.18)] transition-all duration-300 hover:-translate-y-1">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 mb-6 group-hover:scale-110 transition-transform">
                <Building2 className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Multi-Hub Management</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                Monitor and balance 1 or 50 delivery hubs, franchise branches, and cross-docks under one master
                reconciliation umbrella.
              </p>
              <ul className="space-y-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  Station-level permissions &amp; segregation
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  Executive multi-hub performance roll-up
                </li>
              </ul>
            </div>

            {/* Card 4: Dues & Recovery Tracking */}
            <div className="group rounded-3xl border border-amber-500/30 hover:border-amber-400 bg-gradient-to-b from-amber-500/[0.04] via-white to-white dark:from-amber-500/[0.06] dark:via-slate-900 dark:to-slate-900 p-8 shadow-sm hover:shadow-[0_10px_35px_rgba(245,158,11,0.18)] transition-all duration-300 hover:-translate-y-1">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 mb-6 group-hover:scale-110 transition-transform">
                <Wallet className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Dues &amp; Recovery Tracking</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                Eliminate unpaid shortages and rider disputes with transparent running dues balances and partial recovery
                logs.
              </p>
              <ul className="space-y-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  Automated short-collection rollover to rider ledger
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  Full settlement receipt audit trail
                </li>
              </ul>
            </div>

            {/* Card 5: Real-Time Performance Reports (Span 2 cols on lg) */}
            <div className="group lg:col-span-2 rounded-3xl border border-amber-500/30 hover:border-amber-400 bg-gradient-to-r from-amber-500/[0.05] via-amber-400/[0.03] to-slate-900/5 dark:from-amber-500/[0.08] dark:to-slate-900 p-8 shadow-sm hover:shadow-[0_10px_35px_rgba(245,158,11,0.18)] transition-all duration-300 hover:-translate-y-1">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div>
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 mb-4 group-hover:scale-110 transition-transform">
                    <BarChart3 className="h-7 w-7" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                    Real-Time Performance Reports &amp; Team Leaderboard
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl mb-4">
                    Track Total OFD, Status OFD, Delivered, First Attempt Delivery (COD FAD %, Prepaid FAD %), and team
                    productivity metrics with 1-click clipboard snapshot generation.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                      1-Click Day Closing Report
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                      <TrendingUp className="h-3.5 w-3.5 text-indigo-500" />
                      FAD Delivery Analytics
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
                      Instant Excel / CSV Exports
                    </span>
                  </div>
                </div>

                <div className="shrink-0 w-full md:w-auto">
                  <Link
                    to="/trial-signup"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300 text-white px-6 py-3.5 text-sm font-bold shadow-md transition-all active:scale-95"
                  >
                    Try Performance Hub
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION B: WHY HUBVAULT? — A BRIGHTER WAY TO MANAGE COLLECTIONS
          Contrasting dark manual chaos with illuminated HubVault solutions
          ============================================================ */}
      <section
        id="solutions"
        className="relative py-20 lg:py-28 bg-slate-50 dark:bg-[#070b1a] border-y border-slate-200/80 dark:border-amber-500/20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 border border-amber-500/30 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-3">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <span>Section B · Why HubVault</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
              A Brighter Way to Manage Collections
            </h2>
            <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
              Step out of the dark maze of messy registers, disputed rider balances, and 2 AM spreadsheets. Step into
              pure operational clarity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Comparison 1 */}
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-8 shadow-sm overflow-hidden relative">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-500">The Dark Manual Way</span>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-500">The Radiant HubVault Way</span>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3 text-sm text-slate-500 dark:text-slate-400">
                  <XCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                  <span>Manual paper slips &amp; physical registers get smudged, torn, or misplaced by midnight.</span>
                </div>
                <div className="flex items-start gap-3 text-sm font-semibold text-slate-900 dark:text-amber-200 bg-amber-500/10 dark:bg-amber-500/15 p-3.5 rounded-2xl border border-amber-500/20">
                  <CheckCircle2 className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <span>
                    Digital closing entries stored securely with instantaneous sync, verified counts, and tamper audit.
                  </span>
                </div>
              </div>
            </div>

            {/* Comparison 2 */}
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-8 shadow-sm overflow-hidden relative">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-500">The Dark Manual Way</span>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-500">The Radiant HubVault Way</span>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3 text-sm text-slate-500 dark:text-slate-400">
                  <XCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                  <span>Riders dispute shortages next morning, claiming they submitted correct cash without receipts.</span>
                </div>
                <div className="flex items-start gap-3 text-sm font-semibold text-slate-900 dark:text-amber-200 bg-amber-500/10 dark:bg-amber-500/15 p-3.5 rounded-2xl border border-amber-500/20">
                  <CheckCircle2 className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <span>
                    Instant digital counter receipt showing exact cash note denominations &amp; online UTR numbers.
                  </span>
                </div>
              </div>
            </div>

            {/* Comparison 3 */}
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-8 shadow-sm overflow-hidden relative">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-500">The Dark Manual Way</span>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-500">The Radiant HubVault Way</span>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3 text-sm text-slate-500 dark:text-slate-400">
                  <XCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                  <span>Hub managers spend 2 to 3 hours nightly calling supervisors and merging conflicting Excel files.</span>
                </div>
                <div className="flex items-start gap-3 text-sm font-semibold text-slate-900 dark:text-amber-200 bg-amber-500/10 dark:bg-amber-500/15 p-3.5 rounded-2xl border border-amber-500/20">
                  <CheckCircle2 className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <span>
                    1-Click Day Closing aggregates all station runs automatically, giving owners instant clarity.
                  </span>
                </div>
              </div>
            </div>

            {/* Comparison 4 */}
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-8 shadow-sm overflow-hidden relative">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-500">The Dark Manual Way</span>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-500">The Radiant HubVault Way</span>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3 text-sm text-slate-500 dark:text-slate-400">
                  <XCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                  <span>Unrecovered dues pile up silently across months until riders leave the company unannounced.</span>
                </div>
                <div className="flex items-start gap-3 text-sm font-semibold text-slate-900 dark:text-amber-200 bg-amber-500/10 dark:bg-amber-500/15 p-3.5 rounded-2xl border border-amber-500/20">
                  <CheckCircle2 className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <span>
                    Automated dues ledger warns supervisors immediately when a rider reaches the safe credit limit.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION C: LIVE OPERATIONS SUITE SHOWCASE
          Interactive live demonstration of the software
          ============================================================ */}
      <section id="showcase" className="relative py-20 lg:py-28 bg-white dark:bg-slate-950 transition-colors">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-3">
              <Layers className="h-3.5 w-3.5 text-indigo-500" />
              <span>Section C · Operations Suite Showcase</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
              Built for High-Velocity Logistics Hubs
            </h2>
            <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
              Experience the exact interfaces that cashiers, supervisors, and operations managers use every single evening
              at delivery stations.
            </p>
          </div>

          {/* Interactive Tabs */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex rounded-2xl bg-slate-100 dark:bg-slate-900 p-1.5 border border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setActiveTab('register')}
                className={clsx(
                  'rounded-xl px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-bold transition-all cursor-pointer',
                  activeTab === 'register'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                )}
              >
                Collection Register
              </button>
              <button
                onClick={() => setActiveTab('dues')}
                className={clsx(
                  'rounded-xl px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-bold transition-all cursor-pointer',
                  activeTab === 'dues'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                )}
              >
                Dues &amp; Recovery
              </button>
              <button
                onClick={() => setActiveTab('multihub')}
                className={clsx(
                  'rounded-xl px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-bold transition-all cursor-pointer',
                  activeTab === 'multihub'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                )}
              >
                Multi-Hub Matrix
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={clsx(
                  'rounded-xl px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-bold transition-all cursor-pointer',
                  activeTab === 'analytics'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                )}
              >
                Leaderboard &amp; FAD %
              </button>
            </div>
          </div>

          {/* Tab Screen Showcase */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-900 text-white shadow-2xl overflow-hidden">
            {/* Top Browser Bar */}
            <div className="flex items-center justify-between px-6 py-3.5 bg-slate-950/80 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="ml-3 text-xs font-mono text-slate-400">hubvault.in/app/reconciliation-live</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Sync
                </span>
              </div>
            </div>

            {/* Tab 1: Collection Register */}
            {activeTab === 'register' && (
              <div className="p-6 sm:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">Daily Collection Register — Hub #04 South Bangalore</h3>
                    <p className="text-xs text-slate-400 mt-1">Shift: Evening Closing · Cashier: Rohit Verma</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-amber-300 font-mono bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl">
                      Expected: ₹1,84,520
                    </span>
                    <span className="text-xs text-emerald-300 font-mono bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-xl">
                      Reconciled: ₹1,84,520
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase text-[11px] font-bold">
                        <th className="py-3 px-3">Rider Name</th>
                        <th className="py-3 px-3">Run ID</th>
                        <th className="py-3 px-3">COD Delivered</th>
                        <th className="py-3 px-3">Cash Handover</th>
                        <th className="py-3 px-3">UPI Received</th>
                        <th className="py-3 px-3">Diff / Due</th>
                        <th className="py-3 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                      <tr>
                        <td className="py-3 px-3 font-sans font-bold text-slate-200">Arun Kumar (R-104)</td>
                        <td className="py-3 px-3 text-slate-400">DRS-8821</td>
                        <td className="py-3 px-3 text-slate-200">₹32,450</td>
                        <td className="py-3 px-3 text-emerald-400">₹24,000</td>
                        <td className="py-3 px-3 text-indigo-400">₹8,450</td>
                        <td className="py-3 px-3 text-emerald-400">₹0.00</td>
                        <td className="py-3 px-3">
                          <span className="rounded-full bg-emerald-500/20 text-emerald-300 px-2 py-0.5 text-[10px] font-bold border border-emerald-500/30">
                            MATCHED
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 px-3 font-sans font-bold text-slate-200">Vikas Patil (R-112)</td>
                        <td className="py-3 px-3 text-slate-400">DRS-8824</td>
                        <td className="py-3 px-3 text-slate-200">₹28,100</td>
                        <td className="py-3 px-3 text-emerald-400">₹20,500</td>
                        <td className="py-3 px-3 text-indigo-400">₹7,600</td>
                        <td className="py-3 px-3 text-emerald-400">₹0.00</td>
                        <td className="py-3 px-3">
                          <span className="rounded-full bg-emerald-500/20 text-emerald-300 px-2 py-0.5 text-[10px] font-bold border border-emerald-500/30">
                            MATCHED
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td className="py-3 px-3 font-sans font-bold text-slate-200">Sanjay Maurya (R-109)</td>
                        <td className="py-3 px-3 text-slate-400">DRS-8828</td>
                        <td className="py-3 px-3 text-slate-200">₹41,200</td>
                        <td className="py-3 px-3 text-emerald-400">₹32,000</td>
                        <td className="py-3 px-3 text-indigo-400">₹9,000</td>
                        <td className="py-3 px-3 text-amber-400 font-bold">-₹200 (Due)</td>
                        <td className="py-3 px-3">
                          <span className="rounded-full bg-amber-500/20 text-amber-300 px-2 py-0.5 text-[10px] font-bold border border-amber-500/30">
                            PARTIAL DUE
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab 2: Dues & Recovery */}
            {activeTab === 'dues' && (
              <div className="p-6 sm:p-8 space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-white">Employee Dues &amp; Recovery Ledger</h3>
                  <p className="text-xs text-slate-400 mt-1">Automatic balance rollover from short daily collection</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700">
                    <div className="text-xs text-slate-400">Total Active Riders</div>
                    <div className="text-2xl font-bold text-white mt-1">42</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700">
                    <div className="text-xs text-slate-400">Outstanding Dues</div>
                    <div className="text-2xl font-bold text-amber-400 mt-1">₹3,420</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700">
                    <div className="text-xs text-slate-400">Recovered Today</div>
                    <div className="text-2xl font-bold text-emerald-400 mt-1">₹1,850</div>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700 text-xs text-slate-300 leading-relaxed">
                  Every short submission registers immediately to the rider profile with reason stamps (e.g., customer
                  change issue, pending UPI settlement). Clear audits mean zero disputes upon settlement.
                </div>
              </div>
            )}

            {/* Tab 3: Multi-Hub */}
            {activeTab === 'multihub' && (
              <div className="p-6 sm:p-8 space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-white">Central Operations Multi-Hub Overview</h3>
                  <p className="text-xs text-slate-400 mt-1">Live status across 5 active delivery stations</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-800/80 border border-emerald-500/30">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm">Bangalore South Hub</span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-mono">
                        CLOSED
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-2">Collections: ₹1,84,520</div>
                    <div className="text-xs text-emerald-400 font-semibold mt-1">Discrepancy: ₹0.00</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-800/80 border border-amber-500/30">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm">Whitefield Hub</span>
                      <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded font-mono">
                        CLOSING (85%)
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-2">Collections: ₹2,15,800</div>
                    <div className="text-xs text-amber-400 font-semibold mt-1">Pending Riders: 4</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-800/80 border border-indigo-500/30">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm">Electronic City Hub</span>
                      <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded font-mono">
                        CLOSING (92%)
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-2">Collections: ₹1,62,400</div>
                    <div className="text-xs text-indigo-400 font-semibold mt-1">Pending Riders: 2</div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Analytics */}
            {activeTab === 'analytics' && (
              <div className="p-6 sm:p-8 space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-white">Employee Performance Leaderboard &amp; FAD % Metrics</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Complete metrics: Total OFD, Status OFD, Delivered, COD FAD %, Prepaid FAD %, and Overall %
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-center">
                  <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                    <div className="text-[11px] text-slate-400 font-sans">COD FAD %</div>
                    <div className="text-lg font-bold text-emerald-400 mt-0.5">88.4%</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                    <div className="text-[11px] text-slate-400 font-sans">Prepaid FAD %</div>
                    <div className="text-lg font-bold text-indigo-400 mt-0.5">93.2%</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                    <div className="text-[11px] text-slate-400 font-sans">Overall Delivery %</div>
                    <div className="text-lg font-bold text-amber-400 mt-0.5">91.8%</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                    <div className="text-[11px] text-slate-400 font-sans">FAD Delivery %</div>
                    <div className="text-lg font-bold text-white mt-0.5">89.6%</div>
                  </div>
                </div>
                <div className="text-xs text-slate-400 flex items-center justify-between pt-2 border-t border-slate-800">
                  <span>Export high-resolution report snapshots formatted for WhatsApp and leadership updates.</span>
                  <Link to="/trial-signup" className="text-amber-300 font-semibold hover:underline">
                    View Live Leaderboard &rarr;
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION D: TRANSPARENT FESTIVE PRICING
          Diwali Special Offer — Flat ₹999 Lifetime License
          ============================================================ */}
      <section
        id="pricing"
        className="relative py-20 lg:py-28 bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-[#05091a] dark:via-slate-950 dark:to-[#05091a] border-t border-slate-200 dark:border-amber-500/20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-400/40 px-4 py-1 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300 mb-3 shadow-sm">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span>Diwali Special Offer · Flat ₹999</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
              Invest Once in Operational Peace of Mind
            </h2>
            <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
              No hidden fees, no per-rider charges, no surprise price escalations. Simple, honest pricing built for
              growing logistics businesses.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-4xl mx-auto items-stretch">
            {/* Plan 1: Lifetime License (Featured Festive Deal) */}
            <div className="relative rounded-3xl border-2 border-amber-400 bg-white dark:bg-slate-900 p-8 sm:p-10 shadow-[0_0_40px_rgba(245,158,11,0.22)] flex flex-col justify-between">
              {/* Top Banner Tag */}
              <div className="absolute -top-4 right-8 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 px-4 py-1 text-xs font-black uppercase tracking-wider shadow-md">
                <Sparkles className="h-3.5 w-3.5" />
                Diwali Special Deal
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">Lifetime License</h3>
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                      Pay once · Use forever across all hubs
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-baseline justify-end gap-1">
                      <span className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white">
                        ₹{LIFETIME_PRICE}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium line-through">
                      Regular ₹4,999
                    </span>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-3.5">
                  {BUY_FEATURES.map((feature, i) => (
                    <div key={i} className="flex items-start gap-3 text-xs sm:text-sm text-slate-700 dark:text-slate-200">
                      <Check className="h-4 w-4 text-amber-500 shrink-0 mt-0.5 font-bold" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
                <Link
                  to="/buy-hubvault"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 px-6 py-4 text-base font-extrabold shadow-[0_4px_20px_rgba(245,158,11,0.4)] transition-all transform hover:scale-[1.02] active:scale-95"
                >
                  Buy Lifetime License for ₹{LIFETIME_PRICE}
                  <ArrowRight className="h-5 w-5 text-slate-950" />
                </Link>
                <div className="text-center text-[11px] text-slate-500 dark:text-slate-400 mt-2.5">
                  Instant activation via UPI QR · No subscription recurring charges
                </div>
              </div>
            </div>

            {/* Plan 2: Monthly Subscription */}
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 sm:p-10 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Monthly Plan</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                      Flexible month-to-month subscription
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-baseline justify-end gap-1">
                      <span className="text-4xl font-black text-slate-900 dark:text-white">₹{MONTHLY_PRICE}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">/mo</span>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Cancel anytime</span>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-3.5">
                  <div className="flex items-start gap-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5 font-bold" />
                    <span>Unlimited daily collection register &amp; DRS tracking</span>
                  </div>
                  <div className="flex items-start gap-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5 font-bold" />
                    <span>Multi-hub role management &amp; supervisor permissions</span>
                  </div>
                  <div className="flex items-start gap-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5 font-bold" />
                    <span>Employee dues ledger &amp; recovery history</span>
                  </div>
                  <div className="flex items-start gap-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5 font-bold" />
                    <span>Excel closing reports &amp; snapshot generator</span>
                  </div>
                  <div className="flex items-start gap-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5 font-bold" />
                    <span>Standard email support &amp; documentation</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
                <Link
                  to="/trial-signup"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 text-white px-6 py-4 text-base font-bold shadow-sm transition-all active:scale-95"
                >
                  Start 14-Day Free Trial
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <div className="text-center text-[11px] text-slate-500 dark:text-slate-400 mt-2.5">
                  No credit card required · Full feature access during trial
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ad slot for public monetization */}
      <div className="mx-auto max-w-7xl px-4 py-8">
        <AdSlot slot="4444444444" format="horizontal" className="rounded-2xl overflow-hidden" />
      </div>

      {/* ============================================================
          SECTION E: FINAL FESTIVE CALL TO ACTION
          "Start Your Journey Towards Smarter Operations"
          ============================================================ */}
      <section className="relative overflow-hidden py-20 lg:py-24 bg-gradient-to-r from-[#030614] via-[#0b1030] to-[#030614] text-white border-t border-amber-500/30">
        <div className="pointer-events-none absolute -bottom-24 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-amber-500/10 blur-[120px] rounded-full" />

        <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 border border-amber-400/40 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-amber-300">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            <span>Celebrate Growth &amp; Efficiency</span>
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
          </div>

          <h2 className="text-3xl sm:text-5xl font-black tracking-tight uppercase leading-tight">
            Start Your Journey Towards{' '}
            <span className="bg-gradient-to-r from-amber-200 via-yellow-200 to-amber-300 bg-clip-text text-transparent">
              Smarter Operations
            </span>{' '}
            This Diwali
          </h2>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Join logistics and last-mile delivery operations across India that trust HubVault to reconcile collections
            flawlessly every evening.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/trial-signup"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 px-8 py-4 text-base font-extrabold shadow-[0_0_30px_rgba(245,158,11,0.55)] transition-all transform hover:scale-105 active:scale-95"
            >
              Start Free Trial Now
              <ArrowRight className="h-5 w-5 text-slate-950" />
            </Link>

            <Link
              to="/contact"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-amber-400/40 text-amber-200 hover:text-white px-8 py-4 text-base font-bold shadow-md transition-all active:scale-95"
            >
              Contact Our Team
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
