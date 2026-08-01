import SEO from '@/components/SEO';
import AdSlot from '@/components/ui/AdSlot';
import { clsx } from 'clsx';
import { ArrowRight,ChevronDown,HelpCircle } from 'lucide-react';
import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQCategory {
  category: string;
  items: FAQItem[];
}

const FAQ_DATA: FAQCategory[] = [
  {
    category: 'General',
    items: [
      {
        question: 'What is HubVault?',
        answer: 'HubVault is a digital platform that helps logistics and delivery businesses verify that the money collected by their delivery team matches the expected amount for each order or shipment. It tracks cash and online payments, compares actual collections against expected COD amounts, and identifies any shortages, excesses, or exact matches. The platform automates this entire process digitally.',
      },
      {
        question: 'Who is this platform for?',
        answer: 'The platform is designed for logistics and delivery businesses that handle Cash on Delivery (COD) collections. This includes courier companies, last-mile delivery services, e-commerce fulfillment operators, and any business that needs to track and reconcile daily collections across one or multiple hubs or branches.',
      },
      {
        question: 'How does the platform work?',
        answer: 'The platform works in three steps. First, your team records daily collections — cash denominations and online payments — using structured entry forms. Second, the system automatically compares expected vs. actual amounts and flags shortages, excesses, and exact matches. Third, you review real-time dashboards, track pending dues, and export reports for any period.',
      },
    ],
  },
  {
    category: 'Features',
    items: [
      {
        question: 'Can I manage multiple hubs?',
        answer: 'Yes. The platform supports multi-hub management. Each hub operates independently with its own collections and team, while management sees a consolidated view across all hubs. You can switch between hubs or view all hubs at once, depending on your role.',
      },
      {
        question: 'Can I manage Hub Admins and Hub Supervisors?',
        answer: 'Yes. The platform has three roles: Super Admin (full access to all hubs and settings), Hub Admin (manage a specific hub and its users), and Hub Supervisor (manage collections and reconciliation for their assigned hub). You can assign and change roles as needed.',
      },
      {
        question: 'Can I track pending dues?',
        answer: 'Yes. When a reconciliation shows a shortage, the system automatically records it as a pending due against the employee. These dues carry forward and appear in subsequent reconciliations until they are cleared, ensuring no due is forgotten.',
      },
      {
        question: 'How does Recovery work?',
        answer: 'Recovery is the process of collecting outstanding dues from employees. When a due is recovered — through salary deduction, direct payment, or adjustment — you record the recovery in the system with a date, amount, and reference. The system supports partial recoveries and marks dues as cleared once fully recovered.',
      },
      {
        question: 'Can I export reports?',
        answer: 'Yes. All reports can be exported to Excel with one click. You can generate daily, weekly, and monthly reconciliation reports, filter by date range, hub, or employee, and download them for offline analysis or sharing.',
      },
    ],
  },
  {
    category: 'Pricing & Plans',
    items: [
      {
        question: 'How much does the platform cost?',
        answer: 'Pricing depends on the number of hubs, users, and features you need. We offer one-time fee licensing as well as custom plans for growing businesses and large logistics networks. Contact our sales team for a quote tailored to your requirements.',
      },
      {
        question: 'How many hubs can I manage?',
        answer: 'The platform supports unlimited hubs. You can set up as many hubs as your business needs and manage them all from a single dashboard. Contact us to discuss the right plan for your scale.',
      },
      {
        question: 'How many users can I add?',
        answer: 'Each user can be assigned a role — Super Admin, Hub Admin, or Hub Supervisor — with appropriate access levels. The number of users depends on your selected plan. Contact us for details on user limits.',
      },
      {
        question: 'Can I upgrade or change my plan later?',
        answer: 'Yes. You can upgrade or change your plan at any time as your business grows. Contact our team and we will help you transition smoothly without any data loss.',
      },
    ],
  },
  {
    category: 'Security and Data',
    items: [
      {
        question: 'How is my data stored?',
        answer: 'Your data is stored securely in a managed cloud database with encryption in transit and at rest. Access to data is controlled by role-based permissions, ensuring each user can only access data appropriate to their role. All actions are logged for audit purposes.',
      },
      {
        question: 'Can I control user access?',
        answer: 'Yes. The platform uses role-based access control. You can assign each user a role — Super Admin, Hub Admin, or Hub Supervisor — that determines what they can see and do. You can also assign users to specific hubs, limiting their access to only the data for those hubs.',
      },
      {
        question: 'Can different hubs have separate access?',
        answer: 'Yes. Each hub can have its own set of users with their own access. A Hub Admin or Supervisor assigned to one hub cannot access data from another hub. Super Admins can access all hubs. This ensures data isolation between your locations.',
      },
      {
        question: 'What happens to my data if I cancel?',
        answer: 'If you cancel your subscription, your data remains accessible until the end of your current billing period. After that, you can request a data export for 30 days. Following the 30-day grace period, your data is permanently deleted from our systems. We recommend exporting your data before cancellation.',
      },
    ],
  },
];

