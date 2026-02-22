import { describe, expect, it, vi } from 'vitest';

import {
  runInteractiveInstallAndRestart,
  type CommandRunner,
} from '../../src/update/update-install-runner.js';

describe('update-install-runner', () => {
  it('stops when the user declines install', async () => {
    const confirmInstall = vi.fn(async () => false);
    const runCommand = vi.fn<CommandRunner>();

    const result = await runInteractiveInstallAndRestart({
      packageName: 'llm-usage-metrics',
      updateMessage: 'Update available.',
      env: {},
      argv: ['/usr/bin/node', '/app/dist/index.js', 'daily'],
      skipUpdateCheckEnvVar: 'LLM_USAGE_SKIP_UPDATE_CHECK',
      confirmInstall,
      runCommand,
    });

    expect(result).toEqual({ continueExecution: true });
    expect(confirmInstall).toHaveBeenCalledWith('Update available. Install now? [y/N] ');
    expect(runCommand).not.toHaveBeenCalled();
  });

  it('installs latest and restarts with the skip-update env flag', async () => {
    const commandCalls: Array<{
      command: string;
      args: string[];
      options?: { env?: NodeJS.ProcessEnv; stdio?: 'inherit' };
    }> = [];

    const runCommand: CommandRunner = async (command, args, options) => {
      commandCalls.push({ command, args, options });
      return commandCalls.length === 1 ? 0 : 17;
    };

    const result = await runInteractiveInstallAndRestart({
      packageName: 'llm-usage-metrics',
      updateMessage: 'Update available.',
      env: { PATH: '/usr/bin' },
      argv: ['/usr/bin/node', '/app/dist/index.js', 'daily', '--json'],
      execPath: '/usr/bin/node',
      skipUpdateCheckEnvVar: 'LLM_USAGE_SKIP_UPDATE_CHECK',
      confirmInstall: vi.fn(async () => true),
      runCommand,
    });

    expect(result).toEqual({ continueExecution: false, exitCode: 17 });
    expect(commandCalls).toHaveLength(2);

    expect(commandCalls[0].command).toMatch(/npm(?:\\.cmd)?$/u);
    expect(commandCalls[0].args).toEqual(['install', '-g', 'llm-usage-metrics@latest']);
    expect(commandCalls[0].options?.stdio).toBe('inherit');

    expect(commandCalls[1].command).toBe('/usr/bin/node');
    expect(commandCalls[1].args).toEqual(['/app/dist/index.js', 'daily', '--json']);
    expect(commandCalls[1].options?.env?.PATH).toBe('/usr/bin');
    expect(commandCalls[1].options?.env?.LLM_USAGE_SKIP_UPDATE_CHECK).toBe('1');
  });
});
