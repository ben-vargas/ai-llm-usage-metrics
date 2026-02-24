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
  it('registers daily, weekly, monthly, and efficiency commands', () => {
    const cli = createCli();

    expect(cli.name()).toBe('llm-usage');
    expect(cli.commands.map((command) => command.name())).toEqual([
      'daily',
      'weekly',
      'monthly',
      'efficiency',
    ]);
  });

  it('includes output, pricing, and source filter flags on report commands', () => {
    const cli = createCli();
    const reportCommands = cli.commands.filter((command) => command.name() !== 'efficiency');

    for (const command of reportCommands) {
      expect(command.options.some((option) => option.long === '--markdown')).toBe(true);
      expect(command.options.some((option) => option.long === '--per-model-columns')).toBe(true);
      expect(command.options.some((option) => option.long === '--pricing-url')).toBe(true);
      expect(command.options.some((option) => option.long === '--pricing-offline')).toBe(true);
      expect(command.options.some((option) => option.long === '--opencode-db')).toBe(true);
      expect(command.options.some((option) => option.long === '--source')).toBe(true);
      expect(command.options.some((option) => option.long === '--source-dir')).toBe(true);
      expect(command.options.some((option) => option.long === '--model')).toBe(true);
    }
  });

  it('configures efficiency command with repository outcome flags', () => {
    const cli = createCli();
    const efficiencyCommand = cli.commands.find((command) => command.name() === 'efficiency');

    expect(efficiencyCommand).toBeDefined();
    expect(efficiencyCommand?.options.some((option) => option.long === '--repo-dir')).toBe(true);
    expect(
      efficiencyCommand?.options.some((option) => option.long === '--include-merge-commits'),
    ).toBe(true);
    expect(efficiencyCommand?.options.some((option) => option.long === '--per-model-columns')).toBe(
      false,
    );
  });

  it('runs daily command and prints terminal table output', async () => {
    const emptySessionsDir = await mkdtemp(path.join(os.tmpdir(), 'usage-cli-empty-'));
    tempDirs.push(emptySessionsDir);

    const cli = createCli();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await cli.parseAsync(
      [
        'daily',
        '--pi-dir',
        emptySessionsDir,
        '--codex-dir',
        emptySessionsDir,
        '--source',
        'pi,codex',
        '--timezone',
        'UTC',
      ],
      { from: 'user' },
    );

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(String(consoleSpy.mock.calls[0]?.[0])).toContain('Period');
    consoleSpy.mockRestore();
  });

  it('renders help output with command and npx examples', () => {
    const cli = createCli();
    const help = cli.helpInformation();
    const dailyCommandHelp = cli.commands
      .find((command) => command.name() === 'daily')
      ?.helpInformation();
    const compactDailyCommandHelp = dailyCommandHelp?.replace(/\s+/gu, ' ');

    expect(help).toContain('Supported sources (3): pi, codex, opencode');
    expect(help).toContain('Show daily usage report');
    expect(help).toContain('llm-usage <command> --help');
    expect(help).toContain('--source opencode --opencode-db /path/to/opencode.db');
    expect(help).toContain('llm-usage efficiency weekly --repo-dir /path/to/repo --json');
    expect(help).toContain('npx --yes llm-usage-metrics daily');
    expect(compactDailyCommandHelp).toContain('after source/provider/date filters');
  });

  it('supports --version output', async () => {
    const cli = createCli({ version: '1.2.3' });
    let output = '';

    cli.exitOverride();
    cli.configureOutput({
      writeOut: (value) => {
        output += value;
      },
      writeErr: (value) => {
        output += value;
      },
    });

    await expect(cli.parseAsync(['--version'], { from: 'user' })).rejects.toMatchObject({
      code: 'commander.version',
    });
    expect(output.trim()).toBe('1.2.3');
  });
});
