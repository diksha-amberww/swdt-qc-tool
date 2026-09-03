import type { AmazonListingJson } from '../types/amazonListing';
import type { VendorListingJson } from '../types/vendorListing';

const TITLE_MAX = 200;
const FIELD_MAX = 80;

const VOLUME_VALUE_RE =
  /\b(\d+(?:\.\d+)?)\s*(fl\.?\s*oz|oz|ounce|ounces|ml|l|liter|liters|gal|gallon|gallons)\b/i;
const PACK_CLUE_RE =
  /\b(\d+)\s*[- ]?pack\b|\bpack\s*of\s*(\d+)\b|\b(single|multipack)\b|\bset of\s*(\d+)\b|\b(\d+)\s*[- ]?piece\b|\b(\d+)\s*pc\b/i;
const KIT_SET_RE = /\b(set of\s*\d+|\d+\s*[- ]?piece|\d+\s*pc\b|kit)\b/i;
const DIMS_RE = /\d+\s*[x×"']|\d+\s*(ft|in|inch|inches|mm|cm|feet)\b/i;

const AMAZON_ATTR = {
  color: ['color', 'color_name'],
  size: ['size', 'size_map'],
  volume: ['item_volume', 'liquid_volume'],
  pack: ['item_package_quantity', 'number_of_items'],
  voltage: ['voltage', 'power_plug_type'],
} as const;

function flattenAttrValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  if (Array.isArray(value)) {
    return value.map((v) => flattenAttrValue(v)).filter(Boolean).join(' | ');
  }
  if (typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    if (rec.value != null) {
      const unit = rec.unit != null ? ` ${flattenAttrValue(rec.unit)}` : '';
      return `${flattenAttrValue(rec.value)}${unit}`.trim();
    }
    if (rec.name != null) return flattenAttrValue(rec.name);
    return '';
  }
  return String(value);
}

function clip(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, ' ');
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function pushLine(lines: string[], label: string, value: unknown, max = FIELD_MAX): void {
  const text = flattenAttrValue(value);
  if (!text) return;
  lines.push(`${label}: ${clip(text, max)}`);
}

function findVendorAttr(attrs: { key: string; value: string }[], re: RegExp): string {
  for (const a of attrs) {
    if (re.test(a.key.trim())) {
      const v = a.value.trim();
      if (v) return v;
    }
  }
  return '';
}

function extractVolumeFromText(...texts: string[]): string {
  for (const t of texts) {
    const m = t.match(VOLUME_VALUE_RE);
    if (m) return clip(m[0], FIELD_MAX);
  }
  return '';
}

function extractPackCluesFromText(...texts: string[]): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const t of texts) {
    const m = t.match(PACK_CLUE_RE);
    if (!m) continue;
    const phrase = clip(m[0], FIELD_MAX);
    const key = phrase.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    found.push(phrase);
  }
  return found;
}

function extractKitWording(...texts: string[]): string {
  for (const t of texts) {
    const m = t.match(KIT_SET_RE);
    if (m) return clip(m[0], FIELD_MAX);
  }
  return '';
}

function amazonAttr(attrs: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    if (!(key in attrs)) continue;
    const v = flattenAttrValue(attrs[key]);
    if (v && !v.startsWith('{')) return v;
  }
  return '';
}

function extractVoltage(...texts: string[]): string {
  for (const t of texts) {
    const m = t.match(/\b(\d+(?:\.\d+)?)\s*v(?:olts?)?\b/i);
    if (m) return clip(m[0], FIELD_MAX);
  }
  return '';
}

function extractAgeWeight(...texts: string[]): string {
  for (const t of texts) {
    const m =
      t.match(/\b(?:ages?\s*)?\d+\s*(?:to|-)\s*\d+\s*(?:years?|yrs?|months?|lbs?|pounds?)\b/i) ||
      t.match(/\b(?:for\s+)?(?:body\s+)?weight\s+\d+\s*(?:to|-)\s*\d+\s*(?:lbs?|pounds?)\b/i) ||
      t.match(/\b\d+\s*(?:to|-)\s*\d+\s*(?:lbs?|pounds?)\b/i) ||
      t.match(/\b(?:child|infant|adult|youth)\b/i);
    if (m) return clip(m[0], FIELD_MAX);
  }
  return '';
}

function isVolumeOnlySize(value: string): boolean {
  return Boolean(value && VOLUME_VALUE_RE.test(value) && !DIMS_RE.test(value));
}

/**
 * Compact vendor evidence for Claude — identity + variant axes + pack clues only.
 * Never dumps full attribute JSON, descriptions, or packaging signal arrays.
 */
