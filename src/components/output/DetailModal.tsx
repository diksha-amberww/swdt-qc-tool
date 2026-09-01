import React, { memo } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  DollarSign,
  Package,
  Layers,
  Sparkles,
  Barcode,
} from 'lucide-react';
import { QCRowResult, QCStatus } from '../../types/qc';
import { useQCStore } from '../../store/useQCStore';

interface DetailModalProps {
  result: QCRowResult;
  onClose: () => void;
}

export const DetailModal: React.FC<DetailModalProps> = memo(({ result, onClose }) => {
  const updateResult = useQCStore((state) => state.updateResult);

  const handleManualOverride = (newStatus: QCStatus) => {
    updateResult(result.id, {
      status: newStatus,
      manualOverride: true,
      overrideNotes: `Manually changed to ${newStatus} by user.`,
    });
  };

  const getStatusBadge = (status: QCStatus) => {
    switch (status) {
      case 'PASSED':
        return (
          <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>PASSED</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-black bg-red-100 text-red-800 border border-red-300">
            <XCircle className="w-4 h-4 text-red-600" />
            <span>FAILED</span>
          </span>
        );
      case 'MANUAL REVIEW':
        return (
          <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>MANUAL REVIEW</span>
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4 overflow-hidden">
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            {getStatusBadge(result.status)}
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-extrabold text-slate-900">{result.partSku}</h3>
                <span className="text-xs text-slate-400">|</span>
                <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  ASIN: {result.asin}
                </span>
                <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                  {result.brand} • {result.line}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Timestamp: {result.timestamp} {result.manualOverride && '(Manually Overridden)'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Quick Override Buttons */}
            <div className="flex items-center space-x-1 bg-white p-1 rounded-lg border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase px-1.5">Override:</span>
              <button
                onClick={() => handleManualOverride('PASSED')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-all ${
                  result.status === 'PASSED' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                Pass
              </button>
              <button
                onClick={() => handleManualOverride('FAILED')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-all ${
                  result.status === 'FAILED' ? 'bg-red-600 text-white shadow-xs' : 'text-red-700 hover:bg-red-50'
                }`}
              >
                Fail
              </button>
              <button
                onClick={() => handleManualOverride('MANUAL REVIEW')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-all ${
                  result.status === 'MANUAL REVIEW' ? 'bg-amber-600 text-white shadow-xs' : 'text-amber-700 hover:bg-amber-50'
                }`}
              >
                Review
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* AI Reasoning Callout */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-indigo-900 font-extrabold text-xs">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>CLAUDE HAIKU 4.5 AI COMPARISON VERDICT</span>
              </div>
              <span className="text-[11px] font-bold text-indigo-700 bg-white/80 px-2 py-0.5 rounded border border-indigo-200">
                Confidence Score: {(result.confidenceScore * 100).toFixed(0)}%
              </span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              {result.aiVerdictReason}
            </p>
          </div>

          {/* Metric Comparison Gauges */}
          <div className="grid grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] font-bold text-slate-500 block mb-1">Title Match</span>
              <div className="flex items-end justify-between">
                <span className="text-lg font-black text-slate-900">{result.titleMatchPct}%</span>
                <span className={`text-[11px] font-bold ${result.titleMatchPct >= 70 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {result.titleMatchPct >= 70 ? 'PASS (≥70%)' : 'FAIL (<70%)'}
                </span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full ${result.titleMatchPct >= 70 ? 'bg-emerald-500' : 'bg-red-500'}`}
                  style={{ width: `${result.titleMatchPct}%` }}
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] font-bold text-slate-500 block mb-1">Price Variance</span>
              <div className="flex items-end justify-between">
                <span className="text-lg font-black text-slate-900">
                  {result.priceVariancePct > 0 ? `+${result.priceVariancePct}%` : `${result.priceVariancePct}%`}
                </span>
                <span className={`text-[11px] font-bold ${Math.abs(result.priceVariancePct) <= 15 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {Math.abs(result.priceVariancePct) <= 15 ? 'PASS (±15%)' : 'ALERT'}
                </span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                <div
                  className={`h-full ${Math.abs(result.priceVariancePct) <= 15 ? 'bg-emerald-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(100, Math.abs(result.priceVariancePct) * 3)}%` }}
                />
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] font-bold text-slate-500 block mb-1">Pack Quantity Match</span>
              <div className="flex items-end justify-between mt-1">
                <span className="text-sm font-bold text-slate-900">
                  {result.vendorListing.packQuantity} vs {result.amazonListing.packQuantity}
                </span>
                <span className={`text-[11px] font-bold ${result.packQtyMatch ? 'text-emerald-600' : 'text-red-600'}`}>
                  {result.packQtyMatch ? 'MATCH' : 'MISMATCH'}
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] font-bold text-slate-500 block mb-1">UPC Match</span>
              <div className="flex items-end justify-between mt-1">
                <span className="text-xs font-mono text-slate-700 truncate max-w-[100px]">{result.upc}</span>
                <span className={`text-[11px] font-bold ${result.upcMatch ? 'text-emerald-600' : 'text-red-600'}`}>
                  {result.upcMatch ? 'VERIFIED' : 'MISMATCH'}
                </span>
              </div>
            </div>
          </div>

          {/* Side by Side Listing Cards */}
          <div className="grid grid-cols-2 gap-6">
            {/* Vendor Card (Seawide) */}
            <div className="border border-blue-200 rounded-xl bg-blue-50/20 p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-blue-100">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-blue-600" />
                  <h4 className="text-xs font-black text-blue-900 uppercase tracking-wider">
                    Vendor Portal (Seawide)
                  </h4>
                </div>
                <span className="text-[11px] font-semibold text-blue-700 bg-blue-100/60 px-2 py-0.5 rounded">
                  Source: Dealer Catalog
                </span>
              </div>

              <div className="flex items-start space-x-4">
                <img
                  src={result.vendorListing.imageUrl}
                  alt={result.partSku}
                  loading="lazy"
                  decoding="async"
                  width={96}
                  height={96}
                  className="w-24 h-24 object-cover rounded-lg border border-slate-200 bg-white shrink-0"
                />
                <div className="space-y-1.5 flex-1 min-w-0">
                  <h5 className="text-xs font-bold text-slate-900 leading-snug">
                    {result.vendorListing.title}
                  </h5>
                  <div className="flex items-center space-x-3 text-xs">
                    <span className="text-base font-black text-blue-700">
                      ${result.vendorListing.price.toFixed(2)}
                    </span>
                    <span className="text-slate-500 font-medium">
                      Pack Qty: <strong>{result.vendorListing.packQuantity}</strong>
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 flex items-center space-x-1">
                    <Barcode className="w-3.5 h-3.5 text-slate-400" />
                    <span>UPC: <strong className="font-mono">{result.vendorListing.upc}</strong></span>
                  </div>
                </div>
              </div>

              <div className="text-xs space-y-1.5 pt-2 border-t border-blue-100">
                <div className="flex justify-between text-slate-600">
                  <span>Model / MPN:</span>
                  <span className="font-mono font-bold text-slate-800">{result.vendorListing.modelNumber}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Inventory Status:</span>
                  <span className="font-medium text-emerald-700">{result.vendorListing.availability}</span>
                </div>
              </div>
            </div>

            {/* Amazon SP-API Card */}
            <div className="border border-amber-200 rounded-xl bg-amber-50/20 p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-amber-100">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500" />
                  <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider">
                    Amazon Listing (SP-API)
                  </h4>
                </div>
                <a
                  href={`https://www.amazon.com/dp/${result.asin}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center space-x-1 text-[11px] font-bold text-amber-800 hover:text-amber-900 bg-amber-100/60 px-2 py-0.5 rounded cursor-pointer"
                >
                  <span>View ASIN</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="flex items-start space-x-4">
                <img
                  src={result.amazonListing.imageUrl}
                  alt={result.asin}
                  loading="lazy"
                  decoding="async"
                  width={96}
                  height={96}
                  className="w-24 h-24 object-cover rounded-lg border border-slate-200 bg-white shrink-0"
                />
                <div className="space-y-1.5 flex-1 min-w-0">
                  <h5 className="text-xs font-bold text-slate-900 leading-snug">
                    {result.amazonListing.title}
                  </h5>
                  <div className="flex items-center space-x-3 text-xs">
                    <span className="text-base font-black text-amber-700">
                      ${result.amazonListing.price.toFixed(2)}
                    </span>
                    <span className="text-slate-500 font-medium">
                      Pack Qty: <strong>{result.amazonListing.packQuantity}</strong>
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 flex items-center space-x-1">
                    <Barcode className="w-3.5 h-3.5 text-slate-400" />
                    <span>UPC: <strong className="font-mono">{result.amazonListing.upc}</strong></span>
                  </div>
                </div>
              </div>

              <div className="text-xs space-y-1.5 pt-2 border-t border-amber-100">
                <div className="flex justify-between text-slate-600">
                  <span>Catalog Model:</span>
                  <span className="font-mono font-bold text-slate-800">{result.amazonListing.modelNumber}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Fulfillment:</span>
                  <span className="font-medium text-blue-700">{result.amazonListing.availability}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            AI Tokens: <strong className="text-slate-700">{result.aiTokensUsed.input + result.aiTokensUsed.output}</strong> (In: {result.aiTokensUsed.input}, Out: {result.aiTokensUsed.output})
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-black text-white text-xs font-bold shadow-xs cursor-pointer transition-all"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
});

DetailModal.displayName = 'DetailModal';
