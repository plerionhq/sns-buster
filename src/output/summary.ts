import type { ActionSummary, ActionSummaryResult, RunSummary } from './types';

export function createEmptySummary(
  topicArn: string,
  region: string,
  mode: 'read' | 'safe' | 'all',
  credentialsAvailable: boolean
): RunSummary {
  return {
    topicArn,
    region,
    timestamp: new Date().toISOString(),
    mode,
    credentialsAvailable,
    results: {},
    summary: {
      total: 0,
      unsigned: { success: 0, failed: 0 },
      signed: { success: 0, failed: 0 },
    },
  };
}

export function addActionResult(
  summary: RunSummary,
  actionName: string,
  signed: boolean,
  result: ActionSummaryResult
): void {
  if (!summary.results[actionName]) {
    summary.results[actionName] = {
      unsigned: { status: 0, success: false },
    };
  }

  if (signed) {
    summary.results[actionName].signed = result;
  } else {
    summary.results[actionName].unsigned = result;
  }
}

export function calculateSummaryTotals(summary: RunSummary): void {
  const results = Object.values(summary.results);
  summary.summary.total = results.length;

  summary.summary.unsigned = {
    success: results.filter(r => r.unsigned.success).length,
    failed: results.filter(r => !r.unsigned.success).length,
  };

  summary.summary.signed = {
    success: results.filter(r => r.signed?.success).length,
    failed: results.filter(r => r.signed && !r.signed.success).length,
  };
}

export interface ErrorDetails {
  type?: string;   // e.g., "Sender"
  code?: string;   // e.g., "InvalidParameter", "AuthorizationError"
  message?: string;
}

export function parseErrorDetails(responseBody: string): ErrorDetails {
  const details: ErrorDetails = {};

  const typeMatch = responseBody.match(/<Type>([^<]+)<\/Type>/);
  if (typeMatch) {
    details.type = typeMatch[1];
  }

  const codeMatch = responseBody.match(/<Code>([^<]+)<\/Code>/);
  if (codeMatch) {
    details.code = codeMatch[1];
  }

  const messageMatch = responseBody.match(/<Message>([^<]+)<\/Message>/);
  if (messageMatch) {
    details.message = messageMatch[1];
  }

  return details;
}

export function parseErrorFromResponse(responseBody: string): string | undefined {
  // Try to extract error code from XML response
  const errorMatch = responseBody.match(/<Code>([^<]+)<\/Code>/);
  if (errorMatch) {
    return errorMatch[1];
  }

  // Try to extract error type from XML
  const typeMatch = responseBody.match(/<Type>([^<]+)<\/Type>/);
  if (typeMatch) {
    return typeMatch[1];
  }

  return undefined;
}

export function parseRequestIdFromResponse(responseBody: string): string | undefined {
  const match = responseBody.match(/<RequestId>([^<]+)<\/RequestId>/);
  return match ? match[1] : undefined;
}

export function isSuccessStatus(status: number): boolean {
  return status >= 200 && status < 300;
}

export function formatSummaryForTerminal(summary: RunSummary): string {
  const lines: string[] = [];

  lines.push('Summary:');
  lines.push(`  Total actions: ${summary.summary.total}`);
  lines.push(
    `  Unsigned: ${summary.summary.unsigned.success} success, ${summary.summary.unsigned.failed} failed`
  );
  lines.push(
    `  Signed: ${summary.summary.signed.success} success, ${summary.summary.signed.failed} failed`
  );

  return lines.join('\n');
}
