export interface VendorCredentials {
  portalUrl: string;
  email: string;
  password: string;
  companyName: string;
  isConnected: boolean;
  lastTestedAt?: string;
}

export interface AmazonSpApiCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  region: 'NA' | 'EU' | 'FE';
  sellerId?: string;
  isConnected: boolean;
  lastTestedAt?: string;
}

export interface ClaudeAiCredentials {
  apiKey: string;
  model: string;
  endpointUrl?: string;
  isConnected: boolean;
  lastTestedAt?: string;
}

export interface EmailAlertCredentials {
  senderEmail: string;
  gmailAppPassword: string;
  recipientAlertEmail: string;
  smtpHost: string;
  smtpPort: number;
  isConnected: boolean;
  lastTestedAt?: string;
}

export interface AppCredentialsState {
  vendor: VendorCredentials;
  amazon: AmazonSpApiCredentials;
  claude: ClaudeAiCredentials;
  email: EmailAlertCredentials;
}
