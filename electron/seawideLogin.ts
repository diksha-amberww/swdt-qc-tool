import { BrowserWindow, session } from 'electron';
import {
  CHROME_USER_AGENT,
  configureStealthBrowserWindow,
  simulateHumanActivity,
} from './electronStealth';

export const SEAWIDE_LOGIN_URL = 'https://www.seawideb2b.com/Login?returnUrl=%2f';
export const SEAWIDE_HOME_URL = 'https://www.seawideb2b.com/';

export interface SeawideLoginProgress {
  step: string;
  detail?: string;
}

export interface SeawideLoginResult {
  success: boolean;
  message: string;
  finalUrl?: string;
  pageTitle?: string;
  welcomeText?: string;
  responseTimeMs: number;
  steps: string[];
  error?: string;
}

const USER_AGENT = CHROME_USER_AGENT;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const randomDelay = (min: number, max: number) =>
  sleep(min + Math.floor(Math.random() * (max - min + 1)));

const typeWithNativeKeyboard = async (
  win: BrowserWindow,
  selector: string,
  text: string,
): Promise<void> => {
  await win.webContents.executeJavaScript(`
    (() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error('Field not found: ${selector}');
      el.disabled = false;
      el.removeAttribute('disabled');
      el.focus();
      el.click();
    })();
  `);
  await sleep(350);

  // Clear existing content
  win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Control', modifiers: ['control'] });
  win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'A', modifiers: ['control'] });
  win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'A', modifiers: ['control'] });
  win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Control' });
  await sleep(100);
  win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Backspace' });
  win.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Backspace' });
  await sleep(200);

  for (const char of text) {
    win.webContents.insertText(char);
    await sleep(75 + Math.floor(Math.random() * 95));
  }
  await sleep(300);
};

const readFormFieldValues = async (
  win: BrowserWindow,
): Promise<{ username: string; passwordLength: number }> => {
  return win.webContents.executeJavaScript(`
    (() => {
      const u = document.querySelector('#Username');
      const p = document.querySelector('#Password');
      return {
        username: u ? u.value : '',
        passwordLength: p ? p.value.length : 0,
      };
    })();
  `);
};

const submitLoginForm = async (win: BrowserWindow): Promise<void> => {
  await win.webContents.executeJavaScript(`
    (() => {
      const btn = document.querySelector('#SignInButton');
      const form = document.getElementById('LoginForm');
      const user = document.querySelector('#Username');
      const pass = document.querySelector('#Password');
      if (!btn || !form || !user || !pass) throw new Error('Login form elements not found');
      if (!user.value || !pass.value) {
        throw new Error('Username or password field is empty before submit');
      }
      btn.disabled = false;
      btn.removeAttribute('disabled');
      user.disabled = false;
      pass.disabled = false;
      if (typeof jQuery !== 'undefined') {
        jQuery(form).trigger('submit');
      } else if (typeof form.requestSubmit === 'function') {
        form.requestSubmit(btn);
      } else {
        btn.click();
      }
    })();
  `);
};

const dismissCookieBanner = async (win: BrowserWindow): Promise<void> => {
  await win.webContents.executeJavaScript(`
    (() => {
      const acceptBtn =
        document.querySelector('#onetrust-accept-btn-handler') ||
        document.querySelector('.onetrust-close-btn-handler');
      if (acceptBtn instanceof HTMLElement) acceptBtn.click();
    })();
  `).catch(() => {});
};

const readPageState = async (
  win: BrowserWindow,
): Promise<{
  url: string;
  title: string;
  onLoginPage: boolean;
  welcomeText: string;
  hasLogout: boolean;
  hasSmartSearch: boolean;
  hasLoginForm: boolean;
  errorMessage: string;
  incapsulaBlocked: boolean;
}> => {
  return win.webContents.executeJavaScript(`
    (() => {
      const url = window.location.href;
      const pathname = window.location.pathname.toLowerCase();
      const title = document.title || '';
      const welcomeEl = document.querySelector('.welcomeMessage');
      const welcomeText = welcomeEl ? welcomeEl.textContent.trim().replace(/\\s+/g, ' ') : '';
      const errEl = document.querySelector('.error-message');
      return {
        url,
        title,
        onLoginPage: pathname.includes('/login') || !!document.querySelector('#LoginForm'),
        welcomeText,
        hasLogout: !!document.querySelector('.component.logout a[href*="Logout"]'),
        hasSmartSearch: !!document.querySelector('.kao-smartsearch-component'),
        hasLoginForm: !!document.querySelector('#LoginForm'),
        errorMessage: errEl ? errEl.textContent.trim() : '',
        incapsulaBlocked: (() => {
          const html = document.body?.innerHTML || '';
          const hasLoginForm = !!document.querySelector('#LoginForm');
          const hasIframe = !!document.querySelector(
            'iframe#main-iframe, iframe[src*="Incapsula"], iframe[src*="incapsula"]',
          );
          if (hasIframe) return true;
          if (!hasLoginForm && /_Incapsula_Resource|incapsula/i.test(html)) return true;
          return false;
        })(),
      };
    })();
  `);
};

