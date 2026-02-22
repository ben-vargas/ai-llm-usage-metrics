#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const distEntrypoint = join(rootDir, 'dist', 'index.js');
const outputPath = join(rootDir, 'site', 'src', 'content', 'docs', 'cli-reference.mdx');

function run(command, args, options = {}) {
  const output = execFileSync(command, args, {
    cwd: rootDir,
    encoding: 'utf8',
    ...options,
  });

  return typeof output === 'string' ? output.trimEnd() : '';
}

function ensureDistBuild(options = {}) {
  const forceRebuild = options.forceRebuild ?? false;

  if (!forceRebuild && existsSync(distEntrypoint)) {
    return;
  }

  console.log(forceRebuild ? 'Rebuilding CLI dist before docs generation...' : 'dist/index.js not found. Building CLI...');
  run('pnpm', ['run', 'build'], { stdio: 'inherit' });
}

function normalizeDescription(text) {
  return text
    .replace(/\(default:\s*"[^"]+"\)/g, '(default: local system timezone)')
    .replace(/\bmarkdown\b/giu, 'Markdown')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseOptions(helpText) {
  const lines = helpText.split(/\r?\n/);
  const options = [];

  const optionsStart = lines.findIndex((line) => line.trim() === 'Options:');
  if (optionsStart < 0) {
    return options;
  }

  let current = null;

  for (let index = optionsStart + 1; index < lines.length; index += 1) {
    const line = lines[index];

    if (!line.trim()) {
      continue;
    }

    if (/^\s*[A-Z][a-z]+:/.test(line)) {
      break;
    }

    const match = line.match(/^\s*(?:(-\w),\s*)?(--[\w-]+)(?:\s+([^\s].*?))?\s{2,}(.+)$/);

    if (match) {
      const [, short, long, argPartRaw, description] = match;
      const argPart = argPartRaw?.trim() ?? '';

      current = {
        short: short ?? '',
        long,
        arg: argPart.startsWith('--') ? '' : argPart,
        description: normalizeDescription(description),
      };
      options.push(current);
      continue;
    }

    if (current) {
      current.description = normalizeDescription(`${current.description} ${line.trim()}`);
    }
  }

  return options;
}

function deduplicateOptions(options) {
  const byLong = new Map();
  for (const option of options) {
    byLong.set(option.long, option);
  }
  return [...byLong.values()];
}

function sortOptions(options) {
  return [...options].sort((left, right) => {
    const leftTail = left.long === '--help' || left.long === '--version';
    const rightTail = right.long === '--help' || right.long === '--version';

    if (leftTail && !rightTail) {
      return 1;
    }
    if (!leftTail && rightTail) {
      return -1;
    }

    return left.long.localeCompare(right.long);
  });
}

function generateMarkdown(version, options) {
  const lines = [
    '---',
    'title: CLI Reference',
    'description: Command-line options and usage for llm-usage-metrics.',
    '---',
    '',
    ':::note[Auto-generated reference]',
    `Generated from CLI version \`${version}\` via \`scripts/generate-cli-reference.mjs\`.`,
    'For behavioral details and examples, see the other documentation pages.',
    ':::',
    '',
    '## Command structure',
    '',
    '```bash',
    'llm-usage <command> [options]',
    '```',
    '',
    'Commands:',
    '',
    '- `daily`',
    '- `weekly`',
    '- `monthly`',
    '',
    '## Shared options',
    '',
    '| Option | Short | Argument | Description |',
    '| --- | --- | --- | --- |',
  ];

  for (const option of options) {
    const short = option.short ? `\`${option.short}\`` : '-';
    const arg = option.arg ? `\`${option.arg.replace(/\|/g, '\\|')}\`` : '-';
    const desc = option.description.replace(/\|/g, '\\|');

    lines.push(`| \`${option.long}\` | ${short} | ${arg} | ${desc} |`);
  }

  lines.push(
    '',
    '## Examples',
    '',
    '```bash',
    'llm-usage daily',
    'llm-usage weekly --timezone Europe/Paris',
    'llm-usage monthly --since 2026-01-01 --until 2026-01-31',
    'llm-usage monthly --source opencode --opencode-db /path/to/opencode.db',
    'llm-usage daily --json',
    'llm-usage daily --markdown',
    '```',
  );

  return `${lines.join('\n')}\n`;
}

function main() {
  const forceRebuild = process.argv.includes('--rebuild');
  ensureDistBuild({ forceRebuild });

  const version = run('node', ['dist/index.js', '--version']);
  const rootHelp = run('node', ['dist/index.js', '--help']);
  const dailyHelp = run('node', ['dist/index.js', 'daily', '--help']);

  const options = sortOptions(
    deduplicateOptions([...parseOptions(rootHelp), ...parseOptions(dailyHelp)]),
  );
  const markdown = generateMarkdown(version, options);

  writeFileSync(outputPath, markdown, 'utf8');
  console.log(`CLI reference generated at ${outputPath}`);
}

main();
