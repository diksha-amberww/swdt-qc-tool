export type BrandMatchReason =
  | 'empty'
  | 'compact_equal'
  | 'alias'
  | 'token_exact'
  | 'compact_containment'
  | 'token_soft'
  | 'fuzzy'
  | 'mismatch';

export interface BrandMatchDetail {
  match: boolean;
  reason: BrandMatchReason;
  leftSegments: string[];
  rightSegments: string[];
}

interface BrandSegment {
  raw: string;
  spaced: string;
  compact: string;
  tokens: string[];
}

const LEGAL_SUFFIXES =
  /\b(incorporated|corporation|company|limited|gmbh|inc|llc|ltd|corp|co)\b\.?/g;

/** Compact form → canonical compact form. Easy to extend. */
const ALIAS_GROUPS: string[][] = [
  ['ge', 'general electric', 'generalelectric'],
  ['gm', 'general motors', 'generalmotors'],
  ['3m', 'minnesota mining', 'minnesotamining'],
  ['bmw', 'bayerische motoren werke', 'bayerischemotorenwerke'],
  ['hp', 'hewlett packard', 'hewlettpackard'],
  ['ibm', 'international business machines', 'internationalbusinessmachines'],
  ['pg', 'p g', 'procter gamble', 'procter and gamble', 'proctergamble'],
  ['lg', 'lg electronics', 'lgelectronics'],
];

const ALIAS_CANONICAL = buildAliasMap();

const SHORT_BRAND_MAX = 3;
const CONTAINMENT_MIN = 4;
const FUZZY_MIN_LEN = 4;
const FUZZY_RATIO = 0.85;

function buildAliasMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const group of ALIAS_GROUPS) {
    const compactForms = group.map(compactBrand);
    const canonical = compactForms.reduce((longest, form) =>
      form.length > longest.length ? form : longest,
    );
    for (const form of compactForms) {
      if (form) map.set(form, canonical);
    }
  }
  return map;
}

function foldUnicode(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '');
}

function compactBrand(value: string): string {
  return foldUnicode(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function aliasCanonical(compact: string): string {
  return ALIAS_CANONICAL.get(compact) || compact;
}

function stripLegalSuffixes(value: string): string {
  return value.replace(LEGAL_SUFFIXES, ' ').replace(/\s+/g, ' ').trim();
}

function splitBrandSegments(value: string): string[] {
  const folded = foldUnicode(value).toLowerCase().trim();
  if (!folded) return [];
  return folded
    .split(/\s*(?:\/|\||(?<!\w)&(?!\w)|,|\+|\band\b)\s*/g)
    .map((part) => stripLegalSuffixes(part.replace(/[_.'’]+/g, ' ')))
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function tokenizeSpaced(spaced: string): string[] {
  return spaced
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);
}

function toSegment(raw: string): BrandSegment | null {
  const spaced = raw.replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  const compact = spaced.replace(/[^a-z0-9]+/g, '');
  if (!compact) return null;
  return {
    raw,
    spaced,
    compact,
    tokens: tokenizeSpaced(spaced),
  };
}

function parseBrand(value: string): BrandSegment[] {
  const segments: BrandSegment[] = [];
  const seen = new Set<string>();
  for (const part of splitBrandSegments(value)) {
    const segment = toSegment(part);
    if (!segment || seen.has(segment.compact)) continue;
    seen.add(segment.compact);
    segments.push(segment);
  }
  return segments;
}

function isShortBrand(compact: string): boolean {
  return compact.length > 0 && compact.length <= SHORT_BRAND_MAX;
}

function tokensPairSoft(a: string, b: string): boolean {
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length < 3) return false;
  return longer.startsWith(shorter) || longer.includes(shorter);
}

function tokensSoftMatch(left: BrandSegment, right: BrandSegment): boolean {
  const leftTok = left.tokens.filter((t) => t.length >= 3);
  const rightTok = right.tokens.filter((t) => t.length >= 3);
  if (leftTok.length === 0 || rightTok.length === 0) return false;
  const [shorter, longer] =
    leftTok.length <= rightTok.length ? [leftTok, rightTok] : [rightTok, leftTok];
  return shorter.every((st) => longer.some((lt) => tokensPairSoft(st, lt)));
}

function hasExactToken(shortCompact: string, other: BrandSegment): boolean {
  return other.tokens.some((token) => token === shortCompact);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j];
  }
  return prev[b.length];
}

function fuzzyMatch(left: string, right: string): boolean {
  const maxLen = Math.max(left.length, right.length);
  if (maxLen < FUZZY_MIN_LEN) return false;
  const diff = Math.abs(left.length - right.length);
  if (diff > Math.max(2, Math.floor(0.2 * maxLen))) return false;
  const ratio = 1 - levenshtein(left, right) / maxLen;
  return ratio >= FUZZY_RATIO;
}

function compareSegments(left: BrandSegment, right: BrandSegment): BrandMatchReason | null {
  const leftCanon = aliasCanonical(left.compact);
  const rightCanon = aliasCanonical(right.compact);

  if (left.compact === right.compact) return 'compact_equal';
  if (leftCanon === rightCanon) return 'alias';

  const leftShort = isShortBrand(left.compact);
  const rightShort = isShortBrand(right.compact);

  if (leftShort || rightShort) {
    if (leftShort && hasExactToken(left.compact, right)) return 'token_exact';
    if (rightShort && hasExactToken(right.compact, left)) return 'token_exact';
    return null;
  }

  const shorter = left.compact.length <= right.compact.length ? left.compact : right.compact;
  const longer = left.compact.length <= right.compact.length ? right.compact : left.compact;
  if (shorter.length >= CONTAINMENT_MIN && longer.includes(shorter)) return 'compact_containment';

  if (tokensSoftMatch(left, right)) return 'token_soft';
  if (fuzzyMatch(left.compact, right.compact)) return 'fuzzy';
  return null;
}

export function brandMatchDetail(vendorBrand: string, amazonBrand: string): BrandMatchDetail {
  const leftSegments = parseBrand(vendorBrand || '');
  const rightSegments = parseBrand(amazonBrand || '');
  const detail = (reason: BrandMatchReason, match: boolean): BrandMatchDetail => ({
    match,
    reason,
    leftSegments: leftSegments.map((s) => s.raw),
    rightSegments: rightSegments.map((s) => s.raw),
  });

  if (leftSegments.length === 0 || rightSegments.length === 0) {
    return detail('empty', false);
  }

  for (const left of leftSegments) {
    for (const right of rightSegments) {
      const reason = compareSegments(left, right);
      if (reason) return detail(reason, true);
    }
  }

  return detail('mismatch', false);
}

export function brandsMatch(vendorBrand: string, amazonBrand: string): boolean {
  return brandMatchDetail(vendorBrand, amazonBrand).match;
}
