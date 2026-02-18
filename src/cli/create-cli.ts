import { Command } from 'commander';

import { runUsageReport } from './run-usage-report.js';

export type UsageGranularity = 'daily' | 'weekly' | 'monthly';

type SharedOptions = {
  piDir?: string;
  codexDir?: string;
  source?: string[];
  since?: string;
  until?: string;
  timezone?: string;
  provider?: string;
  markdown?: boolean;
  json?: boolean;
  pricingUrl?: string;
  pricingOffline?: boolean;
};

const defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

function collectSourceOption(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function addSharedOptions(command: Command): Command {
  return command
    .option('--pi-dir <path>', 'Path to .pi sessions directory')
    .option('--codex-dir <path>', 'Path to .codex sessions directory')
    .option(
      '--source <name>',
      'Filter by source id (repeatable or comma-separated, allowed: pi,codex)',
      collectSourceOption,
      [],
    )
    .option('--since <YYYY-MM-DD>', 'Inclusive start date filter')
    .option('--until <YYYY-MM-DD>', 'Inclusive end date filter')
    .option('--timezone <iana>', 'Timezone for bucketing', defaultTimezone)
    .option('--provider <name>', 'Provider filter (defaults to openai behavior)')
    .option('--pricing-url <url>', 'Override LiteLLM pricing source URL')
    .option('--pricing-offline', 'Use cached LiteLLM pricing only (no network fetch)')
    .option('--markdown', 'Render output as markdown table')
    .option('--json', 'Render output as JSON');
}

function commandDescription(granularity: UsageGranularity): string {
  switch (granularity) {
    case 'daily':
      return 'Show daily usage report';
    case 'weekly':
      return 'Show weekly usage report (week starts Monday)';
    case 'monthly':
      return 'Show monthly usage report';
  }
}

function createCommand(granularity: UsageGranularity): Command {
  const command = new Command(granularity);

  addSharedOptions(command)
    .description(commandDescription(granularity))
    .action(async (options: SharedOptions) => {
      await runUsageReport(granularity, options);
    });

  return command;
}

function rootDescription(): string {
  return [
    'Aggregate local LLM usage metrics from pi and codex sessions',
    '',
    'Examples:',
    '  $ llm-usage daily',
    '  $ llm-usage weekly --timezone Europe/Paris',
    '  $ llm-usage monthly --since 2026-01-01 --until 2026-01-31 --source codex --json',
    '  $ npx --yes llm-usage-metrics daily',
  ].join('\n');
}

export function createCli(): Command {
  const program = new Command();

  program
    .name('llm-usage')
    .description(rootDescription())
    .showHelpAfterError()
    .addCommand(createCommand('daily'))
    .addCommand(createCommand('weekly'))
    .addCommand(createCommand('monthly'));

  return program;
}
