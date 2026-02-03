import { describe, test, expect, beforeEach } from 'bun:test';
import {
  createEmptySummary,
  addActionResult,
  calculateSummaryTotals,
  parseErrorFromResponse,
  parseRequestIdFromResponse,
  isSuccessStatus,
  formatSummaryForTerminal,
} from '../../src/output/summary';
import type { RunSummary } from '../../src/output/types';

describe('createEmptySummary', () => {
  test('creates summary with topic ARN', () => {
    const summary = createEmptySummary(
      'arn:aws:sns:us-east-1:123456789012:topic',
      'us-east-1',
      'all',
      true
    );

    expect(summary.topicArn).toBe('arn:aws:sns:us-east-1:123456789012:topic');
  });

  test('creates summary with region', () => {
    const summary = createEmptySummary(
      'arn:aws:sns:eu-west-1:123456789012:topic',
      'eu-west-1',
      'all',
      true
    );

    expect(summary.region).toBe('eu-west-1');
  });

  test('creates summary with mode', () => {
    const readSummary = createEmptySummary('arn', 'us-east-1', 'read', true);
    const safeSummary = createEmptySummary('arn', 'us-east-1', 'safe', true);
    const allSummary = createEmptySummary('arn', 'us-east-1', 'all', true);

    expect(readSummary.mode).toBe('read');
    expect(safeSummary.mode).toBe('safe');
    expect(allSummary.mode).toBe('all');
  });

  test('creates summary with credentials availability', () => {
    const withCreds = createEmptySummary('arn', 'us-east-1', 'all', true);
    const withoutCreds = createEmptySummary('arn', 'us-east-1', 'all', false);

    expect(withCreds.credentialsAvailable).toBe(true);
    expect(withoutCreds.credentialsAvailable).toBe(false);
  });

  test('creates summary with timestamp', () => {
    const before = new Date().toISOString();
    const summary = createEmptySummary('arn', 'us-east-1', 'all', true);
    const after = new Date().toISOString();

    expect(summary.timestamp >= before).toBe(true);
    expect(summary.timestamp <= after).toBe(true);
  });

  test('initializes empty results', () => {
    const summary = createEmptySummary('arn', 'us-east-1', 'all', true);

    expect(summary.results).toEqual({});
  });

  test('initializes zero totals', () => {
    const summary = createEmptySummary('arn', 'us-east-1', 'all', true);

    expect(summary.summary.total).toBe(0);
    expect(summary.summary.unsigned.success).toBe(0);
    expect(summary.summary.unsigned.failed).toBe(0);
    expect(summary.summary.signed.success).toBe(0);
    expect(summary.summary.signed.failed).toBe(0);
  });
});

describe('addActionResult', () => {
  let summary: RunSummary;

  beforeEach(() => {
    summary = createEmptySummary('arn', 'us-east-1', 'all', true);
  });

  test('adds unsigned result', () => {
    addActionResult(summary, 'GetTopicAttributes', false, {
      status: 403,
      success: false,
      error: 'AuthorizationError',
    });

    expect(summary.results.GetTopicAttributes.unsigned.status).toBe(403);
    expect(summary.results.GetTopicAttributes.unsigned.success).toBe(false);
    expect(summary.results.GetTopicAttributes.unsigned.error).toBe('AuthorizationError');
  });

  test('adds signed result', () => {
    addActionResult(summary, 'GetTopicAttributes', false, {
      status: 403,
      success: false,
    });
    addActionResult(summary, 'GetTopicAttributes', true, {
      status: 200,
      success: true,
      requestId: 'abc123',
    });

    expect(summary.results.GetTopicAttributes.signed?.status).toBe(200);
    expect(summary.results.GetTopicAttributes.signed?.success).toBe(true);
    expect(summary.results.GetTopicAttributes.signed?.requestId).toBe('abc123');
  });

  test('handles multiple actions', () => {
    addActionResult(summary, 'GetTopicAttributes', false, { status: 403, success: false });
    addActionResult(summary, 'Publish', false, { status: 403, success: false });

    expect(Object.keys(summary.results)).toHaveLength(2);
    expect(summary.results.GetTopicAttributes).toBeDefined();
    expect(summary.results.Publish).toBeDefined();
  });
});

