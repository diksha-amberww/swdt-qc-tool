import type { AmazonListingJson } from '../types/amazonListing';
import type { VendorListingJson } from '../types/vendorListing';
import type { IdentityComparison, RowComparisonPayload } from '../types/scrapeResult';
import { comparePackaging } from './packagingComparator';
import { compareUpcAnyMatch } from './upcAnyMatch';
import { compareDescriptions, compareSpecifications } from './contentComparator';
import { titleSimilarityPct } from './textSimilarity';
import { brandsMatch } from './brandComparator';

export { titleSimilarityPct } from './textSimilarity';
export { brandsMatch };

function modelsMatch(vendorModel: string, amazonModel: string): boolean {
  const vModel = vendorModel.replace(/[\s-]/g, '').toLowerCase();
  const aModel = amazonModel.replace(/[\s-]/g, '').toLowerCase();
  return Boolean(vModel) && Boolean(aModel) && (vModel.includes(aModel) || aModel.includes(vModel));
}

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
      specifications: compareSpecifications(vendor, amazon),
      content: {
        descriptionMatchPct: compareDescriptions(vendor, amazon),
      },
    },
  };
}
