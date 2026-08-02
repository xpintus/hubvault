import { SITE_NAME } from '@/components/SEO';
import { clsx } from 'clsx';
import { ArrowRight,ChevronRight,Mail,Menu,Wallet,X } from 'lucide-react';
import { useEffect,useState } from 'react';
import { Link,Outlet,useLocation } from 'react-router-dom';
import { ThemeToggle } from './ui/ThemeToggle';

const NAV_LINKS = [
  { label: 'Home', path: '/' },
  { label: 'Features', path: '/#features' },
  { label: 'Tools', path: '/#tools' },
  { label: 'Pricing', path: '/#pricing' },
  { label: 'Blog', path: '/blog' },
  { label: 'About Us', path: '/about' },
  { label: 'FAQ', path: '/faq' },
  { label: 'Contact Us', path: '/contact' },
];

const FOOTER_LINKS = {
  Product: [
    { label: 'HubVault Software', path: '/collection-reconciliation-software' },
    { label: 'Features', path: '/#features' },
    { label: 'Pricing', path: '/#pricing' },
    { label: 'Blog', path: '/blog' },
    { label: 'Cash Calculator', path: '/tools/cash-calculator' },
  ],
  Company: [
    { label: 'About Us', path: '/about' },
    { label: 'Contact Us', path: '/contact' },
    { label: 'FAQ', path: '/faq' },
  ],
  Legal: [
    { label: 'Privacy Policy', path: '/privacy' },
    { label: 'Terms & Conditions', path: '/terms' },
  ],
};

function isHashLink(path: string) {
  return path.includes('#');
}

function handleNavClick(e: React.MouseEvent, path: string) {
  if (isHashLink(path) && window.location.pathname === '/') {
    e.preventDefault();
    const id = path.split('#')[1];
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--page-bg)' }}>
      {/* Header */}
      <header
        className={clsx(
          'sticky top-0 z-50 transition-all duration-200',
          isMobileToolMode && 'hidden md:block',
          scrolled ? 'border-b border-brand-600/20 bg-[var(--page-bg)]/85 backdrop-blur-xl shadow-soft' : 'border-b border-transparent'
        )}
        style={{ background: 'color-mix(in srgb, var(--page-bg) 85%, transparent)' }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
              <div className="rounded-xl bg-gradient-to-br from-brand-600 to-brand-400 p-2 text-white shadow-soft transition-transform group-hover:scale-105">
                <Wallet className="h-5 w-5" />
              </div>
              <div className="hidden sm:block">
                <span className="text-[15px] font-bold text-neutral-900 dark:text-neutral-100 tracking-tight block leading-tight">HubVault</span>
                <span className="text-[11px] text-brand-600 dark:text-brand-400 font-medium leading-tight">Collection Reconciliation Suite</span>
              </div>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-0.5">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={(e) => handleNavClick(e, link.path)}
                  className={clsx(
                    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    location.pathname === link.path.split('#')[0]
                      ? 'text-brand-600 dark:text-brand-400'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Desktop CTAs */}
            <div className="hidden lg:flex items-center gap-2">
              <ThemeToggle />
              <Link
                to="/login"
                className="rounded-xl px-4 py-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Login
              </Link>
              <Link
                to="/buy-now"
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-2 text-sm font-bold text-white shadow-soft hover:shadow-soft-lg transition-all active:scale-95"
              >
                Buy — ₹999
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Mobile toggle */}
            <button
              onClick={() => setMobileOpen((o) => !o)}
              className="lg:hidden rounded-xl p-2 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-neutral-200 dark:border-neutral-800 animate-slide-down" style={{ background: 'var(--page-bg)' }}>
            <nav className="mx-auto max-w-7xl px-4 py-4 space-y-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={(e) => { handleNavClick(e, link.path); setMobileOpen(false); }}
                  className={clsx(
                    'flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition-colors',
                    location.pathname === link.path.split('#')[0]
                      ? 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-600/10'
                      : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  )}
                >
                  {link.label}
                  <ChevronRight className="h-4 w-4 text-neutral-400" />
                </Link>
              ))}
              <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
                <div className="flex justify-center pb-1">
                  <ThemeToggle />
                </div>
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-xl px-4 py-3 text-sm font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-center border border-neutral-200 dark:border-neutral-800"
                >
                  Login
                </Link>
                <Link
                  to="/buy-now"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-3 text-sm font-bold text-white shadow-soft"
                >
                  Buy — ₹999
                  <ArrowRight className="h-3.5 w-3.5" />
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

      {/* Footer */}
      <footer className={clsx('text-neutral-500 dark:text-neutral-400 border-t border-neutral-200 dark:border-neutral-800',isMobileToolMode&&'hidden')} style={{ background: 'var(--neutral-100)' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
            {/* Brand */}
            <div className="lg:col-span-2">
              <Link to="/" className="flex items-center gap-2.5 mb-4">
                <div className="rounded-xl bg-gradient-to-br from-brand-600 to-brand-400 p-2 text-white shadow-soft">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-[15px] font-bold text-neutral-900 dark:text-neutral-100 tracking-tight block leading-tight">HubVault</span>
                  <span className="text-[11px] text-brand-600 dark:text-brand-400 font-medium leading-tight">Collection Reconciliation Suite</span>
                </div>
              </Link>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-sm">
                The digital platform for daily collection reconciliation in logistics and delivery businesses. Track cash and online collections, manage dues, and close every day with confidence.
              </p>
              <div className="mt-5 space-y-2">
                <a href="mailto:hello@hubvault.in" className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 hover:text-brand-600 dark:hover:text-brand-400 transition">
                  <Mail className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                  hello@hubvault.in
                </a>
              </div>
            </div>

            {/* Footer links */}
            {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
              <div key={heading}>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-4">{heading}</h3>
                <ul className="space-y-2.5">
                  {links.map((link) => (
                    <li key={link.path}>
                      {['/tools/cash-calculator','/collection-reconciliation-software'].includes(link.path) ? <a
                        href={link.path}
                        className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-brand-600 dark:hover:text-brand-400 transition"
                      >
                        {link.label}
                      </a> : <Link
                        to={link.path}
                        onClick={(e) => handleNavClick(e, link.path)}
                        className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-brand-600 dark:hover:text-brand-400 transition"
                      >
                        {link.label}
                      </Link>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-12 pt-8 border-t border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-neutral-400 dark:text-neutral-500">
              {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <Link to="/privacy" className="text-xs text-neutral-400 dark:text-neutral-500 hover:text-brand-600 dark:hover:text-brand-400 transition">Privacy Policy</Link>
              <Link to="/terms" className="text-xs text-neutral-400 dark:text-neutral-500 hover:text-brand-600 dark:hover:text-brand-400 transition">Terms &amp; Conditions</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
