import React, { useState } from 'react';
import {
  FlaskConical,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Send,
  Sparkles,
  Code2,
} from 'lucide-react';
import { useQCStore } from '../store/useQCStore';
import { useLogStore } from '../store/useLogStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { ValidatorService } from '../services/validatorService';
import { QcEngine } from '../services/qcEngine';
import { formatPackQty } from '../types/qc';
import { ProductValueInput } from '../components/upload/ProductValueInput';
import { placeholderImage } from '../utils/placeholderImage';
import { JsonCopyBlock } from '../components/ui/JsonCopyBlock';

function matchClass(ok: boolean | null): string {
  if (ok == null) return 'text-amber-600';
  return ok ? 'text-emerald-600' : 'text-red-600';
}

function matchLabel(ok: boolean | null, yes: string, no: string, unknown = 'Needs review'): string {
  if (ok == null) return unknown;
  return ok ? yes : no;
}

function ListingThumb({ src, alt, label }: { src: string; alt: string; label: string }) {
  const [failed, setFailed] = useState(false);
  const shown = src && !failed ? src : placeholderImage(label, label.length * 17);
  const img = (
    <img
      src={shown}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="w-16 h-16 object-contain rounded-md border border-slate-200 bg-white shrink-0"
    />
  );
  if (src && !failed) {
    return (
      <a href={src} target="_blank" rel="noreferrer" title="Open image" className="shrink-0">
        {img}
      </a>
    );
  }
  return img;
}

