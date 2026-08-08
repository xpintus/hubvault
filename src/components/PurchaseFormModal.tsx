import Modal from '@/components/ui/Modal';
import { Button,Input,Select,Textarea } from '@/components/ui/primitives';
import { LOGISTICS_COMPANIES } from '@/lib/logisticsCompany';
import { useToast } from '@/components/ui/Toast';
import { supabase,SUPABASE_ANON_KEY,SUPABASE_URL } from '@/lib/supabase';
import { Building2,CheckCircle2,Gift,Lock,Mail,MessageSquare,Phone,ShoppingBag,User } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface PurchaseFormModalProps {
  open: boolean;
  onClose: () => void;
  prefillName?: string;
  prefillEmail?: string;
}

export default function PurchaseFormModal({ open, onClose, prefillName, prefillEmail }: PurchaseFormModalProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    name: prefillName ?? '',
    email: prefillEmail ?? '',
    password: '',
    phone: '',
    hubName: '',
    hubCode: '',
    logisticsCompany: '',
    message: '',
    promoCode: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Enter a valid email';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 6) e.password = 'Password must be at least 6 characters';
    if (!form.phone.trim()) e.phone = 'Phone is required';
    if (!form.hubName.trim()) e.hubName = 'Hub name is required';
    if (!form.hubCode.trim()) e.hubCode = 'Hub code is required';
    else if (!/^[A-Z0-9-]{3,16}$/.test(form.hubCode.trim().toUpperCase())) e.hubCode = 'Use 3–16 letters, numbers or hyphens';
    if (!form.logisticsCompany) e.logisticsCompany = 'Logistics company is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
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
          hub_code: form.hubCode.trim().toUpperCase(),
          logistics_company: form.logisticsCompany,
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

      setDone(true);
      toast.success('Account upgraded! Redirecting to your dashboard...');
      setTimeout(() => navigate('/app'), 1500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setDone(false);
    setErrors({});
    setForm({ ...form, password: '', promoCode: '' });
    onClose();
  };

  if (done) {
    return (
      <Modal open={open} onClose={handleClose} title="Account Created!" size="sm">
        <div className="flex flex-col items-center text-center py-6">
          <div className="rounded-2xl bg-brand-600/15 p-4 text-brand-600 ring-1 ring-brand-600/20 mb-4 animate-scale-in">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">You're all set!</h3>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-sm">
            Your Hub Admin account is ready with full hub creation access. Redirecting to your dashboard...
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Buy HubVault — Lifetime License"
      subtitle="One-time payment of ₹999. Instant account activation."
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl bg-gradient-to-r from-brand-600/10 to-brand-400/10 border border-brand-600/20 p-4 mb-2">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-brand-600 to-brand-400 p-2.5 text-white shadow-glow">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100">HubVault Lifetime License</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">All features · First hub free · Additional hubs ₹499 each · Lifetime updates</p>
            </div>
            <p className="text-2xl font-bold gradient-text">₹999</p>
          </div>
        </div>

        <div className="relative">
          <Input
            label="Full Name"
            name="name"
            value={form.name}
            onChange={(e) => { setForm({ ...form, name: e.target.value }); if (errors.name) setErrors({ ...errors, name: '' }); }}
            placeholder="Your name"
            error={errors.name}
            required
            className="pl-10"
          />
          <User className="absolute left-3 top-[38px] h-4 w-4 text-neutral-400" />
        </div>

        <div className="relative">
          <Input
            label="Email"
            type="email"
            name="email"
            value={form.email}
            onChange={(e) => { setForm({ ...form, email: e.target.value }); if (errors.email) setErrors({ ...errors, email: '' }); }}
            placeholder="you@example.com"
            error={errors.email}
            required
            className="pl-10"
          />
          <Mail className="absolute left-3 top-[38px] h-4 w-4 text-neutral-400" />
        </div>

        <div className="relative">
          <Input
            label="Password"
            type="password"
            name="password"
            value={form.password}
            onChange={(e) => { setForm({ ...form, password: e.target.value }); if (errors.password) setErrors({ ...errors, password: '' }); }}
            placeholder="Create a password (min 6 chars)"
            error={errors.password}
            required
            className="pl-10"
          />
          <Lock className="absolute left-3 top-[38px] h-4 w-4 text-neutral-400" />
        </div>

        <div className="relative">
          <Input
            label="Phone Number"
            name="phone"
            value={form.phone}
            onChange={(e) => { setForm({ ...form, phone: e.target.value }); if (errors.phone) setErrors({ ...errors, phone: '' }); }}
            placeholder="+91 98765 43210"
            error={errors.phone}
            required
            className="pl-10"
          />
          <Phone className="absolute left-3 top-[38px] h-4 w-4 text-neutral-400" />
        </div>

        <div className="relative">
          <Input
            label="Hub Name"
            name="hubName"
            value={form.hubName}
            onChange={(e) => { setForm({ ...form, hubName: e.target.value }); if (errors.hubName) setErrors({ ...errors, hubName: '' }); }}
            placeholder="e.g. Mumbai Central Hub"
            error={errors.hubName}
            required
            className="pl-10"
          />
          <Building2 className="absolute left-3 top-[38px] h-4 w-4 text-neutral-400" />
        </div>

        <div className="relative">
          <Input
            label="Unique Hub Code"
            name="hubCode"
            value={form.hubCode}
            onChange={(e) => { setForm({ ...form, hubCode: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16) }); if (errors.hubCode) setErrors({ ...errors, hubCode: '' }); }}
            placeholder="e.g. MUM-CENTRAL"
            error={errors.hubCode}
            required
            className="pl-10 font-mono uppercase"
          />
          <Building2 className="absolute left-3 top-[38px] h-4 w-4 text-neutral-400" />
        </div>

        <Select
          label="Logistics Company"
          name="logisticsCompany"
          value={form.logisticsCompany}
          onChange={(e) => { setForm({ ...form, logisticsCompany: e.target.value }); if (errors.logisticsCompany) setErrors({ ...errors, logisticsCompany: '' }); }}
          error={errors.logisticsCompany}
          required
        >
          <option value="">Select logistics company</option>
          {LOGISTICS_COMPANIES.map((company) => <option key={company} value={company}>{company}</option>)}
        </Select>

        <div className="relative">
          <Input
            label="Promo / Referral Code (optional)"
            name="promoCode"
            value={form.promoCode}
            onChange={(e) => setForm({ ...form, promoCode: e.target.value.toUpperCase() })}
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
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            placeholder="Any questions or specific requirements?"
            rows={3}
            className="pl-10"
          />
          <MessageSquare className="absolute left-3 top-[38px] h-4 w-4 text-neutral-400" />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" loading={loading} disabled={loading}>
            {loading ? 'Creating account…' : 'Buy Now — ₹999'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
