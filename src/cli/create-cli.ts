import { Command } from 'commander';

export type UsageGranularity = 'daily' | 'weekly' | 'monthly';

type SharedOptions = {
  piDir?: string;
  codexDir?: string;
  since?: string;
  until?: string;
  timezone?: string;
  provider?: string;
  markdown?: boolean;
  json?: boolean;
};

const defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

function addSharedOptions(command: Command): Command {
  return command
    .option('--pi-dir <path>', 'Path to .pi sessions directory')
    .option('--codex-dir <path>', 'Path to .codex sessions directory')
    .option('--since <YYYY-MM-DD>', 'Inclusive start date filter')
    .option('--until <YYYY-MM-DD>', 'Inclusive end date filter')
    .option('--timezone <iana>', 'Timezone for bucketing', defaultTimezone)
    .option('--provider <name>', 'Provider filter (defaults to openai behavior)')
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

function notImplementedMessage(granularity: UsageGranularity): string {
  return `${granularity[0].toUpperCase()}${granularity.slice(1)} usage report is not implemented yet.`;
}

function createCommand(granularity: UsageGranularity): Command {
  const command = new Command(granularity);

  addSharedOptions(command)
    .description(commandDescription(granularity))
    .action((options: SharedOptions) => {
      void options;
      console.log(notImplementedMessage(granularity));
    });

  return command;
}

export function createCli(): Command {
  const program = new Command();

  program
    .name('usage')
    .description('Aggregate local LLM usage metrics from pi and codex sessions')
    .showHelpAfterError()
    .addCommand(createCommand('daily'))
    .addCommand(createCommand('weekly'))
    .addCommand(createCommand('monthly'));

  return program;
}
