import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus, Eye, EyeOff, ArrowRight, ShieldAlert, Phone, Mail, Building2,
  KeyRound, User, MapPin, CheckCircle2, AlertTriangle, Lock, Unlock, Loader2,
} from 'lucide-react';
import { supabase, SUPABASE_URL } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { Button, Card, Input, Select, EmptyState, Badge, Skeleton } from '@/components/ui/primitives';
import { Profile } from '@/types';
import { formatDate } from '@/lib/format';

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

export default function TrialUsers() {
  const { profile } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState<TrialForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<TrialForm>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ name: string; email: string } | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [trialUsers, setTrialUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');

  const isSuperAdmin = profile?.role === 'super_admin';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'trial_user')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTrialUsers(data ?? []);
    } catch {
      // ignore — list is secondary
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) load();
  }, [isSuperAdmin, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return trialUsers;
    return trialUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.company ?? '').toLowerCase().includes(q) ||
        (u.hub_code ?? '').toLowerCase().includes(q)
    );
  }, [trialUsers, search]);

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
    setSuccessInfo(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(`${FUNCTION_URL}?action=create-trial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.session?.access_token}`,
        },
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
      toast.success('Trial user created successfully!');
      setSuccessInfo({ name: form.name.trim(), email: form.email.trim() });
      setForm(EMPTY_FORM);
      setErrors({});
      setShowPassword(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create trial user');
    } finally {
      setSaving(false);
    }
  };

  const handleApproval = async (userId: string, approved: boolean) => {
    setApprovingId(userId);
    try {
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(`${FUNCTION_URL}?action=approve-trial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.session?.access_token}`,
        },
        body: JSON.stringify({ user_id: userId, approved }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Request failed (${response.status})`);
      }
      toast.success(approved ? 'Trial user approved — can now sign in' : 'Access revoked');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update approval');
    } finally {
      setApprovingId(null);
    }
  };

  const update = <K extends keyof TrialForm>(key: K, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  // Access control: only super_admin can access this page
  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] animate-fade-in">
        <Card className="max-w-md w-full text-center p-8">
          <div className="mx-auto mb-5 rounded-2xl bg-red-500/10 p-4 text-red-500 ring-1 ring-red-500/20">
            <ShieldAlert className="h-10 w-10" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">Access Denied</h2>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
            You do not have permission to access this page. This area is restricted to Super Admins only.
          </p>
          <Button
            className="mt-6"
            icon={<ArrowRight className="h-4 w-4" />}
            onClick={() => navigate('/dashboard', { replace: true })}
          >
            Go to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Create Trial User</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Register a prospective customer as a Trial User with limited dashboard access.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.2fr] gap-6">
        {/* Form card */}
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="rounded-xl bg-gradient-to-br from-brand-600 to-brand-400 p-2 text-white shadow-glow">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Trial User Details</h2>
                <p className="text-xs text-neutral-500">All fields are required</p>
              </div>
            </div>

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
              Create Trial User
              {!saving && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

          {/* Success banner */}
          {successInfo && (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-brand-600/30 bg-brand-600/10 p-4 animate-fade-in">
              <CheckCircle2 className="h-5 w-5 text-brand-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Trial user created!</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  <span className="text-neutral-700 dark:text-neutral-300">{successInfo.name}</span> ({successInfo.email}) can now sign in
                  with their password. They will see a limited dashboard preview.
                </p>
              </div>
              <button
                onClick={() => setSuccessInfo(null)}
                className="ml-auto text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition"
              >
                <AlertTriangle className="h-4 w-4 opacity-0" />
                <span className="sr-only">Dismiss</span>
              </button>
            </div>
          )}
        </Card>

        {/* Trial users list */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              Existing Trial Users
              <span className="ml-2 text-xs font-normal text-neutral-500">({filtered.length})</span>
            </h2>
          </div>

          <div className="relative">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, company, or hub code…"
              className="input-base pl-10"
            />
          </div>

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <EmptyState
                icon={<UserPlus className="h-7 w-7" />}
                title="No trial users yet"
                message="Create your first trial user using the form on the left."
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((u) => (
                <Card key={u.id} className="p-4 hover:border-brand-600/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-600 to-brand-400 text-white flex items-center justify-center font-bold text-sm shadow-soft shrink-0">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-neutral-800 dark:text-neutral-200 truncate">{u.name}</p>
                        <Badge color="amber">Trial User</Badge>
                        {u.is_approved ? (
                          <Badge color="green">Approved</Badge>
                        ) : (
                          <Badge color="red">Pending Approval</Badge>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400 truncate mt-0.5">{u.email}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-neutral-500">
                        {u.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {u.phone}
                          </span>
                        )}
                        {u.company && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" /> {u.company}
                          </span>
                        )}
                        {u.hub_code && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {u.hub_code}
                          </span>
                        )}
                        {u.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {u.location}
                          </span>
                        )}
                        <span>{formatDate(u.created_at)}</span>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        {u.is_approved ? (
                          <button
                            onClick={() => handleApproval(u.id, false)}
                            disabled={approvingId === u.id}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition disabled:opacity-50"
                          >
                            {approvingId === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                            Revoke Access
                          </button>
                        ) : (
                          <button
                            onClick={() => handleApproval(u.id, true)}
                            disabled={approvingId === u.id}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition disabled:opacity-50"
                          >
                            {approvingId === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlock className="h-3.5 w-3.5" />}
                            Approve & Enable Login
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
