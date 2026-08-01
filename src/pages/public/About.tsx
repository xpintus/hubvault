import SEO from '@/components/SEO';
import AdSlot from '@/components/ui/AdSlot';
import {
ArrowRight,
BarChart3,Building2,
Eye,
Scale,
Target,
TrendingUp,
Users,
Wallet
} from 'lucide-react';
import { Link } from 'react-router-dom';

const BENEFITS = [
  { icon: BarChart3, title: 'Real-Time Visibility', desc: 'See exactly where each hub stands — total collections, shortages, excesses, and reconciliation rates — at any moment.' },
  { icon: Scale, title: 'Accurate Reconciliation', desc: 'Automated gap detection eliminates manual comparison errors and flags every shortage and excess instantly.' },
  { icon: Building2, title: 'Multi-Hub Control', desc: 'Operate multiple hubs independently while management sees a consolidated view across all locations.' },
  { icon: Users, title: 'Role-Based Access', desc: 'Super Admin, Hub Admin, and Hub Supervisor roles ensure the right people see the right data.' },
  { icon: TrendingUp, title: 'Dues & Recovery Tracking', desc: 'Track pending dues from employees and manage recovery with clear, auditable records.' },
  { icon: Wallet, title: 'Cash & Online Tracking', desc: 'Track cash denominations and online payments separately for precise mixed-mode reconciliation.' },
];

const PROBLEM_POINTS = [
  'Cash counted manually with frequent arithmetic errors',
  'Shortages and excesses discovered days or weeks late',
  'No way to see real-time collection status across hubs',
  'Dues and recovery tracked on paper or ad-hoc spreadsheets',
  'Month-end reporting takes hours of manual compilation',
  'No audit trail for who entered what and when',
];

