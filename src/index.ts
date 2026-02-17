#!/usr/bin/env bun

import { createCli, parseOptions } from './cli';
import { run } from './runner';
import { runMutations, runRequestMutations } from './mutations/runner';
import { runSessionErrors } from './safemode/runner';
import { ArnParseError } from './utils/arn';

async function main(): Promise<void> {
  const program = createCli();
  program.parse();

  const options = parseOptions(program);

  try {
    if (options.sessionErrorsRoleArn) {
      await runSessionErrors(options);
    } else if (options.requestMutations) {
      await runRequestMutations(options);
    } else if (options.compare) {
      await runMutations(options);
    } else {
      await run(options);
    }
  } catch (error) {
    if (error instanceof ArnParseError) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
    throw error;
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
