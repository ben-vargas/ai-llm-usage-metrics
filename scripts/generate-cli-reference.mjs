#!/usr/bin/env node
/**
 * CLI Reference Generator
 * Generates site/src/content/docs/cli-reference.mdx from CLI --help output
 */

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

/**
 * Run a command and capture stdout
 */
function runCommand(cmd) {
  try {
    return execSync(cmd, {
      cwd: rootDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    console.error(`Command failed: ${cmd}`);
    console.error(error.stderr || error.message);
    return null;
  }
}

/**
 * Parse help output into structured options
 */
function parseHelpOutput(helpText) {
  const lines = helpText.split('\n');
  const options = [];
  let inOptions = false;

  for (const line of lines) {
    // Detect options section
    if (line.includes('Options:')) {
      inOptions = true;
      continue;
    }

    if (!inOptions) continue;

    // Stop at next section (Commands:, or empty line after options)
    if (line.match(/^\s*[A-Z][a-z]+:/) && !line.includes('Options:')) {
      break;
    }

    // Parse option line
    // Match patterns like:
    //   -V, --version          output the version number
    //   -f, --format <type>    output format (default: "terminal")
    //   --source <sources>     filter by source (choices: "pi", "codex",
    const match = line.match(
      /^(\s+)(-\w,?\s*)?(--[\w-]+)((?:\s+[<"][^>"]+[>"])*)?(\s+\[[^\]]+\])?\s+(.+)$/,
    );

    if (match) {
      const indent = match[1].length;
      const short = match[2]?.replace(/,\s*$/, '').trim() || '';
      const long = match[3].trim();
      const args = match[4]?.trim() || '';
      const def = match[5]?.trim() || '';
      let desc = match[6].trim();

      // Check if next line is a continuation (more indented)
      const lineIndex = lines.indexOf(line);
      for (let i = lineIndex + 1; i < lines.length; i++) {
        const nextLine = lines[i];
        if (nextLine.match(/^\s+$/)) continue;
        const nextIndent = nextLine.match(/^(\s*)/)?.[1].length || 0;
        if (nextIndent > indent) {
          desc += ' ' + nextLine.trim();
        } else {
          break;
        }
      }

      options.push({
        short,
        long,
        args,
        default: def.replace(/[\[\]]/g, ''),
        description: desc,
      });
    }
  }

  return options;
}

/**
 * Generate CLI reference markdown
 */
function generateCliReference() {
  // Get version
  const version = runCommand('node dist/index.js --version') || 'unknown';

  // Get main help
  const mainHelp = runCommand('node dist/index.js --help') || '';
  const mainOptions = parseHelpOutput(mainHelp);

  // Get subcommand helps
  const dailyHelp = runCommand('node dist/index.js daily --help') || '';
  const dailyOptions = parseHelpOutput(dailyHelp);

  const weeklyHelp = runCommand('node dist/index.js weekly --help') || '';
  const weeklyOptions = parseHelpOutput(weeklyHelp);

  const monthlyHelp = runCommand('node dist/index.js monthly --help') || '';
  const monthlyOptions = parseHelpOutput(monthlyHelp);

  // Merge all options (subcommands have the same options)
  const allOptions = [...mainOptions, ...dailyOptions];

  // Deduplicate by long option name
  const seen = new Set();
  const uniqueOptions = allOptions.filter((opt) => {
    if (seen.has(opt.long)) return false;
    seen.add(opt.long);
    return true;
  });

  // Build the markdown content
  const lines = [
    '---',
    'title: CLI Reference',
    'description: Complete reference for llm-usage-metrics command-line options and usage patterns.',
    '---',
    '',
    '# CLI Reference',
    '',
    ':::caution[Auto-generated]',
    `This reference was automatically generated from CLI version \`${version}\`.`,
    'For the most up-to-date information, run `llm-usage --help` in your terminal.',
    ':::',
    '',
    '## Global Options',
    '',
    '| Option | Short | Description | Default |',
    '|--------|-------|-------------|---------|',
  ];

  // Sort options: help/version last, then alphabetically
  const sortedOptions = uniqueOptions.sort((a, b) => {
    if (a.long === '--help' || a.long === '--version') return 1;
    if (b.long === '--help' || b.long === '--version') return -1;
    return a.long.localeCompare(b.long);
  });

  // Add options table
  for (const opt of sortedOptions) {
    const short = opt.short ? `\`${opt.short}\`` : '';
    const args = opt.args ? ` \`${opt.args.replace(/[<>"]/g, '').split(/\s+/).join(', ')}\`` : '';
    const def = opt.default ? ` \`${opt.default}\`` : '-';
    // Escape pipe characters in description
    const desc = (opt.description + args).replace(/\|/g, '\\|');
    lines.push(`| \`${opt.long}\` | ${short} | ${desc} | ${def} |`);
  }

  lines.push(
    '',
    '## Commands',
    '',
    '### Default (aggregate and display)',
    '',
    'Run without arguments to aggregate usage data and display formatted metrics for the current day.',
    '',
    '```bash',
    'llm-usage',
    '```',
    '',
    '### Temporal Periods',
    '',
    '#### Daily Report',
    '',
    '```bash',
    'llm-usage daily',
    '```',
    '',
    '#### Weekly Report',
    '',
    '```bash',
    'llm-usage weekly',
    'llm-usage weekly --timezone Europe/Paris',
    '```',
    '',
    '#### Monthly Report',
    '',
    '```bash',
    'llm-usage monthly',
    'llm-usage monthly --since 2026-01-01 --until 2026-01-31',
    '```',
    '',
    '## Filtering',
    '',
    '### By Source',
    '',
    'Isolate telemetry to specific coding agents:',
    '',
    '```bash',
    'llm-usage daily --source pi',
    'llm-usage daily --source pi,codex',
    '```',
    '',
    '### By Model',
    '',
    'Filter by model family or name:',
    '',
    '```bash',
    'llm-usage monthly --model claude',
    'llm-usage monthly --model gpt-4',
    '```',
    '',
    '### By Provider',
    '',
    'Filter by upstream LLM provider:',
    '',
    '```bash',
    'llm-usage monthly --provider openai',
    'llm-usage monthly --provider anthropic',
    '```',
    '',
    '## Output Formats',
    '',
    '### Terminal (Default)',
    '',
    'Rich formatted tables with ANSI colors, optimized for terminal display:',
    '',
    '```bash',
    'llm-usage daily',
    '```',
    '',
    '### JSON',
    '',
    'Machine-readable JSON for piping to other tools:',
    '',
    '```bash',
    'llm-usage daily --json',
    "llm-usage weekly --json | jq '.totalCost'",
    '```',
    '',
    '### Markdown',
    '',
    'Formatted markdown tables suitable for documentation:',
    '',
    '```bash',
    'llm-usage monthly --markdown > usage-report.md',
    '```',
    '',
    '## Environment Variables',
    '',
    '| Variable | Description |',
    '|----------|-------------|',
    '| `LLM_USAGE_DATA_DIR` | Override default data directory path |',
    '| `TZ` | Timezone for date calculations |',
    '| `LLM_USAGE_SKIP_UPDATE_CHECK` | Skip startup update check |',
    '| `LLM_USAGE_PARSE_MAX_PARALLEL` | Max concurrent file parses (1-64) |',
    '',
    '## Exit Codes',
    '',
    '| Code | Meaning |',
    '|------|---------|',
    '| `0` | Success |',
    '| `1` | General error |',
    '| `2` | Invalid arguments |',
    '| `3` | No data found |',
    '',
  );

  return lines.join('\n');
}

/**
 * Main function
 */
function main() {
  console.log('Generating CLI reference...');

  // Ensure dist exists
  const distExists = runCommand('test -d dist && echo "yes"');
  if (!distExists) {
    console.log('Building CLI first...');
    const buildResult = runCommand('pnpm run build');
    if (!buildResult) {
      console.error('Build failed');
      process.exit(1);
    }
  }

  const content = generateCliReference();
  const outputPath = join(rootDir, 'site/src/content/docs/cli-reference.mdx');

  writeFileSync(outputPath, content, 'utf-8');
  console.log(`CLI reference written to: ${outputPath}`);
}

main();
