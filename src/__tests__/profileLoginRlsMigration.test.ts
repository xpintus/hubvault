import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  resolve('supabase/migrations/20260802010000_repair_profile_login_rls.sql'),
  'utf8',
).toLowerCase();

describe('profile login RLS repair migration', () => {
  it('keeps self-profile loading independent from helper functions', () => {
    expect(sql).toMatch(/create policy "profiles_select_self"[\s\S]*?using \(id = auth\.uid\(\)\);/);
  });

  it('uses safe security-definer profile helpers', () => {
    for (const name of ['user_role', 'user_hub_id', 'user_hub_ids']) {
      const fn = sql.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$;`))?.[0];
      expect(fn).toContain('security definer');
      expect(fn).toContain('set search_path = public, pg_temp');
    }
  });

  it('retains supervisor privacy and excludes supervisors from writes', () => {
    expect(sql).toContain("public.user_role() = 'supervisor'");
    expect(sql).toContain("and role = 'collector'");
    expect(sql).not.toMatch(/profiles_(insert|update|delete)[\s\S]*?user_role\(\) = 'supervisor'/);
  });
});
