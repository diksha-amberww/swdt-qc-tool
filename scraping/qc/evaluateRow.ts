import type { AmazonListingJson } from '../types/amazonListing';
import type { VendorListingJson } from '../types/vendorListing';
import type { RowComparisonPayload } from '../types/scrapeResult';
import type { ScrapeInputRow } from '../types/inputRow';
import { scrapeVendorListing } from '../vendor/seawideVendorEngine';
import type { FetchLike } from '../vendor/seawideHttpClient';
import { fetchAmazonListing } from '../amazon/amazonSpApiEngine';
import { resolveAmazonCredentials, type AmazonCredentials } from '../amazon/amazonTokenProvider';
import { buildRowComparisonPayload } from '../compare/listingNormalizer';
import {
  materializeCompareImage,
  pickAmazonProductImage,
  prepareImageForClaude,
  type ClaudeImagePayload,
} from '../compare/imageComparator';
import {
  applyClaudePackSizes,
  compareListingsWithClaude,
  type ClaudeQcResult,
  type VariantConflict,
} from '../ai/claudeQcComparator';
import { buildAmazonEvidenceBlock, buildVendorEvidenceBlock } from '../ai/qcEvidenceBuilder';
import { modelMatchDetail } from '../compare/modelComparator';
import { resolveClaudeCredentials } from '../ai/claudeCredentials';
import { emptyComparisonProfile } from '../types/comparisonProfile';
import { emptyVendorRawListing } from '../types/vendorListing';
import { emptyAmazonRawListing } from '../types/amazonListing';

export type QcStatus = 'PASSED' | 'FAILED' | 'MANUAL REVIEW';

export type FailReasonCode =
  | ''
  | 'BRAND'
  | 'MODEL'
  | 'PACK'
  | 'QTY_UNSURE'
  | 'UPC'
  | 'IMAGE'
  | 'SIZE'
  | 'VOLUME'
  | 'AGE'
  | 'VOLTAGE'
  | 'COLOR'
  | 'PRODUCT'
  | 'TITLE'
  | 'SCRAPE';

export interface QcEvaluateSettings {
  priceVarianceThreshold: number;
  titleSimilarityThreshold: number;
  imageSimilarityThreshold: number;
  strictPackQuantity: boolean;
  /** @deprecated unused — specs no longer scored */
  specMatchThreshold?: number;
  /** @deprecated unused — description no longer scored */
  descriptionMatchThreshold?: number;
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
  imageSimilarityPct: number | null;
  packQtyMatch: boolean | null;
  upcMatch: boolean;
  modelMatch: boolean;
  brandMatch: boolean;
  /** Always 0 — specs comparison disabled */
  specMatchPct: number;
  /** Always 0 — description comparison disabled */
  descriptionMatchPct: number;
  titleSameProduct: boolean | null;
  titleResult: 'YES' | 'NO' | null;
  variantConflict: VariantConflict | null;
  packConfidence: 'SURE' | 'UNSURE' | null;
  checks: QcFieldCheckResult[];
  failReason: FailReasonCode;
  /** Short one-line log string (not exported) */
  verdictSentence: string;
  status: QcStatus;
  aiVerdictReason: string;
  aiTokensUsed: { input: number; output: number };
  confidenceScore: number;
  timestamp: string;
  errors: string[];
}

type CheckResult = 'yes' | 'no' | 'unknown';

export interface QcFieldCheckResult {
  name: string;
  result: CheckResult;
  detail: string;
}

