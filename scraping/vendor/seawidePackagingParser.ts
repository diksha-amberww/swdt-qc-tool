import {
  emptyPackagingProfile,
  type PackagingProfile,
  type PackagingSignal,
} from '../types/comparisonProfile';
import type { VendorRawListing } from '../types/vendorListing';
import { cleanText, parseLeadingNumber } from './textUtils';

const UNIT_QTY_KEYS = [
  'unit quantity',
  'pack quantity',
  'package quantity',
  'item package quantity',
  'quantity',
];
const CASE_QTY_KEYS = ['mfg case qty', 'mfg case', 'case qty', 'case quantity', 'case pack'];
const UNIT_SIZE_KEYS = ['unit size', 'size', 'volume', 'net contents'];
const UNIT_TYPE_KEYS = ['unit type', 'package type', 'container type'];

const PACK_TOKEN_RE = /\b(single|pack of \d+|\d+\s*[- ]?pack)\b/i;
const PACK_SEGMENT_RE = /^(single|each|ea\.?|one)$/i;

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function keyMatches(key: string, needles: string[]): boolean {
  const normalized = normalizeKey(key);
  return needles.some((n) => normalized === n || normalized.includes(n));
}

function isCaseKey(key: string): boolean {
  return keyMatches(key, CASE_QTY_KEYS);
}

function isUnitQtyKey(key: string): boolean {
  if (isCaseKey(key)) return false;
  return keyMatches(key, UNIT_QTY_KEYS);
}

function pushSignal(
  signals: PackagingSignal[],
  source: PackagingSignal['source'],
  field: string,
  rawValue: string,
): void {
  const value = cleanText(rawValue);
  if (!value) return;
  signals.push({
    source,
    field,
    rawValue: value,
    parsedNumber: parseLeadingNumber(value),
  });
}

function firstNumeric(signals: PackagingSignal[], fieldIncludes: string[]): number | null {
  for (const signal of signals) {
    const field = normalizeKey(signal.field);
    if (fieldIncludes.some((f) => field.includes(f)) && signal.parsedNumber != null && signal.parsedNumber > 0) {
      return signal.parsedNumber;
    }
  }
  return null;
}

function firstText(signals: PackagingSignal[], fieldIncludes: string[]): string | null {
  for (const signal of signals) {
    const field = normalizeKey(signal.field);
    if (fieldIncludes.some((f) => field.includes(f)) && signal.rawValue) {
      return signal.rawValue;
    }
  }
  return null;
}

function isPackSegment(segment: string): boolean {
  const trimmed = cleanText(segment);
  if (!trimmed) return false;
  if (PACK_SEGMENT_RE.test(trimmed)) return true;
  return PACK_TOKEN_RE.test(trimmed);
}

export function buildVendorPackagingProfile(raw: VendorRawListing): PackagingProfile {
  const profile = emptyPackagingProfile();
  const signals: PackagingSignal[] = [];

  for (const attr of raw.attributes) {
    if (isCaseKey(attr.key)) {
      pushSignal(signals, 'attribute', attr.key, attr.value);
    } else if (isUnitQtyKey(attr.key)) {
      pushSignal(signals, 'attribute', attr.key, attr.value);
    } else if (keyMatches(attr.key, UNIT_SIZE_KEYS) && !isCaseKey(attr.key)) {
      pushSignal(signals, 'attribute', attr.key, attr.value);
    } else if (keyMatches(attr.key, UNIT_TYPE_KEYS)) {
      pushSignal(signals, 'attribute', attr.key, attr.value);
    }
  }

  if (raw.cartMetadata.caseQuantity != null && raw.cartMetadata.caseQuantity > 0) {
    pushSignal(signals, 'cart_json', 'CaseQuantity', String(raw.cartMetadata.caseQuantity));
  }

  const segments = raw.descriptionSegments.length
    ? raw.descriptionSegments
    : raw.shortDescription.split(';').map((s) => s.trim()).filter(Boolean);

  for (const segment of segments) {
    if (isPackSegment(segment)) {
      pushSignal(signals, 'description', 'shortDescription.segment', segment);
    }
  }

  const titlePack = raw.titleHtml.match(PACK_TOKEN_RE);
  if (titlePack) {
    pushSignal(signals, 'title_token', 'title', titlePack[0]);
  }

  profile.rawSignals = signals;

  const unitFromAttr = firstNumeric(signals.filter((s) => s.source === 'attribute'), [
    'unit quantity',
    'pack quantity',
    'package quantity',
    'item package',
    'quantity',
  ]);
  const unitFromTitle = firstNumeric(
    signals.filter((s) => s.source === 'title_token' || s.source === 'description'),
    ['title', 'short'],
  );
  // No pack/unit quantity on vendor → treat as single (1). Unit size and case qty are not pack size.
  const defaultedUnitQty = unitFromAttr == null && unitFromTitle == null;
  profile.unitQuantity = unitFromAttr ?? unitFromTitle ?? 1;

  const caseFromAttr = firstNumeric(signals.filter((s) => s.source === 'attribute'), [
    'mfg case',
    'case qty',
    'case quantity',
    'case pack',
  ]);
  const caseFromCart =
    signals.find((s) => s.field === 'CaseQuantity' && (s.parsedNumber || 0) > 0)?.parsedNumber ?? null;
  profile.caseQuantity = caseFromAttr ?? caseFromCart;

  profile.unitSize = firstText(
    signals.filter((s) => s.source === 'attribute'),
    ['unit size', 'volume', 'net contents'],
  );
  profile.unitType = firstText(signals.filter((s) => s.source === 'attribute'), [
    'unit type',
    'package type',
    'container',
  ]);

  const packDesc =
    firstText(signals.filter((s) => s.source === 'attribute'), ['unit quantity', 'pack quantity', 'package quantity', 'quantity']) ||
    firstText(signals.filter((s) => s.source === 'description'), ['short']) ||
    firstText(signals.filter((s) => s.source === 'title_token'), ['title']);
  profile.packDescription = packDesc ?? (defaultedUnitQty ? 'Single (defaulted)' : null);

  if (profile.unitQuantity != null) {
    profile.isMultipack = profile.unitQuantity > 1;
  } else if (packDesc) {
    profile.isMultipack = /pack of|\d+\s*[- ]?pack/i.test(packDesc) && !/^single$/i.test(packDesc);
  }

  profile.itemPackageQuantity = profile.unitQuantity;

  if (unitFromAttr != null) {
    profile.confidence = 'high';
  } else if (unitFromTitle != null) {
    profile.confidence = 'medium';
  } else if (defaultedUnitQty) {
    profile.confidence = 'low';
  } else if (signals.length > 0) {
    profile.confidence = 'low';
  } else {
    profile.confidence = 'unknown';
  }

  return profile;
}
