import { useSettingsStore } from '../store/useSettingsStore';
import { readEnvFromDisk } from '../store/useCredStore';
import type { EnsureVendorSessionResult, VendorSessionStatus } from '../types/electron';

export type SessionProgressCallback = (message: string) => void;

let cachedSessionReady = false;

export function resetVendorSessionCache(): void {
  cachedSessionReady = false;
}

export function isVendorSessionCached(): boolean {
  return cachedSessionReady;
}

async function resolveCredentialsFromEnv(): Promise<{ username: string; password: string; loginUrl?: string }> {
  const env = await readEnvFromDisk();
  return {
    username: (env.VENDOR_USERNAME || env.VENDOR_EMAIL || '').trim(),
    password: env.VENDOR_PASSWORD || '',
    loginUrl: env.VENDOR_PORTAL_URL,
  };
}

/**
 * Ensure an authenticated Seawide session exists before batch/sandbox runs.
 * Reuses persistent session when valid; logs in first when not.
 */
export async function ensureVendorSessionForRun(
  onProgress?: SessionProgressCallback,
): Promise<EnsureVendorSessionResult> {
  const reuseSession = useSettingsStore.getState().settings.reuseSession;
  const creds = await resolveCredentialsFromEnv();

  const progressHandler = onProgress
    ? (step: string, detail?: string) => onProgress(detail ? `${step} — ${detail}` : step)
    : undefined;

  if (window.electronAPI?.ensureVendorSession) {
    let unsub: (() => void) | undefined;
    if (progressHandler && window.electronAPI.onVendorLoginProgress) {
      unsub = window.electronAPI.onVendorLoginProgress(({ step, detail }) => {
        progressHandler(step, detail);
      });
    }

    try {
      const result = await window.electronAPI.ensureVendorSession({
        username: creds.username,
        password: creds.password,
        loginUrl: creds.loginUrl,
        reuseSession,
      });
      cachedSessionReady = result.success;
      return result;
    } finally {
      unsub?.();
    }
  }

  try {
    const response = await fetch('/api/dev/vendor-ensure-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: creds.username,
        password: creds.password,
        loginUrl: creds.loginUrl,
        reuseSession,
      }),
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return {
        success: false,
        reused: false,
        message: `Session setup failed (HTTP ${response.status}): ${errText.slice(0, 200)}`,
        responseTimeMs: 0,
        steps: [],
        error: 'SESSION_ENSURE_FAILED',
      };
    }
    const result = (await response.json()) as EnsureVendorSessionResult;
    cachedSessionReady = result.success;
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      reused: false,
      message: `Session setup unavailable: ${message}. Run the Electron desktop app for live Seawide login.`,
      responseTimeMs: 0,
      steps: [],
      error: message,
    };
  }
}

export async function getVendorSessionStatusForRun(): Promise<VendorSessionStatus> {
  if (window.electronAPI?.getVendorSessionStatus) {
    return window.electronAPI.getVendorSessionStatus();
  }
  try {
    const response = await fetch('/api/dev/vendor-session-status');
    if (response.ok) {
      return response.json();
    }
  } catch {
    /* fall through */
  }
  return { authenticated: cachedSessionReady, reason: 'Session status unavailable outside Electron.' };
}
