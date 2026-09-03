import type { AmazonListingJson } from '../../scraping/types/amazonListing';
import type { VendorListingJson } from '../../scraping/types/vendorListing';
import type { RowComparisonPayload } from '../../scraping/types/scrapeResult';

export interface RawInputRow {
  id: string;
  asin: string;
  upc: string;
  vendorModel: string;
  /** @deprecated alias of vendorModel for older UI copy */
  partSku: string;
  brand?: string;
  line?: string;
  rawLineNumber?: number;
}

export interface ValidationErrorItem {
  row: number;
  field: string;
  message: string;
  value?: string;
}

export interface ValidationSummary {
  isValid: boolean;
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  errors: ValidationErrorItem[];
  validRows: RawInputRow[];
}

export type QCStatus = 'PASSED' | 'FAILED' | 'MANUAL REVIEW';

export type QCExecutionState = 'IDLE' | 'RUNNING' | 'PAUSED' | 'STOPPED' | 'COMPLETED';

export interface ListingDetails {
  title: string;
  price: number;
  packQuantity: number | null;
  caseQuantity: number | null;
  imageUrl: string;
  modelNumber: string;
  upc: string;
  brand: string;
  availability: string;
  rating?: number;
  reviewsCount?: number;
}

export interface QCRowResult {
  id: string;
  vendorModel: string;
  partSku: string;
  asin: string;
  brand: string;
  line: string;
  upc: string;

  vendorListing: ListingDetails;
  amazonListing: ListingDetails;
  vendorListingFull?: VendorListingJson | null;
  amazonListingFull?: AmazonListingJson | null;
  comparisonPayload?: RowComparisonPayload | null;

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
  titleResult?: 'YES' | 'NO' | null;
  variantConflict?: string | null;
  packConfidence?: 'SURE' | 'UNSURE' | null;
  /** Compact fail code for export/UI (BRAND, PACK, VOLUME, …). */
  failReason?: string;
  /** Per-field QC outcomes: brand, model, pack size, UPC, image, variant, title. */
  checks?: { name: string; result: 'yes' | 'no' | 'unknown'; detail: string }[];
  /** Short one-line log string (not exported as Verdict Sentence). */
  verdictSentence: string;

  status: QCStatus;
  aiVerdictReason: string;
  aiTokensUsed: {
    input: number;
    output: number;
  };
  confidenceScore: number;
  timestamp: string;
  errors?: string[];
  manualOverride?: boolean;
  overrideNotes?: string;
}

export interface QCRunMetrics {
  total: number;
  processed: number;
  passed: number;
  failed: number;
  manualReview: number;
  elapsedSeconds: number;
  speedSkuPerMin: number;
  estimatedSecondsRemaining: number;
}

export function formatPackQty(value: number | null | undefined): string {
  return value == null ? '—' : String(value);
}
