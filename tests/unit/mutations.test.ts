import { describe, test, expect } from 'bun:test';
import {
  compareResponses,
  formatMutationsResult,
  createMutationsSummary,
  isUsefulMutation,
  type MutationsResult,
  type MutationComparison,
} from '../../src/mutations/compare';
import {
  removeAction,
  removeVersion,
  removeMessage,
  emptyMessage,
  endpointToArn,
  invalidActionName,
  invalidAttributeName,
  emptyTagKey,
  removeTagKey,
  removeTagKeys,
  invalidProtocol,
  emptyLabel,
  removeLabel,
  specialCharLabel,
  longTagKey,
  longTagValue,
  longLabel,
  invalidJsonPolicy,
  emptyJsonPolicy,
  invalidPolicyStructure,
  removeDataProtectionPolicy,
  getMutationsForAction,
  didMutationChangeParams,
  defaultMutations,
} from '../../src/mutations/strategies';

describe('compareResponses', () => {
  test('returns match when both status codes are equal', () => {
    const result = compareResponses(
      { status: 200, success: true },
      { status: 200, success: true }
    );

    expect(result.match).toBe(true);
    expect(result.allowedStatus).toBe(200);
    expect(result.deniedStatus).toBe(200);
  });

  test('returns no match when status codes differ', () => {
    const result = compareResponses(
      { status: 200, success: true },
      { status: 403, success: false, error: 'AuthorizationError' }
    );

    expect(result.match).toBe(false);
    expect(result.allowedStatus).toBe(200);
    expect(result.deniedStatus).toBe(403);
  });

  test('returns match when both are 403', () => {
    const result = compareResponses(
      { status: 403, success: false, error: 'AuthorizationError' },
      { status: 403, success: false, error: 'AuthorizationError' }
    );

    expect(result.match).toBe(true);
    expect(result.allowedStatus).toBe(403);
    expect(result.deniedStatus).toBe(403);
  });

  test('includes error codes when present', () => {
    const result = compareResponses(
      { status: 400, success: false, error: 'InvalidParameter' },
      { status: 403, success: false, error: 'AuthorizationError' }
    );

    expect(result.allowedError).toBe('InvalidParameter');
    expect(result.deniedError).toBe('AuthorizationError');
  });
});

describe('createMutationsSummary', () => {
  test('calculates totals correctly', () => {
    const comparisons: MutationComparison[] = [
      { action: 'GetTopicAttributes', match: false, allowedStatus: 200, deniedStatus: 403 },
      { action: 'Publish', match: false, allowedStatus: 200, deniedStatus: 403 },
      { action: 'Subscribe', match: true, allowedStatus: 403, deniedStatus: 403 },
    ];

    const summary = createMutationsSummary(comparisons);

    expect(summary.total).toBe(3);
    expect(summary.matching).toBe(1);
    expect(summary.different).toBe(2);
  });

  test('handles all matching', () => {
    const comparisons: MutationComparison[] = [
      { action: 'GetTopicAttributes', match: true, allowedStatus: 200, deniedStatus: 200 },
      { action: 'Publish', match: true, allowedStatus: 200, deniedStatus: 200 },
    ];

    const summary = createMutationsSummary(comparisons);

    expect(summary.total).toBe(2);
    expect(summary.matching).toBe(2);
    expect(summary.different).toBe(0);
  });

  test('handles all different', () => {
    const comparisons: MutationComparison[] = [
      { action: 'GetTopicAttributes', match: false, allowedStatus: 200, deniedStatus: 403 },
      { action: 'Publish', match: false, allowedStatus: 200, deniedStatus: 403 },
    ];

    const summary = createMutationsSummary(comparisons);

    expect(summary.total).toBe(2);
    expect(summary.matching).toBe(0);
    expect(summary.different).toBe(2);
  });

  test('handles empty comparisons', () => {
    const summary = createMutationsSummary([]);

    expect(summary.total).toBe(0);
    expect(summary.matching).toBe(0);
    expect(summary.different).toBe(0);
  });
});

