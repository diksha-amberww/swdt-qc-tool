import { create } from 'zustand';
import { AICostMetrics } from '../types/cost';

interface CostStoreState {
  metrics: AICostMetrics;
  
  // Rate constants (Claude 3.5 Sonnet: $3 / M input, $15 / M output)
  inputRatePerMillion: number;
  outputRatePerMillion: number;
  
  // Actions
  recordSkuTokens: (inputTokens: number, outputTokens: number) => void;
  resetBatchCost: () => void;
  resetLifetimeCost: () => void;
}

const INITIAL_METRICS: AICostMetrics = {
  batchInputTokens: 0,
  batchOutputTokens: 0,
  batchTotalTokens: 0,
  batchTotalCost: 0,
  liveCostPerSku: 0,
  estCostPer1k: 0,
  estCostPer10k: 0,
  
  lifetimeInputTokens: 1420500,
  lifetimeOutputTokens: 285400,
  lifetimeTotalTokens: 1705900,
  lifetimeTotalCost: 8.542,
  lifetimeSkusProcessed: 1240,
  lifetimeAvgCostPerSku: 0.00688,
};

export const useCostStore = create<CostStoreState>((set) => ({
  metrics: INITIAL_METRICS,
  inputRatePerMillion: 3.0,
  outputRatePerMillion: 15.0,
  
  recordSkuTokens: (inputTokens, outputTokens) => set((state) => {
    const inputCost = (inputTokens / 1_000_000) * state.inputRatePerMillion;
    const outputCost = (outputTokens / 1_000_000) * state.outputRatePerMillion;
    const skuCost = inputCost + outputCost;
    
    const newBatchIn = state.metrics.batchInputTokens + inputTokens;
    const newBatchOut = state.metrics.batchOutputTokens + outputTokens;
    const newBatchTotal = newBatchIn + newBatchOut;
    const newBatchCost = state.metrics.batchTotalCost + skuCost;
    
    const newLifeIn = state.metrics.lifetimeInputTokens + inputTokens;
    const newLifeOut = state.metrics.lifetimeOutputTokens + outputTokens;
    const newLifeTotal = newLifeIn + newLifeOut;
    const newLifeCost = state.metrics.lifetimeTotalCost + skuCost;
    const newLifeCount = state.metrics.lifetimeSkusProcessed + 1;
    const newLifeAvg = newLifeCost / newLifeCount;
    
    return {
      metrics: {
        batchInputTokens: newBatchIn,
        batchOutputTokens: newBatchOut,
        batchTotalTokens: newBatchTotal,
        batchTotalCost: Number(newBatchCost.toFixed(5)),
        liveCostPerSku: Number(skuCost.toFixed(5)),
        estCostPer1k: Number((skuCost * 1000).toFixed(2)),
        estCostPer10k: Number((skuCost * 10000).toFixed(2)),
        
        lifetimeInputTokens: newLifeIn,
        lifetimeOutputTokens: newLifeOut,
        lifetimeTotalTokens: newLifeTotal,
        lifetimeTotalCost: Number(newLifeCost.toFixed(4)),
        lifetimeSkusProcessed: newLifeCount,
        lifetimeAvgCostPerSku: Number(newLifeAvg.toFixed(5)),
      },
    };
  }),
  
  resetBatchCost: () => set((state) => ({
    metrics: {
      ...state.metrics,
      batchInputTokens: 0,
      batchOutputTokens: 0,
      batchTotalTokens: 0,
      batchTotalCost: 0,
      liveCostPerSku: 0,
      estCostPer1k: 0,
      estCostPer10k: 0,
    },
  })),
  
  resetLifetimeCost: () => set((state) => ({
    metrics: {
      ...state.metrics,
      lifetimeInputTokens: 0,
      lifetimeOutputTokens: 0,
      lifetimeTotalTokens: 0,
      lifetimeTotalCost: 0,
      lifetimeSkusProcessed: 0,
      lifetimeAvgCostPerSku: 0,
    },
  })),
}));
