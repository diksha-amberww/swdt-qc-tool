import type { AmazonListingJson } from './amazonListing';
import type { PackagingProfile } from './comparisonProfile';
import type { VendorListingJson } from './vendorListing';

export interface ScrapeError {
  code: string;
  message: string;
  retryable?: boolean;
}

export interface ScrapeTiming {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

export interface VendorScrapeResult {
  success: boolean;
  listing: VendorListingJson | null;
  error?: ScrapeError;
  timing: ScrapeTiming;
  sourceUrl?: string;
}

export interface AmazonFetchResult {
  success: boolean;
  listing: AmazonListingJson | null;
  error?: ScrapeError;
  timing: ScrapeTiming;
}

export interface IdentifierComparison {
  upcMatch: boolean;
  upcVendor: string;
  upcAmazon: string;
  matchedAmazonIdentifier?: { type: string; value: string };
  allMatches: { type: string; vendorValue: string; amazonValue: string }[];
}

export interface PackagingComparison {
  unitQtyMatch: boolean | null;
  caseQtyMatch: boolean | null;
  notes: string[];
  vendorPackaging: PackagingProfile;
  amazonPackaging: PackagingProfile;
}

export interface IdentityComparison {
  titleSimilarityPct: number;
  brandMatch: boolean;
  modelMatch: boolean;
  titleSameProduct: boolean | null;
  titleAiConfidence: number;
  titleAiReason: string;
}

export interface SpecificationComparison {
  overlappingKeys: string[];
  mismatches: { key: string; vendorValue: string; amazonValue: string }[];
  matchPct: number;
}

export interface ContentComparison {
  descriptionMatchPct: number;
}

export interface RowComparisonPayload {
  vendor: VendorListingJson;
  amazon: AmazonListingJson;
  comparison: {
    identifiers: IdentifierComparison;
    packaging: PackagingComparison;
    identity: IdentityComparison;
    specifications: SpecificationComparison;
    content: ContentComparison;
  };
}
