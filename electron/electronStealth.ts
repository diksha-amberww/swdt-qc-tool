import { app, type BrowserWindow } from 'electron';

/** Call before `app.whenReady()` in every Electron entry point. */
export function applyElectronStealthSwitches(): void {
  app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
}

export const CHROME_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const STEALTH_INIT_SCRIPT = `
(() => {
  try {
    Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true });
  } catch {}
  if (!window.chrome) {
    window.chrome = { runtime: {} };
  }
})();
`;

export function configureStealthBrowserWindow(win: BrowserWindow): void {
  win.webContents.setUserAgent(CHROME_USER_AGENT);
  win.webContents.setBackgroundThrottling(false);
  win.webContents.on('dom-ready', () => {
    win.webContents.executeJavaScript(STEALTH_INIT_SCRIPT).catch(() => {});
  });
}

export async function simulateHumanActivity(win: BrowserWindow): Promise<void> {
  const x = 180 + Math.floor(Math.random() * 520);
  const y = 120 + Math.floor(Math.random() * 360);
  win.webContents.sendInputEvent({ type: 'mouseMove', x, y });
  win.webContents.sendInputEvent({
    type: 'mouseDown',
    x,
    y,
    button: 'left',
    clickCount: 1,
  });
  win.webContents.sendInputEvent({
    type: 'mouseUp',
    x,
    y,
    button: 'left',
    clickCount: 1,
  });
  await win.webContents.executeJavaScript('window.scrollBy(0, 48)').catch(() => {});
}
