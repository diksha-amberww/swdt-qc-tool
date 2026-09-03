import type { AmazonListingJson } from '../types/amazonListing';
import type { VendorListingJson } from '../types/vendorListing';
import type { IdentityComparison, RowComparisonPayload } from '../types/scrapeResult';
import { comparePackaging } from './packagingComparator';
import { compareUpcAnyMatch } from './upcAnyMatch';
import { titleSimilarityPct } from './textSimilarity';
import { brandsMatch } from './brandComparator';
import { modelsMatch } from './modelComparator';

export { titleSimilarityPct } from './textSimilarity';
export { brandsMatch };
export { modelsMatch };

function compareIdentity(vendor: VendorListingJson, amazon: AmazonListingJson): IdentityComparison {
  return {
    titleSimilarityPct: titleSimilarityPct(vendor.title, amazon.title),
    brandMatch: brandsMatch(vendor.brand, amazon.brand),
    modelMatch: modelsMatch(vendor.modelNumber, amazon.modelNumber),
    titleSameProduct: null,
    titleAiConfidence: 0,
    titleAiReason: '',
  };
}

export function buildRowComparisonPayload(
  vendor: VendorListingJson,
  amazon: AmazonListingJson,
): RowComparisonPayload {
  return {
    vendor,
    amazon,
    comparison: {
      identifiers: compareUpcAnyMatch(
        vendor.upc,
        vendor.normalized.identifiers.all,
        amazon.upc,
        amazon.normalized.identifiers.all,
      ),
      packaging: comparePackaging(vendor.normalized.packaging, amazon.normalized.packaging),
      identity: compareIdentity(vendor, amazon),
      // Specs / description scoring disabled — stubs kept for payload shape compatibility.
      specifications: { overlappingKeys: [], mismatches: [], matchPct: 0 },
      content: { descriptionMatchPct: 0 },
    },
  };
}
