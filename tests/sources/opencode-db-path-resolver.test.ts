import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { getDefaultOpenCodeDbPathCandidates } from '../../src/sources/opencode/opencode-db-path-resolver.js';

describe('getDefaultOpenCodeDbPathCandidates', () => {
  it('builds deterministic Linux candidate paths with XDG override precedence', () => {
    const candidates = getDefaultOpenCodeDbPathCandidates({
      platform: 'linux',
      homeDir: '/home/test-user',
      env: { XDG_DATA_HOME: '/var/lib/test-user' },
    });

    expect(candidates).toEqual([
      '/var/lib/test-user/opencode/opencode.db',
      '/var/lib/test-user/opencode/db.sqlite',
      '/home/test-user/.opencode/opencode.db',
      '/home/test-user/.opencode/db.sqlite',
    ]);
  });

  it('builds deterministic macOS candidate paths', () => {
    const candidates = getDefaultOpenCodeDbPathCandidates({
      platform: 'darwin',
      homeDir: '/Users/test-user',
      env: {},
    });

    expect(candidates).toEqual([
      '/Users/test-user/Library/Application Support/opencode/opencode.db',
      '/Users/test-user/Library/Application Support/opencode/db.sqlite',
      '/Users/test-user/.opencode/opencode.db',
      '/Users/test-user/.opencode/db.sqlite',
    ]);
  });

  it('builds deterministic Windows candidate paths from APPDATA first', () => {
    const candidates = getDefaultOpenCodeDbPathCandidates({
      platform: 'win32',
      homeDir: 'C:\\Users\\test-user',
      env: { APPDATA: 'C:\\Users\\test-user\\AppData\\Roaming' },
    });

    expect(candidates).toEqual([
      path.join('C:\\Users\\test-user\\AppData\\Roaming', 'opencode', 'opencode.db'),
      path.join('C:\\Users\\test-user\\AppData\\Roaming', 'opencode', 'db.sqlite'),
      path.join('C:\\Users\\test-user', '.opencode', 'opencode.db'),
      path.join('C:\\Users\\test-user', '.opencode', 'db.sqlite'),
    ]);
  });
});