const isAuthenticated = (state: Awaited<ReturnType<typeof readPageState>>): boolean => {
  if (state.onLoginPage || state.hasLoginForm) return false;
  if (state.welcomeText && /welcome/i.test(state.welcomeText)) return true;
  if (state.hasLogout) return true;
  if (state.hasSmartSearch && /SeaWide Home/i.test(state.title)) return true;
  try {
    const path = new URL(state.url).pathname.toLowerCase();
    if ((path === '/' || path === '') && state.hasSmartSearch && !state.hasLoginForm) return true;
  } catch {
    /* ignore */
  }
  return false;
};

const enableLoginFormFields = async (win: BrowserWindow): Promise<void> => {
  await win.webContents.executeJavaScript(`
    (() => {
      for (const sel of ['#Username', '#Password', '#SignInButton']) {
        const el = document.querySelector(sel);
        if (el instanceof HTMLInputElement || el instanceof HTMLButtonElement) {
          el.disabled = false;
          el.removeAttribute('disabled');
        }
      }
    })();
  `).catch(() => {});
};

const isLoginFormInteractive = async (win: BrowserWindow): Promise<boolean> => {
  return win.webContents.executeJavaScript(`
    (() => {
      const user = document.querySelector('#Username');
      const pass = document.querySelector('#Password');
      const btn = document.querySelector('#SignInButton');
      return !!(user && pass && btn);
    })();
  `).catch(() => false);
};

const waitForLoginFormReady = async (win: BrowserWindow, timeoutMs = 120000): Promise<boolean> => {
  const start = Date.now();
  let lastInteraction = 0;
  let reloadAttempted = false;

  while (Date.now() - start < timeoutMs) {
    const state = await readPageState(win);

    if (state.incapsulaBlocked) {
      if (Date.now() - lastInteraction > 2500) {
        await simulateHumanActivity(win);
        lastInteraction = Date.now();
      }
      await sleep(1500);
      continue;
    }

    const hasForm = await isLoginFormInteractive(win);
    if (hasForm) {
      const ready = await win.webContents.executeJavaScript(`
        (() => {
          const user = document.querySelector('#Username');
          const pass = document.querySelector('#Password');
          const btn = document.querySelector('#SignInButton');
          return !!(user && pass && btn && !user.disabled && !pass.disabled && !btn.disabled);
        })();
      `).catch(() => false);

      if (ready) return true;

      // Imperva cleared but fields still disabled — enable them (common with hidden windows).
      if (Date.now() - start > 4000) {
        await enableLoginFormFields(win);
        const enabled = await win.webContents.executeJavaScript(`
          (() => {
            const user = document.querySelector('#Username');
            const pass = document.querySelector('#Password');
            const btn = document.querySelector('#SignInButton');
            return !!(user && pass && btn && !user.disabled && !pass.disabled && !btn.disabled);
          })();
        `).catch(() => false);
        if (enabled) return true;
      }
    }

    if (
      !reloadAttempted &&
      Date.now() - start > 45000 &&
      state.onLoginPage &&
      !state.incapsulaBlocked &&
      !hasForm
    ) {
      reloadAttempted = true;
      await win.webContents.reload();
      await sleep(5000);
      continue;
    }

    if (Date.now() - lastInteraction > 3500) {
      await simulateHumanActivity(win);
      lastInteraction = Date.now();
    }
    await sleep(600);
  }
  return false;
};

