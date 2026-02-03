import type { CliOptions } from '../cli';
import type { Credentials } from '../credentials/types';
import type { Action } from '../actions/base';
import type { RequestResult } from '../http/types';

import { loadCredentials } from '../credentials';
import { verifyCredentials } from '../credentials/verify';
import { getActionsByMode } from '../actions';
import { getRegionFromArn, getEndpointForRegion, parseArn } from '../utils/arn';
import { DEFAULT_USER_AGENT } from '../utils/constants';
import { buildUnsignedRequest, signRequest } from '../http/signer';
import { sendRequest, formatRequestResult } from '../http/client';
import { parseErrorDetails, parseErrorFromResponse, isSuccessStatus } from '../output/summary';
import {
  generateOutputDirName,
  createOutputDirectory,
  writeMutationsHttpLog,
  writeReproduceScript,
} from '../output/directory';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import {
  compareResponses,
  createMutationsSummary,
  formatMutationsResult,
  isUsefulMutation,
  type MutationsResult,
  type MutationComparison,
  type ActionResult,
  type RequestMutationsResult,
  type ActionMutationResult,
  type MutationTestResult,
  type TopicResult,
} from './compare';
import { getMutationsForAction, didMutationChangeParams, type Mutation } from './strategies';
import { randomUUID } from 'crypto';

/**
 * Generate a non-existent topic ARN by replacing the topic name with a GUID.
 * This topic will definitely not exist, allowing us to test if validation
 * runs before the existence/authorization check.
 */
function generateNonexistentTopicArn(allowedTopicArn: string): string {
  const parsed = parseArn(allowedTopicArn);
  const guid = randomUUID();
  return `arn:${parsed.partition}:sns:${parsed.region}:${parsed.accountId}:nonexistent-${guid}`;
}

export async function runMutations(options: CliOptions): Promise<MutationsResult> {
  const { topicArn: allowedTopicArn, compare: deniedTopicArn, mode, verbose, outputDir } = options;

  if (!deniedTopicArn) {
    throw new Error('Compare mode requires --compare <deny-topic-arn>');
  }

  // Determine regions and endpoints
  const allowedRegion = options.region || getRegionFromArn(allowedTopicArn);
  const deniedRegion = getRegionFromArn(deniedTopicArn);
  const allowedEndpoint = getEndpointForRegion(allowedRegion);
  const deniedEndpoint = getEndpointForRegion(deniedRegion);

  // Load and verify credentials (required for compare mode)
  const credentials = await loadCredentials();
  if (!credentials) {
    throw new Error('Compare mode requires AWS credentials');
  }

  if (verbose) {
    process.stdout.write('Verifying credentials... ');
  }

  const verifyResult = await verifyCredentials(credentials, allowedRegion);
  if (!verifyResult.success || !verifyResult.identity) {
    const errorMsg = verifyResult.error || 'Unknown error';
    if (errorMsg.includes('expired')) {
      throw new Error(`AWS credentials have expired. Please refresh your credentials and try again.`);
    }
    throw new Error(`Credential verification failed: ${errorMsg}`);
  }

  if (verbose) {
    console.log('OK');
    console.log(`  Account: ${verifyResult.identity.account}`);
    console.log(`  ARN: ${verifyResult.identity.arn}`);
    console.log('');
    console.log('Compare Mode');
    console.log('');
    console.log(`Allowed topic: ${allowedTopicArn}`);
    console.log(`  Region: ${allowedRegion}`);
    console.log(`  Endpoint: ${allowedEndpoint}`);
    console.log('');
    console.log(`Denied topic: ${deniedTopicArn}`);
    console.log(`  Region: ${deniedRegion}`);
    console.log(`  Endpoint: ${deniedEndpoint}`);
    console.log('');
    console.log(`Mode: ${mode}`);
  } else {
    console.log(`Credentials verified: ${verifyResult.identity.arn}`);
    console.log('');
    console.log('Compare Mode');
    console.log('');
    console.log(`Allowed topic: ${allowedTopicArn}`);
    console.log(`Denied topic:  ${deniedTopicArn}`);
    console.log('');
  }

  // Create output directory
  const timestamp = new Date().toISOString();
  const outputDirName = `${generateOutputDirName(allowedTopicArn)}-compare`;
  const outputPath = await createOutputDirectory(outputDir, outputDirName);

  if (verbose) {
    console.log(`Output: ${outputPath}`);
    console.log('');
  }

  // Get actions for mode
  const actions = getActionsByMode(mode);

  if (verbose) {
    console.log(`Running ${actions.length} actions against both topics...`);
    console.log('');
  }

  // Execute each action against both topics
  const comparisons: MutationComparison[] = [];

  for (const action of actions) {
    const comparison = await executeComparison(action, {
      allowedTopicArn,
      deniedTopicArn,
      allowedRegion,
      deniedRegion,
      allowedEndpoint,
      deniedEndpoint,
      credentials,
      outputPath,
      verbose,
    });
    comparisons.push(comparison);
  }

  // Build result
  const result: MutationsResult = {
    allowedTopicArn,
    deniedTopicArn,
    timestamp,
    mode,
    comparisons,
    summary: createMutationsSummary(comparisons),
    outputPath,
  };

  // Write summary file
  const summaryPath = join(outputPath, 'summary.json');
  await writeFile(summaryPath, JSON.stringify(result, null, 2), 'utf-8');

  // Print results
  console.log('');
  console.log(formatMutationsResult(result));
  console.log('');
  console.log(`Output: ${outputPath}`);

  return result;
}

