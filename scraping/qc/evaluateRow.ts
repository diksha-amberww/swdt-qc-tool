import type { AmazonListingJson } from '../types/amazonListing';
import type { VendorListingJson } from '../types/vendorListing';
import type { RowComparisonPayload } from '../types/scrapeResult';
import type { ScrapeInputRow } from '../types/inputRow';
import { scrapeVendorListing } from '../vendor/seawideVendorEngine';
import type { FetchLike } from '../vendor/seawideHttpClient';
import { fetchAmazonListing } from '../amazon/amazonSpApiEngine';
import { resolveAmazonCredentials, type AmazonCredentials } from '../amazon/amazonTokenProvider';
import { buildRowComparisonPayload } from '../compare/listingNormalizer';
import { compareImageBuffers, materializeCompareImage, pickAmazonProductImage } from '../compare/imageComparator';
import { compareTitlesWithAi } from '../compare/titleAiComparator';
import { resolveClaudeCredentials } from '../ai/claudeCredentials';
import { emptyComparisonProfile } from '../types/comparisonProfile';
import { emptyVendorRawListing } from '../types/vendorListing';
import { emptyAmazonRawListing } from '../types/amazonListing';

export type QcStatus = 'PASSED' | 'FAILED' | 'MANUAL REVIEW';

export const SPEC_MATCH_THRESHOLD = 70;
export const DESCRIPTION_MATCH_THRESHOLD = 70;
export const TITLE_AI_HIGH_CONFIDENCE = 0.75;

export interface QcEvaluateSettings {
  priceVarianceThreshold: number;
  titleSimilarityThreshold: number;
  imageSimilarityThreshold: number;
  strictPackQuantity: boolean;
}

export interface SlimListingDetails {
  title: string;
  price: number;
  packQuantity: number | null;
  caseQuantity: number | null;
  imageUrl: string;
  modelNumber: string;
  upc: string;
  brand: string;
  availability: string;
}

export interface QcEvaluateResult {
  id: string;
  vendorModel: string;
  partSku: string;
  asin: string;
  brand: string;
  line: string;
  upc: string;
  vendorListing: SlimListingDetails;
  amazonListing: SlimListingDetails;
  vendorListingFull: VendorListingJson | null;
  amazonListingFull: AmazonListingJson | null;
  comparisonPayload: RowComparisonPayload | null;
  titleMatchPct: number;
  priceVariancePct: number;
  imageSimilarityPct: number;
  packQtyMatch: boolean | null;
  upcMatch: boolean;
  modelMatch: boolean;
  brandMatch: boolean;
  specMatchPct: number;
  descriptionMatchPct: number;
  titleSameProduct: boolean | null;
  verdictSentence: string;
  status: QcStatus;
  aiVerdictReason: string;
  aiTokensUsed: { input: number; output: number };
  confidenceScore: number;
  timestamp: string;
  errors: string[];
}

type CheckResult = 'yes' | 'no' | 'unknown';

interface FieldCheck {
  name: string;
  result: CheckResult;
  failOnNo: boolean;
  detail: string;
}

function slimFromVendor(listing: VendorListingJson | null, fallbackUpc: string, fallbackModel: string): SlimListingDetails {
  if (!listing) {
    return {
      title: '',
      price: 0,
      packQuantity: null,
      caseQuantity: null,
      imageUrl: '',
      modelNumber: fallbackModel,
      upc: fallbackUpc,
      brand: '',
      availability: 'Not scraped',
    };
  }
  return {
    title: listing.title,
    price: listing.normalized.pricing.retailPrice || listing.normalized.pricing.msrp || listing.raw.pricing.costPrice || 0,
    packQuantity: listing.normalized.packaging.unitQuantity,
    caseQuantity: listing.normalized.packaging.caseQuantity,
    imageUrl: listing.normalized.media.images[0] || '',
    modelNumber: listing.modelNumber,
    upc: listing.upc,
    brand: listing.brand,
    availability: listing.normalized.inventory.availability || '',
  };
}

