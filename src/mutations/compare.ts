import type { ErrorDetails } from '../output/summary';

export interface ActionResult {
  status: number;
  success: boolean;
  error?: string;
  errorDetails?: ErrorDetails;
  requestId?: string;
}

export interface MutationComparison {
  action: string;
  match: boolean;
  allowedStatus: number;
  deniedStatus: number;
  allowedError?: string;
  deniedError?: string;
}

export interface MutationsSummary {
  total: number;
  matching: number;
  different: number;
}

export interface MutationsResult {
  allowedTopicArn: string;
  deniedTopicArn: string;
  timestamp: string;
  mode: string;
  comparisons: MutationComparison[];
  summary: MutationsSummary;
  outputPath?: string;
}

// --- Request Mutations Types ---

export interface TopicResult {
  status: number;
  error?: string;
  errorDetails?: ErrorDetails;
}

export interface MutationTestResult {
  mutationName: string;
  mutationDescription: string;
  // Results from all 3 topics
  allowed: TopicResult;
  denied: TopicResult;
  nonexistent: TopicResult;
  /** True if mutation proves validation runs before auth */
  useful: boolean;
  /** Reason why mutation is/isn't useful */
  reason?: string;
}

export interface ActionMutationResult {
  action: string;
  baseline: {
    allowed: TopicResult;
    denied: TopicResult;
    nonexistent: TopicResult;
  };
  mutations: MutationTestResult[];
  /** Mutations that proved auth bypass */
  usefulMutations: MutationTestResult[];
}

export interface RequestMutationsResult {
  allowedTopicArn: string;
  deniedTopicArn: string;
  nonexistentTopicArn: string;
  timestamp: string;
  mode: string;
  actions: ActionMutationResult[];
  summary: {
    totalActions: number;
    totalMutationsTested: number;
    usefulMutationsFound: number;
  };
  outputPath?: string;
}

/**
 * Safe probe mutations - action-specific mutations that return 200 but don't modify data.
 * Key is "actionName:mutationName", value is true if it's a safe probe.
 */
const SAFE_PROBE_MUTATIONS = new Set([
  // UntagResource - removing non-existent tag is no-op
  'UntagResource:nonexistent-tag-key',
  // RemovePermission - removing non-existent label is no-op
  'RemovePermission:invalid-label',
]);

export interface UsefulMutationResult {
  useful: boolean;
  reason: string;
}

/**
 * Determine if a mutation is useful for safe authorization testing.
 *
 * AWS processes requests as:
 * 1. Standard request structure validation (fails early, before auth)
 * 2. Authorization check
 * 3. Function-specific validation (fails after auth)
 *
 * USEFUL mutations fall into two categories:
 *
 * Category A - "Safe Probe" (validation after auth):
 *   - Passes step 1 (basic validation)
 *   - Passes step 2 (authorization) on allowed topic
 *   - Fails step 3 (function validation)
 *   Evidence: allowed=4xx, denied=403, nonexistent=403/404
 *   This proves auth was checked and passed, making it safe to test.
 *
 * Category B - "No-op Probe" (200 with no side effects):
 *   - Request succeeds but doesn't change anything
 *   Evidence: allowed=200, denied=403, and mutation is known safe
 *   Example: UntagResource with non-existent tag key
 *
 * NOT USEFUL (validation before auth):
 *   - Fails at step 1 before auth runs
 *   Evidence: all three topics return same validation error
 *   This tells us nothing about authorization.
 */
