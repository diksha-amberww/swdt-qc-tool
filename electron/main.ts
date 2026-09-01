import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { testSeawideLogin, SEAWIDE_LOGIN_URL } from './seawideLogin';
import {
  ensureVendorSession,
  getVendorSessionStatus,
  clearVendorSession,
} from './seawideSession';
import { readProjectEnv, resolveVendorCredentials, writeProjectEnv } from '../shared/envUtils';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Keep the QC loop running on low-end machines even when the window is occluded.
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// eslint-disable-next-line @typescript-eslint/no-require-imports
if (process.platform === 'win32') {
  try {
    const squirrel = require('electron-squirrel-startup');
    if (squirrel) app.quit();
  } catch {
    // Ignore if module not found
  }
}

let mainWindow: BrowserWindow | null = null;

const getEnvFilePath = (): string => {
  return path.join(app.getAppPath(), '.env');
};

const parseEnvFile = (filePath: string): Record<string, string> => {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const result: Record<string, string> = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.substring(0, eqIdx).trim();
      let val = trimmed.substring(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      result[key] = val;
    }
  }
  return result;
};

const saveEnvFile = (filePath: string, envData: Record<string, string>): boolean => {
  try {
    let existingEnv: Record<string, string> = {};
    if (fs.existsSync(filePath)) {
      existingEnv = parseEnvFile(filePath);
    }
    const merged = { ...existingEnv, ...envData };
    const content = Object.entries(merged)
      .map(([k, v]) => `${k}="${v}"`)
      .join('\n');
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to write .env file:', err);
    return false;
  }
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1100,
    minHeight: 700,
    title: "SWDT VENDOR QC TOOL - Seawide Distribution",
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false,
      spellcheck: false,
    },
    autoHideMenuBar: true,
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Load URL from Vite Dev Server or production build
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  // Register IPC Handlers
  ipcMain.handle('env:read', async () => {
    const envPath = getEnvFilePath();
    return parseEnvFile(envPath);
  });

  ipcMain.handle('env:write', async (_event, data: Record<string, string>) => {
    return writeProjectEnv(data, app.getAppPath());
  });

  ipcMain.handle('dialog:openFile', async (_event, filters: { name: string; extensions: string[] }[]) => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: filters || [{ name: 'Excel / CSV Files', extensions: ['xlsx', 'xls', 'csv'] }],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    const filePath = result.filePaths[0];
    const buffer = fs.readFileSync(filePath);
    return {
      name: path.basename(filePath),
      path: filePath,
      buffer: Array.from(buffer),
    };
  });

  ipcMain.handle('dialog:saveFile', async (_event, { defaultName, content, isBinary }: { defaultName: string; content: any; isBinary?: boolean }) => {
    if (!mainWindow) return false;
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName,
      filters: [{ name: 'Export Files', extensions: ['xlsx', 'csv', 'json', 'txt'] }],
    });
    if (result.canceled || !result.filePath) {
      return false;
    }
    if (isBinary) {
      fs.writeFileSync(result.filePath, Buffer.from(content));
    } else {
      fs.writeFileSync(result.filePath, content, 'utf-8');
    }
    return true;
  });

  ipcMain.handle('app:version', () => app.getVersion());

  ipcMain.handle('theme:set', (_event, theme: 'light' | 'dark') => {
    const color = theme === 'dark' ? '#0b1220' : '#f8fafc';
    mainWindow?.setBackgroundColor(color);
    return true;
  });

  ipcMain.handle(
    'vendor:testLogin',
    async (_event, payload: { username: string; password: string; loginUrl?: string }) => {
      const sendProgress = (progress: { step: string; detail?: string }) => {
        mainWindow?.webContents.send('vendor:loginProgress', progress);
      };

      const env = readProjectEnv(app.getAppPath());
      const { username, password } = resolveVendorCredentials(
        payload.username || '',
        payload.password || '',
        app.getAppPath(),
      );

      return testSeawideLogin(
        username,
        password,
        payload.loginUrl || env.VENDOR_PORTAL_URL || SEAWIDE_LOGIN_URL,
        sendProgress,
      );
    },
  );

  ipcMain.handle(
    'vendor:ensureSession',
    async (
      _event,
      payload: { username?: string; password?: string; loginUrl?: string; reuseSession?: boolean },
    ) => {
      const sendProgress = (progress: { step: string; detail?: string }) => {
        mainWindow?.webContents.send('vendor:loginProgress', progress);
      };

      const env = readProjectEnv(app.getAppPath());
      const { username, password } = resolveVendorCredentials(
        payload.username || '',
        payload.password || '',
        app.getAppPath(),
      );

      return ensureVendorSession({
        username,
        password,
        loginUrl: payload.loginUrl || env.VENDOR_PORTAL_URL || SEAWIDE_LOGIN_URL,
        reuseSession: payload.reuseSession !== false,
        onProgress: sendProgress,
      });
    },
  );

  ipcMain.handle('vendor:sessionStatus', async () => getVendorSessionStatus());

  ipcMain.handle('vendor:clearSession', async () => {
    await clearVendorSession();
    return true;
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
