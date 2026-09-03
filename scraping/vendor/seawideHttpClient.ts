import { extractPidFromHref, extractSid } from './textUtils';

export const SEAWIDE_ORIGIN = 'https://www.seawideb2b.com';

export interface HttpGetResult {
  url: string;
  status: number;
  html: string;
  finalUrl: string;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const DEFAULT_HEADERS: Record<string, string> = {
  accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
  'upgrade-insecure-requests': '1',
};

export function isLoginHtml(html: string, finalUrl: string): boolean {
  if (/\/Login/i.test(finalUrl)) return true;
  return /<title>[^<]*Login/i.test(html) && !/product-detail-container/i.test(html);
}

export async function seawideGet(
  fetchImpl: FetchLike,
  url: string,
  referrer?: string,
): Promise<HttpGetResult> {
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: {
      ...DEFAULT_HEADERS,
      ...(referrer ? { referer: referrer } : {}),
    },
    redirect: 'follow',
  });
  const html = await response.text();
  return {
    url,
    status: response.status,
    html,
    finalUrl: response.url || url,
  };
}

export function buildSearchUrl(searchTerm: string, sid?: string): string {
  const params = new URLSearchParams({
    ShowSmartSuggestions: 'true',
    SearchTerm: searchTerm,
    SearchType: 'allcategories',
    slc: 'defaultSearchSuggestions ',
    spr: 'true',
    sdr: 'true',
    dcnil: 'true',
    asem: 'true',
    dbsar: 'true',
  });
  if (sid) params.set('ssid', sid);
  return `${SEAWIDE_ORIGIN}/search?${params.toString()}`;
}

export interface SearchDetailLink {
  pid: string;
  href: string;
  sid?: string;
  rcid?: string;
  rpos?: string;
}

function decodeQueryParam(value: string): string {
  return decodeURIComponent(value.replace(/\+/g, ' '));
}

function extractQueryParam(url: string, key: string): string | undefined {
  const match = url.match(new RegExp(`[?&]${key}=([^&]+)`, 'i'));
  return match ? decodeQueryParam(match[1]) : undefined;
}

export function buildDetailUrl(
  pid: string,
  extras?: { sid?: string; rcid?: string; rpos?: string; allin?: boolean },
): string {
  const params = new URLSearchParams({ pid });
  if (extras?.rcid) params.set('rcid', extras.rcid);
  if (extras?.sid) {
    params.set('sid', extras.sid);
    params.set('ssid', extras.sid);
  }
  if (extras?.rpos) params.set('rpos', extras.rpos);
  if (extras?.allin || (!extras?.rcid && !extras?.sid)) params.set('allin', 'true');
  return `${SEAWIDE_ORIGIN}/Search/Detail?${params.toString()}`;
}

export function parseSearchResultPids(html: string): SearchDetailLink[] {
  const results: SearchDetailLink[] = [];
  const re = /href=["']([^"']*Search\/Detail\?[^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const href = match[1].replace(/&amp;/g, '&');
    const pid = extractPidFromHref(href);
    if (!pid) continue;
    results.push({
      pid,
      href: href.startsWith('http') ? href : `${SEAWIDE_ORIGIN}${href.startsWith('/') ? '' : '/'}${href}`,
      sid: extractSid(href) || undefined,
      rcid: extractQueryParam(href, 'rcid'),
      rpos: extractQueryParam(href, 'rpos'),
    });
  }
  return results.filter((item, idx, arr) => arr.findIndex((x) => x.pid === item.pid) === idx);
}
