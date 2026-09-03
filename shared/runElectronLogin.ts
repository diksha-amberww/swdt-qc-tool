import { spawn } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { SeawideLoginResult } from './seawideLoginFetch';

const require = createRequire(import.meta.url);

export function runElectronLoginTest(payload: {
  username?: string;
  password?: string;
  loginUrl?: string;
}): Promise<SeawideLoginResult> {
  return runElectronSubprocess('loginTestCli.js', payload);
}

export function runElectronEnsureSession(payload: {
  username?: string;
  password?: string;
  loginUrl?: string;
  reuseSession?: boolean;
}): Promise<SeawideLoginResult & { reused?: boolean }> {
  return runElectronSubprocess('sessionEnsureCli.js', payload);
}

export function runElectronQcEvaluate(payload: {
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
}): Promise<{ success: boolean; result?: unknown; message?: string; error?: string }> {
  return runElectronJsonSubprocess('qcEvaluateCli.js', payload);
}

function runElectronSubprocess(
  scriptName: string,
  payload: Record<string, unknown>,
): Promise<SeawideLoginResult & { reused?: boolean }> {
  return runElectronJsonSubprocess(scriptName, payload) as Promise<SeawideLoginResult & { reused?: boolean }>;
}

function runElectronJsonSubprocess<T = unknown>(
  scriptName: string,
  payload: Record<string, unknown>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const electronPath: string = require('electron');
    const cliScript = path.join(process.cwd(), 'dist-electron', scriptName);

    const child = spawn(electronPath, [cliScript, JSON.stringify(payload)], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);

    child.on('close', (code) => {
      const trimmed = stdout.trim();
      if (trimmed) {
        try {
          resolve(JSON.parse(trimmed) as T);
          return;
        } catch {
          // Some Electron builds emit noise before JSON; take the outermost object.
          const start = trimmed.indexOf('{');
          const end = trimmed.lastIndexOf('}');
          if (start >= 0 && end > start) {
            try {
              resolve(JSON.parse(trimmed.slice(start, end + 1)) as T);
              return;
            } catch {
              /* fall through */
            }
          }
          reject(new Error(`Invalid Electron CLI output: ${trimmed.slice(0, 200)}`));
          return;
        }
      }
      reject(
        new Error(
          `Electron CLI ${scriptName} exited with code ${code}. ${stderr.slice(0, 300) || 'No output.'}`,
        ),
      );
    });
  });
}
