export interface AICostMetrics {
  // Batch metrics
  batchInputTokens: number;
  batchOutputTokens: number;
  batchTotalTokens: number;
  batchTotalCost: number;
  liveCostPerSku: number;
  estCostPer1k: number;
  estCostPer10k: number;
  
  // Lifetime analytics
  lifetimeInputTokens: number;
  lifetimeOutputTokens: number;
  lifetimeTotalTokens: number;
  lifetimeTotalCost: number;
  lifetimeSkusProcessed: number;
  lifetimeAvgCostPerSku: number;
}
