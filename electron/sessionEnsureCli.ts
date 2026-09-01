import { app } from 'electron';
import { ensureVendorSession } from './seawideSession';
import { readProjectEnv, resolveVendorCredentials } from '../shared/envUtils';

const raw = process.argv[2] || '{}';
let payload: {
  username?: string;
  password?: string;
  loginUrl?: string;
  reuseSession?: boolean;
} = {};

try {
  payload = JSON.parse(raw);
} catch {
  payload = {};
}

const env = readProjectEnv(process.cwd());
const { username, password } = resolveVendorCredentials(
  payload.username || '',
  payload.password || '',
  process.cwd(),
);

app.whenReady().then(async () => {
  try {
    const result = await ensureVendorSession({
      username,
      password,
      loginUrl: payload.loginUrl || env.VENDOR_PORTAL_URL,
      reuseSession: payload.reuseSession !== false,
      onProgress: (progress) => {
        process.stderr.write(`${JSON.stringify({ type: 'progress', ...progress })}\n`);
      },
    });
    process.stdout.write(JSON.stringify(result));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stdout.write(
      JSON.stringify({
        success: false,
        reused: false,
        message: `Session ensure crashed: ${message}`,
        responseTimeMs: 0,
        steps: [],
        error: message,
      }),
    );
  } finally {
    app.quit();
  }
});

app.on('window-all-closed', () => app.quit());
