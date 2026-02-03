import { describe, test, expect } from 'bun:test';
import {
  formatHttpRequest,
  formatHttpResponse,
  formatRequestResult,
} from '../../src/http/client';
import type { HttpRequest, HttpResponse, RequestResult } from '../../src/http/types';

describe('formatHttpRequest', () => {
  test('formats basic POST request', () => {
    const request: HttpRequest = {
      method: 'POST',
      url: 'https://sns.us-east-1.amazonaws.com/',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'Action=Test',
    };

    const formatted = formatHttpRequest(request);

    expect(formatted).toContain('POST / HTTP/1.1');
    expect(formatted).toContain('Host: sns.us-east-1.amazonaws.com');
    expect(formatted).toContain('Content-Type: application/x-www-form-urlencoded');
    expect(formatted).toContain('Action=Test');
  });

  test('formats request with multiple headers', () => {
    const request: HttpRequest = {
      method: 'POST',
      url: 'https://sns.us-east-1.amazonaws.com/',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'TestAgent/1.0',
        'X-Amz-Date': '20260113T120000Z',
      },
      body: 'Action=Test',
    };

    const formatted = formatHttpRequest(request);

    expect(formatted).toContain('Content-Type: application/x-www-form-urlencoded');
    expect(formatted).toContain('User-Agent: TestAgent/1.0');
    expect(formatted).toContain('X-Amz-Date: 20260113T120000Z');
  });

  test('handles request without body', () => {
    const request: HttpRequest = {
      method: 'GET',
      url: 'https://sns.us-east-1.amazonaws.com/',
      headers: {},
    };

    const formatted = formatHttpRequest(request);

    expect(formatted).toContain('GET / HTTP/1.1');
    expect(formatted).toContain('Host: sns.us-east-1.amazonaws.com');
  });

  test('includes URL path', () => {
    const request: HttpRequest = {
      method: 'POST',
      url: 'https://sns.us-east-1.amazonaws.com/some/path',
      headers: {},
      body: 'test',
    };

    const formatted = formatHttpRequest(request);

    expect(formatted).toContain('POST /some/path HTTP/1.1');
  });

  test('does not duplicate Host header', () => {
    const request: HttpRequest = {
      method: 'POST',
      url: 'https://sns.us-east-1.amazonaws.com/',
      headers: {
        'Host': 'sns.us-east-1.amazonaws.com',
        'Content-Type': 'text/plain',
      },
      body: 'test',
    };

    const formatted = formatHttpRequest(request);
    const hostMatches = formatted.match(/Host:/g);

    expect(hostMatches?.length).toBe(1);
  });

  test('redacts X-Amz-Security-Token header', () => {
    const request: HttpRequest = {
      method: 'POST',
      url: 'https://sns.us-east-1.amazonaws.com/',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Amz-Security-Token': 'IQoJb3JpZ2luX2VjEDMSecretTokenValue123',
        'X-Amz-Date': '20260113T120000Z',
      },
      body: 'Action=Test',
    };

    const formatted = formatHttpRequest(request);

    expect(formatted).toContain('X-Amz-Security-Token: [REDACTED]');
    expect(formatted).not.toContain('IQoJb3JpZ2luX2VjEDMSecretTokenValue123');
  });
});

describe('formatHttpResponse', () => {
  test('formats basic response', () => {
    const response: HttpResponse = {
      status: 200,
      statusText: 'OK',
      headers: {
        'content-type': 'text/xml',
      },
      body: '<Response>OK</Response>',
    };

    const formatted = formatHttpResponse(response);

    expect(formatted).toContain('HTTP/1.1 200 OK');
    expect(formatted).toContain('content-type: text/xml');
    expect(formatted).toContain('<Response>OK</Response>');
  });

  test('formats error response', () => {
    const response: HttpResponse = {
      status: 403,
      statusText: 'Forbidden',
      headers: {
        'content-type': 'text/xml',
      },
      body: '<ErrorResponse><Error><Code>AuthorizationError</Code></Error></ErrorResponse>',
    };

    const formatted = formatHttpResponse(response);

    expect(formatted).toContain('HTTP/1.1 403 Forbidden');
    expect(formatted).toContain('AuthorizationError');
  });

  test('formats response with multiple headers', () => {
    const response: HttpResponse = {
      status: 200,
      statusText: 'OK',
      headers: {
        'content-type': 'text/xml',
        'x-amzn-requestid': 'abc123',
        'date': 'Mon, 13 Jan 2026 12:00:00 GMT',
      },
      body: '<Response/>',
    };

    const formatted = formatHttpResponse(response);

    expect(formatted).toContain('content-type: text/xml');
    expect(formatted).toContain('x-amzn-requestid: abc123');
    expect(formatted).toContain('date: Mon, 13 Jan 2026 12:00:00 GMT');
  });

  test('handles empty body', () => {
    const response: HttpResponse = {
      status: 204,
      statusText: 'No Content',
      headers: {},
      body: '',
    };

    const formatted = formatHttpResponse(response);

    expect(formatted).toContain('HTTP/1.1 204 No Content');
  });
});

describe('formatRequestResult', () => {
  test('combines request and response with separator', () => {
    const result: RequestResult = {
      request: {
        method: 'POST',
        url: 'https://sns.us-east-1.amazonaws.com/',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'Action=GetTopicAttributes',
      },
      response: {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/xml' },
        body: '<GetTopicAttributesResponse/>',
      },
      duration: 150,
    };

    const formatted = formatRequestResult(result);

    expect(formatted).toContain('POST / HTTP/1.1');
    expect(formatted).toContain('Action=GetTopicAttributes');
    expect(formatted).toContain('---');
    expect(formatted).toContain('HTTP/1.1 200 OK');
    expect(formatted).toContain('<GetTopicAttributesResponse/>');
  });

  test('request comes before response', () => {
    const result: RequestResult = {
      request: {
        method: 'POST',
        url: 'https://sns.us-east-1.amazonaws.com/',
        headers: {},
        body: 'Action=Test',
      },
      response: {
        status: 403,
        statusText: 'Forbidden',
        headers: {},
        body: 'Error',
      },
      duration: 100,
    };

    const formatted = formatRequestResult(result);
    const requestIndex = formatted.indexOf('POST');
    const responseIndex = formatted.indexOf('HTTP/1.1 403');

    expect(requestIndex).toBeLessThan(responseIndex);
  });
});