describe('calculateSummaryTotals', () => {
  test('calculates total actions', () => {
    const summary = createEmptySummary('arn', 'us-east-1', 'all', true);
    addActionResult(summary, 'Action1', false, { status: 403, success: false });
    addActionResult(summary, 'Action2', false, { status: 403, success: false });
    addActionResult(summary, 'Action3', false, { status: 403, success: false });

    calculateSummaryTotals(summary);

    expect(summary.summary.total).toBe(3);
  });

  test('calculates unsigned success/failure', () => {
    const summary = createEmptySummary('arn', 'us-east-1', 'all', true);
    addActionResult(summary, 'Action1', false, { status: 200, success: true });
    addActionResult(summary, 'Action2', false, { status: 200, success: true });
    addActionResult(summary, 'Action3', false, { status: 403, success: false });

    calculateSummaryTotals(summary);

    expect(summary.summary.unsigned.success).toBe(2);
    expect(summary.summary.unsigned.failed).toBe(1);
  });

  test('calculates signed success/failure', () => {
    const summary = createEmptySummary('arn', 'us-east-1', 'all', true);
    addActionResult(summary, 'Action1', false, { status: 403, success: false });
    addActionResult(summary, 'Action1', true, { status: 200, success: true });
    addActionResult(summary, 'Action2', false, { status: 403, success: false });
    addActionResult(summary, 'Action2', true, { status: 200, success: true });
    addActionResult(summary, 'Action3', false, { status: 403, success: false });
    addActionResult(summary, 'Action3', true, { status: 403, success: false });

    calculateSummaryTotals(summary);

    expect(summary.summary.signed.success).toBe(2);
    expect(summary.summary.signed.failed).toBe(1);
  });

  test('handles no signed results', () => {
    const summary = createEmptySummary('arn', 'us-east-1', 'all', false);
    addActionResult(summary, 'Action1', false, { status: 403, success: false });

    calculateSummaryTotals(summary);

    expect(summary.summary.signed.success).toBe(0);
    expect(summary.summary.signed.failed).toBe(0);
  });
});

describe('parseErrorFromResponse', () => {
  test('extracts error code from XML', () => {
    const xml = `<ErrorResponse>
      <Error>
        <Code>AuthorizationError</Code>
        <Message>Access denied</Message>
      </Error>
    </ErrorResponse>`;

    expect(parseErrorFromResponse(xml)).toBe('AuthorizationError');
  });

  test('extracts error type if no code', () => {
    const xml = `<ErrorResponse>
      <Error>
        <Type>Sender</Type>
        <Message>Invalid parameter</Message>
      </Error>
    </ErrorResponse>`;

    expect(parseErrorFromResponse(xml)).toBe('Sender');
  });

  test('returns undefined for non-error response', () => {
    const xml = `<GetTopicAttributesResponse>
      <GetTopicAttributesResult>
        <Attributes/>
      </GetTopicAttributesResult>
    </GetTopicAttributesResponse>`;

    expect(parseErrorFromResponse(xml)).toBeUndefined();
  });

  test('handles malformed XML', () => {
    expect(parseErrorFromResponse('not xml')).toBeUndefined();
    expect(parseErrorFromResponse('')).toBeUndefined();
  });
});

describe('parseRequestIdFromResponse', () => {
  test('extracts request ID from success response', () => {
    const xml = `<GetTopicAttributesResponse>
      <ResponseMetadata>
        <RequestId>abc123-def456</RequestId>
      </ResponseMetadata>
    </GetTopicAttributesResponse>`;

    expect(parseRequestIdFromResponse(xml)).toBe('abc123-def456');
  });

  test('extracts request ID from error response', () => {
    const xml = `<ErrorResponse>
      <RequestId>error-request-id</RequestId>
    </ErrorResponse>`;

    expect(parseRequestIdFromResponse(xml)).toBe('error-request-id');
  });

  test('returns undefined when no request ID', () => {
    const xml = '<Response>No request ID here</Response>';

    expect(parseRequestIdFromResponse(xml)).toBeUndefined();
  });
});

describe('isSuccessStatus', () => {
  test('returns true for 2xx status codes', () => {
    expect(isSuccessStatus(200)).toBe(true);
    expect(isSuccessStatus(201)).toBe(true);
    expect(isSuccessStatus(204)).toBe(true);
    expect(isSuccessStatus(299)).toBe(true);
  });

  test('returns false for non-2xx status codes', () => {
    expect(isSuccessStatus(199)).toBe(false);
    expect(isSuccessStatus(300)).toBe(false);
    expect(isSuccessStatus(400)).toBe(false);
    expect(isSuccessStatus(403)).toBe(false);
    expect(isSuccessStatus(404)).toBe(false);
    expect(isSuccessStatus(500)).toBe(false);
  });
});

describe('formatSummaryForTerminal', () => {
  test('includes summary header', () => {
    const summary = createEmptySummary(
      'arn:aws:sns:us-east-1:123456789012:my-topic',
      'us-east-1',
      'all',
      true
    );

    const formatted = formatSummaryForTerminal(summary);

    expect(formatted).toContain('Summary:');
  });

  test('includes summary totals', () => {
    const summary = createEmptySummary('arn', 'us-east-1', 'all', true);
    addActionResult(summary, 'Action1', false, { status: 200, success: true });
    addActionResult(summary, 'Action1', true, { status: 200, success: true });
    addActionResult(summary, 'Action2', false, { status: 403, success: false });
    addActionResult(summary, 'Action2', true, { status: 403, success: false });
    calculateSummaryTotals(summary);

    const formatted = formatSummaryForTerminal(summary);

    expect(formatted).toContain('Total actions: 2');
    expect(formatted).toContain('Unsigned: 1 success, 1 failed');
    expect(formatted).toContain('Signed: 1 success, 1 failed');
  });

  test('shows zero counts when no results', () => {
    const summary = createEmptySummary('arn', 'us-east-1', 'all', false);
    calculateSummaryTotals(summary);

    const formatted = formatSummaryForTerminal(summary);

    expect(formatted).toContain('Total actions: 0');
    expect(formatted).toContain('Unsigned: 0 success, 0 failed');
    expect(formatted).toContain('Signed: 0 success, 0 failed');
  });
});
