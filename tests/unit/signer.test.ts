import { describe, test, expect, beforeEach } from 'bun:test';
import { signRequest, buildUnsignedRequest } from '../../src/http/signer';
import type { Credentials } from '../../src/credentials/types';
import type { HttpRequest } from '../../src/http/types';

describe('buildUnsignedRequest', () => {
  test('builds request with correct content type', () => {
    const request = buildUnsignedRequest(
      'https://sns.us-east-1.amazonaws.com',
      { Action: 'GetTopicAttributes', TopicArn: 'arn:aws:sns:us-east-1:123456789012:topic' },
      'TestAgent/1.0'
    );

    expect(request.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
  });

  test('builds request with custom user agent', () => {
    const request = buildUnsignedRequest(
      'https://sns.us-east-1.amazonaws.com',
      { Action: 'GetTopicAttributes' },
      'CustomAgent/1.0'
    );

    expect(request.headers['User-Agent']).toBe('CustomAgent/1.0');
  });

  test('encodes parameters in body', () => {
    const request = buildUnsignedRequest(
      'https://sns.us-east-1.amazonaws.com',
      {
        Action: 'GetTopicAttributes',
        TopicArn: 'arn:aws:sns:us-east-1:123456789012:my-topic',
        Version: '2010-03-31'
      },
      'TestAgent/1.0'
    );

    expect(request.body).toContain('Action=GetTopicAttributes');
    expect(request.body).toContain('TopicArn=arn%3Aaws%3Asns%3Aus-east-1%3A123456789012%3Amy-topic');
    expect(request.body).toContain('Version=2010-03-31');
  });

  test('sets correct content length', () => {
    const request = buildUnsignedRequest(
      'https://sns.us-east-1.amazonaws.com',
      { Action: 'Test' },
      'TestAgent/1.0'
    );

    const expectedLength = Buffer.byteLength(request.body!);
    expect(request.headers['Content-Length']).toBe(expectedLength.toString());
  });

  test('uses POST method', () => {
    const request = buildUnsignedRequest(
      'https://sns.us-east-1.amazonaws.com',
      { Action: 'Test' },
      'TestAgent/1.0'
    );

    expect(request.method).toBe('POST');
  });

  test('handles special characters in parameters', () => {
    const request = buildUnsignedRequest(
      'https://sns.us-east-1.amazonaws.com',
      {
        Message: 'Hello World! Special chars: &=?#'
      },
      'TestAgent/1.0'
    );

    expect(request.body).toContain('Message=Hello+World');
    expect(request.body).toContain('%26'); // encoded &
    expect(request.body).toContain('%3D'); // encoded =
  });
});

describe('signRequest', () => {
  const testCredentials: Credentials = {
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  };

  const testCredentialsWithSession: Credentials = {
    ...testCredentials,
    sessionToken: 'AQoDYXdzEJr...',
  };

  test('adds Authorization header', () => {
    const request: HttpRequest = {
      method: 'POST',
      url: 'https://sns.us-east-1.amazonaws.com',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'Action=GetTopicAttributes',
    };

    const signed = signRequest(request, {
      service: 'sns',
      region: 'us-east-1',
      credentials: testCredentials,
    });

    expect(signed.headers['Authorization']).toBeDefined();
    expect(signed.headers['Authorization']).toContain('AWS4-HMAC-SHA256');
    expect(signed.headers['Authorization']).toContain('Credential=');
    expect(signed.headers['Authorization']).toContain('SignedHeaders=');
    expect(signed.headers['Authorization']).toContain('Signature=');
  });

  test('adds X-Amz-Date header', () => {
    const request: HttpRequest = {
      method: 'POST',
      url: 'https://sns.us-east-1.amazonaws.com',
      headers: {},
      body: 'Action=Test',
    };

    const signed = signRequest(request, {
      service: 'sns',
      region: 'us-east-1',
      credentials: testCredentials,
    });

    expect(signed.headers['X-Amz-Date']).toBeDefined();
    expect(signed.headers['X-Amz-Date']).toMatch(/^\d{8}T\d{6}Z$/);
  });

  test('adds X-Amz-Security-Token when session token provided', () => {
    const request: HttpRequest = {
      method: 'POST',
      url: 'https://sns.us-east-1.amazonaws.com',
      headers: {},
      body: 'Action=Test',
    };

    const signed = signRequest(request, {
      service: 'sns',
      region: 'us-east-1',
      credentials: testCredentialsWithSession,
    });

    expect(signed.headers['X-Amz-Security-Token']).toBe(testCredentialsWithSession.sessionToken!);
  });

  test('does not add X-Amz-Security-Token when no session token', () => {
    const request: HttpRequest = {
      method: 'POST',
      url: 'https://sns.us-east-1.amazonaws.com',
      headers: {},
      body: 'Action=Test',
    };

    const signed = signRequest(request, {
      service: 'sns',
      region: 'us-east-1',
      credentials: testCredentials,
    });

    expect(signed.headers['X-Amz-Security-Token']).toBeUndefined();
  });

  test('preserves original headers', () => {
    const request: HttpRequest = {
      method: 'POST',
      url: 'https://sns.us-east-1.amazonaws.com',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'TestAgent/1.0',
      },
      body: 'Action=Test',
    };

    const signed = signRequest(request, {
      service: 'sns',
      region: 'us-east-1',
      credentials: testCredentials,
    });

    expect(signed.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(signed.headers['User-Agent']).toBe('TestAgent/1.0');
  });

  test('preserves request body', () => {
    const body = 'Action=GetTopicAttributes&TopicArn=test';
    const request: HttpRequest = {
      method: 'POST',
      url: 'https://sns.us-east-1.amazonaws.com',
      headers: {},
      body,
    };

    const signed = signRequest(request, {
      service: 'sns',
      region: 'us-east-1',
      credentials: testCredentials,
    });

    expect(signed.body).toBe(body);
  });

  test('includes region in Authorization header', () => {
    const request: HttpRequest = {
      method: 'POST',
      url: 'https://sns.eu-west-1.amazonaws.com',
      headers: {},
      body: 'Action=Test',
    };

    const signed = signRequest(request, {
      service: 'sns',
      region: 'eu-west-1',
      credentials: testCredentials,
    });

    expect(signed.headers['Authorization']).toContain('eu-west-1');
  });

  test('includes service in Authorization header', () => {
    const request: HttpRequest = {
      method: 'POST',
      url: 'https://sns.us-east-1.amazonaws.com',
      headers: {},
      body: 'Action=Test',
    };

    const signed = signRequest(request, {
      service: 'sns',
      region: 'us-east-1',
      credentials: testCredentials,
    });

    expect(signed.headers['Authorization']).toContain('/sns/');
  });
});
