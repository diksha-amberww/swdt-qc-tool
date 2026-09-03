import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';
import { resolveVendorCredentials, readProjectEnv, writeProjectEnv } from './shared/envUtils';
import {
  runElectronLoginTest,
  runElectronEnsureSession,
  runElectronQcEvaluate,
} from './shared/runElectronLogin';

/** Keep Node/Electron builtins out of the main-process bundle (undici pulls node:sqlite). */
function isElectronMainExternal(id: string): boolean {
  return id === 'electron' || id === 'undici' || id.startsWith('node:');
}

const electronMainBuild = {
  outDir: 'dist-electron',
  rollupOptions: {
    external: isElectronMainExternal,
  },
};

function seawideLoginDevPlugin(): Plugin {
  return {
    name: 'seawide-login-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/dev/env', (req: IncomingMessage, res: ServerResponse, next) => {
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(readProjectEnv()));
          return;
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            res.setHeader('Content-Type', 'application/json');
            try {
              const payload = JSON.parse(body) as Record<string, string>;
              const ok = writeProjectEnv(payload);
              res.end(JSON.stringify({ success: ok }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false }));
            }
          });
          return;
        }

        next();
      });

      server.middlewares.use(
        '/api/dev/vendor-login-test',
        (req: IncomingMessage, res: ServerResponse, next) => {
          if (req.method !== 'POST') {
            next();
            return;
          }

          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', async () => {
            res.setHeader('Content-Type', 'application/json');
            try {
              const payload = JSON.parse(body) as {
                username?: string;
                password?: string;
                loginUrl?: string;
              };
              const resolved = resolveVendorCredentials(
                payload.username || '',
                payload.password || '',
              );
              const result = await runElectronLoginTest({
                username: resolved.username,
                password: resolved.password,
                loginUrl: payload.loginUrl,
              });
              res.end(JSON.stringify(result));
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, message, steps: [], responseTimeMs: 0 }));
            }
          });
        },
      );

      server.middlewares.use('/api/dev/amazon-test', async (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        try {
          const { testAmazonTokenRefresh, resolveAmazonCredentials } = await import(
            './scraping/amazon/amazonTokenProvider'
          );
          const result = await testAmazonTokenRefresh(resolveAmazonCredentials());
          res.end(JSON.stringify(result));
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, message, responseTimeMs: 0, endpoint: '' }));
        }
      });

      server.middlewares.use('/api/dev/vendor-session-status', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ authenticated: false, reason: 'Use vendor-ensure-session before batch runs in browser dev mode.' }));
      });

      server.middlewares.use(
        '/api/dev/vendor-ensure-session',
        (req: IncomingMessage, res: ServerResponse, next) => {
          if (req.method !== 'POST') {
            next();
            return;
          }

          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', async () => {
            res.setHeader('Content-Type', 'application/json');
            try {
              const payload = JSON.parse(body) as {
                username?: string;
                password?: string;
                loginUrl?: string;
                reuseSession?: boolean;
              };
              const resolved = resolveVendorCredentials(
                payload.username || '',
                payload.password || '',
              );
              const result = await runElectronEnsureSession({
                username: resolved.username,
                password: resolved.password,
                loginUrl: payload.loginUrl,
                reuseSession: payload.reuseSession,
              });
              res.end(JSON.stringify(result));
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, reused: false, message, steps: [], responseTimeMs: 0 }));
            }
          });
        },
      );

      server.middlewares.use('/api/dev/qc-evaluate', (req: IncomingMessage, res: ServerResponse, next) => {
        if (req.method !== 'POST') {
          next();
          return;
        }

        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', async () => {
          res.setHeader('Content-Type', 'application/json');
          try {
            const payload = JSON.parse(body) as {
              row: { asin: string; upc: string; vendorModel: string };
              settings: {
                priceVarianceThreshold: number;
                titleSimilarityThreshold: number;
                imageSimilarityThreshold: number;
                strictPackQuantity: boolean;
              };
              username?: string;
              password?: string;
              loginUrl?: string;
              reuseSession?: boolean;
            };
            const resolved = resolveVendorCredentials(
              payload.username || '',
              payload.password || '',
            );
            const result = await runElectronQcEvaluate({
              ...payload,
              username: resolved.username,
              password: resolved.password,
              loginUrl: payload.loginUrl,
            });
            if (!result.success) {
              res.statusCode = 502;
            }
            res.end(JSON.stringify(result));
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, message, error: message }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  // App credentials live in root .env and are read at runtime (Electron / dev API).
  // Do not let Vite watch .env — saving credentials would restart the dev server.
  envFile: false,
  plugins: [
    react(),
    seawideLoginDevPlugin(),
    electron([
      {
        entry: 'electron/main.ts',
        onstart({ startup }) {
          startup();
        },
        vite: {
          build: electronMainBuild,
        },
      },
      {
        entry: 'electron/loginTestCli.ts',
        vite: {
          build: electronMainBuild,
        },
      },
      {
        entry: 'electron/sessionEnsureCli.ts',
        vite: {
          build: electronMainBuild,
        },
      },
      {
        entry: 'electron/scrapeVendorCli.ts',
        vite: {
          build: electronMainBuild,
        },
      },
      {
        entry: 'electron/scrapeAmazonCli.ts',
        vite: {
          build: electronMainBuild,
        },
      },
      {
        entry: 'electron/qcEvaluateCli.ts',
        vite: {
          build: electronMainBuild,
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron',
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ['**/.env', '**/.env.*'],
    },
  },
});
