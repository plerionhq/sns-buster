import type { CliOptions } from '../cli';
import type { Credentials } from '../credentials/types';
import type { Action } from '../actions/base';

import { loadCredentials } from '../credentials';
import { verifyCredentials } from '../credentials/verify';
import { assumeRoleWithPolicy, DENY_ALL_POLICY } from '../credentials/assume';
import { getActionsByMode } from '../actions';
import { getRegionFromArn, getEndpointForRegion, parseArn } from '../utils/arn';
import { DEFAULT_USER_AGENT } from '../utils/constants';
import { buildUnsignedRequest, signRequest } from '../http/signer';
import { sendRequest, formatRequestResult } from '../http/client';
import { parseErrorDetails, isSuccessStatus } from '../output/summary';
import {
  generateOutputDirName,
  createOutputDirectory,
  writeMutationsHttpLog,
} from '../output/directory';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import {
  classifyFromErrorMessage,
  getClassificationLabel,
  type PolicyClassification,
} from './classifier';

export interface SafeModeResult {
  roleArn: string;
  assumedRoleArn: string;
  topicArns: string[];
  timestamp: string;
  mode: 'read' | 'safe' | 'all';
  results: TopicSafeModeResult[];
  summary: SafeModeSummary;
  outputPath: string;
}

export interface TopicSafeModeResult {
  topicArn: string;
  actions: ActionSafeModeResult[];
  summary: {
    total: number;
    public: number;
    privateDeny: number;
    privateNoPolicy: number;
    unknown: number;
  };
}

export interface ActionSafeModeResult {
  action: string;
  status: number;
  classification: PolicyClassification;
  reason: string;
  errorMessage?: string;
}

export interface SafeModeSummary {
  totalTopics: number;
  totalActions: number;
  publicActions: number;
  privateActions: number;
  unknownActions: number;
}

export async function runSessionErrors(options: CliOptions): Promise<SafeModeResult> {
  const { sessionErrorsRoleArn, sessionErrorsTopics, mode, verbose, outputDir } = options;

  if (!sessionErrorsRoleArn || !sessionErrorsTopics || sessionErrorsTopics.length === 0) {
    throw new Error('Session errors mode requires --session-errors <role-arn> <topic-arn...>');
  }

  // Load and verify base credentials
  const baseCredentials = await loadCredentials();
  if (!baseCredentials) {
    throw new Error('Safe mode requires AWS credentials');
  }

  // Determine region from role ARN for STS calls
  const roleArnParsed = parseArn(sessionErrorsRoleArn);
  const stsRegion = roleArnParsed.region || 'us-east-1';

  // Verify base credentials
  const verifyResult = await verifyCredentials(baseCredentials, stsRegion);
  if (!verifyResult.success || !verifyResult.identity) {
    const errorMsg = verifyResult.error || 'Unknown error';
    if (errorMsg.includes('expired')) {
      throw new Error('AWS credentials have expired. Please refresh your credentials and try again.');
    }
    throw new Error(`Credential verification failed: ${errorMsg}`);
  }
  console.log(`Credentials verified: ${verifyResult.identity.arn}`);

  // Assume role with deny-all session policy
  console.log('');
  console.log('Assuming role with deny-all session policy...');

  const sessionName = `sns-buster-safe-${Date.now()}`;
  const assumeResult = await assumeRoleWithPolicy(baseCredentials, stsRegion, {
    roleArn: sessionErrorsRoleArn,
    sessionName,
    sessionPolicy: DENY_ALL_POLICY,
  });

  if (!assumeResult.success || !assumeResult.credentials) {
    throw new Error(`Failed to assume role: ${assumeResult.error}`);
  }

  const safeCredentials = assumeResult.credentials;
  console.log(`Assumed role: ${assumeResult.assumedRoleArn}`);

  // Print header
  console.log('');
  console.log('Session Errors Mode (deny-all session policy)');
  console.log('');
  console.log(`Role:     ${sessionErrorsRoleArn}`);
  console.log(`Session:  ${sessionName}`);
  console.log(`Policy:   Deny:*:*`);
  console.log('');

  // Create output directory
  const timestamp = new Date().toISOString();
  const firstTopic = sessionErrorsTopics[0];
  const outputDirName = `${generateOutputDirName(firstTopic)}-session-errors`;
  const outputPath = await createOutputDirectory(outputDir, outputDirName);

  // Get actions for mode
  const actions = getActionsByMode(mode);

  const topicResults: TopicSafeModeResult[] = [];
  let totalPublic = 0;
  let totalPrivate = 0;
  let totalUnknown = 0;

  // Test each topic
  for (const topicArn of sessionErrorsTopics) {
    const topicResult = await testTopic(topicArn, actions, safeCredentials, outputPath, verbose);
    topicResults.push(topicResult);
    totalPublic += topicResult.summary.public;
    totalPrivate += topicResult.summary.privateDeny + topicResult.summary.privateNoPolicy;
    totalUnknown += topicResult.summary.unknown;
  }

  // Build result
  const result: SafeModeResult = {
    roleArn: sessionErrorsRoleArn,
    assumedRoleArn: assumeResult.assumedRoleArn || '',
    topicArns: sessionErrorsTopics,
    timestamp,
    mode,
    results: topicResults,
    summary: {
      totalTopics: sessionErrorsTopics.length,
      totalActions: actions.length * sessionErrorsTopics.length,
      publicActions: totalPublic,
      privateActions: totalPrivate,
      unknownActions: totalUnknown,
    },
    outputPath,
  };

  // Write summary file
  const summaryPath = join(outputPath, 'summary.json');
  await writeFile(summaryPath, JSON.stringify(result, null, 2), 'utf-8');

  // Print final summary
  console.log('');
  console.log('Summary:');
  console.log(`  Topics tested: ${sessionErrorsTopics.length}`);
  console.log(`  Actions per topic: ${actions.length}`);
  console.log(`  PUBLIC (would be allowed): ${totalPublic}`);
  console.log(`  PRIVATE: ${totalPrivate}`);
  if (totalUnknown > 0) {
    console.log(`  UNKNOWN: ${totalUnknown}`);
  }
  console.log('');
  console.log(`Output: ${outputPath}`);

  return result;
}

