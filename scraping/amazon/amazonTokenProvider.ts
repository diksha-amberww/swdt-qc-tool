import { readProjectEnv } from '../../shared/envUtils';

export interface AmazonCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  region: 'NA' | 'EU' | 'FE';
  marketplaceId: string;
}

const REGION_HOSTS: Record<string, string> = {
  NA: 'https://sellingpartnerapi-na.amazon.com',
  EU: 'https://sellingpartnerapi-eu.amazon.com',
  FE: 'https://sellingpartnerapi-fe.amazon.com',
};

const DEFAULT_MARKETPLACE: Record<string, string> = {
  NA: 'ATVPDKIKX0DER',
  EU: 'A1F83G8C2ARO7P',
  FE: 'A1VC38T7YXB528',
};

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

export function resolveAmazonCredentials(cwd?: string): AmazonCredentials {
  const env = readProjectEnv(cwd);
  const region = (env.SP_API_REGION || 'NA').toUpperCase() as AmazonCredentials['region'];
  const safeRegion = REGION_HOSTS[region] ? region : 'NA';
  return {
    clientId: env.SP_API_CLIENT_ID || '',
    clientSecret: env.SP_API_CLIENT_SECRET || '',
    refreshToken: env.SP_API_REFRESH_TOKEN || '',
    region: safeRegion,
    marketplaceId: env.SP_API_MARKETPLACE_ID || DEFAULT_MARKETPLACE[safeRegion],
  };
}

export function amazonApiHost(region: AmazonCredentials['region']): string {
  return REGION_HOSTS[region] || REGION_HOSTS.NA;
}

export async function getAmazonAccessToken(
  creds: AmazonCredentials = resolveAmazonCredentials(),
): Promise<{ accessToken: string; expiresIn: number }> {
  if (!creds.clientId || !creds.clientSecret || !creds.refreshToken) {
    throw new Error('Amazon SP-API credentials missing. Save Client ID, Secret, and Refresh Token on Credentials.');
  }

  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return { accessToken: cachedToken.accessToken, expiresIn: Math.floor((cachedToken.expiresAt - Date.now()) / 1000) };
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: creds.refreshToken,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
  });

  const response = await fetch('https://api.amazon.com/auth/o2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const json = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || `LWA token refresh failed (HTTP ${response.status})`);
  }

  const expiresIn = json.expires_in || 3600;
  cachedToken = {
    accessToken: json.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
  };
  return { accessToken: json.access_token, expiresIn };
}

export function clearAmazonTokenCache(): void {
  cachedToken = null;
}

export async function testAmazonTokenRefresh(
  creds: AmazonCredentials = resolveAmazonCredentials(),
): Promise<{ success: boolean; message: string; responseTimeMs: number; endpoint: string }> {
  const started = Date.now();
  try {
    await getAmazonAccessToken(creds);
    return {
      success: true,
      message: 'Amazon LWA refresh token accepted. SP-API access token issued.',
      responseTimeMs: Date.now() - started,
      endpoint: amazonApiHost(creds.region),
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : String(err),
      responseTimeMs: Date.now() - started,
      endpoint: amazonApiHost(creds.region),
    };
  }
}
