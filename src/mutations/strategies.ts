/**
 * Mutation strategies for finding auth-vs-validation boundaries.
 *
 * Goal: Find mutations where:
 * - Allowed topic: non-403 response (auth passed, validation failed)
 * - Denied topic: 403 response (auth failed)
 *
 * This proves authorization runs before parameter validation.
 */

export interface Mutation {
  name: string;
  description: string;
  apply: (params: Record<string, string>, topicArn: string) => Record<string, string>;
}

/**
 * Remove the Action parameter
 */
export const removeAction: Mutation = {
  name: 'remove-action',
  description: 'Remove Action parameter',
  apply: (params) => {
    const result = { ...params };
    delete result.Action;
    return result;
  },
};

/**
 * Remove the Version parameter
 */
export const removeVersion: Mutation = {
  name: 'remove-version',
  description: 'Remove Version parameter',
  apply: (params) => {
    const result = { ...params };
    delete result.Version;
    return result;
  },
};

// --- Parameter-based mutations (apply if param exists) ---

/**
 * Change Endpoint from URL to ARN format (if Endpoint param exists)
 */
export const endpointToArn: Mutation = {
  name: 'endpoint-to-arn',
  description: 'Change Endpoint parameter to ARN format',
  apply: (params, topicArn) => {
    if (!params.Endpoint) return params;
    return { ...params, Endpoint: topicArn };
  },
};

/**
 * Remove Message parameter (if exists)
 */
export const removeMessage: Mutation = {
  name: 'remove-message',
  description: 'Remove Message parameter',
  apply: (params) => {
    if (params.Message === undefined) return params;
    const result = { ...params };
    delete result.Message;
    return result;
  },
};

/**
 * Empty Message parameter (if exists)
 */
export const emptyMessage: Mutation = {
  name: 'empty-message',
  description: 'Set Message to empty string',
  apply: (params) => {
    if (params.Message === undefined) return params;
    return { ...params, Message: '' };
  },
};

// --- PublishBatch mutations ---

/**
 * Remove batch entry Message (if exists)
 */
export const removeBatchMessage: Mutation = {
  name: 'remove-batch-message',
  description: 'Remove Message from batch entry',
  apply: (params) => {
    const msgKey = Object.keys(params).find(k => k.match(/PublishBatchRequestEntries\.member\.\d+\.Message/));
    if (!msgKey) return params;
    const result = { ...params };
    delete result[msgKey];
    return result;
  },
};

/**
 * Empty batch entry Message (if exists)
 */
export const emptyBatchMessage: Mutation = {
  name: 'empty-batch-message',
  description: 'Set batch entry Message to empty string',
  apply: (params) => {
    const msgKey = Object.keys(params).find(k => k.match(/PublishBatchRequestEntries\.member\.\d+\.Message/));
    if (!msgKey) return params;
    return { ...params, [msgKey]: '' };
  },
};

/**
 * Remove batch entry Id (if exists)
 */
export const removeBatchId: Mutation = {
  name: 'remove-batch-id',
  description: 'Remove Id from batch entry',
  apply: (params) => {
    const idKey = Object.keys(params).find(k => k.match(/PublishBatchRequestEntries\.member\.\d+\.Id$/));
    if (!idKey) return params;
    const result = { ...params };
    delete result[idKey];
    return result;
  },
};

/**
 * Empty batch entry Id (if exists)
 */
export const emptyBatchId: Mutation = {
  name: 'empty-batch-id',
  description: 'Set batch entry Id to empty string',
  apply: (params) => {
    const idKey = Object.keys(params).find(k => k.match(/PublishBatchRequestEntries\.member\.\d+\.Id$/));
    if (!idKey) return params;
    return { ...params, [idKey]: '' };
  },
};

/**
 * Invalid ActionName.member.* (if exists)
 */
export const invalidActionName: Mutation = {
  name: 'invalid-action-name',
  description: 'Use invalid action name in ActionName parameter',
  apply: (params) => {
    const actionKey = Object.keys(params).find(k => k.startsWith('ActionName.member.'));
    if (!actionKey) return params;
    return { ...params, [actionKey]: 'NotARealAction' };
  },
};

