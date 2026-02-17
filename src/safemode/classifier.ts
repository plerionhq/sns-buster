export type PolicyClassification =
  | 'public'           // Resource policy would allow (blocked by session/identity policy)
  | 'private-deny'     // Resource policy explicitly denies
  | 'private-no-policy' // No resource policy grants access
  | 'unknown';         // Could not determine

export interface ClassificationResult {
  classification: PolicyClassification;
  reason: string;
}

export function classifyFromErrorMessage(errorMessage: string): ClassificationResult {
  // Public: session/identity policy blocked, but resource policy would have allowed
  // Error contains: "identity-based policy" or "session policy"
  if (
    errorMessage.includes('identity-based policy') ||
    errorMessage.includes('session policy')
  ) {
    return {
      classification: 'public',
      reason: 'session/identity policy',
    };
  }

  // Private with explicit deny in resource policy
  // Error contains: "explicit deny in a resource-based policy"
  if (errorMessage.includes('explicit deny in a resource-based policy')) {
    return {
      classification: 'private-deny',
      reason: 'resource policy deny',
    };
  }

  // Private with no resource policy granting access
  // Error contains: "no resource-based policy allows"
  if (errorMessage.includes('no resource-based policy allows')) {
    return {
      classification: 'private-no-policy',
      reason: 'no resource policy',
    };
  }

  // Could not determine from error message
  return {
    classification: 'unknown',
    reason: 'unrecognized error format',
  };
}

export function getClassificationLabel(classification: PolicyClassification): string {
  switch (classification) {
    case 'public':
      return 'PUBLIC';
    case 'private-deny':
    case 'private-no-policy':
      return 'PRIVATE';
    case 'unknown':
      return 'UNKNOWN';
  }
}

export function getClassificationColor(classification: PolicyClassification): string {
  switch (classification) {
    case 'public':
      return '\x1b[32m'; // Green
    case 'private-deny':
    case 'private-no-policy':
      return '\x1b[31m'; // Red
    case 'unknown':
      return '\x1b[33m'; // Yellow
  }
}

export const RESET_COLOR = '\x1b[0m';
