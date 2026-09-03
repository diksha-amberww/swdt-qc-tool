export function cleanText(value: string | null | undefined): string {
  return (value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parsePrice(value: string | null | undefined): number | null {
  const cleaned = cleanText(value).replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

export function parseLeadingNumber(value: string | null | undefined): number | null {
  const cleaned = cleanText(value);
  if (!cleaned) return null;
  const lower = cleaned.toLowerCase();
  if (/^(single|each|ea\.?|one)$/i.test(lower)) return 1;
  const packOf = lower.match(/pack\s*of\s*(\d+)/i);
  if (packOf) return Number(packOf[1]);
  const nPack = lower.match(/(\d+)\s*[- ]?pack/i);
  if (nPack) return Number(nPack[1]);
  // Volume/dimension strings are not pack counts unless pack wording is present.
  const looksLikeMeasure =
    /\b(fl\.?\s*oz|oz|ounce|ounces|ml|\bl\b|liter|liters|litre|litres|gal|gallon|gallons|ft|feet|\bin\b|inch|inches|lb|lbs|pound|pounds|mm|cm)\b/i.test(
      lower,
    );
  const hasPackWording = /\bpack\b|\bcount\b|\bpcs\b|\bpieces\b|\bmultipack\b/i.test(lower);
  if (looksLikeMeasure && !hasPackWording) return null;
  const leading = lower.match(/^(\d+(?:\.\d+)?)/);
  if (leading) return Number(leading[1]);
  return null;
}

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/gi, ' ');
}

export function tryParseJson<T = unknown>(raw: string): T | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    try {
      return JSON.parse(decodeHtmlEntities(trimmed)) as T;
    } catch {
      return null;
    }
  }
}

export function extractOnclickJsonObjects(html: string): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const re = /(?:Cart\.AddToCart|BuildLists\.DisplayBuildLists)\(\s*(\{[\s\S]*?\})\s*,/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const parsed = tryParseJson<Record<string, unknown>>(match[1]);
    if (parsed && typeof parsed === 'object') results.push(parsed);
  }
  return results;
}

export function splitBrandAndModel(
  title: string,
  manufacturerPartNumber: string,
  keystonePartNumber: string,
): { brand: string; modelNumber: string } {
  const full = cleanText(title);
  const candidates = [manufacturerPartNumber, keystonePartNumber]
    .map((c) => cleanText(c))
    .filter(Boolean);

  for (const candidate of candidates) {
    const idx = full.toLowerCase().lastIndexOf(candidate.toLowerCase());
    if (idx > 0 && idx + candidate.length >= full.length - 1) {
      return {
        brand: cleanText(full.slice(0, idx)),
        modelNumber: candidate,
      };
    }
  }

  const parts = full.split(' ');
  if (parts.length >= 2) {
    return {
      brand: parts.slice(0, -1).join(' '),
      modelNumber: parts[parts.length - 1],
    };
  }

  return { brand: full, modelNumber: manufacturerPartNumber || keystonePartNumber };
}

export function extractSupplierCode(name: string): { name: string; code: string } {
  const cleaned = cleanText(name);
  const match = cleaned.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (match) {
    return { name: cleanText(match[1]), code: cleanText(match[2]) };
  }
  return { name: cleaned, code: '' };
}

export function absoluteUrl(href: string, base = 'https://www.seawideb2b.com'): string {
  const value = cleanText(href);
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  try {
    return new URL(value, base).toString();
  } catch {
    return value;
  }
}

export function extractPidFromHref(href: string): string {
  const match = href.match(/[?&]pid=([^&]+)/i);
  return match ? decodeURIComponent(match[1]) : '';
}

export function extractSearchTerm(url: string): string {
  const match = url.match(/[?&]SearchTerm=([^&]+)/i);
  return match ? decodeURIComponent(match[1].replace(/\+/g, ' ')) : '';
}

export function extractSid(url: string): string {
  const match = url.match(/[?&](?:sid|ssid)=([^&]+)/i);
  return match ? decodeURIComponent(match[1]) : '';
}
