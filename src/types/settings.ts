export interface AppSettings {
  priceVarianceThreshold: number; // e.g. 15%
  titleSimilarityThreshold: number; // e.g. 70%
  imageSimilarityThreshold: number; // e.g. 50%
  /** @deprecated unused — specs comparison disabled */
  specMatchThreshold: number;
  /** @deprecated unused — description comparison disabled */
  descriptionMatchThreshold: number;
  reuseSession: boolean;
  headlessMode: boolean;
  strictPackQuantity: boolean;
  autoPauseOnError: boolean;
  concurrencyWorkers: number;
  requestTimeoutSeconds: number;
  aiAutoVerifyThreshold: number; // e.g. 85%
}
