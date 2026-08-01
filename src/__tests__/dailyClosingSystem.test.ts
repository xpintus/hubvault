import { closingDenominationTotal } from '@/lib/dailyClosing';
import { EMPTY_DENOMINATIONS } from '@/types';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe,expect,it } from 'vitest';

const migration = readFileSync(resolve('supabase/migrations/20260803000000_daily_closing_system.sql'), 'utf8').toLowerCase();
const dbSource = readFileSync(resolve('src/lib/offline/db.ts'), 'utf8');
const syncSource = readFileSync(resolve('src/lib/offline/syncQueue.ts'), 'utf8');

describe('Daily Closing System', () => {
  it('calculates the verified physical cash total from every denomination', () => {
    expect(closingDenominationTotal({
      ...EMPTY_DENOMINATIONS, note_500: 2, note_200: 1, note_50: 3, note_2: 4, note_1: 2,
    })).toBe(1360);
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
