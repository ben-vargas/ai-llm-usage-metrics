#!/usr/bin/env node

import { createCli } from './create-cli.js';

const cli = createCli();

try {
  await cli.parseAsync(process.argv);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}
