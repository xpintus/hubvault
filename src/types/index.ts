export type UserRole = 'super_admin' | 'hub_admin' | 'supervisor' | 'collector' | 'guest' | 'trial_user';

export type LicenseStatus = 'none' | 'pending' | 'activated' | 'expired';

export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'none';

export type PlanType = 'lifetime' | 'monthly';

export type HubStatus = 'active' | 'inactive';

export type CollectorStatus = 'active' | 'inactive';

export type EntryStatus = 'reconciled' | 'pending' | 'shortage' | 'excess';

export type OnlinePaymentMode = 'upi' | 'bank_transfer' | 'other';

export interface Hub {
  id: string;
  name: string;
  code: string;
  location: string | null;
  status: HubStatus;
  created_by: string | null;
  created_at: string;
  creator?: Profile | null;
}

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  hub_id: string | null;
  can_create_hub: boolean;
  created_at: string;
  is_approved?: boolean;
  hub?: Hub | null;
  phone?: string | null;
  company?: string | null;
  hub_code?: string | null;
  location?: string | null;
  license_status?: LicenseStatus;
  license_activated_at?: string | null;
  license_expires_at?: string | null;
  hub_add_credits?: number;
  referral_code?: string | null;
  referred_by?: string | null;
  referral_earnings?: number;
  plan_type?: PlanType;
  subscription_started_at?: string | null;
  subscription_expires_at?: string | null;
  subscription_status?: SubscriptionStatus;
  last_payment_at?: string | null;
  next_billing_at?: string | null;
  renewal_count?: number;
}

export interface SubscriptionHistory {
  id: string;
  user_id: string;
  old_plan: string | null;
  new_plan: string | null;
  old_expiry: string | null;
  new_expiry: string | null;
  changed_by: string | null;
  reason: string | null;
  created_at: string;
}