/**
 * Remove ActionName.member.* (if exists)
 */
export const removeActionName: Mutation = {
  name: 'remove-action-name',
  description: 'Remove ActionName parameter',
  apply: (params) => {
    const actionKeys = Object.keys(params).filter(k => k.startsWith('ActionName.member.'));
    if (actionKeys.length === 0) return params;
    const result = { ...params };
    actionKeys.forEach(k => delete result[k]);
    return result;
  },
};

/**
 * Invalid Label (if exists) - use non-existent label
 */
export const invalidLabel: Mutation = {
  name: 'invalid-label',
  description: 'Use non-existent permission label',
  apply: (params) => {
    if (params.Label === undefined) return params;
    return { ...params, Label: 'non-existent-permission-label-12345' };
  },
};

/**
 * Empty Label (if exists)
 */
export const emptyLabel: Mutation = {
  name: 'empty-label',
  description: 'Set Label to empty string',
  apply: (params) => {
    if (params.Label === undefined) return params;
    return { ...params, Label: '' };
  },
};

/**
 * Remove Label parameter (if exists)
 */
export const removeLabel: Mutation = {
  name: 'remove-label',
  description: 'Remove Label parameter',
  apply: (params) => {
    if (params.Label === undefined) return params;
    const result = { ...params };
    delete result.Label;
    return result;
  },
};

/**
 * Label with special characters (if exists)
 */
export const specialCharLabel: Mutation = {
  name: 'special-char-label',
  description: 'Set Label with special characters',
  apply: (params) => {
    if (params.Label === undefined) return params;
    return { ...params, Label: '../../../etc/passwd' };
  },
};

/**
 * Invalid AttributeName (if exists)
 */
export const invalidAttributeName: Mutation = {
  name: 'invalid-attribute-name',
  description: 'Use invalid AttributeName',
  apply: (params) => {
    if (params.AttributeName === undefined) return params;
    return { ...params, AttributeName: 'NotARealAttribute' };
  },
};

/**
 * Remove AttributeName (if exists)
 */
export const removeAttributeName: Mutation = {
  name: 'remove-attribute-name',
  description: 'Remove AttributeName parameter',
  apply: (params) => {
    if (params.AttributeName === undefined) return params;
    const result = { ...params };
    delete result.AttributeName;
    return result;
  },
};

/**
 * Empty tag key (if Tags.member.*.Key exists)
 */
export const emptyTagKey: Mutation = {
  name: 'empty-tag-key',
  description: 'Set tag key to empty string',
  apply: (params) => {
    const tagKeyParam = Object.keys(params).find(k => k.match(/Tags\.member\.\d+\.Key/));
    if (!tagKeyParam) return params;
    return { ...params, [tagKeyParam]: '' };
  },
};

/**
 * Remove tag key (if Tags.member.*.Key exists)
 */
export const removeTagKey: Mutation = {
  name: 'remove-tag-key',
  description: 'Remove tag key parameter',
  apply: (params) => {
    const tagKeyParams = Object.keys(params).filter(k => k.match(/Tags\.member\.\d+\.Key/));
    if (tagKeyParams.length === 0) return params;
    const result = { ...params };
    tagKeyParams.forEach(k => delete result[k]);
    return result;
  },
};

/**
 * Non-existent tag key (GUID-like key for Tags.member.*.Key)
 */
export const nonExistentTag: Mutation = {
  name: 'nonexistent-tag',
  description: 'Set Tags.member.*.Key to a non-existent GUID-like key',
  apply: (params) => {
    const tagKeyParam = Object.keys(params).find(k => k.match(/Tags\.member\.\d+\.Key/));
    if (!tagKeyParam) return params;
    return { ...params, [tagKeyParam]: 'nonexistent-key-a1b2c3d4-e5f6-7890-abcd-ef1234567890' };
  },
};

/**
 * Remove all Tags.member.* params (if any exist)
 */
