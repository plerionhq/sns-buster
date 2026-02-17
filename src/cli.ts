import { Command } from 'commander';

export interface CliOptions {
  topicArn: string;
  mode: 'read' | 'safe' | 'all';
  region?: string;
  verbose: boolean;
  outputDir: string;
  /** Deny topic ARN for compare mode */
  compare?: string;
  /** Allow topic ARN for compare mode (derived from topicArn or options) */
  allowTopicArn?: string;
  /** Request mutations mode enabled */
  requestMutations?: boolean;
  /** Session errors mode: role ARN to assume with deny-all policy */
  sessionErrorsRoleArn?: string;
  /** Session errors mode: topic ARNs to test */
  sessionErrorsTopics?: string[];
}

export function createCli(): Command {
  const program = new Command();

  program
    .name('sns-buster')
    .description('Security testing tool for Amazon SNS topics')
    .version('0.1.0')
    .argument('[topic-arn]', 'SNS topic ARN to test')
    .option('--read', 'Run only read actions (Get*, List*)')
    .option('--safe', 'Run non-destructive actions only')
    .option('--all', 'Run all topic-specific actions (default)')
    .option('--compare [topics...]', 'Compare mode: compare responses between topics [allow-arn] [deny-arn]')
    .option('--request-mutations [topics...]', 'Request mutations mode: test parameter mutations [allow-arn] [deny-arn]')
    .option('--session-errors [args...]', 'Session errors mode: detect public topics via deny-all session policy [role-arn] [topic-arns...]')
    .option('-r, --region <region>', 'Override AWS region (default: derived from ARN)')
    .option('-v, --verbose', 'Enable verbose output', false)
    .option('-o, --output <dir>', 'Output directory', 'output');

  return program;
}

export function parseOptions(program: Command): CliOptions {
  const opts = program.opts();
  const isCompareMode = opts.compare !== undefined;
  const isRequestMutationsMode = opts.requestMutations !== undefined;
  const isSessionErrorsMode = opts.sessionErrors !== undefined;

  // Parse compare topics: --compare [allow] [deny]
  let compareAllowArn: string | undefined;
  let compareDenyArn: string | undefined;

  if (isCompareMode) {
    const compareTopics = Array.isArray(opts.compare) ? opts.compare : [];
    compareAllowArn = compareTopics[0];
    compareDenyArn = compareTopics[1];
    if (!compareAllowArn || !compareDenyArn) {
      console.error('Error: --compare requires two topic ARNs: --compare <allow-arn> <deny-arn>');
      process.exit(1);
    }
  }

  // Parse request mutations topics: --request-mutations [allow] [deny]
  if (isRequestMutationsMode) {
    const mutationTopics = Array.isArray(opts.requestMutations) ? opts.requestMutations : [];
    compareAllowArn = mutationTopics[0];
    compareDenyArn = mutationTopics[1];
    if (!compareAllowArn || !compareDenyArn) {
      console.error('Error: --request-mutations requires two topic ARNs: --request-mutations <allow-arn> <deny-arn>');
      process.exit(1);
    }
  }

  // Parse session errors args: --session-errors [role-arn] [topic-arns...]
  let sessionErrorsRoleArn: string | undefined;
  let sessionErrorsTopics: string[] | undefined;

  if (isSessionErrorsMode) {
    const sessionErrorsArgs = Array.isArray(opts.sessionErrors) ? opts.sessionErrors : [];
    sessionErrorsRoleArn = sessionErrorsArgs[0];
    sessionErrorsTopics = sessionErrorsArgs.slice(1);
    if (!sessionErrorsRoleArn || sessionErrorsTopics.length === 0) {
      console.error('Error: --session-errors requires a role ARN and at least one topic ARN: --session-errors <role-arn> <topic-arn...>');
      process.exit(1);
    }
  }

  // Determine topic ARN for standard mode
  let topicArn = program.args[0];
  if (!topicArn && !isCompareMode && !isRequestMutationsMode && !isSessionErrorsMode) {
    console.error('Error: topic ARN is required. Usage: sns-buster <topic-arn>');
    process.exit(1);
  }

  // Determine mode (mutually exclusive flags)
  let mode: 'read' | 'safe' | 'all' = 'all';
  if (opts.read) {
    mode = 'read';
  } else if (opts.safe) {
    mode = 'safe';
  }

  return {
    topicArn: compareAllowArn || topicArn || '',
    mode,
    region: opts.region,
    verbose: opts.verbose || false,
    outputDir: opts.output || 'output',
    compare: compareDenyArn,
    allowTopicArn: compareAllowArn,
    requestMutations: isRequestMutationsMode,
    sessionErrorsRoleArn,
    sessionErrorsTopics,
  };
}