export const SandboxPage: React.FC = () => {
  const {
    sandboxInputText,
    setSandboxInputText,
    sandboxResult,
    setSandboxResult,
    isSandboxRunning,
    setIsSandboxRunning,
    sandboxTrace,
    setSandboxTrace,
    sandboxPushMessage,
    setSandboxPushMessage,
    overrideSandboxStatus,
    pushSandboxToOutput,
  } = useQCStore();
  const settings = useSettingsStore((state) => state.settings);

  const addLog = useLogStore((state) => state.addLog);

  const runSandboxAnalysis = async () => {
    setIsSandboxRunning(true);
    setSandboxTrace([
      `[${new Date().toLocaleTimeString()}] Initializing Isolated Sandbox Debugger...`,
      `[${new Date().toLocaleTimeString()}] Parsing single-row input string...`,
    ]);

    const summary = ValidatorService.parseDataRows(sandboxInputText);
    if (!summary.isValid || summary.validRows.length === 0) {
      setSandboxTrace((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] ERROR: Row validation failed. ${summary.errors[0]?.message || 'Invalid row'}`,
      ]);
      setIsSandboxRunning(false);
      return;
    }

    const row = summary.validRows[0];
    setSandboxTrace((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] Extracted MODEL: ${row.vendorModel} | ASIN: ${row.asin} | UPC: ${row.upc}`,
      `[${new Date().toLocaleTimeString()}] Ensuring Seawide vendor session (reuse existing if available)...`,
    ]);

    const sessionOk = await QcEngine.ensureBatchSession();
    if (!sessionOk) {
      setSandboxTrace((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] ERROR: Seawide session unavailable. Save vendor login on Credentials page.`,
      ]);
      setIsSandboxRunning(false);
      return;
    }

    setSandboxTrace((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] Seawide session ready — scraping vendor listing and Amazon catalog...`,
    ]);

    try {
      const result = await QcEngine.evaluateSingleSku(row);
      setSandboxResult(result);
      setSandboxTrace((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Result calculated: ${result.status} (Confidence: ${(result.confidenceScore * 100).toFixed(0)}%)`,
        `[${new Date().toLocaleTimeString()}] Fail reason: ${result.failReason || '—'} · Variant: ${result.variantConflict || '—'}`,
        ...(result.errors?.length
          ? [`[${new Date().toLocaleTimeString()}] Warnings: ${result.errors.join(' | ')}`]
          : []),
        `[${new Date().toLocaleTimeString()}] Sandbox evaluation complete!`,
      ]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Execution error';
      setSandboxResult(null);
      setSandboxTrace((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] FATAL: ${message}`,
      ]);
    } finally {
      setIsSandboxRunning(false);
    }
  };

  const handlePushToOutput = () => {
    if (!sandboxResult) return;
    pushSandboxToOutput();
    setSandboxPushMessage(`Pushed ${sandboxResult.vendorModel || sandboxResult.partSku} to Live Output Stream!`);
    addLog('INFO', 'SYSTEM', `Pushed sandbox result for ${sandboxResult.vendorModel || sandboxResult.partSku} to live output stream.`);
    window.setTimeout(() => setSandboxPushMessage(null), 3000);
  };

  const handleLoadPreset = (type: 'PASS' | 'FAIL' | 'REVIEW') => {
    let preset = '';
    if (type === 'PASS') {
      preset = 'B0000AXN5U\t686226806970\tPRM80697';
    } else if (type === 'FAIL') {
      preset = 'B07KM48P9X\t790444031103\tKIT04F-CZ6U51-06';
    } else {
      preset = 'B01N10VZ28\t000000000000\tMST140D';
    }
    setSandboxInputText(preset);
  };

  const activeStatus = sandboxResult?.status;
  const imageChecked = Boolean(
    sandboxResult?.vendorListing.imageUrl && sandboxResult?.amazonListing.imageUrl,
  );
  const imagePass = sandboxResult && imageChecked && sandboxResult.imageSimilarityPct != null
    ? sandboxResult.imageSimilarityPct >= settings.imageSimilarityThreshold
    : null;
  const upcHit = sandboxResult?.comparisonPayload?.comparison.identifiers.matchedAmazonIdentifier;

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 shrink-0">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
            <FlaskConical className="w-5 h-5 text-purple-600" />
            <span>Sandbox Single-SKU Debugger</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Same QC engine as batch runs. One Claude call per SKU for title, image, pack size, and variant conflict.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-slate-400 mr-1">Load Preset:</span>
          <button
            onClick={() => handleLoadPreset('PASS')}
            className="px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all cursor-pointer"
          >
            Match Case
          </button>
          <button
            onClick={() => handleLoadPreset('FAIL')}
            className="px-2.5 py-1 rounded-md text-xs font-bold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-all cursor-pointer"
          >
            Mismatch Case
          </button>
          <button
            onClick={() => handleLoadPreset('REVIEW')}
            className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-all cursor-pointer"
          >
            Review Case
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-12 gap-6 pt-4 overflow-y-auto">
        <div className="col-span-5 flex flex-col space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Single-Row Input
              </span>
              <span className="text-[11px] text-slate-400">header fixed · one row of values</span>
            </div>

            <ProductValueInput
              value={sandboxInputText}
              onChange={setSandboxInputText}
              placeholder="B0000AXN5U	686226806970	PRM80697"
              rows={3}
            />

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={runSandboxAnalysis}
                disabled={isSandboxRunning || !sandboxInputText.trim()}
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-extrabold uppercase tracking-wider shadow-md transition-all cursor-pointer ${
                  isSandboxRunning || !sandboxInputText.trim()
                    ? 'bg-purple-300 text-purple-700 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/30 active:scale-95'
                }`}
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{isSandboxRunning ? 'Analyzing...' : 'Run Sandbox Test'}</span>
              </button>

              {sandboxResult && (
                <button
                  onClick={handlePushToOutput}
                  className="flex items-center space-x-1 px-3 py-2 rounded-lg bg-slate-900 hover:bg-black text-white text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Push to Output</span>
                </button>
              )}
            </div>

            {sandboxPushMessage && (
              <span className="block text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 p-2 rounded-lg text-center animate-in fade-in">
                {sandboxPushMessage}
              </span>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Calculated Verdict Status
              </span>
              <span className="text-[11px] text-slate-400">Click any card to manually override</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => sandboxResult && overrideSandboxStatus('PASSED')}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all cursor-pointer text-center ${
                  activeStatus === 'PASSED'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-900 verdict-pulse-pass shadow-lg'
                    : 'bg-white border-slate-200 text-slate-400 hover:border-emerald-200 hover:bg-emerald-50/30'
                }`}
              >
                <CheckCircle2
                  className={`w-8 h-8 mb-1.5 ${
                    activeStatus === 'PASSED' ? 'text-emerald-600' : 'text-slate-300'
                  }`}
                />
                <span className="text-xs font-black uppercase tracking-wider">PASSED</span>
                <span className="text-[10px] font-semibold mt-0.5 opacity-80">Catalog Match</span>
              </button>

              <button
                onClick={() => sandboxResult && overrideSandboxStatus('FAILED')}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all cursor-pointer text-center ${
                  activeStatus === 'FAILED'
                    ? 'bg-red-50 border-red-500 text-red-900 verdict-pulse-fail shadow-lg'
                    : 'bg-white border-slate-200 text-slate-400 hover:border-red-200 hover:bg-red-50/30'
                }`}
              >
                <XCircle
                  className={`w-8 h-8 mb-1.5 ${
                    activeStatus === 'FAILED' ? 'text-red-600' : 'text-slate-300'
                  }`}
                />
                <span className="text-xs font-black uppercase tracking-wider">FAILED</span>
                <span className="text-[10px] font-semibold mt-0.5 opacity-80">Discrepancy</span>
              </button>

              <button
                onClick={() => sandboxResult && overrideSandboxStatus('MANUAL REVIEW')}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all cursor-pointer text-center ${
                  activeStatus === 'MANUAL REVIEW'
                    ? 'bg-amber-50 border-amber-500 text-amber-900 verdict-pulse-review shadow-lg'
                    : 'bg-white border-slate-200 text-slate-400 hover:border-amber-200 hover:bg-amber-50/30'
                }`}
              >
                <AlertTriangle
                  className={`w-8 h-8 mb-1.5 ${
                    activeStatus === 'MANUAL REVIEW' ? 'text-amber-600' : 'text-slate-300'
                  }`}
                />
                <span className="text-xs font-black uppercase tracking-wider">REVIEW</span>
                <span className="text-[10px] font-semibold mt-0.5 opacity-80">Edge Case</span>
              </button>
            </div>

            {sandboxResult?.manualOverride && (
              <div className="p-2 bg-purple-50 rounded-lg border border-purple-200 text-[11px] text-purple-800 font-semibold text-center">
                Manual Override Active: Operator selected {sandboxResult.status}
              </div>
            )}
          </div>

          <div className="bg-slate-900 text-slate-200 rounded-xl border border-slate-800 p-3 shadow-inner flex flex-col font-mono text-[11px] h-48 overflow-hidden">
            <span className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 pb-1 border-b border-slate-800 flex items-center justify-between">
              <span>Sandbox Execution Trace</span>
              <span className="text-emerald-400">Live</span>
            </span>
            <div className="flex-1 overflow-y-auto space-y-1">
              {sandboxTrace.length > 0 ? (
                sandboxTrace.map((line, i) => (
                  <div key={i} className="text-slate-300 leading-tight">
                    {line}
                  </div>
                ))
              ) : (
                <div className="text-slate-500">Awaiting sandbox run trigger...</div>
              )}
            </div>
          </div>
        </div>

        <div className="col-span-7 flex flex-col space-y-4">
          {sandboxResult ? (
            <>
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      Comparison Matrix
                    </h3>
                  </div>
                  <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {sandboxResult.vendorModel || sandboxResult.partSku} • ASIN: {sandboxResult.asin}
                  </span>
                </div>

                <div className="p-3.5 rounded-lg bg-purple-50/50 border border-purple-100">
                  <span className="text-xs font-bold text-purple-900 block mb-1">Fail reason</span>
                  <p className="text-xs text-slate-700 leading-relaxed font-mono font-bold">
                    {sandboxResult.failReason || (sandboxResult.status === 'PASSED' ? '—' : sandboxResult.aiVerdictReason || '—')}
                    {sandboxResult.variantConflict ? ` · Variant ${sandboxResult.variantConflict}` : ''}
                    {sandboxResult.packConfidence ? ` · Pack ${sandboxResult.packConfidence}` : ''}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-start space-x-3 p-3 bg-blue-50/40 rounded-lg border border-blue-100">
                    <ListingThumb src={sandboxResult.vendorListing.imageUrl} alt="Vendor" label="Vendor" />
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-blue-700 uppercase">Vendor</span>
                      <p className="text-[11px] text-slate-800 font-semibold leading-snug line-clamp-3">
                        {sandboxResult.vendorListing.title || '—'}
                      </p>
                      {!sandboxResult.vendorListing.imageUrl && (
                        <span className="block text-[10px] font-bold text-amber-700 mt-1">Vendor image not scraped</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 p-3 bg-amber-50/40 rounded-lg border border-amber-100">
                    <ListingThumb src={sandboxResult.amazonListing.imageUrl} alt="Amazon" label="Amazon" />
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-amber-700 uppercase">Amazon</span>
                      <p className="text-[11px] text-slate-800 font-semibold leading-snug line-clamp-3">
                        {sandboxResult.amazonListing.title || '—'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 font-semibold block mb-1">Brand</span>
                    <span className="text-sm font-bold text-slate-800 block truncate">
                      {sandboxResult.vendorListing.brand || '—'} vs {sandboxResult.amazonListing.brand || '—'}
                    </span>
                    <span className={`block text-[10px] font-bold mt-0.5 ${matchClass(sandboxResult.vendorListing.brand && sandboxResult.amazonListing.brand ? sandboxResult.brandMatch : null)}`}>
                      {matchLabel(
                        sandboxResult.vendorListing.brand && sandboxResult.amazonListing.brand ? sandboxResult.brandMatch : null,
                        'Brand match',
                        'Brand mismatch',
                        'Brand unpublished',
                      )}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 font-semibold block mb-1">Model / MPN</span>
                    <span className="text-xs font-mono font-bold text-slate-800 block truncate">
                      {sandboxResult.vendorListing.modelNumber || sandboxResult.vendorModel}
                    </span>
                    <span className={`block text-[10px] font-bold mt-0.5 ${matchClass(sandboxResult.vendorListing.modelNumber && sandboxResult.amazonListing.modelNumber ? sandboxResult.modelMatch : null)}`}>
                      {matchLabel(
                        sandboxResult.vendorListing.modelNumber && sandboxResult.amazonListing.modelNumber ? sandboxResult.modelMatch : null,
                        'Partial match',
                        'Model mismatch',
                        'Model unpublished',
                      )}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 font-semibold block mb-1">Pack size (not case qty)</span>
                    <span className="text-sm font-bold text-slate-800">
                      {formatPackQty(sandboxResult.vendorListing.packQuantity)} vs {formatPackQty(sandboxResult.amazonListing.packQuantity)}
                    </span>
                    <span className="block text-[10px] text-slate-500 mt-0.5">
                      Case: {formatPackQty(sandboxResult.vendorListing.caseQuantity)} vs {formatPackQty(sandboxResult.amazonListing.caseQuantity)}
                    </span>
                    <span className={`block text-[10px] font-bold mt-0.5 ${matchClass(sandboxResult.packQtyMatch)}`}>
                      {matchLabel(sandboxResult.packQtyMatch, 'Pack match', 'Pack discrepancy', 'Pack unpublished')}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 font-semibold block mb-1">UPC (any Amazon barcode)</span>
                    <span className="text-xs font-mono font-bold text-slate-800">{sandboxResult.upc}</span>
                    <span className={`block text-[10px] font-bold mt-0.5 ${matchClass(sandboxResult.upcMatch)}`}>
                      {sandboxResult.upcMatch
                        ? `Matched ${upcHit?.type || 'UPC'} ${upcHit?.value || sandboxResult.amazonListing.upc}`
                        : matchLabel(sandboxResult.upcMatch, 'Verified', 'Barcode mismatch', 'No Amazon UPC')}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 font-semibold block mb-1">Image (AI, 1 vs 1)</span>
                    <span className="text-base font-black text-slate-900">
                      {sandboxResult.imageSimilarityPct == null ? '—' : `${sandboxResult.imageSimilarityPct}%`}
                    </span>
                    <span className={`block text-[10px] font-bold mt-0.5 ${matchClass(imagePass)}`}>
                      {matchLabel(
                        imagePass,
                        `Pass (≥${settings.imageSimilarityThreshold}%)`,
                        `Below ${settings.imageSimilarityThreshold}%`,
                        sandboxResult.imageSimilarityPct == null
                          ? 'Image AI not completed'
                          : 'Image missing on one side',
                      )}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 font-semibold block mb-1">Title Result (AI)</span>
                    <span className="text-sm font-bold text-slate-800">
                      {sandboxResult.titleResult ??
                        (sandboxResult.titleSameProduct == null
                          ? 'Not checked'
                          : sandboxResult.titleSameProduct
                            ? 'YES'
                            : 'NO')}
                    </span>
                    <span className="block text-[10px] text-slate-500 mt-0.5">
                      Unified Claude QC · one call per SKU
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 font-semibold block mb-1">Variant conflict</span>
                    <span className="text-base font-black text-slate-900">{sandboxResult.variantConflict || '—'}</span>
                    <span className={`block text-[10px] font-bold mt-0.5 ${sandboxResult.variantConflict && sandboxResult.variantConflict !== 'NONE' ? 'text-red-600' : 'text-emerald-600'}`}>
                      {sandboxResult.variantConflict == null
                        ? 'Not checked'
                        : sandboxResult.variantConflict === 'NONE'
                          ? 'No conflict'
                          : sandboxResult.variantConflict}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 font-semibold block mb-1">Pack confidence</span>
                    <span className="text-base font-black text-slate-900">{sandboxResult.packConfidence || '—'}</span>
                    <span className={`block text-[10px] font-bold mt-0.5 ${sandboxResult.packConfidence === 'UNSURE' ? 'text-amber-600' : 'text-slate-500'}`}>
                      {sandboxResult.packConfidence === 'UNSURE' ? 'Manual review' : 'AI pack certainty'}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 font-semibold block mb-1">Price (display only)</span>
                    <span className="text-base font-black text-slate-900">
                      {sandboxResult.priceVariancePct > 0 ? `+${sandboxResult.priceVariancePct}%` : `${sandboxResult.priceVariancePct}%`}
                    </span>
                    <span className="block text-[10px] font-bold text-slate-500 mt-0.5">Not used in pass/fail</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex-1 flex flex-col min-h-0">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                  <Code2 className="w-4 h-4 text-slate-500" />
                  <span>Raw API & Catalog Response Data</span>
                </span>

                <div className="grid grid-cols-2 gap-3 flex-1 min-h-[140px]">
                  <JsonCopyBlock
                    label="Seawide Vendor Object:"
                    labelClassName="text-blue-700"
                    data={sandboxResult.vendorListingFull || sandboxResult.vendorListing}
                  />
                  <JsonCopyBlock
                    label="Amazon SP-API Object:"
                    labelClassName="text-amber-700"
                    data={sandboxResult.amazonListingFull || sandboxResult.amazonListing}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="h-full bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col items-center justify-center p-8 text-center">
              <FlaskConical className="w-12 h-12 text-slate-300 mb-2" />
              <h3 className="text-sm font-bold text-slate-700">Sandbox Ready</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Enter a single SKU row on the left or select a preset, then click <strong>"Run Sandbox Test"</strong> to inspect granular comparison details.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