const waitForAuthenticated = async (
  win: BrowserWindow,
  timeoutMs = 45000,
): Promise<{ confirmed: boolean; welcomeText?: string; reason: string; url: string; title: string }> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const state = await readPageState(win);
    if (state.errorMessage) {
      return {
        confirmed: false,
        reason: `Login failed: ${state.errorMessage}`,
        url: state.url,
        title: state.title,
      };
    }
    if (isAuthenticated(state)) {
      return {
        confirmed: true,
        welcomeText: state.welcomeText || undefined,
        reason: 'Authenticated Seawide B2B session confirmed.',
        url: state.url,
        title: state.title,
      };
    }
    if (!state.onLoginPage && !state.hasLoginForm && !state.incapsulaBlocked && Date.now() - start > 8000) {
      // Home page loaded but no auth markers
      if (/seawideb2b\.com\/?$/i.test(state.url) && !state.hasLogout && !state.welcomeText) {
        return {
          confirmed: false,
          reason: 'Reached Seawide home URL but session is not authenticated. Check username and password.',
          url: state.url,
          title: state.title,
        };
      }
    }
    await sleep(750);
  }
  const state = await readPageState(win);
  return {
    confirmed: false,
    reason: state.onLoginPage
      ? 'Timed out on login page — credentials may be wrong or the portal blocked the attempt.'
      : `Timed out waiting for authenticated home page. Last URL: ${state.url}`,
    url: state.url,
    title: state.title,
  };
};

export interface SeawideLoginBrowserOptions {
  /** Session partition name. Use `persist:…` for disk-backed cookies. */
  partition?: string;
  /** Clear cookies/storage when the login window closes (default: true for one-off tests). */
  clearOnExit?: boolean;
  /** Close the browser window after login (default: true). */
  closeWindowOnExit?: boolean;
}

export const SEAWIDE_PERSIST_PARTITION = 'persist:seawide-vendor';

/**
 * Check whether an existing browser session partition is authenticated.
 */
