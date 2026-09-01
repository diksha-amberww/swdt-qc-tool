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

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const randomDelay = (min: number, max: number) =>
  sleep(min + Math.floor(Math.random() * (max - min + 1)));

class CookieJar {
  private cookies = new Map<string, string>();

  storeFromResponse(response: Response): void {
    const raw =
      typeof response.headers.getSetCookie === 'function'
        ? response.headers.getSetCookie()
        : [];

    if (raw.length === 0) {
      const single = response.headers.get('set-cookie');
      if (single) raw.push(single);
    }

    for (const header of raw) {
      const pair = header.split(';')[0];
      const eq = pair.indexOf('=');
      if (eq > 0) {
        this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
    }
  }

  header(): string | undefined {
    if (this.cookies.size === 0) return undefined;
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }
}

const extractHiddenValue = (html: string, name: string): string | null => {
  const re = new RegExp(
    `name="${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*value="([^"]*)"`,
    'i',
  );
  const match = html.match(re);
  return match?.[1] ?? null;
};

const verifyHomeHtml = (
  html: string,
  url: string,
): { confirmed: boolean; welcomeText?: string; reason: string } => {
  const pathname = (() => {
    try {
      return new URL(url).pathname.toLowerCase();
    } catch {
      return '';
    }
  })();

  const onLoginPage = pathname.includes('/login');
  const welcomeMatch = html.match(/class="welcomeMessage"[^>]*>([\s\S]*?)<\/div>/i);
  const welcomeText = welcomeMatch
    ? welcomeMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    : '';
  const hasLogout = /component logout/i.test(html) && /Logout/i.test(html);
  const hasSmartSearch = /kao-smartsearch-component/i.test(html);
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  const title = titleMatch?.[1] ?? '';
  const titleIsHome = /SeaWide Home/i.test(title);

  if (onLoginPage) {
    const errMatch = html.match(/class="error-message"[^>]*>([^<]+)/i);
    if (errMatch?.[1]?.trim()) {
      return { confirmed: false, reason: `Login failed: ${errMatch[1].trim()}` };
    }
    return { confirmed: false, reason: 'Still on login page — credentials may be incorrect.' };
  }

  if (hasLogout || welcomeText || hasSmartSearch || titleIsHome) {
    return {
      confirmed: true,
      welcomeText: welcomeText || undefined,
      reason: 'Landed on Seawide B2B home page with authenticated session markers.',
    };
  }

  return {
    confirmed: false,
    reason: `Page loaded but post-login markers were not found. URL: ${url}`,
  };
};

/**
 * HTTP-based Seawide login test (works in Node without Electron).
 * Uses cookie jar + form POST with human-like delays between steps.
 */
export async function testSeawideLoginFetch(
  username: string,
  password: string,
  loginUrl: string = SEAWIDE_LOGIN_URL,
  onProgress?: (progress: SeawideLoginProgress) => void,
): Promise<SeawideLoginResult> {
  const startTime = Date.now();
  const steps: string[] = [];
  const jar = new CookieJar();

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

  const fetchWithCookies = async (url: string, init: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(init.headers);
    headers.set('User-Agent', USER_AGENT);
    const cookie = jar.header();
    if (cookie) headers.set('Cookie', cookie);

    const response = await fetch(url, { ...init, headers, redirect: 'manual' });
    jar.storeFromResponse(response);
    return response;
  };

  try {
    report('Opening Seawide B2B login page', loginUrl);
    const loginResponse = await fetchWithCookies(loginUrl, {
      headers: { Accept: 'text/html,application/xhtml+xml' },
    });

    let loginHtml = '';
    if (loginResponse.status >= 300 && loginResponse.status < 400) {
      const location = loginResponse.headers.get('location');
      if (location) {
        const nextUrl = new URL(location, loginUrl).href;
        const follow = await fetchWithCookies(nextUrl, {
          headers: { Accept: 'text/html,application/xhtml+xml' },
        });
        loginHtml = await follow.text();
      }
    } else {
      loginHtml = await loginResponse.text();
    }

    report('Waiting for page to settle (anti-bot delay)');
    await randomDelay(2500, 3500);

    const csrfToken = extractHiddenValue(loginHtml, '__RequestVerificationToken');
    const renderingId = extractHiddenValue(loginHtml, 'LoginRenderingItemId');

    if (!csrfToken) {
      return {
        success: false,
        message: 'Could not read login form security token. The portal may be blocking automated access.',
        responseTimeMs: Date.now() - startTime,
        steps,
        error: 'CSRF_TOKEN_MISSING',
      };
    }

    report('Entering username (simulated delay)');
    await randomDelay(1200, 2000);

    report('Entering password (simulated delay)');
    await randomDelay(1500, 2500);

    report('Pausing before submit (anti-bot delay)');
    await randomDelay(1800, 2800);

    const postUrl = new URL('/api/keystonelogin/PreformLogin', loginUrl).href;
    const body = new URLSearchParams({
      __RequestVerificationToken: csrfToken,
      LoginRenderingItemId: renderingId || '',
      Username: username.trim(),
      Password: password,
    });

    report('Submitting login form');
    const postResponse = await fetchWithCookies(postUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json, text/html, */*',
        Origin: 'https://www.seawideb2b.com',
        Referer: loginUrl,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: body.toString(),
    });

    let postBody = await postResponse.text();

    // Follow redirect if server sends one
    if (postResponse.status >= 300 && postResponse.status < 400) {
      const location = postResponse.headers.get('location');
      if (location) {
        const redirectUrl = new URL(location, loginUrl).href;
        report('Following post-login redirect', redirectUrl);
        await randomDelay(1500, 2500);
        const redir = await fetchWithCookies(redirectUrl, {
          headers: { Accept: 'text/html,application/xhtml+xml' },
        });
        postBody = await redir.text();
      }
    }

    // AJAX login may return JSON with redirect URL
    try {
      const json = JSON.parse(postBody) as { redirectUrl?: string; RedirectUrl?: string; success?: boolean };
      const redirectPath = json.redirectUrl || json.RedirectUrl;
      if (redirectPath) {
        const homeCandidate = new URL(redirectPath, SEAWIDE_HOME_URL).href;
        report('Following AJAX redirect', homeCandidate);
        await randomDelay(2000, 3000);
        const homeResp = await fetchWithCookies(homeCandidate, {
          headers: { Accept: 'text/html,application/xhtml+xml' },
        });
        postBody = await homeResp.text();
      }
    } catch {
      /* not JSON — continue */
    }

    report('Loading home page to verify session');
    await randomDelay(2000, 3000);

    const homeResponse = await fetchWithCookies(SEAWIDE_HOME_URL, {
      headers: { Accept: 'text/html,application/xhtml+xml' },
    });

    let homeHtml = postBody;
    let finalUrl = SEAWIDE_HOME_URL;

    if (homeResponse.status >= 200 && homeResponse.status < 400) {
      homeHtml = await homeResponse.text();
      finalUrl = homeResponse.url || SEAWIDE_HOME_URL;
    }

    const titleMatch = homeHtml.match(/<title>([^<]*)<\/title>/i);
    const pageTitle = titleMatch?.[1]?.trim() ?? '';

    report('Verifying confirmation page', finalUrl);
    const verification = verifyHomeHtml(homeHtml, finalUrl);
    const elapsed = Date.now() - startTime;

    if (verification.confirmed) {
      report('Login successful — authenticated home page confirmed');
      return {
        success: true,
        message: verification.welcomeText
          ? `Login successful. ${verification.welcomeText}`
          : 'Login successful. Seawide B2B home page confirmed.',
        finalUrl,
        pageTitle,
        welcomeText: verification.welcomeText,
        responseTimeMs: elapsed,
        steps,
      };
    }

    return {
      success: false,
      message: verification.reason,
      finalUrl,
      pageTitle,
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
  }
}
