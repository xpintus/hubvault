import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe,expect,it } from 'vitest';

const migration = readFileSync(
  resolve('supabase/migrations/20260802020000_atomic_financial_workflows.sql'),
  'utf8',
).toLowerCase();

const collectionModal = readFileSync(resolve('src/components/CollectionEntryModal.tsx'), 'utf8');
const depositsPage = readFileSync(resolve('src/pages/Deposits.tsx'), 'utf8');
const recoveryPage = readFileSync(resolve('src/pages/Recovery.tsx'), 'utf8');
const syncEngine = readFileSync(resolve('src/lib/offline/syncEngine.ts'), 'utf8');
const syncContext = readFileSync(resolve('src/lib/offline/SyncContext.tsx'), 'utf8');

describe('atomic financial workflow hardening', () => {
  it('defines transaction-scoped RPCs using caller RLS', () => {
    for (const name of [
      'save_collection_entry_atomic',
      'record_shortage_atomic',
      'record_recovery_atomic',
      'delete_recovery_atomic',
    ]) {
      const fn = migration.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$;`))?.[0];
      expect(fn, `${name} should exist`).toBeTruthy();
      expect(fn).toContain('security invoker');
      expect(fn).toContain('set search_path = public, pg_temp');
    }
  });

  it('routes online multi-row writes through atomic RPCs', () => {
    expect(collectionModal).toContain("supabase.rpc('save_collection_entry_atomic'");
    expect(depositsPage).toContain("supabase.rpc('record_shortage_atomic'");
    expect(depositsPage).toContain("supabase.rpc('record_recovery_atomic'");
    expect(recoveryPage).toContain("supabase.rpc('delete_recovery_atomic'");
  });

  it('removes the reconnect listener and awaits conflict retries', () => {
    expect(syncEngine).toContain("return () => window.removeEventListener('online', handleOnline)");
    expect(syncContext).toContain('cleanupNetworkSync();');
    expect(syncEngine).toContain('await processSyncQueue(true, queueItem.user_id);');
  });
});
