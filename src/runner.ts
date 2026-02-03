import type { CliOptions } from './cli';
import type { Credentials } from './credentials/types';
import type { Action } from './actions/base';
import type { RequestResult } from './http/types';
import type { RunSummary } from './output/types';

import { loadCredentials } from './credentials';
import { verifyCredentials } from './credentials/verify';
import { getActionsByMode } from './actions';
import { getRegionFromArn, getEndpointForRegion } from './utils/arn';
import { DEFAULT_USER_AGENT } from './utils/constants';
import { buildUnsignedRequest, signRequest } from './http/signer';
import { sendRequest, formatRequestResult } from './http/client';
import {
  createEmptySummary,
  addActionResult,
  calculateSummaryTotals,
  parseErrorFromResponse,
  parseRequestIdFromResponse,
  isSuccessStatus,
  formatSummaryForTerminal,
} from './output/summary';
import {
  generateOutputDirName,
  createOutputDirectory,
  writeHttpLog,
  writeSummaryFile,
  writeReproduceScript,
} from './output/directory';

export interface RunnerResult {
  summary: RunSummary;
  outputPath: string;
}

export async function run(options: CliOptions): Promise<RunnerResult> {
  const { topicArn, mode, verbose, outputDir } = options;

  // Determine region
  const region = options.region || getRegionFromArn(topicArn);
  const endpoint = getEndpointForRegion(region);

  if (verbose) {
    console.log(`Target: ${topicArn}`);
    console.log(`Region: ${region}`);
    console.log(`Endpoint: ${endpoint}`);
    console.log(`Mode: ${mode}`);
  }

  // Load credentials
  let credentials = await loadCredentials();
  let hasCredentials = credentials !== null;

  if (verbose) {
    console.log(`Credentials: ${hasCredentials ? 'available' : 'not available'}`);
  }

  // Verify credentials if available
  if (credentials) {
    if (verbose) {
      process.stdout.write('Verifying credentials... ');
    }

    const verifyResult = await verifyCredentials(credentials, region);

    if (verifyResult.success && verifyResult.identity) {
      if (verbose) {
        console.log('OK');
        console.log(`  Account: ${verifyResult.identity.account}`);
        console.log(`  ARN: ${verifyResult.identity.arn}`);
        console.log(`  UserId: ${verifyResult.identity.userId}`);
      } else {
        console.log(`Credentials verified: ${verifyResult.identity.arn}`);
      }
    } else {
      console.error(`Credential verification failed: ${verifyResult.error}`);
      console.error('Continuing with unsigned requests only...');
      credentials = null;
      hasCredentials = false;
    }
  }

  if (verbose) {
    console.log('');
  }

  // Create output directory
  const outputDirName = generateOutputDirName(topicArn);
  const outputPath = await createOutputDirectory(outputDir, outputDirName);

  if (verbose) {
    console.log(`Output: ${outputPath}`);
    console.log('');
  }

  // Initialize summary
  const summary = createEmptySummary(topicArn, region, mode, hasCredentials);

  // Get actions for mode
  const actions = getActionsByMode(mode);

  if (verbose) {
    console.log(`Running ${actions.length} actions...`);
    console.log('');
  } else {
    // Print mode header and table header
    console.log('');
    console.log('Probe Mode');
    console.log('');
    const actionWidth = 28;
    const colWidth = 12;
    console.log(
      'Action'.padEnd(actionWidth) +
      'Unsigned'.padEnd(colWidth) +
      'Signed'
    );
    console.log('-'.repeat(actionWidth + colWidth * 2));
  }

  // Execute each action
  for (const action of actions) {
    await executeAction(action, {
      topicArn,
      region,
      endpoint,
      credentials,
      outputPath,
      summary,
      verbose,
    });
  }

  // Calculate totals
  calculateSummaryTotals(summary);

  // Write summary file
  await writeSummaryFile(outputPath, summary);

  // Print terminal summary
  console.log('');
  console.log(formatSummaryForTerminal(summary));
  console.log('');
  console.log(`Output: ${outputPath}`);

  return { summary, outputPath };
}

interface ExecuteContext {
  topicArn: string;
  region: string;
  endpoint: string;
  credentials: Credentials | null;
  outputPath: string;
  summary: RunSummary;
  verbose: boolean;
}

async function executeAction(action: Action, ctx: ExecuteContext): Promise<void> {
  const { topicArn, region, endpoint, credentials, outputPath, summary, verbose } = ctx;

  const params = action.buildParams(topicArn);

  // Build unsigned request
  const unsignedRequest = buildUnsignedRequest(endpoint, params, DEFAULT_USER_AGENT);

  // Send unsigned request
  if (verbose) {
    process.stdout.write(`${action.name.padEnd(30)} unsigned...`);
  }

  const unsignedResult = await sendRequest(unsignedRequest);
  const unsignedSuccess = isSuccessStatus(unsignedResult.response.status);
  const unsignedError = unsignedSuccess
    ? undefined
    : parseErrorFromResponse(unsignedResult.response.body);
  const unsignedRequestId = parseRequestIdFromResponse(unsignedResult.response.body);

  // Log unsigned result
  addActionResult(summary, action.name, false, {
    status: unsignedResult.response.status,
    success: unsignedSuccess,
    error: unsignedError,
    requestId: unsignedRequestId,
  });

  // Write unsigned HTTP log and reproduce script
  await writeHttpLog(
    outputPath,
    action.name,
    false,
    formatRequestResult(unsignedResult)
  );
  await writeReproduceScript(outputPath, `${action.name}-unsigned`, {
    endpoint,
    params,
    signed: false,
    region,
  });

  if (verbose) {
    process.stdout.write(` ${unsignedResult.response.status}`);
  }

  // If credentials available, send signed request
  if (credentials) {
    if (verbose) {
      process.stdout.write('  signed...');
    }

    const signedRequest = signRequest(unsignedRequest, {
      service: 'sns',
      region,
      credentials,
    });

    const signedResult = await sendRequest(signedRequest);
    const signedSuccess = isSuccessStatus(signedResult.response.status);
    const signedError = signedSuccess
      ? undefined
      : parseErrorFromResponse(signedResult.response.body);
    const signedRequestId = parseRequestIdFromResponse(signedResult.response.body);

    // Log signed result
    addActionResult(summary, action.name, true, {
      status: signedResult.response.status,
      success: signedSuccess,
      error: signedError,
      requestId: signedRequestId,
    });

    // Write signed HTTP log and reproduce script
    await writeHttpLog(
      outputPath,
      action.name,
      true,
      formatRequestResult(signedResult)
    );
    await writeReproduceScript(outputPath, `${action.name}-signed`, {
      endpoint,
      params,
      signed: true,
      region,
    });

    if (verbose) {
      process.stdout.write(` ${signedResult.response.status}`);
    }
  }

  if (verbose) {
    console.log('');
  } else {
    // Non-verbose: print table row
    const actionWidth = 28;
    const colWidth = 12;
    const unsignedStatus = String(unsignedResult.response.status);
    let signedStatus = 'N/A';

    if (credentials) {
      const signedResultData = summary.results[action.name]?.signed;
      if (signedResultData) {
        signedStatus = String(signedResultData.status);
      }
    }

    console.log(
      action.name.padEnd(actionWidth) +
      unsignedStatus.padEnd(colWidth) +
      signedStatus
    );
  }
}
