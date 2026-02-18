import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  checkForUpdatesAndMaybeRestart,
  compareVersions,
  isCacheFresh,
  resolveLatestVersion,
  shouldOfferUpdate,
  type CommandRunner,
} from '../../src/update/update-notifier.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((tempDir) => rm(tempDir, { recursive: true, force: true })));
  tempDirs.length = 0;
  vi.restoreAllMocks();
});

async function createTempCachePath(prefix: string): Promise<string> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(tempDir);
  return path.join(tempDir, 'update-check.json');
}

describe('update-notifier', () => {
  it('compares semantic versions and applies prerelease policy', () => {
    expect(compareVersions('1.2.10', '1.2.9')).toBeGreaterThan(0);
    expect(compareVersions('1.2.3-alpha.1', '1.2.3-alpha.2')).toBeLessThan(0);

    expect(shouldOfferUpdate('1.2.3', '1.3.0-beta.1')).toBe(false);
    expect(shouldOfferUpdate('1.2.3-beta.1', '1.2.3')).toBe(true);
  });

  it('uses a fresh cache entry and skips network calls', async () => {
    const cacheFilePath = await createTempCachePath('update-cache-fresh-');
    const nowValue = 1_000_000;

    await writeFile(
      cacheFilePath,
      JSON.stringify({
        checkedAt: nowValue - 1_000,
        latestVersion: '9.9.9',
      }),
      'utf8',
    );

    const fetchSpy = vi.fn(async () => {
      throw new Error('fetch should not be called for fresh cache');
    });

    const latestVersion = await resolveLatestVersion({
      packageName: 'llm-usage-metrics',
      cacheFilePath,
      cacheTtlMs: 5_000,
      fetchImpl: fetchSpy,
      now: () => nowValue,
    });

    expect(latestVersion).toBe('9.9.9');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(isCacheFresh({ checkedAt: nowValue - 1_000 }, 5_000, () => nowValue)).toBe(true);
  });

  it('falls back silently when cache is stale and network check fails', async () => {
    const cacheFilePath = await createTempCachePath('update-cache-stale-');
    const nowValue = 1_000_000;

    await writeFile(
      cacheFilePath,
      JSON.stringify({
        checkedAt: nowValue - 10_000,
        latestVersion: '9.9.9',
      }),
      'utf8',
    );

    const fetchSpy = vi.fn(async () => {
      throw new Error('timeout');
    });

    const latestVersion = await resolveLatestVersion({
      packageName: 'llm-usage-metrics',
      cacheFilePath,
      cacheTtlMs: 5_000,
      fetchImpl: fetchSpy,
      now: () => nowValue,
    });

    expect(latestVersion).toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('prompts in interactive mode and respects the no-install branch', async () => {
    const cacheFilePath = await createTempCachePath('update-prompt-no-');
    const confirmInstall = vi.fn(async () => false);
    const runCommand = vi.fn<CommandRunner>();

    const result = await checkForUpdatesAndMaybeRestart({
      packageName: 'llm-usage-metrics',
      currentVersion: '0.1.0',
      cacheFilePath,
      fetchImpl: vi.fn(async () => {
        return new Response(JSON.stringify({ version: '0.2.0' }), { status: 200 });
      }),
      stdinIsTTY: true,
      stdoutIsTTY: true,
      env: {},
      confirmInstall,
      runCommand,
    });

    expect(result).toEqual({ continueExecution: true });
    expect(confirmInstall).toHaveBeenCalledOnce();
    expect(runCommand).not.toHaveBeenCalled();
  });

  it('stops restart flow when install command fails', async () => {
    const cacheFilePath = await createTempCachePath('update-install-fail-');
    const confirmInstall = vi.fn(async () => true);
    const notify = vi.fn();
    const runCommand = vi.fn<CommandRunner>().mockResolvedValueOnce(1);

    const result = await checkForUpdatesAndMaybeRestart({
      packageName: 'llm-usage-metrics',
      currentVersion: '0.1.0',
      cacheFilePath,
      fetchImpl: vi.fn(async () => {
        return new Response(JSON.stringify({ version: '0.2.0' }), { status: 200 });
      }),
      stdinIsTTY: true,
      stdoutIsTTY: true,
      env: {},
      confirmInstall,
      runCommand,
      notify,
    });

    expect(result).toEqual({ continueExecution: true });
    expect(runCommand).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(
      expect.stringContaining('Failed to install llm-usage-metrics@latest'),
    );
  });

  it('restarts with original argv and skip-update env flag after successful install', async () => {
    const cacheFilePath = await createTempCachePath('update-restart-');
    const confirmInstall = vi.fn(async () => true);
    const commandCalls: Array<{
      command: string;
      args: string[];
      options?: { env?: NodeJS.ProcessEnv; stdio?: 'inherit' };
    }> = [];

    const runCommand: CommandRunner = async (command, args, commandOptions) => {
      commandCalls.push({
        command,
        args,
        options: commandOptions,
      });

      return commandCalls.length === 1 ? 0 : 23;
    };

    const result = await checkForUpdatesAndMaybeRestart({
      packageName: 'llm-usage-metrics',
      currentVersion: '0.1.0',
      cacheFilePath,
      fetchImpl: vi.fn(async () => {
        return new Response(JSON.stringify({ version: '0.2.0' }), { status: 200 });
      }),
      stdinIsTTY: true,
      stdoutIsTTY: true,
      env: { PATH: '/usr/bin' },
      argv: ['/usr/bin/node', '/app/dist/index.js', 'daily', '--json'],
      execPath: '/usr/bin/node',
      confirmInstall,
      runCommand,
    });

    expect(result).toEqual({ continueExecution: false, exitCode: 23 });

    expect(commandCalls).toHaveLength(2);

    const installCall = commandCalls[0];
    expect(installCall.command).toMatch(/npm(?:\.cmd)?$/u);
    expect(installCall.args).toEqual(['install', '-g', 'llm-usage-metrics@latest']);

    const restartCall = commandCalls[1];
    expect(restartCall.command).toBe('/usr/bin/node');
    expect(restartCall.args).toEqual(['/app/dist/index.js', 'daily', '--json']);
    expect(restartCall.options?.stdio).toBe('inherit');
    expect(restartCall.options?.env?.PATH).toBe('/usr/bin');
    expect(restartCall.options?.env?.LLM_USAGE_SKIP_UPDATE_CHECK).toBe('1');
  });

  it('does not prompt in non-interactive mode and only prints notice', async () => {
    const cacheFilePath = await createTempCachePath('update-non-interactive-');
    const confirmInstall = vi.fn(async () => true);
    const notify = vi.fn();
    let runCommandCalled = false;
    const runCommand: CommandRunner = async () => {
      runCommandCalled = true;
      return 0;
    };

    const result = await checkForUpdatesAndMaybeRestart({
      packageName: 'llm-usage-metrics',
      currentVersion: '0.1.0',
      cacheFilePath,
      fetchImpl: vi.fn(async () => {
        return new Response(JSON.stringify({ version: '0.2.0' }), { status: 200 });
      }),
      stdinIsTTY: false,
      stdoutIsTTY: false,
      env: {},
      confirmInstall,
      runCommand,
      notify,
    });

    expect(result).toEqual({ continueExecution: true });
    expect(confirmInstall).not.toHaveBeenCalled();
    expect(runCommandCalled).toBe(false);
    expect(notify).toHaveBeenCalledOnce();
  });
});
