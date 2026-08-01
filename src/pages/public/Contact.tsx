import SEO from '@/components/SEO';
import AdSlot from '@/components/ui/AdSlot';
import { Button,Input,Spinner,Textarea } from '@/components/ui/primitives';
import { supabase } from '@/lib/supabase';
import { AlertCircle,Briefcase,Building2,CheckCircle2,Headphones,Mail,Send } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  subject?: string;
  message?: string;
}

const CONTACT_SECTIONS = [
  {
    icon: Briefcase,
    title: 'Sales',
    desc: 'Want to learn if HubVault is right for your business? Our sales team will help you choose the right plan.',
    email: 'sales@hubvault.in',
  },
  {
    icon: Headphones,
    title: 'Product Support',
    desc: 'Already a customer and need help with the platform? Reach out to our support team for assistance.',
    email: 'support@hubvault.in',
  },
  {
    icon: Building2,
    title: 'Business Enquiries',
    desc: 'For partnerships, integrations, or other business opportunities, we would love to hear from you.',
    email: 'business@hubvault.in',
  },
];

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', subject: '', message: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Please enter a valid email address';
    if (form.phone && !/^[+]?[\d\s()-]{7,15}$/.test(form.phone)) e.phone = 'Please enter a valid phone number';
    if (!form.subject.trim()) e.subject = 'Subject is required';
    if (!form.message.trim()) e.message = 'Message is required';
    else if (form.message.trim().length < 10) e.message = 'Message must be at least 10 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setStatus('submitting');
    try {
      const { error } = await supabase.from('contact_messages').insert({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        company: form.company.trim() || null,
        subject: form.subject.trim(),
        message: form.message.trim(),
      });
      if (error) throw error;
      setStatus('success');
      setForm({ name: '', email: '', phone: '', company: '', subject: '', message: '' });
    } catch {
      setStatus('error');
    }
  };

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <>
      <SEO
        title="Contact Us"
        description="Get in touch with the HubVault team for sales, product support, or business enquiries. Book a demo or request a consultation today."
        path="/contact"
      />

      {/* Hero */}
      <section className="relative overflow-hidden bg-[#F8FAFC] dark:bg-[#0F172A]">
        <div className="absolute top-20 -right-20 w-96 h-96 rounded-full bg-brand-200/20 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-sm font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-wide">Contact Us</span>
            <h1 className="mt-3 text-4xl lg:text-5xl font-bold tracking-tight text-neutral-800 dark:text-neutral-200 leading-[1.15]">
              We are here to help
            </h1>
            <p className="mt-6 text-lg text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Whether you want to book a demo, need product support, or have a business enquiry — our team is
              ready to assist you.
            </p>
          </div>
        </div>
      </section>

      {/* Contact sections */}
      <section className="py-16 lg:py-20 bg-neutral-100 dark:bg-neutral-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {CONTACT_SECTIONS.map((section) => (
              <div key={section.title} className="card-hover p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600/15 text-brand-600 ring-1 ring-brand-600/30">
                  <section.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-neutral-900 dark:text-neutral-100">{section.title}</h3>
                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">{section.desc}</p>
                <a href={`mailto:${section.email}`} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-600 transition">
                  <Mail className="h-4 w-4" />
                  {section.email}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* In-content ad */}
      <section className="py-8 bg-white dark:bg-neutral-950">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <AdSlot slot="8888888888" className="rounded-2xl overflow-hidden" />
        </div>
      </section>

      {/* Contact form */}
      <section className="py-16 lg:py-24 bg-white dark:bg-neutral-950">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="card p-6 sm:p-10">
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">Send us a message</h2>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              Fill out the form below and we will get back to you within 24 hours.
            </p>

            {status === 'success' && (
              <div className="mt-6 flex items-start gap-3 rounded-xl bg-brand-600/15 border border-brand-600/30 p-4 animate-slide-up">
                <CheckCircle2 className="h-5 w-5 text-brand-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-brand-600">Message sent successfully</p>
                  <p className="mt-0.5 text-sm text-brand-600">Thank you for reaching out. Our team will respond within 24 hours.</p>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="mt-6 flex items-start gap-3 rounded-xl bg-red-500/10 border border-red-500/30 p-4 animate-slide-up">
                <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Something went wrong</p>
                  <p className="mt-0.5 text-sm text-red-400">Please try again or email us directly at hello@hubvault.in</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Input
                  label="Name"
                  name="name"
                  value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Your full name"
                  error={errors.name}
                  required
                />
                <Input
                  label="Email"
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="you@example.com"
                  error={errors.email}
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Input
                  label="Phone Number"
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="+91 98765 43210"
                  error={errors.phone}
                />
                <Input
                  label="Company Name"
                  name="company"
                  value={form.company}
                  onChange={(e) => handleChange('company', e.target.value)}
                  placeholder="Your company (optional)"
                />
              </div>
              <Input
                label="Subject"
                name="subject"
                value={form.subject}
                onChange={(e) => handleChange('subject', e.target.value)}
                placeholder="How can we help?"
                error={errors.subject}
                required
              />
              <Textarea
                label="Message"
                name="message"
                value={form.message}
                onChange={(e) => handleChange('message', e.target.value)}
                placeholder="Tell us more about your enquiry..."
                rows={5}
                error={errors.message}
                required
              />
              <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={status === 'submitting'}>
                {status === 'submitting' ? (
                  <><Spinner className="h-4 w-4" /> Sending...</>
                ) : (
                  <>Send Message <Send className="h-4 w-4" /></>
                )}
              </Button>
            </form>
          </div>

          {/* CTA */}
          <div className="mt-8 text-center">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Prefer to talk to us directly?{' '}
              <a href="mailto:hello@hubvault.in" className="font-semibold text-brand-600 hover:text-brand-600">
                Email us
              </a>{' '}
              or{' '}
              <Link to="/contact" className="font-semibold text-brand-600 hover:text-brand-600">
                book a demo
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
