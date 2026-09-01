export interface RawInputRow {
  id: string;
  partSku: string;
  asin: string;
  brand: string;
  line: string;
  upc: string;
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
  packQuantity: number;
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
  partSku: string;
  asin: string;
  brand: string;
  line: string;
  upc: string;
  
  // Scraped / Retrieved listing details
  vendorListing: ListingDetails;
  amazonListing: ListingDetails;
  
  // Calculated comparison metrics
  titleMatchPct: number;
  priceVariancePct: number;
  imageSimilarityPct: number;
  packQtyMatch: boolean;
  upcMatch: boolean;
  modelMatch: boolean;
  
  // AI & Verdict details
  status: QCStatus;
  aiVerdictReason: string;
  aiTokensUsed: {
    input: number;
    output: number;
  };
  confidenceScore: number;
  timestamp: string;
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
