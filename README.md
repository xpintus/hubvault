# HubVault — Enterprise Logistics Cash Collection & Reconciliation Platform

HubVault is a production-grade web application built for logistics hubs, field collection staff, delivery operations, and financial administrators to manage daily Cash on Delivery (COD) collections, dues tracking, FIFO recovery allocations, bank CMS depositions, and multi-hub financial audits in real time.

---

## Key Features

- **Daily Collections Dashboard**:
  - Real-time track expected COD vs. actual Cash & Online collections.
  - Automatic calculation of Shortage, Excess, and Reconciliation rates.
  - Dedicated **Available Collection** metric & itemized breakdown modal (Cash + Recovery Today).
  - Aggregate physical cash denomination counter with one-click clipboard copying.

- **Dues Management & FIFO Recovery**:
  - Employee-level dues backlog summary and individual due ledgers.
  - Automatic FIFO (First-In, First-Out) recovery payment allocation across active dues.
  - Support for manual old dues and automated collection shortage records.

- **CMS Bank Deposition**:
  - Hub and date-level CMS bank deposit tracking.
  - Multi-bank payment mode splits (Cash submitted vs. Online submitted).
  - Automatic computation of CMS Pending and Excess over-deposited balances.

- **Offline-First Resilience**:
  - Offline local persistence powered by **Dexie IndexedDB**.
  - Background mutation sync queue (`syncQueue.ts`) automatically reconciling offline entries upon network recovery.

- **Enterprise Role-Based Access Control (RBAC)**:
  - Granular permissions for `super_admin`, `hub_admin`, `supervisor`, `collector`, and `auditor`.
  - Hub context filtering supporting single-hub focus or global multi-hub views.

---

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Date-fns
- **Build Tool**: Vite
- **Database & Auth**: Supabase (PostgreSQL, Row Level Security, RPC functions)
- **Offline Storage**: Dexie IndexedDB
- **Excel Import/Export**: XLSX (dynamically code-split)
- **Testing**: Vitest unit test framework
- **CI/CD**: GitHub Actions pipeline

---

## Folder Structure

```
hubvault/
├── .github/
│   └── workflows/
│       └── ci.yml                 # GitHub Actions CI pipeline
├── src/
│   ├── __tests__/                 # Vitest unit test suite
│   │   ├── cmsDeposition.test.ts
│   │   ├── dashboardCalculations.test.ts
│   │   ├── duesManagement.test.ts
│   │   └── fifoRecovery.test.ts
│   ├── components/
│   │   ├── dashboard/             # Extracted Dashboard sub-components
│   │   │   ├── AvailableCollectionModal.tsx
│   │   │   ├── DateNavigation.tsx
│   │   │   ├── DenominationSummary.tsx
│   │   │   ├── KPICard.tsx
│   │   │   ├── ReconciliationCard.tsx
│   │   │   ├── StaffActivityMobile.tsx
│   │   │   └── StaffActivityTable.tsx
│   │   ├── dues/                  # Extracted Dues sub-components
│   │   │   ├── DueCard.tsx
│   │   │   ├── DueTable.tsx
│   │   │   ├── EmployeeLedgerModal.tsx
│   │   │   ├── EmployeeSummary.tsx
│   │   │   └── RecoveryModal.tsx
│   │   ├── ui/                    # Base UI primitives & modals
│   │   └── ErrorBoundary.tsx      # Global React Error Boundary
│   ├── lib/
│   │   ├── financeCalculations.ts # Centralized financial helper library
│   │   ├── recoveryService.ts     # FIFO recovery allocation logic
│   │   ├── offline/               # Dexie schema & sync queue
│   │   ├── excel.ts               # Dynamic XLSX import & parser
│   │   ├── supabase.ts            # Supabase client initialization
│   │   └── auth.tsx               # Auth context provider
│   ├── pages/                     # Main page views
│   └── types/                     # TypeScript definitions
├── supabase/
│   └── migrations/                # Database SQL schema & RPC scripts
├── vitest.config.ts               # Vitest configuration
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-org/hubvault.git
   cd hubvault
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

---

## Verification & Testing Commands

- **Type Check**:
  ```bash
  npm run typecheck
  ```

- **Run Automated Unit Tests**:
  ```bash
  npm test
  ```

- **Run ESLint**:
  ```bash
  npm run lint
  ```

- **Build Production Bundle**:
  ```bash
  npm run build
  ```

---

## License

Private & Proprietary — All rights reserved.