describe('formatMutationsResult', () => {
  test('formats result for terminal output', () => {
    const result: MutationsResult = {
      allowedTopicArn: 'arn:aws:sns:us-east-1:111:allowed',
      deniedTopicArn: 'arn:aws:sns:us-east-1:222:denied',
      timestamp: '2026-01-13T00:00:00Z',
      mode: 'all',
      comparisons: [
        { action: 'GetTopicAttributes', match: false, allowedStatus: 200, deniedStatus: 403 },
        { action: 'Publish', match: true, allowedStatus: 403, deniedStatus: 403 },
      ],
      summary: { total: 2, matching: 1, different: 1 },
    };

    const output = formatMutationsResult(result);

    expect(output).toContain('Action');
    expect(output).toContain('Allowed');
    expect(output).toContain('Denied');
    expect(output).toContain('GetTopicAttributes');
    expect(output).toContain('200');
    expect(output).toContain('403');
    expect(output).toContain('NO');
    expect(output).toContain('YES');
  });
});

describe('isUsefulMutation', () => {
  // Helper to create topic results
  const topicResult = (status: number, code?: string) => ({
    status,
    error: code,
    errorDetails: code ? { code } : undefined,
  });

  test('returns useful when auth passed then function validation failed (safe probe)', () => {
    // This is the ideal case: auth ran and passed on allowed, then function validation failed
    const mutation = {
      allowed: topicResult(400, 'InvalidParameter'),
      denied: topicResult(403, 'AuthorizationError'),
      nonexistent: topicResult(403, 'AuthorizationError'),
    };

    const result = isUsefulMutation(mutation);
    expect(result.useful).toBe(true);
    expect(result.reason).toContain('Safe probe');
    expect(result.reason).toContain('auth passed');
  });

  test('returns useful when nonexistent returns 404 (existence check after auth)', () => {
    const mutation = {
      allowed: topicResult(400, 'InvalidParameter'),
      denied: topicResult(403, 'AuthorizationError'),
      nonexistent: topicResult(404, 'NotFound'),
    };

    const result = isUsefulMutation(mutation);
    expect(result.useful).toBe(true);
    expect(result.reason).toContain('Safe probe');
  });

  test('returns not useful when all 3 topics return same validation error (pre-auth)', () => {
    // Validation runs before auth - not useful for safe testing
    const mutation = {
      allowed: topicResult(400, 'ValidationError'),
      denied: topicResult(400, 'ValidationError'),
      nonexistent: topicResult(400, 'ValidationError'),
    };

    const result = isUsefulMutation(mutation);
    expect(result.useful).toBe(false);
    expect(result.reason).toContain('Pre-auth validation');
  });

  test('returns not useful when nonexistent returns same error as allowed (pre-auth)', () => {
    const mutation = {
      allowed: topicResult(400, 'InvalidParameter'),
      denied: topicResult(403, 'AuthorizationError'),
      nonexistent: topicResult(400, 'InvalidParameter'),
    };

    const result = isUsefulMutation(mutation);
    expect(result.useful).toBe(false);
    expect(result.reason).toContain('Pre-auth validation');
  });

  test('returns not useful when allowed is 403', () => {
    const mutation = {
      allowed: topicResult(403, 'AuthorizationError'),
      denied: topicResult(403, 'AuthorizationError'),
      nonexistent: topicResult(403, 'AuthorizationError'),
    };

    const result = isUsefulMutation(mutation);
    expect(result.useful).toBe(false);
    expect(result.reason).toContain('auth failed');
  });

  test('returns not useful when denied is not 403', () => {
    const mutation = {
      allowed: topicResult(400, 'ValidationError'),
      denied: topicResult(400, 'ValidationError'),
      nonexistent: topicResult(403, 'AuthorizationError'),
    };

    const result = isUsefulMutation(mutation);
    expect(result.useful).toBe(false);
    expect(result.reason).toContain('Pre-auth validation');
  });

  test('returns useful for known safe no-op probe with 200', () => {
    const mutation = {
      allowed: topicResult(200),
      denied: topicResult(403, 'AuthorizationError'),
      nonexistent: topicResult(403, 'AuthorizationError'),
    };

    const result = isUsefulMutation(mutation, 'nonexistent-tag-key', 'UntagResource');
    expect(result.useful).toBe(true);
    expect(result.reason).toContain('No-op probe');
  });

  test('returns not useful for 200 if not in safe probe list', () => {
    const mutation = {
      allowed: topicResult(200),
      denied: topicResult(403, 'AuthorizationError'),
      nonexistent: topicResult(403, 'AuthorizationError'),
    };

    const result = isUsefulMutation(mutation, 'some-mutation', 'SomeAction');
    expect(result.useful).toBe(false);
    expect(result.reason).toContain('not in safe probe list');
  });
});

