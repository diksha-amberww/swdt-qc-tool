import React, { useState } from 'react';
import {
  Coins,
  Cpu,
  DollarSign,
  TrendingUp,
  RotateCcw,
  Sparkles,
  Calculator,
  Layers,
  BarChart3,
  Flame,
} from 'lucide-react';
import { useCostStore } from '../store/useCostStore';
import { useQCStore } from '../store/useQCStore';

export const AICostsPage: React.FC = () => {
  const { metrics, resetBatchCost, resetLifetimeCost, inputRatePerMillion, outputRatePerMillion } = useCostStore();
  const results = useQCStore((state) => state.results);

  const [customSimCount, setCustomSimCount] = useState<number>(5000);

  const currentSkuCost = metrics.liveCostPerSku > 0 ? metrics.liveCostPerSku : 0.0054;
  const customSimCost = (customSimCount * currentSkuCost).toFixed(2);

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      {/* Top Banner */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 shrink-0">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
            <Coins className="w-5 h-5 text-amber-500" />
            <span>AI Token & Inference Cost Analytics</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time billing monitor and cost projection engine for Claude 3.5 Sonnet listing comparisons.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={resetBatchCost}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Reset Batch Metrics</span>
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-6 pt-4 overflow-y-auto">
        {/* Left Column: Current Batch Metrics & Projections (7 cols) */}
        <div className="col-span-7 flex flex-col space-y-5">
          {/* Section 1: Current Batch Run */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <Flame className="w-4 h-4 text-orange-500" />
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  1) Current Batch Run Execution
                </h3>
              </div>
              <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                Processed: {results.length} SKUs
              </span>
            </div>

            {/* 4 Key Points from User Requirement */}
            <div className="grid grid-cols-2 gap-4">
              {/* Point a: AI Token Usage */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                  <Cpu className="w-4 h-4 text-blue-600" />
                  <span>a) AI Token Usage</span>
                </span>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Input Tokens:</span>
                    <strong className="font-mono text-slate-900">{metrics.batchInputTokens.toLocaleString()}</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Output Tokens:</span>
                    <strong className="font-mono text-slate-900">{metrics.batchOutputTokens.toLocaleString()}</strong>
                  </div>
                  <div className="flex justify-between text-slate-800 pt-1 border-t border-slate-200 font-bold">
                    <span>Total Batch Tokens:</span>
                    <strong className="font-mono text-blue-700">{metrics.batchTotalTokens.toLocaleString()}</strong>
                  </div>
                </div>
              </div>

              {/* Point b & c: Live Cost Per SKU & Live Total Cost */}
              <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-2">
                <span className="text-xs font-bold text-emerald-900 flex items-center space-x-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  <span>b & c) Live Cost Incurred</span>
                </span>
                <div className="space-y-2">
                  <div>
                    <span className="text-[11px] text-emerald-700 block">b) Live Cost Per SKU:</span>
                    <span className="text-xl font-black text-emerald-900 font-mono">
                      ${currentSkuCost.toFixed(5)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-emerald-700 block">c) Total Current Batch Cost:</span>
                    <span className="text-xl font-black text-emerald-800 font-mono">
                      ${metrics.batchTotalCost.toFixed(4)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Point d: Live x1,000 and x10,000 SKU Cost Estimations */}
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50/40 rounded-xl border border-blue-200 space-y-3">
              <span className="text-xs font-bold text-blue-900 flex items-center space-x-1.5">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                <span>d) Live Batch Scaling Projections</span>
              </span>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-white rounded-lg border border-blue-100 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 block uppercase">1,000 SKUs Projection</span>
                  <span className="text-2xl font-black text-blue-900 font-mono mt-0.5 block">
                    ${(currentSkuCost * 1000).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-400">Est. ~$0.005 / SKU</span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-indigo-100 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 block uppercase">10,000 SKUs Projection</span>
                  <span className="text-2xl font-black text-indigo-900 font-mono mt-0.5 block">
                    ${(currentSkuCost * 10000).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-400">Bulk catalog audit</span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Custom SKU Calculator */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-3">
            <div className="flex items-center space-x-2">
              <Calculator className="w-4 h-4 text-purple-600" />
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Interactive Catalog Size Cost Calculator
              </h3>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Enter target Seawide SKU count to audit:
                </label>
                <input
                  type="number"
                  min={100}
                  max={500000}
                  step={500}
                  value={customSimCount}
                  onChange={(e) => setCustomSimCount(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>

              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-right min-w-[160px]">
                <span className="text-[10px] font-bold text-purple-700 uppercase block">Estimated Total Cost</span>
                <span className="text-2xl font-black text-purple-900 font-mono">${customSimCost}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Lifetime Metrics & Persisted Storage (5 cols) */}
        <div className="col-span-5 flex flex-col space-y-5">
          {/* Section 2: Lifetime Incurred Analytics */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  2) Lifetime Persisted Cost Analytics
                </h3>
              </div>
              <button
                onClick={resetLifetimeCost}
                className="text-[10px] font-bold text-red-600 hover:text-red-700 underline cursor-pointer"
              >
                Reset Lifetime
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 block">Total Lifetime Cost Incurred</span>
                  <span className="text-2xl font-black text-slate-900 font-mono mt-0.5 block">
                    ${metrics.lifetimeTotalCost.toFixed(4)}
                  </span>
                </div>
                <DollarSign className="w-7 h-7 text-emerald-500" />
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 block">Total SKUs Processed (Lifetime)</span>
                  <span className="text-2xl font-black text-blue-700 font-mono mt-0.5 block">
                    {metrics.lifetimeSkusProcessed.toLocaleString()}
                  </span>
                </div>
                <Layers className="w-7 h-7 text-blue-500" />
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-slate-500 block">Lifetime Average Cost / SKU</span>
                  <span className="text-xl font-black text-indigo-900 font-mono mt-0.5 block">
                    ${metrics.lifetimeAvgCostPerSku.toFixed(5)}
                  </span>
                </div>
                <Coins className="w-7 h-7 text-amber-500" />
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">Lifetime Token Breakdown</span>
                <div className="space-y-1">
                  <div className="flex justify-between text-slate-600">
                    <span>Input Tokens:</span>
                    <span className="font-mono font-bold text-slate-800">{metrics.lifetimeInputTokens.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Output Tokens:</span>
                    <span className="font-mono font-bold text-slate-800">{metrics.lifetimeOutputTokens.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-900 font-bold pt-1 border-t border-slate-200">
                    <span>Total Consumed:</span>
                    <span className="font-mono text-purple-700">{metrics.lifetimeTotalTokens.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing Model Reference */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-xs space-y-2">
            <span className="font-bold text-slate-700 uppercase tracking-wider block text-[11px]">
              Model Rate Reference: Claude Haiku 4.5
            </span>
            <div className="space-y-1 text-slate-600 text-[11px]">
              <div className="flex justify-between">
                <span>Input Pricing:</span>
                <span className="font-mono font-semibold">${inputRatePerMillion.toFixed(2)} / 1M tokens</span>
              </div>
              <div className="flex justify-between">
                <span>Output Pricing:</span>
                <span className="font-mono font-semibold">${outputRatePerMillion.toFixed(2)} / 1M tokens</span>
              </div>
              <p className="text-[10px] text-slate-400 pt-1">
                Average listing comparison consumes ~900 input tokens and ~180 output tokens per product item.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
