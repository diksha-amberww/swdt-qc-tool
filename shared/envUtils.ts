import fs from 'fs';
import path from 'path';

export function parseEnvFileContent(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    let val = trimmed.substring(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    result[key] = val;
  }
  return result;
}

export function escapeEnvValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function readProjectEnv(cwd: string = process.cwd()): Record<string, string> {
  const envPath = path.join(cwd, '.env');
  if (!fs.existsSync(envPath)) return {};
  return parseEnvFileContent(fs.readFileSync(envPath, 'utf-8'));
}

export function writeProjectEnv(
  updates: Record<string, string>,
  cwd: string = process.cwd(),
): boolean {
  try {
    const envPath = path.join(cwd, '.env');
    const merged = { ...readProjectEnv(cwd), ...updates };
    const lines = Object.entries(merged).map(
      ([key, value]) => `${key}="${escapeEnvValue(value)}"`,
    );
    fs.writeFileSync(envPath, lines.join('\n') + '\n', 'utf-8');
    return true;
  } catch {
    return false;
  }
}

export function resolveVendorCredentials(
  username: string,
  password: string,
  cwd?: string,
): { username: string; password: string } {
  const env = readProjectEnv(cwd);
  return {
    username: (username.trim() || env.VENDOR_USERNAME || env.VENDOR_EMAIL || '').trim(),
    password: password || env.VENDOR_PASSWORD || '',
  };
}
