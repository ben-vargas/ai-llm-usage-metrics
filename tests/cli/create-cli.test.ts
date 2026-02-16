import { describe, expect, it, vi } from 'vitest';

import { createCli } from '../../src/cli/create-cli.js';

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

  it('prints a not-implemented message for daily command', async () => {
    const cli = createCli();
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await cli.parseAsync(['daily'], { from: 'user' });

    expect(consoleSpy).toHaveBeenCalledWith('Daily usage report is not implemented yet.');
    consoleSpy.mockRestore();
  });

  it('renders help output', () => {
    const cli = createCli();

    expect(cli.helpInformation()).toContain('Show daily usage report');
  });
});