interface CompareContext {
  allowedTopicArn: string;
  deniedTopicArn: string;
  allowedRegion: string;
  deniedRegion: string;
  allowedEndpoint: string;
  deniedEndpoint: string;
  credentials: Credentials;
  outputPath: string;
  verbose: boolean;
}

async function executeComparison(
  action: Action,
  ctx: CompareContext
): Promise<MutationComparison> {
  const {
    allowedTopicArn,
    deniedTopicArn,
    allowedRegion,
    deniedRegion,
    allowedEndpoint,
    deniedEndpoint,
    credentials,
    outputPath,
    verbose,
  } = ctx;

  // Build and send request for allowed topic
  const allowedParams = action.buildParams(allowedTopicArn);
  const allowedUnsigned = buildUnsignedRequest(allowedEndpoint, allowedParams, DEFAULT_USER_AGENT);
  const allowedSigned = signRequest(allowedUnsigned, {
    service: 'sns',
    region: allowedRegion,
    credentials,
  });
  const allowedResponse = await sendRequest(allowedSigned);

  const allowedResult: ActionResult = {
    status: allowedResponse.response.status,
    success: isSuccessStatus(allowedResponse.response.status),
    error: isSuccessStatus(allowedResponse.response.status)
      ? undefined
      : parseErrorFromResponse(allowedResponse.response.body),
  };

  // Write allowed HTTP log and reproduce script
  await writeMutationsHttpLog(
    outputPath,
    action.name,
    'allowed',
    formatRequestResult(allowedResponse)
  );
  await writeReproduceScript(outputPath, `${action.name}-allowed`, {
    endpoint: allowedEndpoint,
    params: allowedParams,
    signed: true,
    region: allowedRegion,
  });

  // Build and send request for denied topic
  const deniedParams = action.buildParams(deniedTopicArn);
  const deniedUnsigned = buildUnsignedRequest(deniedEndpoint, deniedParams, DEFAULT_USER_AGENT);
  const deniedSigned = signRequest(deniedUnsigned, {
    service: 'sns',
    region: deniedRegion,
    credentials,
  });
  const deniedResponse = await sendRequest(deniedSigned);

  const deniedResult: ActionResult = {
    status: deniedResponse.response.status,
    success: isSuccessStatus(deniedResponse.response.status),
    error: isSuccessStatus(deniedResponse.response.status)
      ? undefined
      : parseErrorFromResponse(deniedResponse.response.body),
  };

  // Write denied HTTP log and reproduce script
  await writeMutationsHttpLog(
    outputPath,
    action.name,
    'denied',
    formatRequestResult(deniedResponse)
  );
  await writeReproduceScript(outputPath, `${action.name}-denied`, {
    endpoint: deniedEndpoint,
    params: deniedParams,
    signed: true,
    region: deniedRegion,
  });

  // Compare responses
  const comparison = compareResponses(allowedResult, deniedResult);

  if (verbose) {
    const matchIndicator = comparison.match ? 'MATCH' : 'DIFF';
    console.log(
      `${action.name.padEnd(30)} allowed:${allowedResult.status} denied:${deniedResult.status} [${matchIndicator}]`
    );
  }

  return {
    action: action.name,
    ...comparison,
  };
}

