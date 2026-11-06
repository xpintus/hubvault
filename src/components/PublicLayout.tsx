import { SITE_NAME } from '@/components/SEO';
import { clsx } from 'clsx';
import { ArrowRight, ChevronRight, Mail, Menu, ShieldCheck, Wallet, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { ThemeToggle } from './ui/ThemeToggle';

const NAV_LINKS = [
  { label: 'Features', path: '/#features' },
  { label: 'Solutions', path: '/#solutions' },
  { label: 'How It Works', path: '/#how-it-works' },
  { label: 'Showcase', path: '/#showcase' },
  { label: 'Pricing', path: '/#pricing' },
  { label: 'About', path: '/about' },
];

const FOOTER_LINKS = {
  Product: [
    { label: 'Collection Reconciliation', path: '/collection-reconciliation-software' },
    { label: 'COD Reconciliation Software', path: '/cod-reconciliation-software' },
    { label: 'Daily Closing Software', path: '/daily-closing-software' },
    { label: 'Logistics Cash Management', path: '/logistics-cash-collection-software' },
    { label: 'Features Overview', path: '/#features' },
    { label: 'Dashboard Showcase', path: '/#showcase' },
    { label: 'Pricing & Plans', path: '/#pricing' },
    { label: 'Buy Lifetime License', path: '/buy-hubvault' },
  ],
  'Free Tools': [
    { label: 'Cash Denomination Calculator', path: '/tools/cash-calculator' },
    { label: 'COD Reconciliation Calculator', path: '/tools/cod-reconciliation-calculator' },
    { label: 'Daily Collection Checklist', path: '/#how-it-works' },
    { label: 'Employee Dues Tracker', path: '/#showcase' },
  ],
  Solutions: [
    { label: 'Logistics Companies & 3PLs', path: '/#solutions' },
    { label: 'Last-Mile Delivery Partners', path: '/#solutions' },
    { label: 'Delivery Franchises & Stations', path: '/#solutions' },
    { label: 'Hub Managers & Cashiers', path: '/#solutions' },
    { label: 'Operations & Finance Teams', path: '/#solutions' },
  ],
  Company: [
    { label: 'About HubVault', path: '/about' },
    { label: 'Contact Us', path: '/contact' },
    { label: 'FAQ', path: '/faq' },
    { label: 'Blog & Articles', path: '/blog' },
    { label: 'Security & Access Control', path: '/#security' },
  ],
};

const CLEAN_PUBLIC_LINKS = new Set([
  '/buy-hubvault',
  '/about',
  '/blog',
  '/faq',
  '/contact',
  '/privacy',
  '/terms',
  '/tools/cash-calculator',
  '/tools/cod-reconciliation-calculator',
  '/collection-reconciliation-software',
  '/cod-reconciliation-software',
  '/daily-closing-software',
  '/logistics-cash-collection-software',
]);

function isHashLink(path: string) {
  return path.includes('#');
}

function handleNavClick(e: React.MouseEvent, path: string) {
  if (isHashLink(path)) {
    const id = path.split('#')[1];
    if (window.location.pathname === '/') {
      e.preventDefault();
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

export default function PublicLayout() {
  const location = useLocation();
  const isMobileToolMode = location.pathname === '/tools/cash-calculator';
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '');
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.pathname, location.hash]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors">
      {/* Top Festive Utility Bar */}
      <div className="bg-gradient-to-r from-[#030614] via-[#0b102b] to-[#030614] text-white text-xs py-2 px-4 border-b border-amber-500/25 hidden sm:block">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 text-[11px] border border-amber-400/35 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              🪔 Shubh Deepavali
            </span>
            <span className="text-amber-100/90 font-medium">
              Celebrate Diwali with HubVault: Illuminate your logistics operations with zero-discrepancy reconciliation.
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-amber-200/80">
            <Link to="/buy-hubvault" className="text-amber-300 hover:text-white font-semibold transition-colors flex items-center gap-1">
              Festive Deal: ₹999 Lifetime License &rarr;
            </Link>
            <span className="text-slate-600">|</span>
            <a href="mailto:hello@hubvault.in" className="hover:text-white transition-colors">
              hello@hubvault.in
            </a>
          </div>
        </div>
      </div>

      {/* Sticky Header (Section 1) */}
      <header
        className={clsx(
          'sticky top-0 z-50 transition-all duration-200 backdrop-blur-xl',
          isMobileToolMode && 'hidden md:block',
          scrolled
            ? 'border-b border-slate-200/80 bg-white/90 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/90'
            : 'border-b border-transparent bg-white/70 dark:bg-slate-950/70'
        )}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            {/* Logo */}
            <a href="/" className="flex items-center gap-3 shrink-0 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white shadow-sm ring-1 ring-slate-900/10 dark:ring-white/15 transition-transform group-hover:scale-105">
                <Wallet className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[17px] font-bold text-slate-900 dark:text-white tracking-tight block leading-tight">
                    HubVault
                  </span>
                  <span className="hidden xl:inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold px-2 py-0.5 text-[10px] border border-amber-500/30">
                    🪔 Happy Diwali
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block leading-tight">
                  Collection Reconciliation Suite
                </span>
              </div>
            </a>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-1">
              {NAV_LINKS.map((link) =>
                CLEAN_PUBLIC_LINKS.has(link.path) ? (
                  <a
                    key={link.path}
                    href={link.path}
                    className={clsx(
                      'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                      location.pathname === link.path.split('#')[0]
                        ? 'text-slate-900 font-semibold dark:text-white bg-slate-100 dark:bg-slate-800/60'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/50'
                    )}
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={(e) => handleNavClick(e, link.path)}
                    className={clsx(
                      'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                      location.pathname === link.path.split('#')[0] && !isHashLink(link.path)
                        ? 'text-slate-900 font-semibold dark:text-white bg-slate-100 dark:bg-slate-800/60'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/50'
                    )}
                  >
                    {link.label}
                  </Link>
                )
              )}
            </nav>

            {/* Desktop CTAs */}
            <div className="hidden lg:flex items-center gap-2.5">
              <ThemeToggle />
              <Link
                to="/login"
                className="rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Login
              </Link>
              <Link
                to="/trial-signup"
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 text-white px-4 py-2 text-sm font-semibold shadow-sm transition-all active:scale-95"
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Mobile toggle */}
            <div className="flex items-center gap-2 lg:hidden">
              <ThemeToggle />
              <button
                onClick={() => setMobileOpen((o) => !o)}
                className="rounded-xl p-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                aria-label="Toggle menu"
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile nav drawer */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-xl">
            <nav className="mx-auto max-w-7xl px-4 py-4 space-y-1">
              {NAV_LINKS.map((link) =>
                CLEAN_PUBLIC_LINKS.has(link.path) ? (
                  <a
                    key={link.path}
                    href={link.path}
                    className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {link.label}
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </a>
                ) : (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={(e) => {
                      handleNavClick(e, link.path);
                      setMobileOpen(false);
                    }}
                    className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {link.label}
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </Link>
                )
              )}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-200 text-center border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Login
                </Link>
                <Link
                  to="/trial-signup"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-950 px-4 py-3 text-sm font-bold shadow-sm"
                >
                  Get Started Free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer (Section 11) */}
      <footer
        className={clsx(
          'relative border-t border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400',
          isMobileToolMode && 'hidden'
        )}
      >
        {/* Festive Golden Ambient Hairline */}
        <div className="pointer-events-none absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 lg:py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-12">
            {/* Brand Col */}
            <div className="lg:col-span-2">
              <a href="/" className="flex items-center gap-3 mb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white ring-1 ring-slate-900/10 dark:ring-white/15">
                  <Wallet className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <span className="text-[17px] font-bold text-slate-900 dark:text-white tracking-tight block leading-tight">
                    HubVault
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-tight">
                    Collection Reconciliation Suite
                  </span>
                </div>
              </a>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-sm">
                HubVault is a digital collection reconciliation platform built for logistics and last-mile delivery
                businesses. Track COD and online collections, manage employee dues, monitor hub-wise performance, and
                reconcile collections across multiple hubs in real time.
              </p>
              <div className="mt-5 space-y-2">
                <a
                  href="mailto:hello@hubvault.in"
                  className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition"
                >
                  <Mail className="h-4 w-4 text-amber-500" />
                  hello@hubvault.in
                </a>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  End-to-End Encrypted · Multi-Hub Separation
                </div>
              </div>
            </div>

            {/* Structured Link Columns */}
            {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
              <div key={heading}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 mb-4">
                  {heading}
                </h3>
                <ul className="space-y-2.5">
                  {links.map((link) => (
                    <li key={link.label}>
                      {CLEAN_PUBLIC_LINKS.has(link.path) ? (
                        <a
                          href={link.path}
                          className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link
                          to={link.path}
                          onClick={(e) => handleNavClick(e, link.path)}
                          className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition"
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom strip */}
          <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-500 dark:text-slate-500">
              &copy; {new Date().getFullYear()} {SITE_NAME}. Digital Collection Reconciliation Suite. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <Link
                to="/privacy"
                className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition"
              >
                Privacy Policy
              </Link>
              <Link
                to="/terms"
                className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition"
              >
                Terms &amp; Conditions
              </Link>
              <a
                href="/#security"
                onClick={(e) => handleNavClick(e, '/#security')}
                className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition"
              >
                Security Standards
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
