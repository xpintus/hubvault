import { buildClosingVarianceRemark,calculateClosingVariances } from '@/lib/dailyClosing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe,expect,it } from 'vitest';

const migration = readFileSync(resolve('supabase/migrations/20260803000000_daily_closing_system.sql'), 'utf8').toLowerCase();
const amountMigration = readFileSync(resolve('supabase/migrations/20260803010000_daily_closing_amount_inputs.sql'), 'utf8').toLowerCase();
const revisionMigration = readFileSync(resolve('supabase/migrations/20260803020000_revise_submitted_daily_closing.sql'), 'utf8').toLowerCase();
const duesMigration = readFileSync(resolve('supabase/migrations/20260803030000_daily_closing_dues_match.sql'), 'utf8').toLowerCase();
const finalizationMigration = readFileSync(resolve('supabase/migrations/20260803040000_finalize_daily_closing_day.sql'), 'utf8').toLowerCase();
const exportSource = readFileSync(resolve('src/lib/dailyClosingExport.ts'), 'utf8');
const dbSource = readFileSync(resolve('src/lib/offline/db.ts'), 'utf8');
const syncSource = readFileSync(resolve('src/lib/offline/syncQueue.ts'), 'utf8');
const dashboardSource = readFileSync(resolve('src/pages/Dashboard.tsx'), 'utf8');

describe('Daily Closing System', () => {
  it('keeps cash and online variances separate even when their total offsets', () => {
    expect(calculateClosingVariances(2500, 4020, 2500, 4020)).toEqual({ cash: 0, online: 0, total: 0, reconciled: true });
    expect(calculateClosingVariances(2500, 4020, 2000, 4520)).toEqual({ cash: -500, online: 500, total: 0, reconciled: false });
  });

  it('auto-generates a channel-specific variance remark', () => {
    expect(buildClosingVarianceRemark(calculateClosingVariances(2900, 350, 2900, 0)))
      .toContain('Online shortage ₹350');
  });

  it('uses direct actual cash and online amounts without denomination verification', () => {
    expect(amountMigration).toContain('submit_daily_closing_amounts');
    expect(amountMigration).toContain('p_actual_cash numeric');
    expect(amountMigration).toContain('p_actual_online numeric');
    expect(amountMigration).toContain('denomination_verified=false');
    expect(amountMigration).toContain('cash or online mismatch requires notes');
  });

  it('allows an awaiting-review closing to be corrected with zero online amount', () => {
    expect(revisionMigration).toContain('revise_submitted_daily_closing_amounts');
    expect(revisionMigration).toContain("v_existing.status <> 'submitted'");
    expect(revisionMigration).toContain('p_actual_online < 0');
  });

  it('matches existing collection dues and creates only residual closing dues', () => {
    expect(duesMigration).toContain("source = 'collection_shortage'");
    expect(duesMigration).toContain("'daily_closing_shortage'");
    expect(duesMigration).toContain("variance_channel='online'");
    expect(duesMigration).toContain('auto dues reconciliation:');
    expect(duesMigration).toContain("new.status = 'rejected'");
  });

  it('uses verified Daily Closing amounts and status on the dashboard', () => {
    expect(dashboardSource).toContain("supabase.from('daily_closings')");
    expect(dashboardSource).toContain('closing.actual_cash');
    expect(dashboardSource).toContain('closing.expected_online_amount');
    expect(dashboardSource).toContain('dashboardEntries');
    expect(dashboardSource).toContain('verifiedCollectorBreakdown');
  });

  it('finalizes only when every employee closing is approved and stores verifier identity', () => {
    expect(finalizationMigration).toContain('finalize_daily_closing_day');
    expect(finalizationMigration).toContain('v_approved<>v_required');
    expect(finalizationMigration).toContain('finalized_by');
    expect(finalizationMigration).toContain('report_snapshot');
    expect(finalizationMigration).toContain('finalized daily closing records are locked');
    expect(exportSource).toContain('Daily Closing verified by');
  });

  it('defines unique collector/day closings and immutable approved records', () => {
    expect(migration).toContain('unique (closing_date, collector_id, hub_id)');
    expect(migration).toContain("old.status = 'approved'");
    expect(migration).toContain("new.status <> 'reopened'");
  });

  it('enforces collector submission, manager review and super-admin reopening', () => {
    expect(migration).toContain('public.daily_closing_can_submit(collector_id, hub_id)');
    expect(migration).toContain("public.user_role() not in ('super_admin','hub_admin','supervisor')");
    expect(migration).toContain("public.user_role() <> 'super_admin'");
    expect(migration).toContain('daily_closing_history');
    expect(migration).toContain('daily_closing_insert_audit_trigger');
  });

  it('snapshots collection and CMS source amounts for auditability', () => {
    expect(migration).toContain("'cms_cash_submitted'");
    expect(migration).toContain("'cms_online_submitted'");
    expect(migration).toContain("'expected_cash'");
  });

  it('upgrades the per-user offline database and queue for daily closings', () => {
    expect(dbSource).toContain('this.version(3).stores');
    expect(dbSource).toContain("daily_closings: 'id, closing_date, collector_id, hub_id, status, submitted_by, updated_at'");
    expect(syncSource).toContain("'daily_closings'");
  });
});
