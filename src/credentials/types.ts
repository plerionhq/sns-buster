export interface Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

export interface CredentialProvider {
  getCredentials(): Promise<Credentials | null>;
}