function slimFromAmazon(listing: AmazonListingJson | null): SlimListingDetails {
  if (!listing) {
    return {
      title: '',
      price: 0,
      packQuantity: null,
      caseQuantity: null,
      imageUrl: '',
      modelNumber: '',
      upc: '',
      brand: '',
      availability: 'Not fetched',
    };
  }
  return {
    title: listing.title,
    price: listing.normalized.pricing.retailPrice || 0,
    packQuantity: listing.normalized.packaging.unitQuantity,
    caseQuantity: listing.normalized.packaging.caseQuantity,
    imageUrl: listing.normalized.media.images[0] || '',
    modelNumber: listing.modelNumber,
    upc: listing.upc,
    brand: listing.brand,
    availability: listing.normalized.inventory.availability || '',
  };
}

function placeholderVendor(input: ScrapeInputRow): VendorListingJson {
  return {
    source: 'seawide',
    scrapedAt: new Date().toISOString(),
    input,
    raw: emptyVendorRawListing(),
    normalized: emptyComparisonProfile(),
    title: '',
    brand: '',
    modelNumber: input.vendorModel,
    upc: input.upc,
  };
}

function placeholderAmazon(asin: string, marketplaceId: string): AmazonListingJson {
  return {
    source: 'amazon_sp_api',
    fetchedAt: new Date().toISOString(),
    asin,
    marketplaceId,
    raw: emptyAmazonRawListing(),
    normalized: emptyComparisonProfile(),
    title: '',
    brand: '',
    modelNumber: '',
    upc: '',
  };
}

function priceVariancePct(vendorPrice: number, amazonPrice: number): number {
  if (!vendorPrice || !amazonPrice) return 0;
  return Number((((amazonPrice - vendorPrice) / vendorPrice) * 100).toFixed(1));
}

function formatQty(value: number | null | undefined): string {
  return value == null ? 'unpublished' : String(value);
}

function buildVerdictSentence(checks: FieldCheck[], status: QcStatus, scrapeErrors: string[]): string {
  if (scrapeErrors.length) {
    return `Could not finish comparison: ${scrapeErrors.join(' ')}`;
  }
  if (status === 'PASSED') {
    return 'Core fields match: brand, model, pack size, UPC, image, and titles represent the same product.';
  }
  const failed = checks.filter((c) => c.result === 'no');
  const unknown = checks.filter((c) => c.result === 'unknown');
  const matched = checks.filter((c) => c.result === 'yes').map((c) => c.name);
  const parts: string[] = [];
  if (failed.length) parts.push(failed.map((c) => c.detail).join(' '));
  if (unknown.length) parts.push(unknown.map((c) => c.detail).join(' '));
  if (matched.length) parts.push(`Matched: ${matched.join(', ')}.`);
  return parts.join(' ') || 'Comparison is incomplete.';
}

const CORE_CHECK_NAMES = new Set(['brand', 'model', 'pack size', 'UPC', 'image', 'title']);

function resolveStatus(checks: FieldCheck[], scrapeErrors: string[]): QcStatus {
  if (scrapeErrors.length) return 'MANUAL REVIEW';
  if (checks.some((c) => c.result === 'no' && c.failOnNo)) return 'FAILED';
  const core = checks.filter((c) => CORE_CHECK_NAMES.has(c.name));
  if (core.some((c) => c.result === 'no')) return 'MANUAL REVIEW';
  if (core.some((c) => c.result === 'unknown')) return 'MANUAL REVIEW';
  if (core.every((c) => c.result === 'yes')) return 'PASSED';
  return 'MANUAL REVIEW';
}