export function buildVendorEvidenceBlock(vendor: VendorListingJson): string {
  const lines: string[] = ['=== VENDOR LISTING ==='];
  const attrs = vendor.raw.attributes || [];
  const title = vendor.title || '';
  const shortDesc = vendor.raw.shortDescription || '';
  const unitSize = vendor.normalized.packaging.unitSize || '';

  pushLine(lines, 'Title', title, TITLE_MAX);
  pushLine(lines, 'Brand', vendor.brand);
  pushLine(lines, 'Model', vendor.modelNumber);
  pushLine(
    lines,
    'Product type',
    vendor.normalized.identity.productType || vendor.normalized.identity.supplierName,
  );

  pushLine(lines, 'Color', findVendorAttr(attrs, /^(color|colour)$/i));

  const sizeAttr = findVendorAttr(attrs, /^(size|dimensions?|length|width|height|chest size)$/i);
  const size = sizeAttr && !isVolumeOnlySize(sizeAttr) ? sizeAttr : unitSize && !isVolumeOnlySize(unitSize) ? unitSize : '';
  pushLine(lines, 'Size', size);

  const volumeAttr = findVendorAttr(attrs, /^(unit size|net contents|volume|liquid volume|item volume)$/i);
  const volume =
    extractVolumeFromText(volumeAttr, unitSize, title, shortDesc) ||
    (volumeAttr && VOLUME_VALUE_RE.test(volumeAttr) ? volumeAttr : '');
  pushLine(lines, 'Volume', volume);

  pushLine(
    lines,
    'Voltage',
    findVendorAttr(attrs, /voltage|volt\b/i) || extractVoltage(title, shortDesc),
  );

  pushLine(
    lines,
    'Age/weight',
    findVendorAttr(attrs, /age|body weight|weight range|for ages/i) ||
      extractAgeWeight(title, shortDesc),
  );

  const packClues: string[] = [];
  const qtyAttr = findVendorAttr(
    attrs,
    /^(unit quantity|quantity|pack quantity|package quantity|item package)$/i,
  );
  if (qtyAttr && !VOLUME_VALUE_RE.test(qtyAttr)) packClues.push(qtyAttr);
  const packDesc = vendor.normalized.packaging.packDescription || '';
  if (packDesc && (!/case/i.test(packDesc) || /pack|single|set/i.test(packDesc))) {
    packClues.push(packDesc);
  }
  packClues.push(...extractPackCluesFromText(title, shortDesc, qtyAttr));
  if (!packClues.length && (volume || vendor.normalized.packaging.unitQuantity === 1)) {
    packClues.push('no multipack cue (default 1)');
  }
  const uniquePack = [...new Set(packClues.map((p) => clip(p, FIELD_MAX)).filter(Boolean))];
  if (uniquePack.length) pushLine(lines, 'Pack clues', uniquePack.join('; '));

  pushLine(lines, 'Kit/set', extractKitWording(title, shortDesc, qtyAttr));
  pushLine(lines, 'Unit type', vendor.normalized.packaging.unitType);

  return lines.join('\n');
}

/**
 * Compact Amazon evidence for Claude — same card shape as vendor.
 */
export function buildAmazonEvidenceBlock(amazon: AmazonListingJson): string {
  const lines: string[] = ['=== AMAZON LISTING ==='];
  const attrs = amazon.raw.attributes || {};
  const title = amazon.title || '';
  const productType =
    amazon.raw.productTypes?.[0]?.productType ||
    (amazon.raw.summaries?.[0] as Record<string, unknown> | undefined)?.productType ||
    amazon.normalized.identity.productType;

  pushLine(lines, 'Title', title, TITLE_MAX);
  pushLine(lines, 'Brand', amazon.brand);
  pushLine(lines, 'Model', amazon.modelNumber);
  pushLine(lines, 'Product type', productType);
  pushLine(lines, 'ASIN', amazon.asin);

  pushLine(lines, 'Color', amazonAttr(attrs, AMAZON_ATTR.color));

  const sizeRaw = amazonAttr(attrs, AMAZON_ATTR.size);
  const volumeRaw = amazonAttr(attrs, AMAZON_ATTR.volume);
  const volume =
    extractVolumeFromText(volumeRaw, sizeRaw, title) ||
    (volumeRaw && VOLUME_VALUE_RE.test(volumeRaw) ? volumeRaw : '');

  const size =
    sizeRaw && (!isVolumeOnlySize(sizeRaw) || DIMS_RE.test(sizeRaw))
      ? isVolumeOnlySize(sizeRaw)
        ? ''
        : sizeRaw
      : '';
  pushLine(lines, 'Size', size);
  pushLine(lines, 'Volume', volume);

  pushLine(lines, 'Voltage', amazonAttr(attrs, AMAZON_ATTR.voltage) || extractVoltage(title));
  pushLine(
    lines,
    'Age/weight',
    extractAgeWeight(title, flattenAttrValue(attrs.size), flattenAttrValue(attrs.size_map)),
  );

  const packClues: string[] = [];
  for (const key of AMAZON_ATTR.pack) {
    const v = amazonAttr(attrs, [key]);
    if (v) packClues.push(`${key}=${v}`);
  }
  const sizeMapRaw = amazonAttr(attrs, ['size_map']);
  packClues.push(...extractPackCluesFromText(title, sizeRaw, sizeMapRaw));
  const packDesc = amazon.normalized.packaging.packDescription || '';
  if (packDesc && !packClues.some((c) => c.toLowerCase().includes(packDesc.toLowerCase()))) {
    packClues.push(packDesc);
  }
  if (
    !packClues.length &&
    (volume || amazon.normalized.packaging.unitQuantity === 1)
  ) {
    packClues.push('no multipack cue (default 1)');
  }
  const uniquePack = [...new Set(packClues.map((p) => clip(p, FIELD_MAX)).filter(Boolean))];
  if (uniquePack.length) pushLine(lines, 'Pack clues', uniquePack.join('; '));

  pushLine(lines, 'Kit/set', extractKitWording(title, sizeRaw, sizeMapRaw));

  return lines.join('\n');
}

/** Fixtures: ensure evidence never dumps raw signals / full attr blobs. */
export function evidenceLooksSlim(block: string): boolean {
  return (
    !block.includes('signal[') &&
    !block.includes('preparsed ') &&
    !block.includes('attr.') &&
    !block.includes('identity.') &&
    !block.includes('Bullet points:') &&
    !block.includes('Short description:')
  );
}
