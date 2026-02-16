import { aggregateUsage } from '../aggregate/aggregate-usage.js';
import type { UsageEvent } from '../domain/usage-event.js';
import { applyPricingToEvents } from '../pricing/cost-engine.js';
import { createDefaultOpenAiPricingSource } from '../pricing/static-pricing-source.js';
import { renderMarkdownTable } from '../render/markdown-table.js';
import { renderTerminalTable } from '../render/terminal-table.js';
import { CodexSourceAdapter } from '../sources/codex/codex-source-adapter.js';
import { PiSourceAdapter } from '../sources/pi/pi-source-adapter.js';
import type { SourceAdapter } from '../sources/source-adapter.js';
import { getPeriodKey, type ReportGranularity } from '../utils/time-buckets.js';

export type ReportCommandOptions = {
  piDir?: string;
  codexDir?: string;
  since?: string;
  until?: string;
  timezone?: string;
  provider?: string;
  markdown?: boolean;
  json?: boolean;
};

function validateDateInput(value: string, flagName: '--since' | '--until'): void {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new Error(`${flagName} must use format YYYY-MM-DD`);
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${flagName} has an invalid calendar date`);
  }
}

function validateTimezone(timezone: string): void {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
  } catch {
    throw new Error(`Invalid timezone: ${timezone}`);
  }
}

function normalizeProviderFilter(provider: string | undefined): string | undefined {
  if (!provider) {
    return undefined;
  }

  const normalized = provider.trim().toLowerCase();
  return normalized || undefined;
}

function matchesProvider(
  provider: string | undefined,
  providerFilter: string | undefined,
): boolean {
  if (!providerFilter) {
    return true;
  }

  return provider?.toLowerCase().includes(providerFilter) ?? false;
}

async function parseAdapterEvents(adapter: SourceAdapter): Promise<UsageEvent[]> {
  const files = await adapter.discoverFiles();
  const parsedByFile = await Promise.all(files.map((filePath) => adapter.parseFile(filePath)));

  return parsedByFile.flat();
}

function filterEventsByDateRange(
  events: UsageEvent[],
  timezone: string,
  since: string | undefined,
  until: string | undefined,
): UsageEvent[] {
  return events.filter((event) => {
    const eventDate = getPeriodKey(event.timestamp, 'daily', timezone);

    if (since && eventDate < since) {
      return false;
    }

    if (until && eventDate > until) {
      return false;
    }

    return true;
  });
}

export async function buildUsageReport(
  granularity: ReportGranularity,
  options: ReportCommandOptions,
): Promise<string> {
  if (options.markdown && options.json) {
    throw new Error('Choose either --markdown or --json, not both');
  }

  if (options.since) {
    validateDateInput(options.since, '--since');
  }

  if (options.until) {
    validateDateInput(options.until, '--until');
  }

  if (options.since && options.until && options.since > options.until) {
    throw new Error('--since must be less than or equal to --until');
  }

  const timezone = options.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  validateTimezone(timezone);

  const providerFilter = normalizeProviderFilter(options.provider);

  const piAdapter = new PiSourceAdapter({
    sessionsDir: options.piDir,
    providerFilter: (provider) => matchesProvider(provider, providerFilter ?? 'openai'),
  });
  const codexAdapter = new CodexSourceAdapter({
    sessionsDir: options.codexDir,
  });

  const [piEvents, codexEvents] = await Promise.all([
    parseAdapterEvents(piAdapter),
    parseAdapterEvents(codexAdapter),
  ]);

  const providerFilteredEvents = [...piEvents, ...codexEvents].filter((event) =>
    matchesProvider(event.provider, providerFilter),
  );

  const dateFilteredEvents = filterEventsByDateRange(
    providerFilteredEvents,
    timezone,
    options.since,
    options.until,
  );

  const pricedEvents = applyPricingToEvents(dateFilteredEvents, createDefaultOpenAiPricingSource());
  const rows = aggregateUsage(pricedEvents, {
    granularity,
    timezone,
  });

  if (options.json) {
    return JSON.stringify(rows, null, 2);
  }

  if (options.markdown) {
    return renderMarkdownTable(rows);
  }

  return renderTerminalTable(rows);
}

export async function runUsageReport(
  granularity: ReportGranularity,
  options: ReportCommandOptions,
): Promise<void> {
  const output = await buildUsageReport(granularity, options);
  console.log(output);
}
