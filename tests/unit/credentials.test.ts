import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { EnvironmentCredentialProvider, loadCredentials } from '../../src/credentials';

describe('EnvironmentCredentialProvider', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear relevant env vars before each test
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_SESSION_TOKEN;
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  test('returns null when no credentials in environment', async () => {
    const provider = new EnvironmentCredentialProvider();
    const credentials = await provider.getCredentials();

    expect(credentials).toBeNull();
  });

  test('returns null when only access key is set', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';

    const provider = new EnvironmentCredentialProvider();
    const credentials = await provider.getCredentials();

    expect(credentials).toBeNull();
  });

  test('returns null when only secret key is set', async () => {
    process.env.AWS_SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';

    const provider = new EnvironmentCredentialProvider();
    const credentials = await provider.getCredentials();

    expect(credentials).toBeNull();
  });

  test('returns credentials when access key and secret are set', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';
    process.env.AWS_SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';

    const provider = new EnvironmentCredentialProvider();
    const credentials = await provider.getCredentials();

    expect(credentials).not.toBeNull();
    expect(credentials!.accessKeyId).toBe('AKIAIOSFODNN7EXAMPLE');
    expect(credentials!.secretAccessKey).toBe('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');
    expect(credentials!.sessionToken).toBeUndefined();
  });

  test('includes session token when set', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';
    process.env.AWS_SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
    process.env.AWS_SESSION_TOKEN = 'AQoDYXdzEJr...';

    const provider = new EnvironmentCredentialProvider();
    const credentials = await provider.getCredentials();

    expect(credentials!.sessionToken).toBe('AQoDYXdzEJr...');
  });

  test('handles empty session token as undefined', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';
    process.env.AWS_SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
    process.env.AWS_SESSION_TOKEN = '';

    const provider = new EnvironmentCredentialProvider();
    const credentials = await provider.getCredentials();

    expect(credentials!.sessionToken).toBeUndefined();
  });
});

describe('loadCredentials', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_SESSION_TOKEN;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('returns credentials from environment', async () => {
    process.env.AWS_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';
    process.env.AWS_SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';

    const credentials = await loadCredentials();

    expect(credentials).not.toBeNull();
    expect(credentials!.accessKeyId).toBe('AKIAIOSFODNN7EXAMPLE');
  });

  test('returns null when no credentials available', async () => {
    const credentials = await loadCredentials();

    expect(credentials).toBeNull();
  });
});
