import { Link } from 'react-router-dom';
import { ShieldCheck, Mail } from 'lucide-react';
import SEO from '@/components/SEO';

const SECTIONS = [
  {
    id: 'introduction',
    title: 'Introduction',
    body: [
      'This Privacy Policy explains how HubVault ("we", "us", or "our") collects, uses, stores, and protects your information when you use our platform and related services. HubVault is a SaaS platform that helps logistics and delivery businesses manage daily collections, reconcile cash and online payments, track dues, and operate multiple hubs.',
      'By creating an account or using our services, you agree to the practices described in this Privacy Policy. If you do not agree with these practices, please do not use the platform.',
    ],
  },
  {
    id: 'information-we-collect',
    title: 'Information We Collect',
    body: [
      'We collect information that you provide directly to us, information generated through your use of the platform, and certain technical information about your device and usage patterns. The categories of information we may process are described in detail below.',
    ],
  },
  {
    id: 'account-and-user-information',
    title: 'Account and User Information',
    body: [
      'When you create an account, we collect the following information:',
      'Name — the name of the user creating the account or being added to the organization.',
      'Email address — used for authentication, notifications, and account communication.',
      'Phone number — may be collected for contact purposes and account recovery.',
      'Login information — authentication credentials used to access the platform.',
      'Role and permissions — the access level assigned to each user within the organization.',
    ],
  },
  {
    id: 'business-and-hub-information',
    title: 'Business and Hub Information',
    body: [
      'When you set up your organization on the platform, we collect:',
      'Organization name and details — the name of your business and relevant operational details.',
      'Hub or branch information — names, codes, and locations of the hubs or branches you manage.',
      'User assignments — which users are assigned to which hubs and their roles within each hub.',
    ],
  },
  {
    id: 'collection-and-reconciliation-data',
    title: 'Collection and Reconciliation Data',
    body: [
      'As you use the platform to manage daily collections, we process the following types of data:',
      'Collection entries — cash and online collection amounts, including denomination breakdowns.',
      'Expected COD amounts — the amounts expected for each shipment or order.',
      'Reconciliation records — comparisons of expected vs. actual collections, including shortages and excesses.',
      'Employee and collector data — names and identifiers of the delivery employees and collectors entered by you or your team.',
      'Dues and recovery records — pending dues attributed to employees and recovery transactions recorded against them.',
      'Reports — generated summaries of collection and reconciliation activity over specified periods.',
    ],
  },
  {
    id: 'payment-and-subscription-information',
    title: 'Payment and Subscription Information',
    body: [
      'If you subscribe to a paid plan, we may collect and process:',
      'Subscription plan details — the plan you have selected and its billing cycle.',
      'Billing information — name, email, and billing address associated with your subscription.',
      'Payment-related information — processed through our payment provider. We do not store full credit card or payment card numbers on our servers.',
    ],
  },
  {
    id: 'how-we-use-information',
    title: 'How We Use Information',
    body: [
      'We use the information we collect to:',
      'Provide, operate, and maintain the platform and its features.',
      'Authenticate users and manage access based on assigned roles.',
      'Process and store your collection, reconciliation, dues, and recovery data.',
      'Generate reports and analytics based on your data.',
      'Communicate with you about your account, subscriptions, and platform updates.',
      'Process subscription payments and manage billing.',
      'Detect, prevent, and address technical issues, errors, or misuse of the platform.',
      'Comply with applicable legal obligations.',
    ],
  },
  {
    id: 'data-storage-and-security',
    title: 'Data Storage and Security',
    body: [
      'Your data is stored in a managed cloud database. We take measures to protect your data, including encryption of data in transit and at rest within the database infrastructure.',
      'Access to data is controlled through role-based permissions. Users can only access data appropriate to their assigned role and hub. Administrative access to infrastructure is restricted to authorized personnel.',
      'While we take reasonable measures to protect your data, no system can guarantee complete security. We encourage you to use strong passwords and follow best practices for account security.',
    ],
  },
  {
    id: 'supabase-and-authentication',
    title: 'Supabase and Authentication',
    body: [
      'We use Supabase as our backend infrastructure provider for database storage and user authentication. When you log in, your authentication credentials are processed through Supabase authentication services. Your data is stored in a Supabase-managed PostgreSQL database.',
      'Supabase acts as a data processor on our behalf. Your data is processed in accordance with our instructions and the security measures provided by Supabase.',
    ],
  },
  {
    id: 'payment-provider-data',
    title: 'Payment Provider Data',
    body: [
      'Subscription payments are processed through a third-party payment provider. When you make a payment, the payment provider handles the transaction. We receive confirmation of the payment and subscription status, but we do not store your full card details or banking credentials.',
      'The payment provider is responsible for the security of the payment information you submit to them, in accordance with their own privacy policy and security practices.',
    ],
  },
  {
    id: 'cookies-and-analytics',
    title: 'Cookies and Analytics',
    body: [
      'The platform may use cookies and similar technologies for essential functionality, such as maintaining your login session. We may also use analytics tools to understand how the platform is used and to improve our services.',
      'You can control cookies through your browser settings. Disabling certain cookies may affect the functionality of the platform.',
    ],
  },
  {
    id: 'data-sharing',
    title: 'Data Sharing',
    body: [
      'We do not sell your personal information or business data to third parties. We may share information in the following circumstances:',
      'With service providers — such as Supabase (database and authentication) and our payment provider — who process data on our behalf to deliver the platform.',
      'As required by law — if we are legally compelled to disclose information by a court order, regulatory request, or similar legal process.',
      'In connection with a business transaction — if we are involved in a merger, acquisition, or sale of assets, information may be transferred as part of that transaction.',
    ],
  },
  {
    id: 'data-retention',
    title: 'Data Retention',
    body: [
      'We retain your data for as long as your account is active. If you cancel your subscription, your data remains accessible until the end of your current billing period. After that, you may request a data export for 30 days. Following the 30-day grace period, your data is permanently deleted from our systems.',
      'We may retain certain information beyond this period if required by law or for legitimate business purposes such as fraud prevention or audit compliance.',
    ],
  },
  {
    id: 'user-rights',
    title: 'User Rights',
    body: [
      'Depending on your location, you may have certain rights regarding your personal data, including:',
      'The right to access — you can request a copy of the personal data we hold about you.',
      'The right to correction — you can request that we correct inaccurate or incomplete information.',
      'The right to deletion — you can request that we delete your personal data, subject to legal exceptions.',
      'The right to data export — you can request an export of your data in a portable format.',
      'To exercise any of these rights, please contact us using the information provided in the Contact Information section below.',
    ],
  },
  {
    id: 'account-deletion',
    title: 'Account Deletion',
    body: [
      'You can request deletion of your account at any time by contacting us. Upon account deletion, your personal information will be removed from our active systems. Some data may be retained in backup systems for a limited period before being permanently deleted.',
      'Please note that account deletion is irreversible. Ensure you have exported any data you wish to keep before requesting deletion.',
    ],
  },
  {
    id: 'childrens-privacy',
    title: "Children's Privacy",
    body: [
      'The platform is designed for business use and is not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If you believe we have collected information from a child, please contact us and we will take steps to delete that information.',
    ],
  },
  {
    id: 'changes-to-this-privacy-policy',
    title: 'Changes to This Privacy Policy',
    body: [
      'We may update this Privacy Policy from time to time to reflect changes in our practices, legal requirements, or the features of our platform. When we make material changes, we will notify you through the platform or by email.',
      'The "Last Updated" date at the top of this page indicates when the policy was last revised. We encourage you to review this policy periodically.',
    ],
  },
  {
    id: 'contact-information',
    title: 'Contact Information',
    body: [
      'If you have any questions, concerns, or requests regarding this Privacy Policy or your personal data, please contact us at:',
      'Email: privacy@hubvault.in',
      'We will respond to your enquiry within a reasonable timeframe.',
    ],
  },
];