export interface LicenseKey {
  id: string;
  user_id: string;
  license_code: string;
  status: 'pending' | 'activated' | 'expired';
  plan_type?: PlanType;
  generated_at: string;
  activated_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface UserHubAccess {
  id: string;
  user_id: string;
  hub_id: string;
  created_at: string;
  hub?: Hub | null;
}

export interface AuditLog {
  id: string;
  action: string;
  performed_by: string | null;
  target_user_id: string | null;
  target_hub_id: string | null;
  details: string | null;
  created_at: string;
  performer?: Profile | null;
  target_user?: Profile | null;
  target_hub?: Hub | null;
}

export interface Collector {
  id: string;
  name: string;
  employee_id: string;
  phone: string | null;
  hub_id: string;
  status: CollectorStatus;
  created_at: string;
  profile_id?: string | null;
  hub?: Hub | null;
}

export type DailyClosingStatus = 'submitted' | 'approved' | 'rejected' | 'reopened';

export interface DailyClosing {
  id: string;
  closing_date: string;
  collector_id: string;
  hub_id: string;
  expected_cash: number;
  expected_online_amount: number;
  actual_cash: number;
  online_amount: number;
  denomination_total: number;
  shortage_excess: number;
  note_500: number;
  note_200: number;
  note_100: number;
  note_50: number;
  note_20: number;
  note_10: number;
  note_5: number;
  note_2: number;
  note_1: number;
  denomination_verified: boolean;
  source_snapshot: Record<string, unknown>;
  notes: string | null;
  rejection_reason: string | null;
  status: DailyClosingStatus;
  submitted_by: string;
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reopened_by: string | null;
  reopened_at: string | null;
  created_at: string;
  updated_at: string;
  collector?: Collector | null;
  hub?: Hub | null;
}

export interface DailyClosingHistory {
  id: string;
  daily_closing_id: string;
  action: 'submitted' | 'approved' | 'rejected' | 'reopened' | 'resubmitted';
  from_status: DailyClosingStatus | null;
  to_status: DailyClosingStatus;
  reason: string | null;
  snapshot: Record<string, unknown>;
  performed_by: string;
  created_at: string;
  performer?: Profile | null;
}

export interface DailyClosingFinalization {
  id: string;
  closing_date: string;
  hub_id: string;
  finalized_by: string;
  finalized_at: string;
  closing_count: number;
  report_snapshot: Record<string, unknown>;
  finalizer?: Profile | null;
  hub?: Hub | null;
}

export interface Denomination {
  id: string;
  collection_entry_id: string;
  note_500: number;
  note_200: number;
  note_100: number;
  note_50: number;
  note_20: number;
  note_10: number;
  note_5: number;
  note_2: number;
  note_1: number;
}

export interface CollectionEntry {
  id: string;
  collection_date: string;
  collector_id: string;
  hub_id: string;
  expected_cod: number;
  cash_amount: number;
  online_amount: number;
  online_payment_mode: OnlinePaymentMode | null;
  total_collection: number;
  gap: number;
  status: EntryStatus;
  remarks: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  collector?: Collector | null;
  hub?: Hub | null;
  denominations?: Denomination[] | null;
}

export interface DenominationInput {
  note_500: number;
  note_200: number;
  note_100: number;
  note_50: number;
  note_20: number;
  note_10: number;
  note_5: number;
  note_2: number;
  note_1: number;
}

export interface CollectionEntryInput {
  collection_date: string;
  collector_id: string;
  hub_id: string;
  expected_cod: number;
  cash_amount: number;
  online_amount: number;
  online_payment_mode: OnlinePaymentMode | null;
  total_collection: number;
  gap: number;
  status: EntryStatus;
  remarks: string | null;
  denominations: DenominationInput;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  hub_admin: 'Hub Admin',
  supervisor: 'Supervisor',
  collector: 'Employee',
  guest: 'Guest User',
  trial_user: 'Trial User',
};

export const STATUS_LABELS: Record<EntryStatus, string> = {
  reconciled: 'Reconciled',
  pending: 'Pending',
  shortage: 'Shortage',
  excess: 'Excess',
};

export const PAYMENT_MODE_LABELS: Record<OnlinePaymentMode, string> = {
  upi: 'UPI',
  bank_transfer: 'Bank Transfer',
  other: 'Other',
};

export const DENOMINATIONS: { key: keyof DenominationInput; value: number; label: string }[] = [
  { key: 'note_500', value: 500, label: '₹500' },
  { key: 'note_200', value: 200, label: '₹200' },
  { key: 'note_100', value: 100, label: '₹100' },
  { key: 'note_50', value: 50, label: '₹50' },
  { key: 'note_20', value: 20, label: '₹20' },
  { key: 'note_10', value: 10, label: '₹10' },
  { key: 'note_5', value: 5, label: '₹5' },
  { key: 'note_2', value: 2, label: '₹2' },
  { key: 'note_1', value: 1, label: '₹1' },
];

export type DueStatus = 'outstanding' | 'partially_recovered' | 'fully_recovered' | 'cancelled';

export type RecoveryPaymentMode = 'cash' | 'online' | 'other';

export interface Due {
  id: string;
  collector_id: string;
  hub_id: string;
  collection_entry_id: string | null;
  daily_closing_id?: string | null;
  variance_channel?: 'cash' | 'online' | null;
  original_amount: number;
  recovered_amount: number;
  remaining_amount: number;
  due_date: string;
  status: DueStatus;
  notes: string | null;
  source?: 'collection_shortage' | 'manual_old_due' | 'penalty' | 'adjustment' | string | null;
  due_reason?: string | null;
  reference_number?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  collector?: Collector | null;
  hub?: Hub | null;
  collection_entry?: CollectionEntry | null;
}

export interface Recovery {
  id: string;
  collector_id: string;
  hub_id: string;
  due_id: string;
  recovery_date: string;
  amount: number;
  payment_mode: RecoveryPaymentMode;
  reference_number: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  collector?: Collector | null;
  hub?: Hub | null;
  due?: Due | null;
}

export interface DueInput {
  collector_id: string;
  hub_id: string;
  collection_entry_id: string | null;
  original_amount: number;
  due_date: string;
  source?: string | null;
  due_reason?: string | null;
  reference_number?: string | null;
  notes?: string | null;
}

export interface RecoveryInput {
  collector_id: string;
  hub_id: string;
  due_id: string;
  recovery_date: string;
  amount: number;
  payment_mode: RecoveryPaymentMode;
  reference_number?: string | null;
  notes?: string | null;
}

export const DUE_STATUS_LABELS: Record<DueStatus, string> = {
  outstanding: 'Outstanding',
  partially_recovered: 'Partially Recovered',
  fully_recovered: 'Fully Recovered',
  cancelled: 'Cancelled',
};

export const RECOVERY_PAYMENT_MODE_LABELS: Record<RecoveryPaymentMode, string> = {
  cash: 'Cash',
  online: 'Online',
  other: 'Other',
};

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  subject: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export type PurchaseStatus = 'pending' | 'contacted' | 'completed' | 'rejected';

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  pending: 'Pending',
  contacted: 'Contacted',
  completed: 'Completed',
  rejected: 'Rejected',
};

