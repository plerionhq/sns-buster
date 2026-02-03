import type { Credentials } from './types';
import type { HttpRequest } from '../http/types';
import { signRequest, buildUnsignedRequest } from '../http/signer';
import { sendRequest } from '../http/client';
import { DEFAULT_USER_AGENT } from '../utils/constants';

export interface CallerIdentity {
  account: string;
  arn: string;
  userId: string;
}

export interface VerifyResult {
  success: boolean;
  identity?: CallerIdentity;
  error?: string;
}

const STS_API_VERSION = '2011-06-15';

export async function verifyCredentials(
  credentials: Credentials,
  region: string
): Promise<VerifyResult> {
  const endpoint = `https://sts.${region}.amazonaws.com`;

  const params: Record<string, string> = {
    Action: 'GetCallerIdentity',
    Version: STS_API_VERSION,
  };

  const unsignedRequest = buildUnsignedRequest(endpoint, params, DEFAULT_USER_AGENT);

  const signedRequest = signRequest(unsignedRequest, {
    service: 'sts',
    region,
    credentials,
  });

  try {
    const result = await sendRequest(signedRequest);

    if (result.response.status === 200) {
      const identity = parseCallerIdentity(result.response.body);
      if (identity) {
        return { success: true, identity };
      }
      return { success: false, error: 'Failed to parse identity response' };
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

function parseCallerIdentity(body: string): CallerIdentity | null {
  const accountMatch = body.match(/<Account>([^<]+)<\/Account>/);
  const arnMatch = body.match(/<Arn>([^<]+)<\/Arn>/);
  const userIdMatch = body.match(/<UserId>([^<]+)<\/UserId>/);

  if (accountMatch && arnMatch && userIdMatch) {
    return {
      account: accountMatch[1],
      arn: arnMatch[1],
      userId: userIdMatch[1],
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
