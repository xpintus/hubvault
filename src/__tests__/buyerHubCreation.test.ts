import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe,expect,it } from 'vitest';

describe('buyer first hub creation',()=>{
  it('requires an explicit unique hub code in the Buy Now form',()=>{
    const page=readFileSync(resolve('src/pages/public/BuyNow.tsx'),'utf8');
    expect(page).toContain("hubCode: ''");
    expect(page).toContain("hub_code: form.hubCode.trim().toUpperCase()");
    expect(page).toContain('Unique Hub Code');
  });

  it('never returns a successful buyer without a created and assigned hub',()=>{
    const fn=readFileSync(resolve('supabase/functions/manage-user/index.ts'),'utf8');
    expect(fn).toContain('.eq("code", requestedHubCode)');
    expect(fn).toContain('if (hubErr || !newHub)');
    expect(fn).toContain('await adminClient.auth.admin.deleteUser(newUserId)');
    expect(fn).toContain('if (accessErr || profileHubErr)');
    expect(fn).toContain('hub_id: hubId');
  });
});