export const removeTags: Mutation = {
  name: 'remove-tags',
  description: 'Remove all Tags.member.* params',
  apply: (params) => {
    const tagParams = Object.keys(params).filter(k => k.startsWith('Tags.member.'));
    if (tagParams.length === 0) return params;
    const result = { ...params };
    tagParams.forEach(k => delete result[k]);
    return result;
  },
};

/**
 * Zero index for Tags (use member.0 instead of member.1)
 */
export const zeroIndexTag: Mutation = {
  name: 'zero-index-tag',
  description: 'Use Tags.member.0 instead of member.1',
  apply: (params) => {
    const tagParams = Object.keys(params).filter(k => k.match(/Tags\.member\.\d+\./));
    if (tagParams.length === 0) return params;
    const result = { ...params };
    tagParams.forEach(k => {
      const newKey = k.replace(/Tags\.member\.\d+\./, 'Tags.member.0.');
      result[newKey] = result[k];
      delete result[k];
    });
    return result;
  },
};

/**
 * Remove tag value field (keep .Key, remove .Value)
 */
export const removeTagValue: Mutation = {
  name: 'remove-tag-value',
  description: 'Remove Tags.member.*.Value param (keep Key)',
  apply: (params) => {
    const tagValueParams = Object.keys(params).filter(k => k.match(/Tags\.member\.\d+\.Value/));
    if (tagValueParams.length === 0) return params;
    const result = { ...params };
    tagValueParams.forEach(k => delete result[k]);
    return result;
  },
};

/**
 * Remove TagKeys.member.* (if exists)
 */
export const removeTagKeys: Mutation = {
  name: 'remove-tag-keys',
  description: 'Remove TagKeys parameter',
  apply: (params) => {
    const tagKeysParams = Object.keys(params).filter(k => k.startsWith('TagKeys.member.'));
    if (tagKeysParams.length === 0) return params;
    const result = { ...params };
    tagKeysParams.forEach(k => delete result[k]);
    return result;
  },
};

/**
 * Empty TagKeys.member.* value (if exists)
 */
export const emptyTagKeys: Mutation = {
  name: 'empty-tag-keys',
  description: 'Set TagKeys.member.1 to empty string',
  apply: (params) => {
    const tagKeysParam = Object.keys(params).find(k => k.startsWith('TagKeys.member.'));
    if (!tagKeysParam) return params;
    return { ...params, [tagKeysParam]: '' };
  },
};

/**
 * Non-existent TagKeys.member.* value (GUID-like key that doesn't exist)
 */
export const nonExistentTagKey: Mutation = {
  name: 'nonexistent-tag-key',
  description: 'Set TagKeys to a non-existent GUID-like key',
  apply: (params) => {
    const tagKeysParam = Object.keys(params).find(k => k.startsWith('TagKeys.member.'));
    if (!tagKeysParam) return params;
    return { ...params, [tagKeysParam]: 'nonexistent-key-a1b2c3d4-e5f6-7890-abcd-ef1234567890' };
  },
};

/**
 * Long TagKeys.member.* value (exceeds 128 char limit)
 */
export const longTagKeys: Mutation = {
  name: 'long-tag-keys',
  description: 'Set TagKeys.member.* to exceed max length (128)',
  apply: (params) => {
    const tagKeysParam = Object.keys(params).find(k => k.startsWith('TagKeys.member.'));
    if (!tagKeysParam) return params;
    return { ...params, [tagKeysParam]: 'x'.repeat(200) };
  },
};

/**
 * Zero index for TagKeys (use member.0 instead of member.1)
 */
export const zeroIndexTagKey: Mutation = {
  name: 'zero-index-tag-key',
  description: 'Use TagKeys.member.0 instead of member.1',
  apply: (params) => {
    const tagKeysParams = Object.keys(params).filter(k => k.match(/TagKeys\.member\.\d+/));
    if (tagKeysParams.length === 0) return params;
    const result = { ...params };
    tagKeysParams.forEach(k => {
      const newKey = k.replace(/TagKeys\.member\.\d+/, 'TagKeys.member.0');
      result[newKey] = result[k];
      delete result[k];
    });
    return result;
  },
};

