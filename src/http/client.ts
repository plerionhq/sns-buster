import type { HttpRequest, HttpResponse, RequestResult } from './types';

export async function sendRequest(request: HttpRequest): Promise<RequestResult> {
  const startTime = Date.now();

  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });

  const responseBody = await response.text();
  const duration = Date.now() - startTime;

  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  return {
    request,
    response: {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
    },
    duration,
  };
}

export function formatHttpRequest(request: HttpRequest): string {
  const url = new URL(request.url);
  const lines: string[] = [];

  lines.push(`${request.method} ${url.pathname || '/'} HTTP/1.1`);
  lines.push(`Host: ${url.host}`);

  for (const [key, value] of Object.entries(request.headers)) {
    if (key.toLowerCase() !== 'host') {
      // Redact security token to avoid leaking credentials in logs
      const outputValue = key.toLowerCase() === 'x-amz-security-token' ? '[REDACTED]' : value;
      lines.push(`${key}: ${outputValue}`);
    }
  }

  lines.push('');

  if (request.body) {
    lines.push(request.body);
  }

  return lines.join('\r\n');
}

export function formatHttpResponse(response: HttpResponse): string {
  const lines: string[] = [];

  lines.push(`HTTP/1.1 ${response.status} ${response.statusText}`);

  for (const [key, value] of Object.entries(response.headers)) {
    lines.push(`${key}: ${value}`);
  }

  lines.push('');
  lines.push(response.body);

  return lines.join('\r\n');
}

export function formatRequestResult(result: RequestResult): string {
  const requestStr = formatHttpRequest(result.request);
  const responseStr = formatHttpResponse(result.response);

  return `${requestStr}\r\n\r\n---\r\n\r\n${responseStr}`;
}