export function isUsefulMutation(
  mutation: {
    allowed: TopicResult;
    denied: TopicResult;
    nonexistent: TopicResult;
  },
  mutationName?: string,
  actionName?: string
): UsefulMutationResult {
  const { allowed, denied, nonexistent } = mutation;

  const allowedCode = allowed.errorDetails?.code || allowed.error;
  const deniedCode = denied.errorDetails?.code || denied.error;
  const nonexistentCode = nonexistent.errorDetails?.code || nonexistent.error;

  // Category B: Safe no-op probe (200 success with no side effects)
  if (
    mutationName &&
    actionName &&
    SAFE_PROBE_MUTATIONS.has(`${actionName}:${mutationName}`) &&
    allowed.status === 200 &&
    denied.status === 403
  ) {
    return {
      useful: true,
      reason: 'No-op probe: 200 success with no side effects',
    };
  }

  // Rule 1: Allowed topic must NOT return 403 (auth must pass or validation fail first)
  if (allowed.status === 403) {
    return {
      useful: false,
      reason: 'Allowed topic returned 403 (auth failed)',
    };
  }

  // Rule 2: Denied topic must return 403 (proves auth check runs)
  if (denied.status !== 403) {
    // If denied also returns validation error, validation runs before auth
    // This is NOT useful for safe testing
    if (deniedCode === allowedCode) {
      return {
        useful: false,
        reason: `Pre-auth validation: all topics return "${allowedCode}" (auth not checked)`,
      };
    }
    return {
      useful: false,
      reason: `Denied topic returned ${denied.status} ${deniedCode}, expected 403`,
    };
  }

  // Rule 3: Check nonexistent topic to confirm auth runs before this validation
  // If nonexistent returns same validation error as allowed, validation is pre-auth
  if (nonexistentCode === allowedCode && nonexistent.status === allowed.status) {
    return {
      useful: false,
      reason: `Pre-auth validation: nonexistent also returns "${allowedCode}"`,
    };
  }

  // Rule 4: Nonexistent should return 403/404 (auth/existence check runs)
  // Allowed should return a validation error (auth passed, then validation failed)
  if ((nonexistent.status === 403 || nonexistent.status === 404) &&
      allowed.status >= 400 && allowed.status < 500 && allowed.status !== 403) {
    return {
      useful: true,
      reason: `Safe probe: auth passed then "${allowedCode}" (denied=403, nonexistent=${nonexistent.status})`,
    };
  }

  // Edge case: allowed succeeded (200) but this isn't a known safe probe
  if (allowed.status === 200) {
    return {
      useful: false,
      reason: 'Allowed returned 200 but mutation not in safe probe list',
    };
  }

  return {
    useful: false,
    reason: `Inconclusive: allowed=${allowed.status} denied=${denied.status} nonexistent=${nonexistent.status}`,
  };
}

export function compareResponses(
  allowed: ActionResult,
  denied: ActionResult
): Omit<MutationComparison, 'action'> {
  return {
    match: allowed.status === denied.status,
    allowedStatus: allowed.status,
    deniedStatus: denied.status,
    allowedError: allowed.error,
    deniedError: denied.error,
  };
}

export function createMutationsSummary(comparisons: MutationComparison[]): MutationsSummary {
  const matching = comparisons.filter(c => c.match).length;
  return {
    total: comparisons.length,
    matching,
    different: comparisons.length - matching,
  };
}

export function formatMutationsResult(result: MutationsResult): string {
  const lines: string[] = [];

  // Table header
  const actionWidth = 28;
  const statusWidth = 10;
  lines.push(
    'Action'.padEnd(actionWidth) +
    'Allowed'.padEnd(statusWidth) +
    'Denied'.padEnd(statusWidth) +
    'Match'
  );
  lines.push('-'.repeat(actionWidth + statusWidth * 2 + 5));

  // Results
  for (const comp of result.comparisons) {
    const matchCol = comp.match ? 'YES' : 'NO';

    lines.push(
      comp.action.padEnd(actionWidth) +
      String(comp.allowedStatus).padEnd(statusWidth) +
      String(comp.deniedStatus).padEnd(statusWidth) +
      matchCol
    );
  }

  lines.push('');
  lines.push('Summary:');
  lines.push(`  Total actions: ${result.summary.total}`);
  lines.push(`  Matching responses: ${result.summary.matching}`);
  lines.push(`  Different responses: ${result.summary.different}`);

  return lines.join('\n');
}