// --- Request Mutations Runner ---

export async function runRequestMutations(options: CliOptions): Promise<RequestMutationsResult> {
  const { topicArn: allowedTopicArn, compare: deniedTopicArn, mode, verbose, outputDir } = options;

  if (!deniedTopicArn) {
    throw new Error('Request mutations mode requires --compare <deny-topic-arn>');
  }

  // Generate non-existent topic ARN (same account/region, random GUID name)
  const nonexistentTopicArn = generateNonexistentTopicArn(allowedTopicArn);

  // Determine regions and endpoints (all same region for consistency)
  const allowedRegion = options.region || getRegionFromArn(allowedTopicArn);
  const deniedRegion = getRegionFromArn(deniedTopicArn);
  const nonexistentRegion = allowedRegion; // Same region as allowed
  const allowedEndpoint = getEndpointForRegion(allowedRegion);
  const deniedEndpoint = getEndpointForRegion(deniedRegion);
  const nonexistentEndpoint = getEndpointForRegion(nonexistentRegion);

  // Load and verify credentials
  const credentials = await loadCredentials();
  if (!credentials) {
    throw new Error('Request mutations mode requires AWS credentials');
  }

  const verifyResult = await verifyCredentials(credentials, allowedRegion);
  if (!verifyResult.success || !verifyResult.identity) {
    const errorMsg = verifyResult.error || 'Unknown error';
    if (errorMsg.includes('expired')) {
      throw new Error(`AWS credentials have expired. Please refresh your credentials and try again.`);
    }
    throw new Error(`Credential verification failed: ${errorMsg}`);
  }
  console.log(`Credentials verified: ${verifyResult.identity.arn}`);
  console.log('');
  console.log('Request Mutations Mode (3-topic validation)');
  console.log('');
  console.log(`Allowed topic:     ${allowedTopicArn}`);
  console.log(`Denied topic:      ${deniedTopicArn}`);
  console.log(`Non-existent topic: ${nonexistentTopicArn}`);
  console.log('');

  // Create output directory
  const timestamp = new Date().toISOString();
  const outputDirName = `${generateOutputDirName(allowedTopicArn)}-request-mutations`;
  const outputPath = await createOutputDirectory(outputDir, outputDirName);

  // Get actions for mode
  const actions = getActionsByMode(mode);
  console.log(`Testing ${actions.length} actions with request mutations...`);
  console.log('');

  const actionResults: ActionMutationResult[] = [];
  let totalMutationsTested = 0;
  let usefulMutationsFound = 0;

  for (const action of actions) {
    const result = await testActionMutations(action, {
      allowedTopicArn,
      deniedTopicArn,
      nonexistentTopicArn,
      allowedRegion,
      deniedRegion,
      nonexistentRegion,
      allowedEndpoint,
      deniedEndpoint,
      nonexistentEndpoint,
      credentials,
      outputPath,
      verbose,
    });

    actionResults.push(result);
    totalMutationsTested += result.mutations.length;
    usefulMutationsFound += result.usefulMutations.length;

    // Print progress
    const usefulStr = result.usefulMutations.length > 0
      ? ` [${result.usefulMutations.length} useful]`
      : '';
    console.log(
      `${action.name.padEnd(28)} baseline: ${result.baseline.allowed.status}/${result.baseline.denied.status}/${result.baseline.nonexistent.status}  ` +
      `mutations: ${result.mutations.length}${usefulStr}`
    );
  }

  // Build result
  const result: RequestMutationsResult = {
    allowedTopicArn,
    deniedTopicArn,
    nonexistentTopicArn,
    timestamp,
    mode,
    actions: actionResults,
    summary: {
      totalActions: actions.length,
      totalMutationsTested,
      usefulMutationsFound,
    },
    outputPath,
  };

  // Write summary file
  const summaryPath = join(outputPath, 'summary.json');
  await writeFile(summaryPath, JSON.stringify(result, null, 2), 'utf-8');

  // Print summary
  console.log('');
  console.log('='.repeat(60));
  console.log('Summary:');
  console.log(`  Actions tested: ${actions.length}`);
  console.log(`  Total mutations tested: ${totalMutationsTested}`);
  console.log(`  Useful mutations found: ${usefulMutationsFound}`);

  if (usefulMutationsFound > 0) {
    console.log('');
    console.log('Useful mutations (validation runs before auth):');
    for (const actionResult of actionResults) {
      for (const mut of actionResult.usefulMutations) {
        console.log(`  ${actionResult.action} + ${mut.mutationName}:`);
        console.log(`    allowed=${mut.allowed.status} denied=${mut.denied.status} nonexistent=${mut.nonexistent.status}`);
        console.log(`    ${mut.reason}`);
      }
    }
  }

  console.log('');
  console.log(`Output: ${outputPath}`);

  return result;
}

