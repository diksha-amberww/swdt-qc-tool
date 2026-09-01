import { app } from 'electron';
import { testSeawideLoginBrowser } from './seawideLogin';
import { resolveVendorCredentials } from '../shared/envUtils';

const raw = process.argv[2] || '{}';
let payload: { username?: string; password?: string; loginUrl?: string } = {};
try {
  payload = JSON.parse(raw);
} catch {
  payload = {};
}

const { username, password } = resolveVendorCredentials(
  payload.username || '',
  payload.password || '',
  process.cwd(),
);

app.whenReady().then(async () => {
  try {
    const result = await testSeawideLoginBrowser(
      username,
      password,
      payload.loginUrl,
      (progress) => {
        process.stderr.write(`${JSON.stringify({ type: 'progress', ...progress })}\n`);
      },
    );
    process.stdout.write(JSON.stringify(result));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stdout.write(
      JSON.stringify({
        success: false,
        message: `Login test crashed: ${message}`,
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