export default function About() {
  return (
    <>
      <SEO
        title="About Us"
        description="Learn about HubVault — a SaaS platform built to help logistics and delivery businesses manage daily collections, reconciliation, dues, and multi-hub operations with precision."
        path="/about"
      />

      {/* Hero */}
      <section className="relative overflow-hidden bg-[#F8FAFC] dark:bg-[#0F172A]">
        <div className="absolute top-20 -right-20 w-96 h-96 rounded-full bg-brand-400/20 dark:bg-brand-600/20 blur-[100px]" />
        <div className="absolute -bottom-20 -left-10 w-72 h-72 rounded-full bg-accent-400/15 dark:bg-accent-600/15 blur-[100px]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-sm font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-wide">About Us</span>
            <h1 className="mt-3 text-4xl lg:text-5xl font-bold tracking-tight text-neutral-800 dark:text-neutral-200 leading-[1.15]">
              Built for logistics teams who take collections seriously
            </h1>
            <p className="mt-6 text-lg text-neutral-500 dark:text-neutral-400 leading-relaxed">
              HubVault is a SaaS platform that helps logistics and delivery businesses manage
              daily collections, reconcile cash and online payments, track dues, and operate multiple hubs —
              all from one digital system.
            </p>
          </div>
        </div>
      </section>

      {/* The Problem */}
      <section className="py-20 lg:py-24 bg-neutral-100 dark:bg-neutral-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <span className="text-sm font-semibold text-brand-600 uppercase tracking-wide">The Problem</span>
              <h2 className="mt-2 text-3xl lg:text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                Collections are messy. Spreadsheets make it worse.
              </h2>
              <p className="mt-4 text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Most delivery businesses handle COD collections with spreadsheets, paper logs, and end-of-day
                counting. This approach is slow, error-prone, and impossible to scale across multiple hubs.
                Money leaks go unnoticed until they become significant losses.
              </p>
              <ul className="mt-6 space-y-3">
                {PROBLEM_POINTS.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-sm text-neutral-700 dark:text-neutral-300">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:pl-8">
              <div className="card p-8 bg-gradient-to-br from-neutral-100 dark:from-neutral-950 to-accent-600/5">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-soft">
                  <Target className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-neutral-900 dark:text-neutral-100">The Solution</h3>
                <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  A digital platform that mirrors your existing collection process while adding structure,
                  automation, and real-time reporting. Every collection is captured with validated forms,
                  every gap is detected automatically, and every entry is attributable to a specific person.
                </p>
                <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  The result: fewer errors, faster reconciliation, and a clear audit trail for every rupee
                  that moves through your business.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why It Was Created */}
      <section className="py-20 lg:py-24 bg-neutral-50 dark:bg-neutral-950">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="text-sm font-semibold text-brand-600 uppercase tracking-wide">Our Story</span>
            <h2 className="mt-2 text-3xl lg:text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              Why we built this platform
            </h2>
            <p className="mt-6 text-lg text-neutral-500 dark:text-neutral-400 leading-relaxed">
              HubVault was created after watching logistics businesses struggle with the same
              recurring problem: daily collections that never quite matched up. Spreadsheets were patched together,
              paper logs were lost, and shortages were discovered too late to investigate. The bigger the operation
              grew, the harder reconciliation became.
            </p>
            <p className="mt-4 text-lg text-neutral-500 dark:text-neutral-400 leading-relaxed">
              We built a platform that replaces the manual chaos with a structured, digital system — one that
              captures collections accurately, detects gaps automatically, and gives management real-time visibility
              across every hub. The goal was simple: help logistics teams close every day knowing exactly what was
              collected, what was expected, and where the gaps are.
            </p>
          </div>
        </div>
      </section>

      {/* In-content ad */}
      <section className="py-8 bg-neutral-100 dark:bg-neutral-900">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <AdSlot slot="5555555555" className="rounded-2xl overflow-hidden" />
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 lg:py-24 bg-neutral-100 dark:bg-neutral-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-semibold text-brand-600 uppercase tracking-wide">Key Benefits</span>
            <h2 className="mt-2 text-3xl lg:text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              How the platform helps your business
            </h2>
          </div>
          <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {BENEFITS.map((b) => (
              <div key={b.title} className="card-hover p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600/15 text-brand-600 ring-1 ring-brand-600/30">
                  <b.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-neutral-900 dark:text-neutral-100">{b.title}</h3>
                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-20 lg:py-24 bg-neutral-50 dark:bg-neutral-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            <div className="card p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white shadow-soft">
                <Target className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-2xl font-bold text-neutral-900 dark:text-neutral-100">Our Mission</h2>
              <p className="mt-3 text-neutral-500 dark:text-neutral-400 leading-relaxed">
                To help logistics and delivery businesses eliminate collection errors, gain real-time visibility
                across all hubs, and operate with the financial precision that growth demands. We do this by
                replacing manual processes with a digital system that is accurate, auditable, and scalable.
              </p>
            </div>
            <div className="card p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-500 text-white shadow-soft">
                <Eye className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-2xl font-bold text-neutral-900 dark:text-neutral-100">Our Vision</h2>
              <p className="mt-3 text-neutral-500 dark:text-neutral-400 leading-relaxed">
                A logistics industry where every rupee collected is tracked, verified, and reconciled in real time —
                where no business loses money to avoidable errors, and where management has complete confidence in
                their daily collection numbers, no matter how many hubs they operate.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* In-content ad */}
      <section className="py-8 bg-neutral-50 dark:bg-neutral-950">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <AdSlot slot="6666666666" className="rounded-2xl overflow-hidden" />
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-20 overflow-hidden bg-[#F8FAFC] dark:bg-[#0F172A]">
        <div className="absolute top-0 -right-32 w-[400px] h-[400px] rounded-full bg-brand-400/15 dark:bg-brand-600/15 blur-[120px]" />
        <div className="absolute -bottom-20 -left-20 w-[350px] h-[350px] rounded-full bg-accent-400/15 dark:bg-accent-600/15 blur-[100px]" />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-neutral-800 dark:text-neutral-200">
            Get HubVault today
          </h2>
          <p className="mt-4 text-lg text-neutral-500 dark:text-neutral-400">
            See how digital collection reconciliation transforms your daily operations.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/#pricing"
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
    </>
  );
}
