import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe,expect,it } from 'vitest';

const source = readFileSync(resolve('src/pages/Collectors.tsx'), 'utf8');

describe('Employee page loader stability', () => {
  it('does not depend on the hubs state that it updates', () => {
    expect(source).toContain('let availableHubs: Hub[]');
    expect(source).toContain('setHubs(availableHubs)');
    expect(source).not.toContain('hubCtx.accessibleHubs, hubs, toast');
  });
});