export async function checkSeawideSessionAuth(
  partition: string = SEAWIDE_PERSIST_PARTITION,
): Promise<{
  authenticated: boolean;
  welcomeText?: string;
  url?: string;
  title?: string;
  reason?: string;
}> {
  const ses = session.fromPartition(partition);
  let win: BrowserWindow | null = null;
  try {
    win = new BrowserWindow({
      show: false,
      width: 1360,
      height: 900,
      webPreferences: {
        partition,
        session: ses,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        javascript: true,
        backgroundThrottling: false,
      },
    });
    configureStealthBrowserWindow(win);
    await win.loadURL(SEAWIDE_HOME_URL);
    await sleep(2500);
    await dismissCookieBanner(win);
    await sleep(500);
    const state = await readPageState(win);
    const authenticated = isAuthenticated(state);
    return {
      authenticated,
      welcomeText: state.welcomeText || undefined,
      url: state.url,
      title: state.title,
      reason: authenticated
        ? 'Existing Seawide session is authenticated.'
        : state.onLoginPage || state.hasLoginForm
          ? 'Session expired — login page shown.'
          : 'Session not authenticated on home page.',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { authenticated: false, reason: `Session check failed: ${message}` };
  } finally {
    if (win && !win.isDestroyed()) {
      win.close();
    }
  }
}

/**
 * Real browser login via hidden Electron window.
 */
export async function testSeawideLoginBrowser(
  username: string,
  password: string,
  loginUrl: string = SEAWIDE_LOGIN_URL,
  onProgress?: (progress: SeawideLoginProgress) => void,
  priorSteps: string[] = [],
  browserOptions: SeawideLoginBrowserOptions = {},
): Promise<SeawideLoginResult> {
  const {
    partition = `seawide-login-${Date.now()}`,
    clearOnExit = true,
    closeWindowOnExit = true,
  } = browserOptions;
  const startTime = Date.now();
  const steps = [...priorSteps];

  const report = (step: string, detail?: string) => {
    steps.push(detail ? `${step} — ${detail}` : step);
    onProgress?.({ step, detail });
  };

  if (!username.trim() || !password.trim()) {
    return {
      success: false,
      message: 'Username and password are required. Enter credentials or save them to .env first.',
      responseTimeMs: Date.now() - startTime,
      steps,
      error: 'MISSING_CREDENTIALS',
    };
  }

  const partitionName = partition;
  const ses = session.fromPartition(partitionName);
  let loginWindow: BrowserWindow | null = null;

  try {
    loginWindow = new BrowserWindow({
      show: true,
      width: 1280,
      height: 860,
      autoHideMenuBar: true,
      title: 'SeaWide B2B Login',
      webPreferences: {
        partition: partitionName,
        session: ses,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        javascript: true,
        backgroundThrottling: false,
      },
    });
    configureStealthBrowserWindow(loginWindow);
    loginWindow.focus();

    report('Opening Seawide B2B login page', loginUrl);
    await loginWindow.loadURL(loginUrl);

    report('Waiting for Imperva/portal security check to complete');
    await simulateHumanActivity(loginWindow);
    await randomDelay(4000, 6000);

    await dismissCookieBanner(loginWindow);
    await randomDelay(1000, 1500);

    report('Waiting for login form to become interactive');
    const formReady = await waitForLoginFormReady(loginWindow);
    if (!formReady) {
      const state = await readPageState(loginWindow);
      return {
        success: false,
        message: state.incapsulaBlocked
          ? 'Portal bot-protection (Incapsula) did not clear in time. Try again in a minute.'
          : 'Login form did not become ready. The portal may be temporarily unavailable.',
        finalUrl: state.url,
        pageTitle: state.title,
        responseTimeMs: Date.now() - startTime,
        steps,
        error: 'FORM_NOT_READY',
      };
    }

    report('Entering username');
    await randomDelay(1200, 2000);
    await typeWithNativeKeyboard(loginWindow, '#Username', username.trim());

    report('Entering password');
    await randomDelay(1500, 2500);
    await typeWithNativeKeyboard(loginWindow, '#Password', password);

    const fieldCheck = await readFormFieldValues(loginWindow);
    report(
      'Verifying form fields populated',
      `username="${fieldCheck.username.slice(0, 3)}***" (${fieldCheck.username.length} chars), password=${fieldCheck.passwordLength} chars`,
    );

    if (!fieldCheck.username || fieldCheck.passwordLength === 0) {
      return {
        success: false,
        message:
          'Credentials did not register in the login form. Re-enter username/password on the Credentials page and save to .env before testing.',
        finalUrl: loginWindow.webContents.getURL(),
        pageTitle: loginWindow.webContents.getTitle(),
        responseTimeMs: Date.now() - startTime,
        steps,
        error: 'FORM_VALUES_EMPTY',
      };
    }

    if (fieldCheck.username !== username.trim()) {
      return {
        success: false,
        message: `Username mismatch in form (expected ${username.trim().length} chars, got ${fieldCheck.username.length}). The portal may have altered input.`,
        responseTimeMs: Date.now() - startTime,
        steps,
        error: 'USERNAME_MISMATCH',
      };
    }

    report('Pausing before submit (anti-bot delay)');
    await randomDelay(2000, 3500);

    report('Submitting login form');
    await submitLoginForm(loginWindow);

    report('Waiting for post-login confirmation page');
    await randomDelay(2000, 3000);

    const verification = await waitForAuthenticated(loginWindow);
    const elapsed = Date.now() - startTime;

    if (verification.confirmed) {
      report('Login successful — authenticated home page confirmed');
      return {
        success: true,
        message: verification.welcomeText
          ? `Login successful. ${verification.welcomeText}`
          : 'Login successful. Seawide B2B home page confirmed.',
        finalUrl: verification.url,
        pageTitle: verification.title,
        welcomeText: verification.welcomeText,
        responseTimeMs: elapsed,
        steps,
      };
    }

    return {
      success: false,
      message: verification.reason,
      finalUrl: verification.url,
      pageTitle: verification.title,
      responseTimeMs: elapsed,
      steps,
      error: 'CONFIRMATION_FAILED',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    report('Login test error', message);
    return {
      success: false,
      message: `Login test failed: ${message}`,
      responseTimeMs: Date.now() - startTime,
      steps,
      error: message,
    };
  } finally {
    if (closeWindowOnExit && loginWindow && !loginWindow.isDestroyed()) {
      loginWindow.close();
    }
    if (clearOnExit) {
      await ses.clearStorageData().catch(() => {});
    }
  }
}

/** Primary entry — always uses real browser (HTTP fetch is blocked by Imperva). */
export async function testSeawideLogin(
  username: string,
  password: string,
  loginUrl?: string,
  onProgress?: (progress: SeawideLoginProgress) => void,
): Promise<SeawideLoginResult> {
  return testSeawideLoginBrowser(username, password, loginUrl, onProgress);
}

// Re-export fetch for diagnostics only
export { testSeawideLoginFetch } from '../shared/seawideLoginFetch';
