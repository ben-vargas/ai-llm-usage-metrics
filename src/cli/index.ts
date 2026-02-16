#!/usr/bin/env node

import { createCli } from './create-cli.js';

const cli = createCli();

await cli.parseAsync(process.argv);