async function testTopic(
  topicArn: string,
  actions: Action[],
  credentials: Credentials,
  outputPath: string,
  verbose: boolean
): Promise<TopicSafeModeResult> {
  const region = getRegionFromArn(topicArn);
  const endpoint = getEndpointForRegion(region);

  console.log(`Testing: ${topicArn}`);
  console.log('');

  // Print table header
  const actionWidth = 28;
  const statusWidth = 10;
  console.log(
    'Action'.padEnd(actionWidth) +
    'Status'.padEnd(statusWidth) +
    'Classification'
  );
  console.log('-'.repeat(52));

  const actionResults: ActionSafeModeResult[] = [];
  let publicCount = 0;
  let privateDenyCount = 0;
  let privateNoPolicyCount = 0;
  let unknownCount = 0;

  for (const action of actions) {
    const params = action.buildParams(topicArn);
    const unsigned = buildUnsignedRequest(endpoint, params, DEFAULT_USER_AGENT);
    const signed = signRequest(unsigned, {
      service: 'sns',
      region,
      credentials,
    });

    const response = await sendRequest(signed);
    const status = response.response.status;
    const errorDetails = parseErrorDetails(response.response.body);
    const errorMessage = errorDetails?.message || '';

    // Classify based on error message
    const classificationResult = classifyFromErrorMessage(errorMessage);
    const classification = classificationResult.classification;

    // Update counts
    switch (classification) {
      case 'public':
        publicCount++;
        break;
      case 'private-deny':
        privateDenyCount++;
        break;
      case 'private-no-policy':
        privateNoPolicyCount++;
        break;
      case 'unknown':
        unknownCount++;
        break;
    }

    const actionResult: ActionSafeModeResult = {
      action: action.name,
      status,
      classification,
      reason: classificationResult.reason,
      errorMessage: errorMessage || undefined,
    };
    actionResults.push(actionResult);

    // Write HTTP log
    await writeMutationsHttpLog(
      outputPath,
      action.name,
      topicArn.split(':').pop() || 'topic',
      formatRequestResult(response)
    );

    // Print row
    const label = getClassificationLabel(classification);
    console.log(
      action.name.padEnd(actionWidth) +
      String(status).padEnd(statusWidth) +
      label
    );
  }

  console.log('');
  console.log(`Summary for ${topicArn}:`);
  console.log(`  Actions tested: ${actions.length}`);
  console.log(`  PUBLIC (would be allowed): ${publicCount}`);
  console.log(`  PRIVATE: ${privateDenyCount + privateNoPolicyCount}`);
  if (unknownCount > 0) {
    console.log(`  UNKNOWN: ${unknownCount}`);
  }
  console.log('');

  return {
    topicArn,
    actions: actionResults,
    summary: {
      total: actions.length,
      public: publicCount,
      privateDeny: privateDenyCount,
      privateNoPolicy: privateNoPolicyCount,
      unknown: unknownCount,
    },
  };
}
