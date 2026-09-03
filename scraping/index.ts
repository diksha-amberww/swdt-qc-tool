export type { ScrapeInputRow } from './types/inputRow';
export type { VendorListingJson } from './types/vendorListing';
export type { AmazonListingJson } from './types/amazonListing';
export type { ComparisonProfile, PackagingProfile } from './types/comparisonProfile';
export type {
  VendorScrapeResult,
  AmazonFetchResult,
  RowComparisonPayload,
} from './types/scrapeResult';

export { parseSeawideDetailHtml } from './vendor/seawideDetailParser';
export { scrapeVendorListing } from './vendor/seawideVendorEngine';
export { fetchAmazonListing } from './amazon/amazonSpApiEngine';
export { testAmazonTokenRefresh, resolveAmazonCredentials } from './amazon/amazonTokenProvider';
export { buildRowComparisonPayload, titleSimilarityPct, brandsMatch } from './compare/listingNormalizer';
export { brandMatchDetail } from './compare/brandComparator';
export { upcsMatch, normalizeUpcDigits } from './compare/upcComparator';
export { comparePackaging } from './compare/packagingComparator';
export { compareListingsWithClaude } from './ai/claudeQcComparator';
export { resolveClaudeCredentials } from './ai/claudeCredentials';
