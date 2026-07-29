import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingBag, User, Mail, Phone, Building2, MessageSquare, Lock,
  CheckCircle2, Gift, ArrowRight, ShieldCheck, Sparkles, Send,
  TrendingUp, BarChart3, Scale, RotateCcw, Wallet, Eye, EyeOff,
} from 'lucide-react';
import SEO from '@/components/SEO';
import { useToast } from '@/components/ui/Toast';
import { Button, Card, Input, Textarea, Spinner } from '@/components/ui/primitives';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';
import { useSettings } from '@/lib/settings';

const BUY_FEATURES = [
  { icon: Sparkles, text: 'Lifetime access — pay once, use forever' },
  { icon: BarChart3, text: 'Real-time dashboards & one-click reports' },
  { icon: Scale, text: 'Daily reconciliation, dues & recovery tracking' },
  { icon: Building2, text: 'Unlimited hubs, collectors & transactions' },
  { icon: RotateCcw, text: 'Free updates and bug fixes included' },
];

interface BuyFormErrors {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  hubName?: string;
}

export default function BuyNow() {
  const navigate = useNavigate();
  const toast = useToast();
  const { settings } = useSettings();
  const PRICE = settings.license_price;
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '', hubName: '', message: '', promoCode: '',
  });
  const [errors, setErrors] = useState<BuyFormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const validate = (): boolean => {
    const e: BuyFormErrors = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Please enter a valid email address';
    if (!form.phone.trim()) e.phone = 'Phone number is required';
    else if (!/^[+]?[\d\s()-]{7,15}$/.test(form.phone)) e.phone = 'Please enter a valid phone number';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 6) e.password = 'Password must be at least 6 characters';
    if (!form.hubName.trim()) e.hubName = 'Hub name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setStatus('submitting');
    setErrorMsg('');
    try {
      const funcUrl = `${SUPABASE_URL}/functions/v1/manage-user?action=create-buyer`;
      const resp = await fetch(funcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          phone: form.phone.trim(),
          hub_name: form.hubName.trim(),
          referral_code: form.promoCode.trim() || undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Failed to create account');

      await supabase.from('purchase_requests').insert({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        company: form.hubName.trim() || null,
        message: form.message.trim() || null,
        status: 'completed',
        is_read: true,
      });

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      });
      if (signInErr) throw new Error('Account created but sign-in failed. Please log in manually.');

      setStatus('success');
      toast.success('Account created! Redirecting to your dashboard...');
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof BuyFormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  if (status === 'success') {
    return (
      <>
        <SEO title="Purchase Complete" description="Your HubVault account is ready." noindex />
        <div className="mx-auto max-w-lg px-4 py-16 sm:py-24">
          <Card className="p-8 text-center animate-fade-in">
            <div className="mx-auto mb-5 rounded-2xl bg-brand-600/15 p-5 text-brand-600 ring-1 ring-brand-600/20 animate-scale-in">
              <CheckCircle2 className="h-12 w-12" />
            </div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Account Created Successfully!</h1>
            <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-sm mx-auto">
              Your Hub Admin account is ready with full hub creation access. Redirecting to your dashboard...
            </p>
            <div className="mt-6 flex justify-center">
              <Spinner className="h-6 w-6 text-brand-600" />
            </div>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <SEO
        title="Buy HubVault — Lifetime License"
        description="Get HubVault for ₹999 one-time. Lifetime access, unlimited hubs, real-time dashboards, and reconciliation. No subscriptions, no recurring fees."
        path="/buy-now"
      />

      {/* Hero band */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[#F8FAFC] dark:bg-[#0F172A]" />
        <div className="absolute top-0 -right-32 w-[500px] h-[500px] rounded-full bg-brand-400/20 dark:bg-brand-600/20 blur-[120px]" />
        <div className="absolute -bottom-32 -left-20 w-[450px] h-[450px] rounded-full bg-accent-400/20 dark:bg-accent-600/20 blur-[120px]" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="text-center max-w-2xl mx-auto">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-600/10 border border-brand-600/20 px-4 py-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              Lifetime Deal — Pay Once, Use Forever
            </span>
            <h1 className="mt-5 text-4xl sm:text-5xl font-bold tracking-tight text-neutral-800 dark:text-neutral-200">
              Buy HubVault for <span className="gradient-text">₹{PRICE}</span>
            </h1>
            <p className="mt-4 text-lg text-neutral-500 dark:text-neutral-400 leading-relaxed">
              One-time payment. No subscriptions, no recurring fees. Get full hub creation access and start reconciling collections today.
            </p>
          </div>
        </div>
      </section>

      {/* Main split layout */}
      <section className="relative -mt-6 pb-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8 items-start">
            {/* Left — Pricing & features */}
            <div className="lg:col-span-2 space-y-6">
              {/* Price card */}
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-accent-600 p-7 text-white shadow-card-hover">
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

                  <div className="mt-7 space-y-3">
                    {BUY_FEATURES.map((f) => (
                      <div key={f.text} className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15">
                          <f.icon className="h-4 w-4" />
                        </span>
                        <span className="text-sm text-white/90 leading-snug pt-1">{f.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* How it works */}
              <Card className="p-6">
                <h3 className="text-base font-bold text-neutral-800 dark:text-neutral-200">How buying works</h3>
                <p className="mt-1 text-sm text-neutral-400">Simple, transparent, and secure — no payment gateway, no hidden charges.</p>
                <div className="mt-5 space-y-4">
                  {[
                    { icon: Send, title: 'Fill in your details', desc: 'Enter your name, email, phone, and a password. Your Hub Admin account is created instantly.' },
                    { icon: ShieldCheck, title: 'Get full access', desc: 'Your account gets Hub Admin role with hub creation access. Create hubs and start managing collections.' },
                    { icon: CheckCircle2, title: 'Start reconciling', desc: 'Sign in with your new credentials and you are all set to reconcile collections across unlimited hubs.' },
                  ].map((s, i) => (
                    <div key={s.title} className="flex items-start gap-3.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600/10 text-brand-600 dark:text-brand-400 ring-1 ring-brand-600/20">
                        <s.icon className="h-4.5 w-4.5" />
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
                <div className="mt-5 rounded-xl bg-brand-600/5 border border-brand-600/15 p-3.5 flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-brand-600 dark:text-brand-400 shrink-0" />
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    <span className="font-semibold text-neutral-800 dark:text-neutral-200">100% money-back guarantee</span> within 7 days if you are not satisfied.
                  </p>
                </div>
              </Card>

              {/* Trust badges */}
              <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-neutral-500">
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-brand-600" /> Instant activation
                </span>
                <span className="flex items-center gap-1.5">
                  <Wallet className="h-4 w-4 text-brand-600" /> No hidden charges
                </span>
                <span className="flex items-center gap-1.5">
                  <RotateCcw className="h-4 w-4 text-brand-600" /> 7-day refund
                </span>
              </div>
            </div>

            {/* Right — Purchase form */}
            <div className="lg:col-span-3">
              <Card className="p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="rounded-xl bg-gradient-to-br from-brand-600 to-brand-400 p-2.5 text-white shadow-glow">
                    <ShoppingBag className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Complete Your Purchase</h2>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">Lifetime license — ₹{PRICE} one-time</p>
                  </div>
                </div>

                {status === 'error' && (
                  <div className="mb-5 flex items-start gap-3 rounded-xl bg-red-500/10 border border-red-500/30 p-3.5 animate-slide-up">
                    <CheckCircle2 className="h-5 w-5 text-red-500 shrink-0 mt-0.5 rotate-180" />
                    <p className="text-sm text-red-500 dark:text-red-400">{errorMsg || 'Something went wrong. Please try again or email us at hello@hubvault.in'}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="relative">
                    <Input
                      label="Full Name"
                      name="name"
                      value={form.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      placeholder="Your full name"
                      error={errors.name}
                      required
                      className="pl-10"
                    />
                    <User className="absolute left-3 top-[38px] h-4 w-4 text-neutral-400" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="relative">
                      <Input
                        label="Email"
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={(e) => handleChange('email', e.target.value)}
                        placeholder="you@example.com"
                        error={errors.email}
                        required
                        className="pl-10"
                      />
                      <Mail className="absolute left-3 top-[38px] h-4 w-4 text-neutral-400" />
                    </div>
                    <div className="relative">
                      <Input
                        label="Phone Number"
                        type="tel"
                        name="phone"
                        value={form.phone}
                        onChange={(e) => handleChange('phone', e.target.value)}
                        placeholder="+91 98765 43210"
                        error={errors.phone}
                        required
                        className="pl-10"
                      />
                      <Phone className="absolute left-3 top-[38px] h-4 w-4 text-neutral-400" />
                    </div>
                  </div>

                  <div className="relative">
                    <Input
                      label="Password"
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={form.password}
                      onChange={(e) => handleChange('password', e.target.value)}
                      placeholder="Create a password (min 6 chars)"
                      error={errors.password}
                      required
                      className="pl-10 pr-10"
                    />
                    <Lock className="absolute left-3 top-[38px] h-4 w-4 text-neutral-400" />
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
                      label="Hub Name"
                      name="hubName"
                      value={form.hubName}
                      onChange={(e) => handleChange('hubName', e.target.value)}
                      placeholder="e.g. Mumbai Central Hub"
                      error={errors.hubName}
                      required
                      className="pl-10"
                    />
                    <Building2 className="absolute left-3 top-[38px] h-4 w-4 text-neutral-400" />
                  </div>

                  <div className="relative">
                    <Input
                      label="Promo / Referral Code (optional)"
                      name="promoCode"
                      value={form.promoCode}
                      onChange={(e) => handleChange('promoCode', e.target.value.toUpperCase())}
                      placeholder="Enter referral code for discount"
                      className="pl-10 font-mono uppercase"
                    />
                    <Gift className="absolute left-3 top-[38px] h-4 w-4 text-neutral-400" />
                  </div>

                  <div className="relative">
                    <Textarea
                      label="Message (optional)"
                      name="message"
                      value={form.message}
                      onChange={(e) => handleChange('message', e.target.value)}
                      placeholder="Any questions or specific requirements?"
                      rows={3}
                      className="pl-10"
                    />
                    <MessageSquare className="absolute left-3 top-[38px] h-4 w-4 text-neutral-400" />
                  </div>

                  <Button type="submit" size="lg" className="w-full" disabled={status === 'submitting'} icon={status !== 'submitting' ? <ArrowRight className="h-4 w-4" /> : undefined}>
                    {status === 'submitting' ? (
                      <><Spinner className="h-4 w-4" /> Creating your account...</>
                    ) : (
                      <>Buy Now — ₹{PRICE}</>
                    )}
                  </Button>

                  <p className="text-center text-xs text-neutral-500 dark:text-neutral-400">
                    Your Hub Admin account and first hub are created instantly. You can add more hubs anytime.
                  </p>
                </form>

                <div className="mt-5 pt-5 border-t border-neutral-200 dark:border-neutral-800 text-center">
                  <p className="text-sm text-neutral-500">
                    Already have an account?{' '}
                    <Link to="/login" className="text-brand-600 hover:text-brand-500 font-semibold transition">
                      Sign in
                    </Link>
                  </p>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