/**
 * Invalid Protocol (if exists)
 */
export const invalidProtocol: Mutation = {
  name: 'invalid-protocol',
  description: 'Use invalid Protocol value',
  apply: (params) => {
    if (params.Protocol === undefined) return params;
    return { ...params, Protocol: 'not-a-protocol' };
  },
};

/**
 * Remove Protocol (if exists)
 */
export const removeProtocol: Mutation = {
  name: 'remove-protocol',
  description: 'Remove Protocol parameter',
  apply: (params) => {
    if (params.Protocol === undefined) return params;
    const result = { ...params };
    delete result.Protocol;
    return result;
  },
};

// --- JSON/Policy-based mutations ---

/**
 * Invalid JSON for DataProtectionPolicy (if exists)
 */
export const invalidJsonPolicy: Mutation = {
  name: 'invalid-json-policy',
  description: 'Set DataProtectionPolicy to invalid JSON',
  apply: (params) => {
    if (params.DataProtectionPolicy === undefined) return params;
    return { ...params, DataProtectionPolicy: '{not valid json' };
  },
};

/**
 * Empty JSON object for DataProtectionPolicy (if exists)
 */
export const emptyJsonPolicy: Mutation = {
  name: 'empty-json-policy',
  description: 'Set DataProtectionPolicy to empty JSON object',
  apply: (params) => {
    if (params.DataProtectionPolicy === undefined) return params;
    return { ...params, DataProtectionPolicy: '{}' };
  },
};

/**
 * Invalid policy structure (valid JSON but wrong schema)
 */
export const invalidPolicyStructure: Mutation = {
  name: 'invalid-policy-structure',
  description: 'Set DataProtectionPolicy to valid JSON with invalid structure',
  apply: (params) => {
    if (params.DataProtectionPolicy === undefined) return params;
    return { ...params, DataProtectionPolicy: JSON.stringify({ invalid: 'structure', foo: 'bar' }) };
  },
};

/**
 * Remove DataProtectionPolicy parameter (if exists)
 */
export const removeDataProtectionPolicy: Mutation = {
  name: 'remove-data-protection-policy',
  description: 'Remove DataProtectionPolicy parameter',
  apply: (params) => {
    if (params.DataProtectionPolicy === undefined) return params;
    const result = { ...params };
    delete result.DataProtectionPolicy;
    return result;
  },
};

// --- Length-based mutations ---

const LONG_STRING_200 = 'x'.repeat(200);  // Exceeds tag key limit (128)
const LONG_STRING_500 = 'x'.repeat(500);  // Exceeds tag value limit (256)
const LONG_STRING_1000 = 'x'.repeat(1000); // Very long

/**
 * Tag key too long (max 128 chars)
 */
export const longTagKey: Mutation = {
  name: 'long-tag-key',
  description: 'Set tag key to exceed max length (128)',
  apply: (params) => {
    const tagKeyParam = Object.keys(params).find(k => k.match(/Tags\.member\.\d+\.Key/));
    if (!tagKeyParam) return params;
    return { ...params, [tagKeyParam]: LONG_STRING_200 };
  },
};

/**
 * Tag value too long (max 256 chars)
 */
export const longTagValue: Mutation = {
  name: 'long-tag-value',
  description: 'Set tag value to exceed max length (256)',
  apply: (params) => {
    const tagValueParam = Object.keys(params).find(k => k.match(/Tags\.member\.\d+\.Value/));
    if (!tagValueParam) return params;
    return { ...params, [tagValueParam]: LONG_STRING_500 };
  },
};

/**
 * Label too long (if exists)
 */
export const longLabel: Mutation = {
  name: 'long-label',
  description: 'Set Label to exceed reasonable length',
  apply: (params) => {
    if (params.Label === undefined) return params;
    return { ...params, Label: LONG_STRING_200 };
  },
};

/**
 * AttributeValue too long (if exists)
 */
