import { Link } from 'react-router-dom';
import { FileText, Mail } from 'lucide-react';
import SEO from '@/components/SEO';

const SECTIONS = [
  {
    id: 'acceptance-of-terms',
    title: 'Acceptance of Terms',
    body: [
      'By creating an account, accessing, or using the HubVault platform ("the Service"), you agree to be bound by these Terms and Conditions ("Terms"). If you do not agree to these Terms, please do not use the Service.',
      'These Terms constitute a legally binding agreement between you ("you" or "Customer") and HubVault ("we", "us", or "our").',
    ],
  },
  {
    id: 'description-of-the-service',
    title: 'Description of the Service',
    body: [
      'HubVault is a software-as-a-service (SaaS) platform that provides tools for managing daily collections, reconciling cash and online payments, tracking pending dues and recovery, managing multiple hubs, and generating reports for logistics and delivery businesses.',
      'The Service is a software tool. We do not collect payments on your behalf, verify your shipments, or handle your physical cash. The Service helps you organize and track data that you and your team enter into the system.',
    ],
  },
  {
    id: 'user-account-responsibilities',
    title: 'User Account Responsibilities',
    body: [
      'You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account.',
      'You agree to notify us immediately of any unauthorized use of your account or any other security breach. We are not liable for any loss or damage arising from unauthorized access to your account.',
      'You are responsible for ensuring that all users added to your organization use the Service in accordance with these Terms.',
    ],
  },
  {
    id: 'organization-and-hub-management',
    title: 'Organization and Hub Management',
    body: [
      'As a Customer, you can set up your organization on the platform and create hubs or branches as needed within the limits of your subscription plan.',
      'You are responsible for the accurate setup of your organization structure, including hub names, codes, and user assignments. Incorrect setup may affect the accuracy of your reports and reconciliation data.',
    ],
  },
  {
    id: 'user-roles-and-permissions',
    title: 'User Roles and Permissions',
    body: [
      'The Service supports three user roles: Super Admin, Hub Admin, and Hub Supervisor. Each role has different access levels and permissions.',
      'You are responsible for assigning appropriate roles to your users. Granting elevated access to users who do not need it may result in unintended data exposure or modifications within your organization.',
    ],
  },
  {
    id: 'subscription-plans',
    title: 'Subscription Plans',
    body: [
      'We offer licensing plans with different features, limits, and pricing. The details of each plan — including the number of hubs, users, and features included — will be shared with you before you make a purchase.',
      'Plan features and limits may be updated from time to time. Any changes to your plan will be communicated to you in advance.',
    ],
  },
  {
    id: 'payments-and-billing',
    title: 'Payments and Billing',
    body: [
      'We offer one-time fee licensing as well as custom plans. Payments are processed through a secure third-party payment provider.',
      'You agree to provide accurate and complete billing information and to authorize us to charge your selected payment method for the applicable fees.',
      'Pricing, included features, and payment terms are clearly communicated to you before you make a payment.',
    ],
  },
  {
    id: 'refund-policy',
    title: 'Refund Policy',
    body: [
      'Fees are non-refundable except where required by applicable law. If you believe you have been charged in error, please contact us within 30 days of the charge. We will review your request and, if warranted, issue a refund or credit.',
    ],
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable Use',
    body: [
      'You agree to use the Service only for lawful purposes and in a manner that does not infringe the rights of, or restrict the use of, the Service by others.',
      'You agree to comply with all applicable laws and regulations in connection with your use of the Service.',
    ],
  },
  {
    id: 'prohibited-activities',
    title: 'Prohibited Activities',
    body: [
      'You agree not to:',
      'Use the Service to store, process, or transmit any unlawful, fraudulent, or malicious data.',
      'Attempt to gain unauthorized access to the Service, other accounts, or our infrastructure.',
      'Interfere with or disrupt the Service, including introducing viruses or malicious code.',
      'Use the Service to harass, abuse, or harm other users.',
      'Reverse engineer, decompile, or attempt to extract the source code of the Service.',
      'Resell or sublicense the Service without our written permission.',
      'Use the Service in any way that could damage, disable, or impair the platform.',
    ],
  },
  {
    id: 'customer-data-responsibility',
    title: 'Customer Data Responsibility',
    body: [
      'You are responsible for the accuracy, completeness, and legality of all data you and your team enter into the Service, including collection entries, employee information, hub details, and reconciliation records.',
      'The Service processes data based on your inputs. We do not verify the accuracy of your data against external sources. Any reports, analytics, or reconciliation results generated by the Service are based on the data you have entered.',
    ],
  },
  {
    id: 'data-accuracy',
    title: 'Data Accuracy',
    body: [
      'The accuracy of your reconciliation and reports depends entirely on the accuracy of the data entered by your team. We are not responsible for financial losses or operational issues arising from inaccurate data entry.',
      'We recommend implementing internal processes to verify data accuracy, such as dual verification for high-value collections and regular review of reconciliation entries.',
    ],
  },
  {
    id: 'service-availability',
    title: 'Service Availability',
    body: [
      'We strive to maintain high availability of the Service but do not guarantee uninterrupted access. The Service may be temporarily unavailable due to maintenance, updates, infrastructure issues, or factors beyond our control.',
      'We are not liable for any downtime, data loss, or business interruption resulting from Service unavailability. We will make reasonable efforts to notify you of planned maintenance.',
    ],
  },
  {
    id: 'third-party-services',
    title: 'Third-Party Services',
    body: [
      'The Service integrates with and relies on third-party providers, including Supabase (database and authentication) and our payment provider. We are not responsible for the availability, security, or performance of these third-party services.',
      'Your use of third-party services may be subject to their own terms and privacy policies. We encourage you to review those terms.',
    ],
  },
  {
    id: 'intellectual-property',
    title: 'Intellectual Property',
    body: [
      'The Service, including its design, features, branding, and underlying software, is owned by us and protected by intellectual property laws. You may not copy, modify, distribute, or create derivative works from the Service without our permission.',
      'You retain all rights to the data you enter into the Service. We do not claim ownership of your business data, collection records, or any other content you upload to the platform.',
    ],
  },
  {
    id: 'limitation-of-liability',
    title: 'Limitation of Liability',
    body: [
      'To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenue, arising from your use of the Service.',
      'Our total liability for any claim arising from your use of the Service shall not exceed the amount you have paid us in the three months preceding the claim.',
    ],
  },
  {
    id: 'disclaimer',
    title: 'Disclaimer',
    body: [
      'The Service is provided "as is" and "as available" without warranties of any kind, whether express or implied. We do not warrant that the Service will be error-free, uninterrupted, or fit for any particular purpose.',
      'You use the Service at your own risk. Any reliance on data or reports generated by the Service is at your sole discretion.',
    ],
  },
  {
    id: 'account-suspension-and-termination',
    title: 'Account Suspension and Termination',
    body: [
      'We may suspend or terminate your account if you violate these Terms, use the Service in an unlawful manner, or fail to pay subscription fees when due.',
      'You may terminate your account at any time by contacting us. Upon termination, your data will be handled in accordance with our Privacy Policy and data retention practices.',
    ],
  },
  {
    id: 'changes-to-terms',
    title: 'Changes to Terms',
    body: [
      'We may update these Terms from time to time. When we make material changes, we will notify you through the platform or by email. Continued use of the Service after changes take effect constitutes acceptance of the revised Terms.',
      'The "Last Updated" date at the top of this page indicates when the Terms were last revised.',
    ],
  },
  {
    id: 'governing-law',
    title: 'Governing Law',
    body: [
      'These Terms are governed by and construed in accordance with applicable laws. Any disputes arising from these Terms or your use of the Service shall be resolved through good-faith negotiation and, if necessary, through the appropriate legal channels in the jurisdiction where we operate.',
    ],
  },
  {
    id: 'contact-information-terms',
    title: 'Contact Information',
    body: [
      'If you have any questions about these Terms and Conditions, please contact us at:',
      'Email: legal@hubvault.in',
      'We will respond to your enquiry within a reasonable timeframe.',
    ],
  },
];

export default function Terms() {
  const lastUpdated = 'July 24, 2026';
  return (
    <>
      <SEO
        title="Terms & Conditions"
        description="Read the Terms and Conditions for using the HubVault platform — licensing terms, user responsibilities, acceptable use, data responsibility, and more."
        path="/terms"
      />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-neutral-50 dark:from-neutral-950">
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600/15 text-brand-600 ring-1 ring-brand-600/30">
              <FileText className="h-5 w-5" />
            </div>
            <span className="text-sm font-semibold text-brand-600 uppercase tracking-wide">Legal</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 leading-[1.15]">
            Terms &amp; Conditions
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
                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Questions about these Terms?</p>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  Email us at{' '}
                  <a href="mailto:legal@hubvault.in" className="font-semibold text-brand-600 hover:text-brand-600">
                    legal@hubvault.in
                  </a>
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex items-center gap-4 text-sm">
            <Link to="/privacy" className="text-neutral-500 hover:text-brand-600 transition">Privacy Policy</Link>
            <span className="text-neutral-400">|</span>
            <Link to="/contact" className="text-neutral-500 hover:text-brand-600 transition">Contact Us</Link>
          </div>
        </div>
      </section>
    </>
  );
}
