import { Button,Input } from '@/components/ui/primitives';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth';
import {
ArrowLeft,
ArrowRight,
Banknote,
BarChart3,
Building2,
Coins,
Eye,EyeOff,
FileText,
LogIn,
Mail,
RotateCcw,
Scale,
ShieldAlert,
ShieldCheck,
Smartphone,
Sparkles,
User,
UserPlus,
Users,
Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { Link,useNavigate } from 'react-router-dom';

const SERVICES = [
  { icon: BarChart3, label: 'Real-Time Dashboards', desc: 'Live collection trends' },
  { icon: Banknote, label: 'Denomination Tracking', desc: 'Note-by-note cash counting' },
  { icon: Smartphone, label: 'Online Payment Tracking', desc: 'UPI, bank transfers & digital' },
  { icon: Scale, label: 'Automated Gap Detection', desc: 'Shortages & excesses flagged' },
  { icon: RotateCcw, label: 'Dues & Recovery', desc: 'Track pending employee dues' },
  { icon: Building2, label: 'Multi-Hub Management', desc: 'Consolidated cross-hub view' },
  { icon: Users, label: 'Role-Based Access', desc: 'Admin, supervisor & collector' },
  { icon: FileText, label: 'Automated Reports', desc: 'One-click Excel exports' },
  { icon: Mail, label: 'Message Center', desc: 'Customer enquiries inbox' },
  { icon: ShieldAlert, label: 'Audit Logs', desc: 'Full action history & trail' },
];

interface SignInForm {
  email: string;
  password: string;
}

interface SignUpForm {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

type Mode = 'signin' | 'signup';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [signInForm, setSignInForm] = useState<SignInForm>({ email: '', password: '' });
  const [signUpForm, setSignUpForm] = useState<SignUpForm>({ name: '', email: '', password: '', confirmPassword: '' });
  const [signUpErrors, setSignUpErrors] = useState<Partial<SignUpForm>>({});

  const validateSignUp = (): boolean => {
    const e: Partial<SignUpForm> = {};
    if (!signUpForm.name.trim()) e.name = 'Name is required';
    else if (signUpForm.name.trim().length < 2) e.name = 'Name must be at least 2 characters';
    if (!signUpForm.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signUpForm.email.trim())) e.email = 'Please enter a valid email address';
    if (!signUpForm.password) e.password = 'Password is required';
    else if (signUpForm.password.length < 6) e.password = 'Password must be at least 6 characters';
    if (!signUpForm.confirmPassword) e.confirmPassword = 'Please confirm your password';
    else if (signUpForm.confirmPassword !== signUpForm.password) e.confirmPassword = 'Passwords do not match';
    setSignUpErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(signInForm.email.trim(), signInForm.password);
    if (error) {
      toast.error(error);
      setLoading(false);
    } else {
      navigate('/dashboard');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSignUp()) return;
    setLoading(true);
    const { error } = await signUp(
      signUpForm.name.trim(),
      signUpForm.email.trim(),
      signUpForm.password
    );
    if (error) {
      toast.error(error);
      setLoading(false);
    } else {
      toast.success('Account created successfully! Welcome to HubVault.');
      navigate('/dashboard');
    }
  };

  const switchMode = (newMode: Mode) => {
    setMode(newMode);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setSignUpErrors({});
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F8FAFC] dark:bg-[#0F172A]">
      {/* Left brand panel — hidden on mobile, shown on desktop */}
      <div className="hidden lg:flex lg:w-[48%] relative flex-col overflow-hidden bg-[#F1F5F9] dark:bg-[#1E293B] text-neutral-800 dark:text-neutral-200">
        {/* Gradient glow blobs */}
        <div className="absolute top-10 -right-20 w-80 h-80 rounded-full bg-brand-400/20 dark:bg-brand-600/25 blur-[100px]" />
        <div className="absolute -bottom-20 -left-10 w-72 h-72 rounded-full bg-accent-400/20 dark:bg-accent-600/20 blur-[100px]" />
        {/* Dot pattern */}
        <div
          className="absolute inset-0 opacity-[0.12] dark:opacity-[0.06]"
          style={{
            backgroundImage: 'radial-gradient(circle at 25% 25%, #6366F1 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Floating cash & money elements */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute top-[12%] right-[10%] animate-sway">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-600/15 backdrop-blur text-brand-600 dark:text-brand-400 shadow-lg ring-2 ring-brand-600/20">
              <Coins className="h-6 w-6" />
            </div>
          </div>
          <div className="absolute top-[42%] left-[6%] animate-sway-reverse" style={{ animationDelay: '1s' }}>
            <div className="flex h-10 w-16 items-center justify-center rounded-lg bg-white/60 dark:bg-white/10 backdrop-blur text-brand-600 dark:text-brand-400 shadow-md ring-1 ring-brand-600/15">
              <Banknote className="h-5 w-5" />
            </div>
          </div>
          <div className="absolute bottom-[15%] right-[8%] animate-sway" style={{ animationDelay: '0.5s' }}>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-500/15 text-accent-500 dark:text-accent-400 shadow-md ring-1 ring-accent-500/15">
              <Coins className="h-4 w-4" />
            </div>
          </div>
          <div className="absolute top-[68%] right-[12%] animate-sway-reverse" style={{ animationDelay: '2s' }}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/60 dark:bg-white/10 backdrop-blur text-brand-600 dark:text-brand-400 shadow-md ring-1 ring-brand-600/15">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <div className="absolute bottom-0 left-[15%] animate-float-coin" style={{ animationDelay: '1s' }}>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-400/30 text-brand-600 dark:text-brand-400 ring-1 ring-brand-600/15">
              <Coins className="h-4 w-4" />
            </div>
          </div>
          <div className="absolute bottom-0 right-[30%] animate-float-note" style={{ animationDelay: '3s' }}>
            <div className="flex h-6 w-10 items-center justify-center rounded-md bg-accent-400/30 text-accent-600 dark:text-accent-400 ring-1 ring-accent-500/10">
              <Banknote className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>

        <div className="relative flex-1 flex flex-col p-7 lg:p-12 overflow-y-auto">
          {/* Logo — clickable, goes to homepage */}
          <Link
            to="/"
            className="flex items-center gap-3 shrink-0 group cursor-pointer w-fit"
            title="Back to homepage"
          >
            <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-400 p-3 text-white shadow-glow transition-transform group-hover:scale-105 group-active:scale-95">
              <Wallet className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">HubVault</h1>
              <p className="text-neutral-500 dark:text-neutral-400 text-sm font-medium">Collection Reconciliation Suite</p>
            </div>
          </Link>

          {/* Headline */}
          <div className="mt-8 shrink-0">
            <h2 className="text-[1.75rem] lg:text-4xl font-bold leading-[1.15] tracking-tight text-neutral-800 dark:text-neutral-200">
              Everything your logistics business needs to <span className="gradient-text">reconcile collections.</span>
            </h2>
            <p className="mt-4 text-neutral-500 dark:text-neutral-400 leading-relaxed text-[15px] max-w-lg">
              A complete platform for daily collection reconciliation — track cash and online
              payments, manage dues, and operate multiple hubs with real-time visibility.
            </p>
          </div>

          {/* Services grid */}
          <div className="mt-7 grid grid-cols-2 gap-2.5">
            {SERVICES.map((s, i) => (
              <div
                key={s.label}
                className="group flex items-start gap-2.5 rounded-xl bg-white/50 dark:bg-white/5 backdrop-blur px-3 py-2.5 border border-brand-600/10 hover:border-brand-600/25 hover:shadow-soft transition-all duration-200 animate-count-up"
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600/15 text-brand-600 dark:text-brand-400 shrink-0 group-hover:bg-brand-600/25 transition-colors">
                  <s.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-neutral-800 dark:text-neutral-200 leading-tight">{s.label}</p>
                  <p className="text-[11px] text-brand-600/70 dark:text-brand-400/70 leading-tight mt-0.5">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-6 pt-5 border-t border-brand-600/10 shrink-0">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-brand-600/80 dark:text-brand-400/80">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                Secure authentication
              </span>
              <span className="flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" />
                Real-time data
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Role-based access
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="lg:w-[52%] flex items-center justify-center p-6 sm:p-8 lg:p-12 relative bg-[#F8FAFC] dark:bg-[#0F172A] min-h-screen lg:min-h-0">
        <div className="absolute top-5 right-5 flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 dark:text-neutral-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Home</span>
          </Link>
          <ThemeToggle />
        </div>

        <div className="w-full max-w-md animate-slide-up">
          <div className="mb-6">
            {/* Mobile logo — clickable, goes to homepage */}
            <Link to="/" className="flex items-center gap-3 mb-6 lg:hidden group w-fit" title="Back to homepage">
              <div className="rounded-xl bg-gradient-to-br from-brand-600 to-brand-400 p-2.5 text-white shadow-glow transition-transform group-hover:scale-105 group-active:scale-95">
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-neutral-800 dark:text-neutral-200">HubVault</h1>
                <p className="text-sm text-neutral-500">Collection Reconciliation Suite</p>
              </div>
            </Link>

            {/* Friendly badge */}
            <div className="hidden lg:flex items-center gap-1.5 mb-4 text-xs font-semibold text-brand-600 dark:text-brand-400">
              <Sparkles className="h-3.5 w-3.5" />
              Trusted by logistics businesses across India
            </div>

            {/* Mode toggle */}
            <div className="flex gap-1 p-1 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] mb-6">
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                  mode === 'signin'
                    ? 'bg-gradient-to-r from-brand-600 to-brand-400 text-white shadow-glow'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
                }`}
              >
                <LogIn className="h-4 w-4" />
                Sign In
              </button>
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                  mode === 'signup'
                    ? 'bg-gradient-to-r from-brand-600 to-brand-400 text-white shadow-glow'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
                }`}
              >
                <UserPlus className="h-4 w-4" />
                New User
              </button>
            </div>

            {mode === 'signin' ? (
              <>
                <h2 className="text-2xl lg:text-3xl font-bold text-neutral-800 dark:text-neutral-200 tracking-tight">Welcome back!</h2>
                <p className="text-neutral-500 mt-1.5 text-sm">Glad to see you again. Sign in to manage your collections.</p>
              </>
            ) : (
              <>
                <h2 className="text-2xl lg:text-3xl font-bold text-neutral-800 dark:text-neutral-200 tracking-tight">Join HubVault</h2>
                <p className="text-neutral-500 mt-1.5 text-sm">Create your account and start reconciling in minutes.</p>
              </>
            )}
          </div>

          {/* Sign In Form */}
          {mode === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-5">
              <Input
                label="Email"
                type="email"
                name="email"
                value={signInForm.email}
                onChange={(e) => setSignInForm({ ...signInForm, email: e.target.value })}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
              <div className="relative">
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={signInForm.password}
                  onChange={(e) => setSignInForm({ ...signInForm, password: e.target.value })}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-[38px] text-neutral-400 hover:text-brand-600 transition"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="flex justify-end">
                <Link
                  to="/forgot-password"
                  className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline transition"
                >
                  Forgot password?
                </Link>
              </div>
              <Button type="submit" size="lg" className="w-full" loading={loading} disabled={loading}>
                Sign In
                {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>
          )}

          {/* Sign Up Form */}
          {mode === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="relative">
                <Input
                  label="Full Name"
                  type="text"
                  name="name"
                  value={signUpForm.name}
                  onChange={(e) => {
                    setSignUpForm({ ...signUpForm, name: e.target.value });
                    if (signUpErrors.name) setSignUpErrors({ ...signUpErrors, name: undefined });
                  }}
                  placeholder="Your full name"
                  error={signUpErrors.name}
                  required
                  autoComplete="name"
                  className="pr-10"
                />
                <User className="absolute right-3 top-[38px] h-4 w-4 text-neutral-400" />
              </div>
              <Input
                label="Email"
                type="email"
                name="email"
                value={signUpForm.email}
                onChange={(e) => {
                  setSignUpForm({ ...signUpForm, email: e.target.value });
                  if (signUpErrors.email) setSignUpErrors({ ...signUpErrors, email: undefined });
                }}
                placeholder="you@example.com"
                error={signUpErrors.email}
                required
                autoComplete="email"
              />
              <div className="relative">
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={signUpForm.password}
                  onChange={(e) => {
                    setSignUpForm({ ...signUpForm, password: e.target.value });
                    if (signUpErrors.password) setSignUpErrors({ ...signUpErrors, password: undefined });
                  }}
                  placeholder="At least 6 characters"
                  error={signUpErrors.password}
                  required
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-[38px] text-neutral-400 hover:text-brand-600 transition"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="relative">
                <Input
                  label="Confirm Password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={signUpForm.confirmPassword}
                  onChange={(e) => {
                    setSignUpForm({ ...signUpForm, confirmPassword: e.target.value });
                    if (signUpErrors.confirmPassword) setSignUpErrors({ ...signUpErrors, confirmPassword: undefined });
                  }}
                  placeholder="Re-enter your password"
                  error={signUpErrors.confirmPassword}
                  required
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((s) => !s)}
                  className="absolute right-3 top-[38px] text-neutral-400 hover:text-brand-600 transition"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button type="submit" size="lg" className="w-full" loading={loading} disabled={loading}>
                Create Account
                {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>
              <p className="text-center text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                By creating an account, you agree to our{' '}
                <Link to="/terms" className="font-semibold text-brand-600 dark:text-brand-400 hover:underline">Terms</Link>
                {' '}and{' '}
                <Link to="/privacy" className="font-semibold text-brand-600 dark:text-brand-400 hover:underline">Privacy Policy</Link>.
              </p>
            </form>
          )}

          {loading && <div className="sr-only">Loading…</div>}
        </div>
      </div>
    </div>
  );
}
