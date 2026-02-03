import type { Credentials, CredentialProvider } from './types';

export class EnvironmentCredentialProvider implements CredentialProvider {
  async getCredentials(): Promise<Credentials | null> {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const sessionToken = process.env.AWS_SESSION_TOKEN;

    if (!accessKeyId || !secretAccessKey) {
      return null;
    }

    return {
      accessKeyId,
      secretAccessKey,
      sessionToken: sessionToken || undefined,
    };
  }
}

export async function loadCredentials(): Promise<Credentials | null> {
  const provider = new EnvironmentCredentialProvider();
  return provider.getCredentials();
}

export * from './types';