export async function evaluateQcRow(
  input: ScrapeInputRow,
  options: {
    fetchImpl: FetchLike;
    settings: QcEvaluateSettings;
    amazonCreds?: AmazonCredentials;
    claudeCreds?: ReturnType<typeof resolveClaudeCredentials>;
    appPath?: string;
  },
): Promise<QcEvaluateResult> {
  const errors: string[] = [];
  const amazonCreds = options.amazonCreds || resolveAmazonCredentials(options.appPath);
  const claudeCreds = options.claudeCreds || resolveClaudeCredentials(options.appPath);
  const imageThreshold = options.settings.imageSimilarityThreshold ?? 50;

  const vendorResult = await scrapeVendorListing(input, { fetchImpl: options.fetchImpl });
  if (!vendorResult.success || !vendorResult.listing) {
    errors.push(vendorResult.error?.message || 'Vendor scrape failed');
  }

  const amazonResult = await fetchAmazonListing(input.asin, amazonCreds);
  if (!amazonResult.success || !amazonResult.listing) {
    errors.push(amazonResult.error?.message || 'Amazon fetch failed');
  }

  const vendor = vendorResult.listing || placeholderVendor(input);
  const amazon = amazonResult.listing || placeholderAmazon(input.asin, amazonCreds.marketplaceId);
  const comparisonPayload: RowComparisonPayload | null =
    vendorResult.listing && amazonResult.listing ? buildRowComparisonPayload(vendor, amazon) : null;

  const identity = comparisonPayload?.comparison.identity;
  const packaging = comparisonPayload?.comparison.packaging;
  const identifiers = comparisonPayload?.comparison.identifiers;
  const vendorSlim = slimFromVendor(vendor, input.upc, input.vendorModel);
  const amazonSlim = slimFromAmazon(amazon);
  const variance = priceVariancePct(vendorSlim.price, amazonSlim.price);

  const [vendorImage, amazonImage, titleAi] = await Promise.all([
    materializeCompareImage(vendorSlim.imageUrl, options.fetchImpl),
    pickAmazonProductImage(amazon.normalized.media.images.length
      ? amazon.normalized.media.images
      : amazonSlim.imageUrl
        ? [amazonSlim.imageUrl]
        : []),
    compareTitlesWithAi(vendorSlim.title, amazonSlim.title, claudeCreds, {
      vendorBrand: vendor.brand,
      amazonBrand: amazon.brand,
      vendorModel: vendor.modelNumber,
      amazonModel: amazon.modelNumber,
    }),
  ]);

  if (vendorImage) vendorSlim.imageUrl = vendorImage.dataUrl;
  if (amazonImage) amazonSlim.imageUrl = amazonImage.url;
  const imageSimilarityPct =
    vendorImage && amazonImage ? await compareImageBuffers(vendorImage.buffer, amazonImage.buffer) : 0;

  if (comparisonPayload) {
    comparisonPayload.comparison.identity.titleSameProduct = titleAi.sameProduct;
    comparisonPayload.comparison.identity.titleAiConfidence = titleAi.confidence;
    comparisonPayload.comparison.identity.titleAiReason = titleAi.reason;
  }

  const brandPresent = Boolean(vendor.brand && amazon.brand);
  const brandMatch = identity?.brandMatch ?? false;
  const modelPresent = Boolean(vendor.modelNumber && amazon.modelNumber);
  const modelMatch = identity?.modelMatch ?? false;
  const packQtyMatch = packaging?.unitQtyMatch ?? null;
  const upcMatch = identifiers?.upcMatch ?? false;
  const specMatchPct = comparisonPayload?.comparison.specifications.matchPct ?? 0;
  const descriptionMatchPct = comparisonPayload?.comparison.content.descriptionMatchPct ?? 0;
  const specOverlap = comparisonPayload?.comparison.specifications.overlappingKeys.length ?? 0;
  const titleMatchPct = identity?.titleSimilarityPct ?? 0;

  const checks: FieldCheck[] = [
    {
      name: 'brand',
      result: !brandPresent ? 'unknown' : brandMatch ? 'yes' : 'no',
      failOnNo: true,
      detail: !brandPresent
        ? 'Brand is missing on one or both listings.'
        : brandMatch
          ? `Brand matches (${vendor.brand}).`
          : `Brand differs: ${vendor.brand} vs ${amazon.brand}.`,
    },
    {
      name: 'model',
      result: !modelPresent ? 'unknown' : modelMatch ? 'yes' : 'no',
      failOnNo: false,
      detail: !modelPresent
        ? 'Model number is missing on one or both listings.'
        : modelMatch
          ? `Model matches (${vendor.modelNumber}).`
          : `Model numbers differ: ${vendor.modelNumber} vs ${amazon.modelNumber}.`,
    },
    {
      name: 'pack size',
      result: packQtyMatch == null ? 'unknown' : packQtyMatch ? 'yes' : 'no',
      failOnNo: options.settings.strictPackQuantity,
      detail:
        packQtyMatch == null
          ? `Pack size is unpublished on one or both listings (vendor ${formatQty(vendorSlim.packQuantity)}, Amazon ${formatQty(amazonSlim.packQuantity)}). Case qty is not pack size.`
          : packQtyMatch
            ? `Pack size matches (${vendorSlim.packQuantity}).`
            : `Pack size differs (vendor ${vendorSlim.packQuantity} vs Amazon ${amazonSlim.packQuantity}).`,
    },
    {
      name: 'UPC',
      result: !identifiers?.upcAmazon && !amazon.upc ? 'unknown' : upcMatch ? 'yes' : 'no',
      failOnNo: true,
      detail: upcMatch
        ? `UPC matches Amazon ${identifiers?.matchedAmazonIdentifier?.type || 'identifier'} ${identifiers?.upcAmazon || amazon.upc}.`
        : !amazon.upc && !identifiers?.upcAmazon
          ? 'Amazon catalog did not publish a UPC/EAN/GTIN for this ASIN.'
          : `UPC mismatch: input/vendor ${identifiers?.upcVendor || input.upc} vs Amazon ${identifiers?.upcAmazon || amazon.upc}.`,
    },
    {
      name: 'image',
      result: !vendorSlim.imageUrl || !amazonSlim.imageUrl
        ? 'unknown'
        : imageSimilarityPct >= imageThreshold
          ? 'yes'
          : 'no',
      failOnNo: false,
      detail: !vendorSlim.imageUrl || !amazonSlim.imageUrl
        ? 'One or both listings are missing a compare image.'
        : imageSimilarityPct >= imageThreshold
          ? `Images match (${imageSimilarityPct}% ≥ ${imageThreshold}%).`
          : `Images are below ${imageThreshold}% similarity (${imageSimilarityPct}%).`,
    },
    {
      name: 'specs',
      result: specOverlap === 0 ? 'unknown' : specMatchPct >= SPEC_MATCH_THRESHOLD ? 'yes' : 'no',
      failOnNo: false,
      detail: specOverlap === 0
        ? 'No overlapping specification keys to compare.'
        : specMatchPct >= SPEC_MATCH_THRESHOLD
          ? `Specs match ${specMatchPct}% (≥ ${SPEC_MATCH_THRESHOLD}%).`
          : `Specs match ${specMatchPct}%, below ${SPEC_MATCH_THRESHOLD}%.`,
    },
    {
      name: 'description',
      result: descriptionMatchPct <= 0 ? 'unknown' : descriptionMatchPct >= DESCRIPTION_MATCH_THRESHOLD ? 'yes' : 'no',
      failOnNo: false,
      detail: descriptionMatchPct <= 0
        ? 'Description text is missing on one or both listings.'
        : descriptionMatchPct >= DESCRIPTION_MATCH_THRESHOLD
          ? `Description match ${descriptionMatchPct}% (≥ ${DESCRIPTION_MATCH_THRESHOLD}%).`
          : `Description match ${descriptionMatchPct}%, below ${DESCRIPTION_MATCH_THRESHOLD}%.`,
    },
    {
      name: 'title',
      result: titleAi.sameProduct == null
        ? 'unknown'
        : titleAi.sameProduct
          ? 'yes'
          : 'no',
      failOnNo: titleAi.sameProduct === false && titleAi.confidence >= TITLE_AI_HIGH_CONFIDENCE,
      detail: titleAi.reason,
    },
  ];

  const status = resolveStatus(checks, errors);
  const verdictSentence = buildVerdictSentence(checks, status, errors);
  const confidence =
    status === 'PASSED' ? 0.92 : status === 'FAILED' ? 0.88 : 0.55;

  return {
    id: `qc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    vendorModel: input.vendorModel,
    partSku: input.vendorModel,
    asin: input.asin,
    brand: vendor.brand || amazon.brand,
    line: amazon.normalized.identity.productType || vendor.normalized.identity.supplierName || '',
    upc: input.upc,
    vendorListing: vendorSlim,
    amazonListing: amazonSlim,
    vendorListingFull: vendorResult.listing,
    amazonListingFull: amazonResult.listing,
    comparisonPayload,
    titleMatchPct,
    priceVariancePct: variance,
    imageSimilarityPct,
    packQtyMatch,
    upcMatch,
    modelMatch,
    brandMatch,
    specMatchPct,
    descriptionMatchPct,
    titleSameProduct: titleAi.sameProduct,
    verdictSentence,
    status,
    aiVerdictReason: verdictSentence,
    aiTokensUsed: titleAi.tokensUsed,
    confidenceScore: confidence,
    timestamp: new Date().toLocaleTimeString(),
    errors,
  };
}
