import { mkdir, writeFile, chmod } from 'fs/promises';
import { join } from 'path';
import type { RunSummary } from './types';

export function generateOutputDirName(topicArn: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const topicName = topicArn.split(':').pop() || 'unknown';
  return `${timestamp}-${topicName}`;
}

export async function createOutputDirectory(baseDir: string, name: string): Promise<string> {
  const outputPath = join(baseDir, name);
  await mkdir(outputPath, { recursive: true });
  return outputPath;
}

export async function writeHttpLog(
  outputDir: string,
  actionName: string,
  signed: boolean,
  content: string
): Promise<void> {
  const filename = `${actionName}-${signed ? 'signed' : 'unsigned'}.http`;
  const filepath = join(outputDir, filename);
  await writeFile(filepath, content, 'utf-8');
}

export async function writeMutationsHttpLog(
  outputDir: string,
  actionName: string,
  target: 'allowed' | 'denied' | 'nonexistent',
  content: string
): Promise<void> {
  const filename = `${actionName}-${target}.http`;
  const filepath = join(outputDir, filename);
  await writeFile(filepath, content, 'utf-8');
}

export async function writeSummaryFile(
  outputDir: string,
  summary: RunSummary
): Promise<void> {
  const filepath = join(outputDir, 'summary.json');
  await writeFile(filepath, JSON.stringify(summary, null, 2), 'utf-8');
}

export interface ReproduceScriptOptions {
  endpoint: string;
  params: Record<string, string>;
  signed: boolean;
  region: string;
}

// Map API Action to AWS CLI subcommand
const ACTION_TO_CLI: Record<string, string> = {
  GetTopicAttributes: 'get-topic-attributes',
  GetDataProtectionPolicy: 'get-data-protection-policy',
  ListSubscriptionsByTopic: 'list-subscriptions-by-topic',
  ListTagsForResource: 'list-tags-for-resource',
  Publish: 'publish',
  PublishBatch: 'publish-batch',
  Subscribe: 'subscribe',
  TagResource: 'tag-resource',
  UntagResource: 'untag-resource',
  AddPermission: 'add-permission',
  RemovePermission: 'remove-permission',
  SetTopicAttributes: 'set-topic-attributes',
  PutDataProtectionPolicy: 'put-data-protection-policy',
  DeleteTopic: 'delete-topic',
};

/**
 * Generate AWS CLI command from params.
 * Note: May not work for mutated requests since CLI validates params.
 */
function generateAwsCliCommand(params: Record<string, string>, region: string): string | null {
  const action = params.Action;
  const cliCmd = ACTION_TO_CLI[action];
  if (!cliCmd) return null;

  const topicArn = params.TopicArn || params.ResourceArn;
  if (!topicArn) return null;

  const arnFlag = params.ResourceArn ? '--resource-arn' : '--topic-arn';
  const parts: string[] = [
    `aws sns ${cliCmd}`,
    `--region ${region}`,
    `${arnFlag} '${topicArn}'`,
  ];

  // Add action-specific params
  if (action === 'SetTopicAttributes' && params.AttributeName) {
    parts.push(`--attribute-name '${params.AttributeName}'`);
    if (params.AttributeValue) {
      parts.push(`--attribute-value '${params.AttributeValue}'`);
    }
  } else if (action === 'Publish' && params.Message) {
    parts.push(`--message '${params.Message}'`);
  } else if (action === 'Subscribe' && params.Protocol && params.Endpoint) {
    parts.push(`--protocol '${params.Protocol}'`);
    parts.push(`--endpoint '${params.Endpoint}'`);
  } else if (action === 'AddPermission' && params.Label) {
    parts.push(`--label '${params.Label}'`);
    const actionName = Object.entries(params).find(([k]) => k.startsWith('ActionName.member.'))?.[1];
    const principal = Object.entries(params).find(([k]) => k.startsWith('AWSAccountId.member.'))?.[1];
    if (actionName) parts.push(`--action-name '${actionName}'`);
    if (principal) parts.push(`--aws-account-id '${principal}'`);
  } else if (action === 'RemovePermission' && params.Label) {
    parts.push(`--label '${params.Label}'`);
  }

  return parts.join(' \\\n  ');
}

/**
 * Generate a shell script that reproduces the request.
 * Uses curl for unsigned, awscurl for signed requests.
 * Includes AWS CLI equivalent as comment.
 */
export function generateReproduceScript(options: ReproduceScriptOptions): string {
  const { endpoint, params, signed, region } = options;

  // Build URL-encoded body
  const body = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const awsCliCmd = generateAwsCliCommand(params, region);
  const cliSection = awsCliCmd
    ? `\n# AWS CLI (may not work for mutated params):\n${awsCliCmd}\n`
    : '';

  if (!signed) {
    return `#!/bin/bash
# Unsigned request
curl -s -X POST '${endpoint}' \\
  -H 'Content-Type: application/x-www-form-urlencoded' \\
  -d '${body}'
${cliSection}`;
  }

  // Signed: awscurl (pip install awscurl)
  return `#!/bin/bash
# Signed request (requires: pip install awscurl)
awscurl --service sns --region ${region} -X POST \\
  -H 'Content-Type: application/x-www-form-urlencoded' \\
  -d '${body}' \\
  '${endpoint}'
${cliSection}`;
}

export async function writeReproduceScript(
  outputDir: string,
  filename: string,
  options: ReproduceScriptOptions
): Promise<void> {
  const reproduceDir = join(outputDir, 'reproduce');
  await mkdir(reproduceDir, { recursive: true });

  const content = generateReproduceScript(options);
  const filepath = join(reproduceDir, `${filename}.sh`);
  await writeFile(filepath, content, 'utf-8');
  await chmod(filepath, 0o755);
}
