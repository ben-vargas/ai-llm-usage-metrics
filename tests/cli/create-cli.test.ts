import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createCli } from '../../src/cli/create-cli.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

describe('createCli', () => {
  it('registers daily, weekly, and monthly commands', () => {
    const cli = createCli();

    expect(cli.commands.map((command) => command.name())).toEqual(['daily', 'weekly', 'monthly']);
  });

  it('includes the markdown flag on each command', () => {
    const cli = createCli();

    for (const command of cli.commands) {
      expect(command.options.some((option) => option.long === '--markdown')).toBe(true);
    }
  });

  it('runs daily command and prints terminal table output', async () => {
    const emptySessionsDir = await mkdtemp(path.join(os.tmpdir(), 'usage-cli-empty-'));
    tempDirs.push(emptySessionsDir);

    const cli = createCli();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await cli.parseAsync(
      ['daily', '--pi-dir', emptySessionsDir, '--codex-dir', emptySessionsDir, '--timezone', 'UTC'],
      { from: 'user' },
    );

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(String(consoleSpy.mock.calls[0]?.[0])).toContain('Period');
    consoleSpy.mockRestore();
  });

  it('renders help output', () => {
    const cli = createCli();

    expect(cli.helpInformation()).toContain('Show daily usage report');
  });
});
