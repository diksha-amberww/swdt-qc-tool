import { normalizeUpcDigits, upcsMatch } from './upcComparator';
import type { IdentifierComparison } from '../types/scrapeResult';
import type { IdentifierRecord } from '../types/comparisonProfile';

const BARCODE_TYPES = new Set(['UPC', 'EAN', 'GTIN', 'ISBN']);
const SKIP_TYPES = new Set(['ASIN', 'PID', 'VCPN', 'MPN', 'KEYSTONE', 'SKU']);

function isBarcodeRecord(record: IdentifierRecord): boolean {
  const type = (record.type || '').toUpperCase();
  if (SKIP_TYPES.has(type)) return false;
  if (BARCODE_TYPES.has(type)) return true;
  const digits = normalizeUpcDigits(record.value);
  return /^\d{8,14}$/.test(digits);
}

export function compareUpcAnyMatch(
  vendorUpc: string,
  vendorIds: IdentifierRecord[],
  amazonUpc: string,
  amazonIds: IdentifierRecord[],
): IdentifierComparison {
  const vendorCandidates = [
    { type: 'UPC', value: vendorUpc, source: 'vendor' },
    ...vendorIds,
  ].filter((id) => isBarcodeRecord(id) && normalizeUpcDigits(id.value));

  const amazonCandidates = [
    { type: amazonUpc ? 'UPC' : '', value: amazonUpc, source: 'amazon' },
    ...amazonIds,
  ].filter((id) => isBarcodeRecord(id) && normalizeUpcDigits(id.value));

  const allMatches: IdentifierComparison['allMatches'] = [];
  let matchedAmazonIdentifier: IdentifierComparison['matchedAmazonIdentifier'];

  for (const vendorId of vendorCandidates) {
    for (const amazonId of amazonCandidates) {
      if (!upcsMatch(vendorId.value, amazonId.value)) continue;
      allMatches.push({
        type: amazonId.type || vendorId.type,
        vendorValue: vendorId.value,
        amazonValue: amazonId.value,
      });
      if (!matchedAmazonIdentifier) {
        matchedAmazonIdentifier = { type: amazonId.type || 'UPC', value: amazonId.value };
      }
    }
  }

  return {
    upcMatch: allMatches.length > 0,
    upcVendor: normalizeUpcDigits(vendorUpc) || normalizeUpcDigits(vendorCandidates[0]?.value),
    upcAmazon: matchedAmazonIdentifier
      ? normalizeUpcDigits(matchedAmazonIdentifier.value)
      : normalizeUpcDigits(amazonUpc) || normalizeUpcDigits(amazonCandidates[0]?.value),
    matchedAmazonIdentifier,
    allMatches,
  };
}
