export interface AppSettings {
  priceVarianceThreshold: number; // e.g. 15%
  titleSimilarityThreshold: number; // e.g. 70%
  imageSimilarityThreshold: number; // e.g. 70%
  reuseSession: boolean;
  headlessMode: boolean;
  strictPackQuantity: boolean;
  autoPauseOnError: boolean;
  concurrencyWorkers: number;
  requestTimeoutSeconds: number;
  aiAutoVerifyThreshold: number; // e.g. 85%
}
