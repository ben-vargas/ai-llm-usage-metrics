#!/usr/bin/env node

import { checkForUpdatesAndMaybeRestart } from '../update/update-notifier.js';
import { createCli } from './create-cli.js';
import { loadPackageMetadataFromRuntime } from './package-metadata.js';

const { packageName, packageVersion } = loadPackageMetadataFromRuntime();

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