interface MutationTestContext {
  allowedTopicArn: string;
  deniedTopicArn: string;
  nonexistentTopicArn: string;
  allowedRegion: string;
  deniedRegion: string;
  nonexistentRegion: string;
  allowedEndpoint: string;
  deniedEndpoint: string;
  nonexistentEndpoint: string;
  credentials: Credentials;
  outputPath: string;
  verbose: boolean;
}

async function testActionMutations(
  action: Action,
  ctx: MutationTestContext
): Promise<ActionMutationResult> {
  const {
    allowedTopicArn,
    deniedTopicArn,
    nonexistentTopicArn,
    allowedRegion,
    deniedRegion,
    nonexistentRegion,
    allowedEndpoint,
    deniedEndpoint,
    nonexistentEndpoint,
    credentials,
    outputPath,
    verbose,
  } = ctx;

  // Get baseline params for all 3 topics
  const baselineAllowedParams = action.buildParams(allowedTopicArn);
  const baselineDeniedParams = action.buildParams(deniedTopicArn);
  const baselineNonexistentParams = action.buildParams(nonexistentTopicArn);

  // Test baseline on all 3 topics
  const baselineAllowed = await sendSignedRequest(
    allowedEndpoint,
    baselineAllowedParams,
    allowedRegion,
    credentials
  );
  const baselineDenied = await sendSignedRequest(
    deniedEndpoint,
    baselineDeniedParams,
    deniedRegion,
    credentials
  );
  const baselineNonexistent = await sendSignedRequest(
    nonexistentEndpoint,
    baselineNonexistentParams,
    nonexistentRegion,
    credentials
  );

  // Write baseline logs and reproduce scripts
  await writeMutationsHttpLog(outputPath, `${action.name}-baseline`, 'allowed', formatRequestResult(baselineAllowed));
  await writeMutationsHttpLog(outputPath, `${action.name}-baseline`, 'denied', formatRequestResult(baselineDenied));
  await writeMutationsHttpLog(outputPath, `${action.name}-baseline`, 'nonexistent', formatRequestResult(baselineNonexistent));
  await writeReproduceScript(outputPath, `${action.name}-baseline-allowed`, { endpoint: allowedEndpoint, params: baselineAllowedParams, signed: true, region: allowedRegion });
  await writeReproduceScript(outputPath, `${action.name}-baseline-denied`, { endpoint: deniedEndpoint, params: baselineDeniedParams, signed: true, region: deniedRegion });
  await writeReproduceScript(outputPath, `${action.name}-baseline-nonexistent`, { endpoint: nonexistentEndpoint, params: baselineNonexistentParams, signed: true, region: nonexistentRegion });

  const baseline = {
    allowed: buildTopicResult(baselineAllowed),
    denied: buildTopicResult(baselineDenied),
    nonexistent: buildTopicResult(baselineNonexistent),
  };

  // Get mutations for this action
  const mutations = getMutationsForAction(action.name);
  const mutationResults: MutationTestResult[] = [];
  const usefulMutations: MutationTestResult[] = [];

  for (const mutation of mutations) {
    // Apply mutation to all 3 topic params
    const mutatedAllowedParams = mutation.apply(baselineAllowedParams, allowedTopicArn);
    const mutatedDeniedParams = mutation.apply(baselineDeniedParams, deniedTopicArn);
    const mutatedNonexistentParams = mutation.apply(baselineNonexistentParams, nonexistentTopicArn);

    // Skip if mutation didn't change params (parameter not present in this action)
    if (!didMutationChangeParams(baselineAllowedParams, mutatedAllowedParams)) {
      continue;
    }

    // Send mutated requests to all 3 topics
    const mutatedAllowed = await sendSignedRequest(
      allowedEndpoint,
      mutatedAllowedParams,
      allowedRegion,
      credentials
    );
    const mutatedDenied = await sendSignedRequest(
      deniedEndpoint,
      mutatedDeniedParams,
      deniedRegion,
      credentials
    );
    const mutatedNonexistent = await sendSignedRequest(
      nonexistentEndpoint,
      mutatedNonexistentParams,
      nonexistentRegion,
      credentials
    );

    // Write mutation logs and reproduce scripts for all 3 topics
    await writeMutationsHttpLog(
      outputPath,
      `${action.name}-${mutation.name}`,
      'allowed',
      formatRequestResult(mutatedAllowed)
    );
    await writeMutationsHttpLog(
      outputPath,
      `${action.name}-${mutation.name}`,
      'denied',
      formatRequestResult(mutatedDenied)
    );
    await writeMutationsHttpLog(
      outputPath,
      `${action.name}-${mutation.name}`,
      'nonexistent',
      formatRequestResult(mutatedNonexistent)
    );
    await writeReproduceScript(outputPath, `${action.name}-${mutation.name}-allowed`, { endpoint: allowedEndpoint, params: mutatedAllowedParams, signed: true, region: allowedRegion });
    await writeReproduceScript(outputPath, `${action.name}-${mutation.name}-denied`, { endpoint: deniedEndpoint, params: mutatedDeniedParams, signed: true, region: deniedRegion });
    await writeReproduceScript(outputPath, `${action.name}-${mutation.name}-nonexistent`, { endpoint: nonexistentEndpoint, params: mutatedNonexistentParams, signed: true, region: nonexistentRegion });

    const mutationTopics = {
      allowed: buildTopicResult(mutatedAllowed),
      denied: buildTopicResult(mutatedDenied),
      nonexistent: buildTopicResult(mutatedNonexistent),
    };

    const usefulResult = isUsefulMutation(mutationTopics, mutation.name, action.name);

    const mutationResult: MutationTestResult = {
      mutationName: mutation.name,
      mutationDescription: mutation.description,
      allowed: mutationTopics.allowed,
      denied: mutationTopics.denied,
      nonexistent: mutationTopics.nonexistent,
      useful: usefulResult.useful,
      reason: usefulResult.reason,
    };

    mutationResults.push(mutationResult);
    if (mutationResult.useful) {
      usefulMutations.push(mutationResult);
    }

    if (verbose) {
      const indicator = mutationResult.useful ? '✓' : ' ';
      console.log(
        `  ${indicator} ${mutation.name.padEnd(20)} a:${mutationTopics.allowed.status} d:${mutationTopics.denied.status} n:${mutationTopics.nonexistent.status}`
      );
    }
  }

  return {
    action: action.name,
    baseline,
    mutations: mutationResults,
    usefulMutations,
  };
}

/**
 * Build a TopicResult from a RequestResult
 */
function buildTopicResult(response: RequestResult): TopicResult {
  const status = response.response.status;
  const isSuccess = isSuccessStatus(status);
  const errorDetails = isSuccess ? undefined : parseErrorDetails(response.response.body);

  return {
    status,
    error: errorDetails?.code,
    errorDetails,
  };
}

async function sendSignedRequest(
  endpoint: string,
  params: Record<string, string>,
  region: string,
  credentials: Credentials
): Promise<RequestResult> {
  const unsigned = buildUnsignedRequest(endpoint, params, DEFAULT_USER_AGENT);
  const signed = signRequest(unsigned, {
    service: 'sns',
    region,
    credentials,
  });
  return sendRequest(signed);
}