// --- Mutation Strategy Tests ---

const sampleTopicArn = 'arn:aws:sns:us-east-1:123456789012:my-topic';

describe('default mutations', () => {
  const baseParams = {
    Action: 'GetTopicAttributes',
    TopicArn: sampleTopicArn,
    Version: '2010-03-31',
  };

  test('defaultMutations only contains structure mutations, not ARN mutations', () => {
    // We intentionally do NOT mutate TopicArn/ResourceArn because
    // AWS needs the correct target ARN to perform authorization checks
    expect(defaultMutations.length).toBe(2);
    expect(defaultMutations.some(m => m.name === 'remove-action')).toBe(true);
    expect(defaultMutations.some(m => m.name === 'remove-version')).toBe(true);
    // Should NOT contain any ARN mutations
    expect(defaultMutations.some(m => m.name.includes('arn'))).toBe(false);
  });

  test('removeAction removes Action param', () => {
    const result = removeAction.apply(baseParams, sampleTopicArn);
    expect(result.Action).toBeUndefined();
    expect(result.TopicArn).toBe(sampleTopicArn);
    expect(result.Version).toBe('2010-03-31');
  });

  test('removeVersion removes Version param', () => {
    const result = removeVersion.apply(baseParams, sampleTopicArn);
    expect(result.Version).toBeUndefined();
    expect(result.TopicArn).toBe(sampleTopicArn);
    expect(result.Action).toBe('GetTopicAttributes');
  });

  test('mutations preserve TopicArn', () => {
    // Critical: all default mutations must preserve the target ARN
    for (const mutation of defaultMutations) {
      const result = mutation.apply(baseParams, sampleTopicArn);
      expect(result.TopicArn).toBe(sampleTopicArn);
    }
  });
});