export interface PurchaseRequest {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string | null;
  message: string | null;
  status: PurchaseStatus;
  is_read: boolean;
  created_at: string;
}

export const EMPTY_DENOMINATIONS: DenominationInput = {
  note_500: 0,
  note_200: 0,
  note_100: 0,
  note_50: 0,
  note_20: 0,
  note_10: 0,
  note_5: 0,
  note_2: 0,
  note_1: 0,
};

export interface CmsDeposit {
  id: string;
  deposit_date: string;
  collection_date?: string | null;
  collector_id?: string | null;
  hub_id: string;
  total_cash_collected: number;
  cash_deposited: number;
  online_amount: number;
  total_expected_cms: number;
  total_deposited: number;
  cash_submitted?: number;
  online_submitted?: number;
  total_submitted?: number;
  short_amount: number;
  reference_number: string | null;
  cash_reference?: string | null;
  online_reference?: string | null;
  bank_name?: string | null;
  remarks: string | null;
  status?: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  hub?: Hub | null;
  collector?: Collector | null;
}

export interface CmsDepositInput {
  deposit_date: string;
  collection_date?: string;
  collector_id?: string | null;
  hub_id: string;
  total_cash_collected: number;
  cash_deposited: number;
  online_amount: number;
  cash_submitted?: number;
  online_submitted?: number;
  total_submitted?: number;
  short_amount: number;
  reference_number?: string | null;
  cash_reference?: string | null;
  online_reference?: string | null;
  bank_name?: string | null;
  remarks?: string | null;
}

// ==========================================
// KhataBook (Party Ledger) Types
// ==========================================

export type OpeningBalanceType = 'receivable' | 'payable';

export interface Party {
  id: string;
  hub_id: string | null;
  name: string;
  company_name: string | null;
  mobile: string | null;
  address: string | null;
  gstin: string | null;
  opening_balance: number;
  opening_balance_type: OpeningBalanceType;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  hub?: Hub | null;
}

export interface PartyInput {
  hub_id?: string | null;
  name: string;
  company_name?: string | null;
  mobile?: string | null;
  address?: string | null;
  gstin?: string | null;
  opening_balance: number;
  opening_balance_type: OpeningBalanceType;
  notes?: string | null;
}

export interface PartyTransaction {
  id: string;
  party_id: string;
  hub_id: string | null;
  transaction_date: string;
  amount_received: number;
  cash_paid: number;
  online_paid: number;
  payment_reference: string | null;
  remarks: string | null;
  attachment_url: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  party?: Party | null;
  hub?: Hub | null;
}

export interface PartyTransactionInput {
  party_id: string;
  hub_id?: string | null;
  transaction_date: string;
  amount_received: number;
  cash_paid: number;
  online_paid: number;
  payment_reference?: string | null;
  remarks?: string | null;
  attachment_url?: string | null;
}

export interface PartyAdjustment {
  id: string;
  party_id: string;
  due_transaction_id: string | null;
  payment_transaction_id: string | null;
  amount: number;
  created_at: string;
}

export type PartyLedgerStatus = 'settled' | 'pending' | 'excess' | 'partial';

export interface PartyLedgerEntry extends PartyTransaction {
  total_paid: number;
  difference: number;
  running_balance: number;
  status: PartyLedgerStatus;
  status_label: string;
  remaining_amount: number;
  adjusted_amount: number;
}

export interface PartySummaryCardData {
  party: Party;
  total_received: number;
  cash_paid: number;
  online_paid: number;
  total_paid: number;
  current_balance: number;
  last_transaction_date: string | null;
  status: 'pending' | 'excess' | 'settled';
  balance_text: string;
}

export interface KhataBookSummary {
  total_parties: number;
  total_received: number;
  total_cash_paid: number;
  total_online_paid: number;
  total_paid: number;
  current_pending: number;
  current_excess: number;
  settled_parties: number;
  today_transactions_count: number;
}

export interface KhataBookFilterState {
  party_id: string;
  from_date: string;
  to_date: string;
  status: 'all' | 'pending' | 'excess' | 'settled' | 'cash' | 'online';
  search_query: string;
}


