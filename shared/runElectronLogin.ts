import { spawn } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { SeawideLoginResult } from './shared/seawideLoginFetch';

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

function runElectronSubprocess(
  scriptName: string,
  payload: Record<string, unknown>,
): Promise<SeawideLoginResult & { reused?: boolean }> {
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
          const lines = trimmed.split('\n');
          const lastLine = lines[lines.length - 1];
          resolve(JSON.parse(lastLine) as SeawideLoginResult);
          return;
        } catch {
          reject(new Error(`Invalid login test output: ${trimmed.slice(0, 200)}`));
          return;
        }
      }
      reject(
        new Error(
          `Electron login test exited with code ${code}. ${stderr.slice(0, 300) || 'No output.'}`,
        ),
      );
    });
  });
}
