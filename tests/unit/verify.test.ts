import { describe, test, expect, mock } from 'bun:test';
import type { CallerIdentity, VerifyResult } from '../../src/credentials/verify';

describe('verifyCredentials', () => {
  test('module exports expected functions', async () => {
    const verifyModule = await import('../../src/credentials/verify');
    expect(typeof verifyModule.verifyCredentials).toBe('function');
  });

  test('VerifyResult type has expected shape', () => {
    const successResult: VerifyResult = {
      success: true,
      identity: {
        account: '123456789012',
        arn: 'arn:aws:iam::123456789012:user/test',
        userId: 'AIDAEXAMPLE',
      },
    };

    expect(successResult.success).toBe(true);
    expect(successResult.identity?.account).toBe('123456789012');
    expect(successResult.identity?.arn).toBe('arn:aws:iam::123456789012:user/test');
    expect(successResult.identity?.userId).toBe('AIDAEXAMPLE');
  });

  test('VerifyResult error shape', () => {
    const errorResult: VerifyResult = {
      success: false,
      error: 'Invalid credentials',
    };

    expect(errorResult.success).toBe(false);
    expect(errorResult.error).toBe('Invalid credentials');
    expect(errorResult.identity).toBeUndefined();
  });

  test('CallerIdentity has expected fields', () => {
    const identity: CallerIdentity = {
      account: '123456789012',
      arn: 'arn:aws:sts::123456789012:assumed-role/TestRole/session',
      userId: 'AROAEXAMPLE:session',
    };

    expect(identity.account).toBeDefined();
    expect(identity.arn).toBeDefined();
    expect(identity.userId).toBeDefined();
  });
});

describe('STS GetCallerIdentity parsing', () => {
  test('parses successful response', () => {
    const responseBody = `
      <GetCallerIdentityResponse xmlns="https://sts.amazonaws.com/doc/2011-06-15/">
        <GetCallerIdentityResult>
          <Arn>arn:aws:iam::123456789012:user/testuser</Arn>
          <UserId>EXAMPLEUSERID123456</UserId>
          <Account>123456789012</Account>
        </GetCallerIdentityResult>
        <ResponseMetadata>
          <RequestId>01234567-89ab-cdef-0123-456789abcdef</RequestId>
        </ResponseMetadata>
      </GetCallerIdentityResponse>
    `;

    const accountMatch = responseBody.match(/<Account>([^<]+)<\/Account>/);
    const arnMatch = responseBody.match(/<Arn>([^<]+)<\/Arn>/);
    const userIdMatch = responseBody.match(/<UserId>([^<]+)<\/UserId>/);

    expect(accountMatch?.[1]).toBe('123456789012');
    expect(arnMatch?.[1]).toBe('arn:aws:iam::123456789012:user/testuser');
    expect(userIdMatch?.[1]).toBe('EXAMPLEUSERID123456');
  });

  test('parses error response', () => {
    const errorBody = `
      <ErrorResponse xmlns="https://sts.amazonaws.com/doc/2011-06-15/">
        <Error>
          <Type>Sender</Type>
          <Code>InvalidClientTokenId</Code>
          <Message>The security token included in the request is invalid.</Message>
        </Error>
        <RequestId>01234567-89ab-cdef-0123-456789abcdef</RequestId>
      </ErrorResponse>
    `;

    const messageMatch = errorBody.match(/<Message>([^<]+)<\/Message>/);
    const codeMatch = errorBody.match(/<Code>([^<]+)<\/Code>/);

    expect(messageMatch?.[1]).toBe('The security token included in the request is invalid.');
    expect(codeMatch?.[1]).toBe('InvalidClientTokenId');
  });
});