export const longAttributeValue: Mutation = {
  name: 'long-attribute-value',
  description: 'Set AttributeValue to very long string',
  apply: (params) => {
    if (params.AttributeValue === undefined) return params;
    return { ...params, AttributeValue: LONG_STRING_1000 };
  },
};

/**
 * Invalid SignatureVersion value (only valid values are "1" or "2")
 */
export const invalidSignatureVersion: Mutation = {
  name: 'invalid-signature-version',
  description: 'Set SignatureVersion to invalid value (99)',
  apply: (params) => {
    if (params.AttributeName !== 'SignatureVersion') return params;
    return { ...params, AttributeValue: '99' };
  },
};

/**
 * Endpoint too long (if exists)
 */
export const longEndpoint: Mutation = {
  name: 'long-endpoint',
  description: 'Set Endpoint to very long URL',
  apply: (params) => {
    if (params.Endpoint === undefined) return params;
    return { ...params, Endpoint: `https://example.com/${'x'.repeat(2000)}` };
  },
};

/**
 * Subject too long for Publish (max 100 chars)
 */
export const longSubject: Mutation = {
  name: 'long-subject',
  description: 'Add Subject parameter exceeding max length (100)',
  apply: (params) => {
    // Only apply to Publish action
    if (params.Action !== 'Publish') return params;
    return { ...params, Subject: LONG_STRING_200 };
  },
};

/**
 * Default set of mutations to try (structure-based)
 * NOTE: We intentionally do NOT mutate TopicArn/ResourceArn because
 * AWS needs the correct target ARN to perform authorization checks.
 * Only OTHER parameters (like Endpoint) can be mutated.
 */
export const defaultMutations: Mutation[] = [
  removeAction,
  removeVersion,
];

/**
 * Parameter-based mutations (applied if param exists in request)
 */
export const parameterMutations: Mutation[] = [
  // Message param (Publish)
  removeMessage,
  emptyMessage,
  // PublishBatch params
  removeBatchMessage,
  emptyBatchMessage,
  removeBatchId,
  emptyBatchId,
  // Endpoint param
  endpointToArn,
  longEndpoint,
  // Protocol param
  invalidProtocol,
  removeProtocol,
  // ActionName.member.* params
  invalidActionName,
  removeActionName,
  // Label param
  invalidLabel,
  emptyLabel,
  removeLabel,
  specialCharLabel,
  longLabel,
  // AttributeName/AttributeValue params
  invalidAttributeName,
  removeAttributeName,
  longAttributeValue,
  invalidSignatureVersion,
  // Tags.member.*.Key/Value params (TagResource)
  nonExistentTag,
  removeTags,
  emptyTagKey,
  longTagKey,
  zeroIndexTag,
  removeTagKey,
  removeTagValue,
  longTagValue,
  // TagKeys.member.* params (UntagResource)
  nonExistentTagKey,
  removeTagKeys,
  emptyTagKeys,
  longTagKeys,
  zeroIndexTagKey,
  // Publish-specific
  longSubject,
  // DataProtectionPolicy param
  invalidJsonPolicy,
  emptyJsonPolicy,
  invalidPolicyStructure,
  removeDataProtectionPolicy,
];

/**
 * Get all mutations to try for a given action.
 * Returns default mutations + all parameter-based mutations.
 * Parameter mutations return unchanged params if the param doesn't exist.
 */
export function getMutationsForAction(_actionName: string): Mutation[] {
  return [...defaultMutations, ...parameterMutations];
}

/**
 * Check if mutation actually changed the params
 */
export function didMutationChangeParams(
  original: Record<string, string>,
  mutated: Record<string, string>
): boolean {
  const origKeys = Object.keys(original).sort();
  const mutKeys = Object.keys(mutated).sort();

  if (origKeys.length !== mutKeys.length) return true;
  if (origKeys.join(',') !== mutKeys.join(',')) return true;

  for (const key of origKeys) {
    if (original[key] !== mutated[key]) return true;
  }
  return false;
}
