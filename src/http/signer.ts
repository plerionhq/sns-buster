import aws4 from 'aws4';
import type { Credentials } from '../credentials/types';
import type { HttpRequest } from './types';

export interface SigningOptions {
  service: string;
  region: string;
  credentials: Credentials;
}

export function signRequest(request: HttpRequest, options: SigningOptions): HttpRequest {
  const url = new URL(request.url);

  const aws4Request: aws4.Request = {
    host: url.host,
    path: url.pathname + url.search,
    method: request.method,
    headers: { ...request.headers },
    body: request.body,
    service: options.service,
    region: options.region,
  };

  const signedRequest = aws4.sign(aws4Request, {
    accessKeyId: options.credentials.accessKeyId,
    secretAccessKey: options.credentials.secretAccessKey,
    sessionToken: options.credentials.sessionToken,
  });

  return {
    method: request.method,
    url: request.url,
    headers: signedRequest.headers as Record<string, string>,
    body: request.body,
  };
}

export function buildUnsignedRequest(
  endpoint: string,
  params: Record<string, string>,
  userAgent: string
): HttpRequest {
  const body = new URLSearchParams(params).toString();

  return {
    method: 'POST',
    url: endpoint,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': userAgent,
      'Content-Length': Buffer.byteLength(body).toString(),
    },
    body,
  };
}
