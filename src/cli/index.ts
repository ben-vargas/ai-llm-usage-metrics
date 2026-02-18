#!/usr/bin/env node

import { createRequire } from 'node:module';

import { checkForUpdatesAndMaybeRestart } from '../update/update-notifier.js';
import { createCli } from './create-cli.js';

const require = createRequire(import.meta.url);
const packageJson = require('../../package.json') as { name?: string; version?: string };
const packageName = packageJson.name ?? 'llm-usage-metrics';
const packageVersion = packageJson.version ?? '0.0.0';

const cli = createCli();

try {
  const updateResult = await checkForUpdatesAndMaybeRestart({
    packageName,
    currentVersion: packageVersion,
  });

  if (!updateResult.continueExecution) {
    process.exitCode = updateResult.exitCode ?? 0;
  } else {
    await cli.parseAsync(process.argv);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}
