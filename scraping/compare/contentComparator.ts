import type { SpecificationComparison } from '../types/scrapeResult';
import { normalizeSpecKey } from '../types/comparisonProfile';
import { titleSimilarityPct } from './textSimilarity';
import { parseLeadingNumber } from '../vendor/textUtils';
import type { AmazonListingJson } from '../types/amazonListing';
import type { VendorListingJson } from '../types/vendorListing';

const SPEC_ALIASES: Record<string, string[]> = {
  finish: ['finish', 'exterior finish', 'exterior_finish', 'coating'],
  material: ['material'],
  color: ['color', 'colour'],
  quantity: ['quantity', 'item package quantity', 'number of items', 'unit quantity'],
  weight: ['weight', 'item weight'],
  manufacturer: ['manufacturer'],
  brand: ['brand'],
  'part number': ['part number', 'model number', 'model name'],
  warranty: ['warranty', 'warranty description'],
  design: ['design'],
  'disc type': ['disc type', 'rotor type', 'brake disc type'],
};

const AMAZON_SKIP = new Set([
  'fcc radio frequency emission compliance',
  'batteries required',
  'product site launch date',
  'is assembly required',
  'supplier declared dg hz regulation',
  'package level',
  'unspsc code',
  'bullet point',
  'item name',
  'list price',
  'externally assigned product identifier',
  'item package dimensions',
  'item dimensions',
  'item type keyword',
  'automotive fit type',
  'compatible with vehicle type',
  'included components',
]);

function canonicalSpecKey(key: string): string {
  const normalized = normalizeSpecKey(key);
  for (const [canon, aliases] of Object.entries(SPEC_ALIASES)) {
    if (aliases.some((alias) => normalized === alias || normalized === normalizeSpecKey(alias))) {
      return canon;
    }
  }
  return normalized;
}

function valuesMatch(vendorValue: string, amazonValue: string): boolean {
  const v = vendorValue.toLowerCase().trim();
  const a = amazonValue.toLowerCase().trim();
  if (!v || !a) return false;
  if (v === a) return true;
  if (v.includes(a) || a.includes(v)) return true;
  const vn = parseLeadingNumber(v);
  const an = parseLeadingNumber(a);
  if (vn != null && an != null && vn === an) return true;
  return false;
}

function comparableAmazonEntries(amazon: AmazonListingJson): Record<string, { original: string; value: string }> {
  const byCanon: Record<string, { original: string; value: string }> = {};
  for (const entry of amazon.normalized.specifications.entries) {
    const normalized = normalizeSpecKey(entry.key);
    if (AMAZON_SKIP.has(normalized)) continue;
    if (!entry.value || entry.value.startsWith('{')) continue;
    const canon = canonicalSpecKey(entry.key);
    if (!byCanon[canon]) byCanon[canon] = { original: entry.key, value: entry.value };
  }
  return byCanon;
}

export function compareSpecifications(vendor: VendorListingJson, amazon: AmazonListingJson): SpecificationComparison {
  const overlappingKeys: string[] = [];
  const mismatches: SpecificationComparison['mismatches'] = [];
  const amazonByCanon = comparableAmazonEntries(amazon);

  const vendorSeen = new Set<string>();
  for (const entry of vendor.normalized.specifications.entries) {
    const canon = canonicalSpecKey(entry.key);
    if (vendorSeen.has(canon)) continue;
    vendorSeen.add(canon);
    const amazonHit = amazonByCanon[canon];
    if (!amazonHit) continue;
    overlappingKeys.push(canon);
    if (!valuesMatch(entry.value, amazonHit.value)) {
      mismatches.push({ key: canon, vendorValue: entry.value, amazonValue: amazonHit.value });
    }
  }

  const matched = overlappingKeys.length - mismatches.length;
  const matchPct = overlappingKeys.length === 0 ? 0 : Math.round((matched / overlappingKeys.length) * 100);

  return { overlappingKeys, mismatches, matchPct };
}

function listingDescriptionText(listing: VendorListingJson | AmazonListingJson): string {
  const content = listing.normalized.content;
  return [content.shortDescription, content.longDescription, ...content.features, ...content.bulletPoints]
    .filter(Boolean)
    .join(' ');
}

export function compareDescriptions(vendor: VendorListingJson, amazon: AmazonListingJson): number {
  return titleSimilarityPct(listingDescriptionText(vendor), listingDescriptionText(amazon));
}
