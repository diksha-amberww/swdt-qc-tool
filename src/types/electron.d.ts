export interface SeawideLoginProgress {
  step: string;
  detail?: string;
}

export interface SeawideLoginResult {
  success: boolean;
  message: string;
  finalUrl?: string;
  pageTitle?: string;
  welcomeText?: string;
  responseTimeMs: number;
  steps: string[];
  error?: string;
}

export interface EnsureVendorSessionResult extends SeawideLoginResult {
  reused?: boolean;
}

export interface VendorSessionStatus {
  authenticated: boolean;
  welcomeText?: string;
  url?: string;
  title?: string;
  reason?: string;
}

export interface ElectronAPI {
  isElectron: boolean;
  readEnv: () => Promise<Record<string, string>>;
  writeEnv: (data: Record<string, string>) => Promise<boolean>;
  openFileDialog: (filters?: { name: string; extensions: string[] }[]) => Promise<{
    name: string;
    path: string;
    buffer: number[];
  } | null>;
  saveFileDialog: (options: { defaultName: string; content: any; isBinary?: boolean }) => Promise<boolean>;
  getAppVersion: () => Promise<string>;
  setNativeTheme?: (theme: 'light' | 'dark') => Promise<boolean>;
  testVendorLogin?: (payload: {
    username: string;
    password: string;
    loginUrl?: string;
  }) => Promise<SeawideLoginResult>;
  onVendorLoginProgress?: (callback: (progress: SeawideLoginProgress) => void) => () => void;
  ensureVendorSession?: (payload?: {
    username?: string;
    password?: string;
    loginUrl?: string;
    reuseSession?: boolean;
  }) => Promise<EnsureVendorSessionResult>;
  getVendorSessionStatus?: () => Promise<VendorSessionStatus>;
  clearVendorSession?: () => Promise<boolean>;
  scrapeVendorListing?: (payload: {
    upc?: string;
    vendorModel?: string;
    asin?: string;
  }) => Promise<unknown>;
  fetchAmazonListing?: (payload: { asin: string }) => Promise<unknown>;
  testAmazonConnection?: () => Promise<{
    success: boolean;
    message: string;
    responseTimeMs: number;
    endpoint: string;
  }>;
  evaluateQcRow?: (payload: {
    row: { asin: string; upc: string; vendorModel: string };
    settings: {
      priceVarianceThreshold: number;
      titleSimilarityThreshold: number;
      imageSimilarityThreshold: number;
      strictPackQuantity: boolean;
    };
  }) => Promise<import('../../scraping/qc/evaluateRow').QcEvaluateResult>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