describe('parameter-based mutations', () => {
  test('removeMessage removes Message param when present', () => {
    const params = { Action: 'Publish', TopicArn: sampleTopicArn, Message: 'hello' };
    const result = removeMessage.apply(params, sampleTopicArn);
    expect(result.Message).toBeUndefined();
  });

  test('removeMessage returns unchanged when Message not present', () => {
    const params = { Action: 'GetTopicAttributes', TopicArn: sampleTopicArn };
    const result = removeMessage.apply(params, sampleTopicArn);
    expect(result).toBe(params);
  });

  test('emptyMessage sets Message to empty string', () => {
    const params = { Action: 'Publish', TopicArn: sampleTopicArn, Message: 'hello' };
    const result = emptyMessage.apply(params, sampleTopicArn);
    expect(result.Message).toBe('');
  });

  test('endpointToArn changes Endpoint to ARN', () => {
    const params = { Action: 'Subscribe', TopicArn: sampleTopicArn, Endpoint: 'https://example.com' };
    const result = endpointToArn.apply(params, sampleTopicArn);
    expect(result.Endpoint).toBe(sampleTopicArn);
  });

  test('endpointToArn returns unchanged when Endpoint not present', () => {
    const params = { Action: 'Publish', TopicArn: sampleTopicArn };
    const result = endpointToArn.apply(params, sampleTopicArn);
    expect(result).toBe(params);
  });

  test('invalidActionName changes ActionName.member.* to invalid value', () => {
    const params = { Action: 'AddPermission', TopicArn: sampleTopicArn, 'ActionName.member.1': 'Publish' };
    const result = invalidActionName.apply(params, sampleTopicArn);
    expect(result['ActionName.member.1']).toBe('NotARealAction');
  });

  test('invalidActionName returns unchanged when ActionName not present', () => {
    const params = { Action: 'Publish', TopicArn: sampleTopicArn };
    const result = invalidActionName.apply(params, sampleTopicArn);
    expect(result).toBe(params);
  });

  test('invalidAttributeName changes AttributeName to invalid value', () => {
    const params = { Action: 'SetTopicAttributes', TopicArn: sampleTopicArn, AttributeName: 'DisplayName' };
    const result = invalidAttributeName.apply(params, sampleTopicArn);
    expect(result.AttributeName).toBe('NotARealAttribute');
  });

  test('emptyTagKey sets tag key to empty string', () => {
    const params = { Action: 'TagResource', ResourceArn: sampleTopicArn, 'Tags.member.1.Key': 'mykey' };
    const result = emptyTagKey.apply(params, sampleTopicArn);
    expect(result['Tags.member.1.Key']).toBe('');
  });

  test('emptyTagKey returns unchanged when no tag key present', () => {
    const params = { Action: 'Publish', TopicArn: sampleTopicArn };
    const result = emptyTagKey.apply(params, sampleTopicArn);
    expect(result).toBe(params);
  });

  test('removeTagKey removes tag key param', () => {
    const params = { Action: 'TagResource', ResourceArn: sampleTopicArn, 'Tags.member.1.Key': 'mykey', 'Tags.member.1.Value': 'myvalue' };
    const result = removeTagKey.apply(params, sampleTopicArn);
    expect(result['Tags.member.1.Key']).toBeUndefined();
    expect(result['Tags.member.1.Value']).toBe('myvalue');
  });

  test('removeTagKeys removes TagKeys.member.* params', () => {
    const params = { Action: 'UntagResource', ResourceArn: sampleTopicArn, 'TagKeys.member.1': 'key1', 'TagKeys.member.2': 'key2' };
    const result = removeTagKeys.apply(params, sampleTopicArn);
    expect(result['TagKeys.member.1']).toBeUndefined();
    expect(result['TagKeys.member.2']).toBeUndefined();
  });

  test('invalidProtocol changes Protocol to invalid value', () => {
    const params = { Action: 'Subscribe', TopicArn: sampleTopicArn, Protocol: 'https' };
    const result = invalidProtocol.apply(params, sampleTopicArn);
    expect(result.Protocol).toBe('not-a-protocol');
  });

  test('emptyLabel sets Label to empty string', () => {
    const params = { Action: 'RemovePermission', TopicArn: sampleTopicArn, Label: 'my-label' };
    const result = emptyLabel.apply(params, sampleTopicArn);
    expect(result.Label).toBe('');
  });

  test('emptyLabel returns unchanged when Label not present', () => {
    const params = { Action: 'Publish', TopicArn: sampleTopicArn };
    const result = emptyLabel.apply(params, sampleTopicArn);
    expect(result).toBe(params);
  });

  test('removeLabel removes Label param', () => {
    const params = { Action: 'RemovePermission', TopicArn: sampleTopicArn, Label: 'my-label' };
    const result = removeLabel.apply(params, sampleTopicArn);
    expect(result.Label).toBeUndefined();
  });

  test('specialCharLabel sets Label with special characters', () => {
    const params = { Action: 'RemovePermission', TopicArn: sampleTopicArn, Label: 'my-label' };
    const result = specialCharLabel.apply(params, sampleTopicArn);
    expect(result.Label).toBe('../../../etc/passwd');
  });

  test('longTagKey sets tag key to exceed limit', () => {
    const params = { Action: 'TagResource', ResourceArn: sampleTopicArn, 'Tags.member.1.Key': 'mykey' };
    const result = longTagKey.apply(params, sampleTopicArn);
    expect(result['Tags.member.1.Key'].length).toBe(200);
  });

  test('longTagValue sets tag value to exceed limit', () => {
    const params = { Action: 'TagResource', ResourceArn: sampleTopicArn, 'Tags.member.1.Value': 'myvalue' };
    const result = longTagValue.apply(params, sampleTopicArn);
    expect(result['Tags.member.1.Value'].length).toBe(500);
  });

  test('longLabel sets Label to exceed limit', () => {
    const params = { Action: 'AddPermission', TopicArn: sampleTopicArn, Label: 'my-label' };
    const result = longLabel.apply(params, sampleTopicArn);
    expect(result.Label.length).toBe(200);
  });
});

