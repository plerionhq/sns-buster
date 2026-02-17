import type { Credentials } from './types';
import { signRequest, buildUnsignedRequest } from '../http/signer';
import { sendRequest } from '../http/client';
import { DEFAULT_USER_AGENT } from '../utils/constants';

const STS_API_VERSION = '2011-06-15';

export interface AssumeRoleOptions {
  roleArn: string;
  sessionName?: string;
  sessionPolicy?: string;
}

export interface AssumeRoleResult {
  success: boolean;
  credentials?: Credentials;
  assumedRoleArn?: string;
  error?: string;
}

export async function assumeRoleWithPolicy(
  credentials: Credentials,
  region: string,
  options: AssumeRoleOptions
): Promise<AssumeRoleResult> {
  const endpoint = `https://sts.${region}.amazonaws.com`;
  const sessionName = options.sessionName || `sns-buster-${Date.now()}`;

  const params: Record<string, string> = {
    Action: 'AssumeRole',
    Version: STS_API_VERSION,
    RoleArn: options.roleArn,
    RoleSessionName: sessionName,
  };

  if (options.sessionPolicy) {
    params.Policy = options.sessionPolicy;
  }

  const unsignedRequest = buildUnsignedRequest(endpoint, params, DEFAULT_USER_AGENT);

  const signedRequest = signRequest(unsignedRequest, {
    service: 'sts',
    region,
    credentials,
  });

  try {
    const result = await sendRequest(signedRequest);

    if (result.response.status === 200) {
      const parsed = parseAssumeRoleResponse(result.response.body);
      if (parsed) {
        return {
          success: true,
          credentials: parsed.credentials,
          assumedRoleArn: parsed.assumedRoleArn,
        };
      }
      return { success: false, error: 'Failed to parse AssumeRole response' };
    }

    const error = parseErrorMessage(result.response.body);
    return { success: false, error: error || `HTTP ${result.response.status}` };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

interface ParsedAssumeRole {
  credentials: Credentials;
  assumedRoleArn: string;
}

function parseAssumeRoleResponse(body: string): ParsedAssumeRole | null {
  const accessKeyIdMatch = body.match(/<AccessKeyId>([^<]+)<\/AccessKeyId>/);
  const secretAccessKeyMatch = body.match(/<SecretAccessKey>([^<]+)<\/SecretAccessKey>/);
  const sessionTokenMatch = body.match(/<SessionToken>([^<]+)<\/SessionToken>/);
  const arnMatch = body.match(/<Arn>([^<]+)<\/Arn>/);

  if (accessKeyIdMatch && secretAccessKeyMatch && sessionTokenMatch) {
    return {
      credentials: {
        accessKeyId: accessKeyIdMatch[1],
        secretAccessKey: secretAccessKeyMatch[1],
        sessionToken: sessionTokenMatch[1],
      },
      assumedRoleArn: arnMatch ? arnMatch[1] : '',
    };
  }

  return null;
}

function parseErrorMessage(body: string): string | null {
  const messageMatch = body.match(/<Message>([^<]+)<\/Message>/);
  if (messageMatch) {
    return messageMatch[1];
  }

  const errorMatch = body.match(/<Code>([^<]+)<\/Code>/);
  if (errorMatch) {
    return errorMatch[1];
  }

  return null;
}

export const DENY_ALL_POLICY = JSON.stringify({
  Version: '2012-10-17',
  Statement: [
    {
      Effect: 'Deny',
      Action: '*',
      Resource: '*',
    },
  ],
});
