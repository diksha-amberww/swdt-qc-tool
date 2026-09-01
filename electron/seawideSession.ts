import { session } from 'electron';
import {
  checkSeawideSessionAuth,
  SEAWIDE_LOGIN_URL,
  SEAWIDE_PERSIST_PARTITION,
  SeawideLoginProgress,
  SeawideLoginResult,
  testSeawideLoginBrowser,
} from './seawideLogin';

export interface VendorSessionStatus {
  authenticated: boolean;
  welcomeText?: string;
  url?: string;
  title?: string;
  reason?: string;
}

export interface EnsureVendorSessionResult extends SeawideLoginResult {
  reused?: boolean;
}

export interface EnsureVendorSessionOptions {
  username: string;
  password: string;
  loginUrl?: string;
  reuseSession?: boolean;
  onProgress?: (progress: SeawideLoginProgress) => void;
}

let inMemorySessionReady = false;

export function markVendorSessionReady(ready: boolean): void {
  inMemorySessionReady = ready;
}

export function isVendorSessionReadyInMemory(): boolean {
  return inMemorySessionReady;
}

export async function getVendorSessionStatus(): Promise<VendorSessionStatus> {
  return checkSeawideSessionAuth(SEAWIDE_PERSIST_PARTITION);
}

export async function clearVendorSession(): Promise<void> {
  inMemorySessionReady = false;
  const ses = session.fromPartition(SEAWIDE_PERSIST_PARTITION);
  await ses.clearStorageData().catch(() => {});
}

/**
 * Ensure a persistent authenticated Seawide session exists for batch/sandbox runs.
 * Reuses cookies in `persist:seawide-vendor` when valid; logs in otherwise.
 */
export async function ensureVendorSession(
  options: EnsureVendorSessionOptions,
): Promise<EnsureVendorSessionResult> {
  const startTime = Date.now();
  const steps: string[] = [];
  const report = (step: string, detail?: string) => {
    steps.push(detail ? `${step} — ${detail}` : step);
    options.onProgress?.({ step, detail });
  };

  const loginUrl = options.loginUrl || SEAWIDE_LOGIN_URL;
  const reuseSession = options.reuseSession !== false;

  if (!reuseSession) {
    report('Fresh login requested', 'Clearing existing Seawide session');
    await clearVendorSession();
  } else {
    report('Checking for existing Seawide session');
    const existing = await getVendorSessionStatus();
    if (existing.authenticated) {
      inMemorySessionReady = true;
      report('Reusing existing session', existing.welcomeText || existing.reason);
      return {
        success: true,
        reused: true,
        message: existing.welcomeText
          ? `Reusing active Seawide session. ${existing.welcomeText}`
          : 'Reusing active Seawide B2B session.',
        finalUrl: existing.url,
        pageTitle: existing.title,
        welcomeText: existing.welcomeText,
        responseTimeMs: Date.now() - startTime,
        steps,
      };
    }
    report('No valid session found', existing.reason || 'Login required');
  }

  const { username, password } = options;
  if (!username.trim() || !password.trim()) {
    return {
      success: false,
      reused: false,
      message: 'Seawide username and password required. Save vendor login on the Credentials page first.',
      responseTimeMs: Date.now() - startTime,
      steps,
      error: 'MISSING_CREDENTIALS',
    };
  }

  report('Logging in to Seawide B2B', 'Creating persistent session for batch run');
  const loginResult = await testSeawideLoginBrowser(
    username,
    password,
    loginUrl,
    options.onProgress,
    steps,
    {
      partition: SEAWIDE_PERSIST_PARTITION,
      clearOnExit: false,
      closeWindowOnExit: true,
    },
  );

  if (loginResult.success) {
    inMemorySessionReady = true;
    return { ...loginResult, reused: false };
  }

  inMemorySessionReady = false;
  return { ...loginResult, reused: false };
}