const ALL_ITEMS = FAQ_DATA.flatMap((cat) => cat.items);

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: ALL_ITEMS.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
};

export default function FAQ() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const categories = ['All', ...FAQ_DATA.map((c) => c.category)];
  const filteredData = activeCategory === 'All' ? FAQ_DATA : FAQ_DATA.filter((c) => c.category === activeCategory);

  const toggleItem = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <>
      <SEO
        title="FAQ — Frequently Asked Questions"
        description="Find answers to common questions about HubVault — features, plans, multi-hub management, security, and data handling."
        path="/faq"
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(FAQ_SCHEMA)}</script>
      </Helmet>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-neutral-50 dark:from-neutral-950">
        <div className="absolute top-20 -right-20 w-96 h-96 rounded-full bg-brand-200/20 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-sm font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-wide">FAQ</span>
            <h1 className="mt-3 text-4xl lg:text-5xl font-bold tracking-tight text-neutral-800 dark:text-neutral-200 leading-[1.15]">
              Frequently asked questions
            </h1>
            <p className="mt-6 text-lg text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Everything you need to know about the platform. Cannot find the answer you are looking for?{' '}
              <Link to="/contact" className="font-semibold text-brand-600 hover:text-brand-600">Contact us</Link>.
            </p>
          </div>
        </div>
      </section>

      {/* Category filter */}
      <section className="py-12 lg:py-16 bg-neutral-50 dark:bg-neutral-900">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => { setActiveCategory(cat); setOpenId(null); }}
                className={clsx(
                  'rounded-xl px-4 py-2 text-sm font-medium transition-all active:scale-95',
                  activeCategory === cat
                    ? 'bg-gradient-to-r from-brand-600 to-brand-400 text-white shadow-glow hover:shadow-glow'
                    : 'bg-neutral-50 dark:bg-neutral-950 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900'
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Accordion */}
          <div className="space-y-4">
            {filteredData.map((cat) =>
              cat.items.map((item, idx) => {
                const id = `${cat.category}-${idx}`;
                const isOpen = openId === id;
                return (
                  <div key={id} className="card overflow-hidden">
                    <button
                      onClick={() => toggleItem(id)}
                      className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-neutral-100 dark:hover:bg-neutral-900/60"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <HelpCircle className={clsx('h-5 w-5 shrink-0 mt-0.5 transition-colors', isOpen ? 'text-brand-600' : 'text-neutral-400')} />
                        <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{item.question}</span>
                      </div>
                      <ChevronDown className={clsx('h-5 w-5 shrink-0 text-neutral-400 transition-transform', isOpen && 'rotate-180')} />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 pl-13 animate-slide-down">
                        <p className="text-sm text-neutral-400 leading-relaxed pl-8">{item.answer}</p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* In-content ad */}
      <section className="py-8 bg-neutral-100 dark:bg-neutral-950">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <AdSlot slot="7777777777" className="rounded-2xl overflow-hidden" />
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-neutral-100 dark:bg-neutral-950">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Still have questions?</h2>
          <p className="mt-3 text-neutral-500 dark:text-neutral-400">
            Our team is happy to help. Reach out and we will get back to you within 24 hours.
          </p>
          <Link
            to="/contact"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3.5 text-sm font-semibold text-white shadow-soft hover:bg-brand-700 transition-all active:scale-95"
          >
            Contact Us
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
