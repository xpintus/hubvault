import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  UserPlus, Eye, EyeOff, ArrowRight, Phone, Mail, Building2,
  KeyRound, User, MapPin, CheckCircle2, Lock, Sparkles, Wallet,
} from 'lucide-react';
import SEO from '@/components/SEO';
import { useToast } from '@/components/ui/Toast';
import { Button, Card, Input, Select } from '@/components/ui/primitives';
import { SUPABASE_URL } from '@/lib/supabase';

const COMPANIES = ['Valmo', 'Amazon', 'Flipkart', 'Shadowfax', 'Delhivery'];

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/manage-user`;

interface TrialForm {
  name: string;
  phone: string;
  email: string;
  company: string;
  hub_code: string;
  location: string;
  password: string;
}

const EMPTY_FORM: TrialForm = {
  name: '', phone: '', email: '', company: '', hub_code: '', location: '', password: '',
};

export default function TrialSignup() {
  const toast = useToast();

  const [form, setForm] = useState<TrialForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<TrialForm>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const validate = (): boolean => {
    const e: Partial<TrialForm> = {};
    if (!form.name.trim()) e.name = 'Full name is required';
    else if (form.name.trim().length < 2) e.name = 'Name must be at least 2 characters';

    const phoneDigits = form.phone.replace(/\D/g, '');
    if (!form.phone.trim()) e.phone = 'Phone number is required';
    else if (!/^\d{10}$/.test(phoneDigits)) e.phone = 'Enter a valid 10-digit Indian mobile number';

    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Please enter a valid email address';

    if (!form.company) e.company = 'Please select a company';
    if (!form.hub_code.trim()) e.hub_code = 'Hub code is required';
    if (!form.location.trim()) e.location = 'Location is required';

    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 6) e.password = 'Password must be at least 6 characters';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const response = await fetch(`${FUNCTION_URL}?action=create-trial-public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.replace(/\D/g, ''),
          email: form.email.trim(),
          company: form.company,
          hub_code: form.hub_code.trim(),
          location: form.location.trim(),
          password: form.password,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Request failed (${response.status})`);
      }
      toast.success('Account created! Awaiting admin approval.');
      setDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setSaving(false);
    }
  };

  const update = <K extends keyof TrialForm>(key: K, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  if (done) {
    return (
      <>
        <SEO title="Trial Account Created" description="Your HubVault trial account is ready." noindex />
        <div className="mx-auto max-w-lg px-4 py-16 sm:py-24">
          <Card className="p-8 text-center animate-fade-in">
            <div className="mx-auto mb-5 rounded-2xl bg-brand-600/15 p-5 text-brand-600 ring-1 ring-brand-600/20 animate-scale-in">
              <CheckCircle2 className="h-12 w-12" />
            </div>
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Account Created — Pending Approval</h1>
            <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Your HubVault trial account has been created. An administrator must approve your
              account before you can sign in. You will be able to log in once approved.
            </p>
            <div className="mt-4 rounded-xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 p-4 text-left">
              <p className="text-xs text-neutral-500 mb-1">Your login email</p>
              <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">{form.email}</p>
            </div>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Link to="/login" className="flex-1">
                <Button className="w-full" size="lg" icon={<ArrowRight className="h-4 w-4" />}>
                  Go to Login
                </Button>
              </Link>
              <Link to="/" className="flex-1">
                <Button variant="outline" className="w-full" size="lg">
                  Back to Home
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <SEO title="Free Trial Signup" description="Create a free HubVault trial account and explore the collection reconciliation dashboard." noindex />
      <div className="mx-auto max-w-xl px-4 py-12 sm:py-16">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 inline-flex rounded-2xl bg-gradient-to-br from-brand-600 to-brand-400 p-3 text-white shadow-glow">
            <UserPlus className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Start Your Free Trial</h1>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-md mx-auto">
            Fill in your details below to create a trial account and explore the HubVault dashboard.
            No credit card required.
          </p>
        </div>

        <Card className="p-6 sm:p-8">
          {/* Trial badge */}
          <div className="mb-6 flex items-center gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3">
            <Lock className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-600 font-medium">
              Trial accounts get a read-only preview of the dashboard. Upgrade to unlock full features.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name */}
            <div className="relative">
              <Input
                label="Full Name"
                name="name"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                error={errors.name}
                placeholder="John Doe"
                className="pr-10"
                autoComplete="name"
              />
              <User className="absolute right-3 top-[38px] h-4 w-4 text-neutral-400" />
            </div>

            {/* Phone */}
            <div className="relative">
              <Input
                label="Phone Number"
                name="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                error={errors.phone}
                placeholder="9876543210"
                hint="10-digit Indian mobile number"
                className="pr-10"
                autoComplete="tel"
                maxLength={10}
              />
              <Phone className="absolute right-3 top-[38px] h-4 w-4 text-neutral-400" />
            </div>

            {/* Email */}
            <div className="relative">
              <Input
                label="Email ID"
                name="email"
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                error={errors.email}
                placeholder="user@company.com"
                className="pr-10"
                autoComplete="email"
              />
              <Mail className="absolute right-3 top-[38px] h-4 w-4 text-neutral-400" />
            </div>

            {/* Company dropdown */}
            <Select
              label="Company"
              name="company"
              value={form.company}
              onChange={(e) => update('company', e.target.value)}
              error={errors.company}
            >
              <option value="">Select a company…</option>
              {COMPANIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>

            {/* Hub Code */}
            <div className="relative">
              <Input
                label="Hub Code"
                name="hub_code"
                value={form.hub_code}
                onChange={(e) => update('hub_code', e.target.value)}
                error={errors.hub_code}
                placeholder="e.g. MUM-01"
                className="pr-10"
              />
              <MapPin className="absolute right-3 top-[38px] h-4 w-4 text-neutral-400" />
            </div>

            {/* Location */}
            <div className="relative">
              <Input
                label="Location"
                name="location"
                value={form.location}
                onChange={(e) => update('location', e.target.value)}
                error={errors.location}
                placeholder="e.g. Mumbai, Maharashtra"
                className="pr-10"
              />
              <MapPin className="absolute right-3 top-[38px] h-4 w-4 text-neutral-400" />
            </div>

            {/* Password */}
            <div className="relative">
              <Input
                label="Password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                error={errors.password}
                placeholder="Min 6 characters"
                className="pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-[38px] text-neutral-400 hover:text-brand-600 transition"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={saving}
              disabled={saving}
              icon={!saving ? <KeyRound className="h-4 w-4" /> : undefined}
            >
              Create Trial Account
              {!saving && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

          <p className="mt-5 text-center text-xs text-neutral-500">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-600 hover:text-brand-500 font-semibold transition">
              Sign in
            </Link>
          </p>
        </Card>

        {/* Trust indicators */}
        <div className="mt-8 flex items-center justify-center gap-6 text-xs text-neutral-500">
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-brand-600" />
            No credit card
          </span>
          <span className="flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5 text-brand-600" />
            ₹999 lifetime upgrade
          </span>
          <span className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-brand-600" />
            Multi-hub ready
          </span>
        </div>
      </div>
    </>
  );
}