describe('policy mutations', () => {
  const samplePolicy = JSON.stringify({ Name: 'test', Version: '2021-06-01', Statement: [] });

  test('invalidJsonPolicy sets policy to invalid JSON', () => {
    const params = { Action: 'PutDataProtectionPolicy', ResourceArn: sampleTopicArn, DataProtectionPolicy: samplePolicy };
    const result = invalidJsonPolicy.apply(params, sampleTopicArn);
    expect(result.DataProtectionPolicy).toBe('{not valid json');
  });

  test('invalidJsonPolicy returns unchanged when policy not present', () => {
    const params = { Action: 'Publish', TopicArn: sampleTopicArn };
    const result = invalidJsonPolicy.apply(params, sampleTopicArn);
    expect(result).toBe(params);
  });

  test('emptyJsonPolicy sets policy to empty object', () => {
    const params = { Action: 'PutDataProtectionPolicy', ResourceArn: sampleTopicArn, DataProtectionPolicy: samplePolicy };
    const result = emptyJsonPolicy.apply(params, sampleTopicArn);
    expect(result.DataProtectionPolicy).toBe('{}');
  });

  test('invalidPolicyStructure sets policy to valid JSON with wrong schema', () => {
    const params = { Action: 'PutDataProtectionPolicy', ResourceArn: sampleTopicArn, DataProtectionPolicy: samplePolicy };
    const result = invalidPolicyStructure.apply(params, sampleTopicArn);
    expect(JSON.parse(result.DataProtectionPolicy)).toEqual({ invalid: 'structure', foo: 'bar' });
  });

  test('removeDataProtectionPolicy removes the policy param', () => {
    const params = { Action: 'PutDataProtectionPolicy', ResourceArn: sampleTopicArn, DataProtectionPolicy: samplePolicy };
    const result = removeDataProtectionPolicy.apply(params, sampleTopicArn);
    expect(result.DataProtectionPolicy).toBeUndefined();
  });
});

describe('didMutationChangeParams', () => {
  test('returns true when keys are added', () => {
    const original = { a: '1' };
    const mutated = { a: '1', b: '2' };
    expect(didMutationChangeParams(original, mutated)).toBe(true);
  });

  test('returns true when keys are removed', () => {
    const original = { a: '1', b: '2' };
    const mutated = { a: '1' };
    expect(didMutationChangeParams(original, mutated)).toBe(true);
  });

  test('returns true when values are changed', () => {
    const original = { a: '1' };
    const mutated = { a: '2' };
    expect(didMutationChangeParams(original, mutated)).toBe(true);
  });

  test('returns false when params are identical', () => {
    const original = { a: '1', b: '2' };
    const mutated = { a: '1', b: '2' };
    expect(didMutationChangeParams(original, mutated)).toBe(false);
  });

  test('returns false when params are same but different order', () => {
    const original = { b: '2', a: '1' };
    const mutated = { a: '1', b: '2' };
    expect(didMutationChangeParams(original, mutated)).toBe(false);
  });
});

describe('getMutationsForAction', () => {
  test('returns default and parameter mutations', () => {
    const mutations = getMutationsForAction('GetTopicAttributes');
    // Default mutations (2) + parameter mutations (31)
    expect(mutations.length).toBeGreaterThan(20);
    // Should include structure mutations
    expect(mutations.some(m => m.name === 'remove-action')).toBe(true);
    expect(mutations.some(m => m.name === 'remove-version')).toBe(true);
    // Should include parameter mutations
    expect(mutations.some(m => m.name === 'empty-message')).toBe(true);
    expect(mutations.some(m => m.name === 'endpoint-to-arn')).toBe(true);
    // Should NOT include any ARN mutations (they modify target TopicArn)
    expect(mutations.some(m => m.name === 'remove-arn')).toBe(false);
    expect(mutations.some(m => m.name === 'empty-arn')).toBe(false);
  });

  test('returns same mutations for different actions', () => {
    const mutations1 = getMutationsForAction('GetTopicAttributes');
    const mutations2 = getMutationsForAction('Publish');
    expect(mutations1.length).toBe(mutations2.length);
  });

  test('no mutations modify TopicArn or ResourceArn', () => {
    const mutations = getMutationsForAction('GetTopicAttributes');
    const baseParams = {
      Action: 'GetTopicAttributes',
      TopicArn: sampleTopicArn,
      Version: '2010-03-31',
    };

    for (const mutation of mutations) {
      const result = mutation.apply(baseParams, sampleTopicArn);
      // TopicArn must always be preserved (or deleted is OK for structure mutations)
      if (result.TopicArn !== undefined) {
        expect(result.TopicArn).toBe(sampleTopicArn);
      }
    }
  });
});