export default function Privacy() {
  const lastUpdated = 'July 24, 2026';
  return (
    <>
      <SEO
        title="Privacy Policy"
        description="Read the HubVault Privacy Policy — how we collect, use, store, and protect your information including account data, collection records, and payment information."
        path="/privacy"
      />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-neutral-50 dark:from-neutral-950">
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600/15 text-brand-600 ring-1 ring-brand-600/30">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span className="text-sm font-semibold text-brand-600 uppercase tracking-wide">Legal</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 leading-[1.15]">
            Privacy Policy
          </h1>
          <p className="mt-4 text-sm text-neutral-500 font-medium">Last Updated: {lastUpdated}</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 lg:py-20 bg-neutral-50 dark:bg-neutral-900">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {/* Table of contents */}
          <div className="card p-6 mb-10 bg-neutral-50 dark:bg-neutral-900/60">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Table of Contents</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              {SECTIONS.map((section, idx) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="text-sm text-brand-600 hover:text-brand-600 transition"
                >
                  {idx + 1}. {section.title}
                </a>
              ))}
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-10">
            {SECTIONS.map((section, idx) => (
              <section key={section.id} id={section.id} className="scroll-mt-24">
                <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 flex items-start gap-3">
                  <span className="text-brand-600 text-sm font-bold mt-1.5 tabular-nums shrink-0">{String(idx + 1).padStart(2, '0')}</span>
                  {section.title}
                </h2>
                <div className="mt-3 pl-8 space-y-3">
                  {section.body.map((para, i) => (
                    <p key={i} className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">{para}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Contact CTA */}
          <div className="mt-12 card p-6 bg-brand-50 dark:bg-brand-600/15/30 border-brand-600/30">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shrink-0">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Questions about your privacy?</p>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  Email us at{' '}
                  <a href="mailto:privacy@hubvault.in" className="font-semibold text-brand-600 hover:text-brand-600">
                    privacy@hubvault.in
                  </a>
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex items-center gap-4 text-sm">
            <Link to="/terms" className="text-neutral-500 hover:text-brand-600 transition">Terms &amp; Conditions</Link>
            <span className="text-neutral-400">|</span>
            <Link to="/contact" className="text-neutral-500 hover:text-brand-600 transition">Contact Us</Link>
          </div>
        </div>
      </section>
    </>
  );
}