interface FieldCheck extends QcFieldCheckResult {
  failOnNo: boolean;
  failCode?: FailReasonCode;
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

function resolveStatus(checks: FieldCheck[], scrapeErrors: string[]): QcStatus {
  if (scrapeErrors.length) return 'MANUAL REVIEW';
  if (checks.some((c) => c.result === 'no' && c.failOnNo)) return 'FAILED';
  if (checks.some((c) => c.result === 'no')) return 'MANUAL REVIEW';
  if (checks.some((c) => c.result === 'unknown')) return 'MANUAL REVIEW';
  return 'PASSED';
}

function buildFailReason(
  checks: FieldCheck[],
  status: QcStatus,
  scrapeErrors: string[],
): FailReasonCode {
  if (scrapeErrors.length) return 'SCRAPE';
  if (status === 'PASSED') return '';

  const hardFail = checks.find((c) => c.result === 'no' && c.failOnNo && c.failCode);
  if (hardFail?.failCode) return hardFail.failCode;

  const soft = checks.find((c) => (c.result === 'no' || c.result === 'unknown') && c.failCode);
  if (soft?.failCode) return soft.failCode;

  return 'PRODUCT';
}

function buildLogSentence(status: QcStatus, failReason: FailReasonCode, scrapeErrors: string[]): string {
  if (scrapeErrors.length) return `Could not finish comparison: ${scrapeErrors.join(' ')}`;
  if (status === 'PASSED') return 'PASSED';
  if (failReason) return `${status}: ${failReason}`;
  return status;
}

function titleCheckDetail(titleResult: 'YES' | 'NO' | null): string {
  if (titleResult === 'YES') return 'Titles represent the same product (AI: YES).';
  if (titleResult === 'NO') return 'Titles do not represent the same product (AI: NO).';
  return 'Title comparison was not completed by AI.';
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

  let claudeQc: ClaudeQcResult | null = null;
  let vendorClaudeImage: ClaudeImagePayload | null = null;
  let amazonClaudeImage: ClaudeImagePayload | null = null;
  const bothListingsFetched = Boolean(vendorResult.listing && amazonResult.listing);

  if (bothListingsFetched) {
    const vendorSlimForImages = slimFromVendor(vendor, input.upc, input.vendorModel);
    const amazonSlimForImages = slimFromAmazon(amazon);

    const [vendorImage, amazonImage] = await Promise.all([
      materializeCompareImage(vendorSlimForImages.imageUrl, options.fetchImpl),
      pickAmazonProductImage(
        amazon.normalized.media.images.length
          ? amazon.normalized.media.images
          : amazonSlimForImages.imageUrl
            ? [amazonSlimForImages.imageUrl]
            : [],
      ),
    ]);

    [vendorClaudeImage, amazonClaudeImage] = await Promise.all([
      prepareImageForClaude(vendorImage),
      prepareImageForClaude(amazonImage),
    ]);

    claudeQc = await compareListingsWithClaude(
      {
        vendorEvidence: buildVendorEvidenceBlock(vendor),
        amazonEvidence: buildAmazonEvidenceBlock(amazon),
        vendorTitle: vendor.title,
        amazonTitle: amazon.title,
        vendorImage: vendorClaudeImage,
        amazonImage: amazonClaudeImage,
      },
      claudeCreds,
    );

    if (claudeQc.error) {
      errors.push(claudeQc.error);
    }

    // Only overwrite parser pack sizes when AI is confident.
    if (
      claudeQc.packConfidence === 'SURE' &&
      claudeQc.vendorPackSize != null &&
      claudeQc.amazonPackSize != null &&
      !claudeQc.skipped
    ) {
      applyClaudePackSizes(vendor, amazon, claudeQc.vendorPackSize, claudeQc.amazonPackSize);
    }
  }

  const comparisonPayload: RowComparisonPayload | null = bothListingsFetched
    ? buildRowComparisonPayload(vendor, amazon)
    : null;

  const identity = comparisonPayload?.comparison.identity;
  const packaging = comparisonPayload?.comparison.packaging;
  const identifiers = comparisonPayload?.comparison.identifiers;
  const vendorSlim = slimFromVendor(vendor, input.upc, input.vendorModel);
  const amazonSlim = slimFromAmazon(amazon);
  const variance = priceVariancePct(vendorSlim.price, amazonSlim.price);

  const titleResult = claudeQc?.titleResult ?? null;
  const titleSameProduct =
    titleResult === 'YES' ? true : titleResult === 'NO' ? false : null;
  const bothImagesReady = Boolean(vendorClaudeImage && amazonClaudeImage);
  // Ignore AI image % when either side lacked a usable Claude image.
  const imageSimilarityPct = bothImagesReady ? (claudeQc?.imageSimilarityPct ?? null) : null;
  const packConfidence = claudeQc?.packConfidence ?? null;
  const variantConflict = claudeQc?.variantConflict ?? null;

  if (comparisonPayload) {
    comparisonPayload.comparison.identity.titleSameProduct = titleSameProduct;
    comparisonPayload.comparison.identity.titleAiConfidence = 0;
    comparisonPayload.comparison.identity.titleAiReason = titleCheckDetail(titleResult);
  }

  const brandPresent = Boolean(vendor.brand && amazon.brand);
  const brandMatch = identity?.brandMatch ?? false;
  const modelPresent = Boolean(vendor.modelNumber && amazon.modelNumber);
  const modelDetail = modelMatchDetail(vendor.modelNumber || '', amazon.modelNumber || '');
  const modelMatch = modelPresent && modelDetail.match;
  const packQtyMatch = packaging?.unitQtyMatch ?? null;
  const upcMatch = identifiers?.upcMatch ?? false;
  const titleMatchPct = identity?.titleSimilarityPct ?? 0;

  const packUnsure = packConfidence === 'UNSURE';
  let packResult: CheckResult;
  let packFailOnNo: boolean;
  let packFailCode: FailReasonCode | undefined;
  let packDetail: string;

  if (packUnsure) {
    packResult = 'unknown';
    packFailOnNo = false;
    packFailCode = 'QTY_UNSURE';
    packDetail = `Pack quantity unsure (AI: UNSURE; vendor ${formatQty(vendorSlim.packQuantity)}, Amazon ${formatQty(amazonSlim.packQuantity)}).`;
  } else if (packQtyMatch == null) {
    packResult = 'unknown';
    packFailOnNo = false;
    packFailCode = 'QTY_UNSURE';
    packDetail = `Pack size is unpublished on one or both listings (vendor ${formatQty(vendorSlim.packQuantity)}, Amazon ${formatQty(amazonSlim.packQuantity)}).`;
  } else if (packQtyMatch) {
    packResult = 'yes';
    packFailOnNo = options.settings.strictPackQuantity;
    packDetail = `Pack size matches (vendor ${vendorSlim.packQuantity}, Amazon ${amazonSlim.packQuantity}).`;
  } else {
    packResult = 'no';
    packFailOnNo = options.settings.strictPackQuantity;
    packFailCode = 'PACK';
    packDetail = `Pack size differs (vendor ${vendorSlim.packQuantity} vs Amazon ${amazonSlim.packQuantity}).`;
  }

  const variantPresent = variantConflict != null;
  const variantIsConflict = variantPresent && variantConflict !== 'NONE';

  let imageResult: CheckResult;
  let imageDetail: string;
  if (!bothImagesReady) {
    imageResult = 'no';
    imageDetail = 'Vendor/Amazon compare image unavailable.';
  } else if (imageSimilarityPct == null) {
    imageResult = 'unknown';
    imageDetail = 'Image similarity was not completed by AI.';
  } else if (imageSimilarityPct >= imageThreshold) {
    imageResult = 'yes';
    imageDetail = `Images match (${imageSimilarityPct}% ≥ ${imageThreshold}%).`;
  } else {
    imageResult = 'no';
    imageDetail = `Images are below ${imageThreshold}% similarity (${imageSimilarityPct}%).`;
  }

  const checks: FieldCheck[] = [
    {
      name: 'brand',
      result: !brandPresent ? 'unknown' : brandMatch ? 'yes' : 'no',
      failOnNo: true,
      failCode: 'BRAND',
      detail: !brandPresent
        ? 'Brand is missing on one or both listings.'
        : brandMatch
          ? `Brand matches (${vendor.brand}).`
          : `Brand differs: ${vendor.brand} vs ${amazon.brand}.`,
    },
    {
      name: 'model',
      result: !modelPresent ? 'unknown' : modelMatch ? 'yes' : 'no',
      failOnNo: true,
      failCode: 'MODEL',
      detail: !modelPresent
        ? 'Model number is missing on one or both listings.'
        : modelMatch
          ? `Model matches (${vendor.modelNumber} ↔ ${amazon.modelNumber}, ${modelDetail.reason}).`
          : `Model numbers differ: ${vendor.modelNumber} vs ${amazon.modelNumber}.`,
    },
    {
      name: 'pack size',
      result: packResult,
      failOnNo: packFailOnNo,
      failCode: packFailCode,
      detail: packDetail,
    },
    {
      name: 'UPC',
      result: !identifiers?.upcAmazon && !amazon.upc ? 'unknown' : upcMatch ? 'yes' : 'no',
      failOnNo: true,
      failCode: 'UPC',
      detail: upcMatch
        ? `UPC matches Amazon ${identifiers?.matchedAmazonIdentifier?.type || 'identifier'} ${identifiers?.upcAmazon || amazon.upc}.`
        : !amazon.upc && !identifiers?.upcAmazon
          ? 'Amazon catalog did not publish a UPC/EAN/GTIN for this ASIN.'
          : `UPC mismatch: input/vendor ${identifiers?.upcVendor || input.upc} vs Amazon ${identifiers?.upcAmazon || amazon.upc}.`,
    },
    {
      name: 'image',
      result: imageResult,
      failOnNo: true,
      failCode: 'IMAGE',
      detail: imageDetail,
    },
    {
      name: 'variant',
      result: !variantPresent ? 'unknown' : variantIsConflict ? 'no' : 'yes',
      failOnNo: true,
      failCode: variantIsConflict ? (variantConflict as FailReasonCode) : undefined,
      detail: !variantPresent
        ? 'Variant conflict check was not completed by AI.'
        : variantIsConflict
          ? `Variant conflict: ${variantConflict}.`
          : 'No variant conflict (AI: NONE).',
    },
    {
      name: 'title',
      result: titleResult == null ? 'unknown' : titleResult === 'YES' ? 'yes' : 'no',
      failOnNo: titleResult === 'NO',
      failCode: 'TITLE',
      detail: titleCheckDetail(titleResult),
    },
  ];

  const status = resolveStatus(checks, errors);
  const failReason = buildFailReason(checks, status, errors);
  const verdictSentence = buildLogSentence(status, failReason, errors);
  const confidence = status === 'PASSED' ? 0.92 : status === 'FAILED' ? 0.88 : 0.55;

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
    packQtyMatch: packUnsure ? null : packQtyMatch,
    upcMatch,
    modelMatch,
    brandMatch,
    specMatchPct: 0,
    descriptionMatchPct: 0,
    titleSameProduct,
    titleResult,
    variantConflict,
    packConfidence,
    checks: checks.map(({ name, result, detail }) => ({ name, result, detail })),
    failReason,
    verdictSentence,
    status,
    aiVerdictReason: failReason || verdictSentence,
    aiTokensUsed: claudeQc?.tokensUsed ?? { input: 0, output: 0 },
    confidenceScore: confidence,
    timestamp: new Date().toLocaleTimeString(),
    errors,
  };
}
