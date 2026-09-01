import React, { useState } from 'react';
import {
  FlaskConical,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Send,
  Sparkles,
  Barcode,
  Layers,
  Code2,
  FileCode,
} from 'lucide-react';
import { useQCStore } from '../store/useQCStore';
import { useLogStore } from '../store/useLogStore';
import { ValidatorService } from '../services/validatorService';
import { MockQCEngine } from '../services/mockQCEngine';
import { QCStatus } from '../types/qc';

export const SandboxPage: React.FC = () => {
  const {
    sandboxInputText,
    setSandboxInputText,
    sandboxResult,
    setSandboxResult,
    isSandboxRunning,
    setIsSandboxRunning,
    overrideSandboxStatus,
    pushSandboxToOutput,
  } = useQCStore();

  const addLog = useLogStore((state) => state.addLog);
  const [pushedMessage, setPushedMessage] = useState<string | null>(null);
  const [sandboxTrace, setSandboxTrace] = useState<string[]>([]);

  const runSandboxAnalysis = async () => {
    setIsSandboxRunning(true);
    setSandboxTrace([
      `[${new Date().toLocaleTimeString()}] Initializing Isolated Sandbox Debugger...`,
      `[${new Date().toLocaleTimeString()}] Parsing single-row input string...`,
    ]);

    const summary = ValidatorService.parseRawText(sandboxInputText);
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
      `[${new Date().toLocaleTimeString()}] Extracted SKU: ${row.partSku} | ASIN: ${row.asin} | Brand: ${row.brand}`,
      `[${new Date().toLocaleTimeString()}] Ensuring Seawide vendor session (reuse existing if available)...`,
    ]);

    const sessionOk = await MockQCEngine.ensureBatchSession();
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
      `[${new Date().toLocaleTimeString()}] Seawide session ready — running sandbox QC pipeline...`,
      `[${new Date().toLocaleTimeString()}] Simulating Amazon SP-API items/listings endpoint...`,
      `[${new Date().toLocaleTimeString()}] Calling Claude Haiku 4.5 comparison analyzer...`,
    ]);

    try {
      const result = await MockQCEngine.evaluateSingleSku(row);
      setSandboxResult(result);
      setSandboxTrace((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Result calculated: ${result.status} (Confidence: ${(result.confidenceScore * 100).toFixed(0)}%)`,
        `[${new Date().toLocaleTimeString()}] Sandbox evaluation complete!`,
      ]);
    } catch (err: any) {
      setSandboxTrace((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] FATAL: ${err?.message || 'Execution error'}`,
      ]);
    } finally {
      setIsSandboxRunning(false);
    }
  };

  const handlePushToOutput = () => {
    if (!sandboxResult) return;
    pushSandboxToOutput();
    setPushedMessage(`Pushed SKU ${sandboxResult.partSku} to Live Output Stream!`);
    addLog('INFO', 'SYSTEM', `Pushed sandbox result for SKU ${sandboxResult.partSku} to live output stream.`);
    setTimeout(() => setPushedMessage(null), 3000);
  };

  const handleLoadPreset = (type: 'PASS' | 'FAIL' | 'REVIEW') => {
    let preset = '';
    if (type === 'PASS') {
      preset = 'SKU-SWD-10492\tB0000AXN5U\tSierra Marine\tElectrical\t030999014923';
    } else if (type === 'FAIL') {
      preset = 'SKU-SWD-20914\tB07KM48P9X\tSeachoice\tHardware & Fasteners\t719249501481';
    } else {
      preset = 'SKU-SWD-33819\tB01N10VZ28\tTeleflex\tSteering & Control\t731957002819';
    }
    setSandboxInputText(preset);
  };

  const activeStatus = sandboxResult?.status;

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      {/* Top Banner */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 shrink-0">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
            <FlaskConical className="w-5 h-5 text-purple-600" />
            <span>Sandbox Single-SKU Debugger</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Test and inspect individual product listings with live AI verification, pulsating status cards, and manual override controls.
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

      {/* Main Sandbox Grid */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-6 pt-4 overflow-y-auto">
        {/* Left Column: Input Box & Big Pulsating Status Cards (5 cols) */}
        <div className="col-span-5 flex flex-col space-y-4">
          {/* Input Box Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Single-Row Input (TSV / Excel format)
              </span>
              <span className="text-[11px] text-slate-400 font-mono">PART SKU | ASIN | Brand | Line | UPC</span>
            </div>

            <textarea
              value={sandboxInputText}
              onChange={(e) => setSandboxInputText(e.target.value)}
              placeholder="SKU-SWD-8849	B07XQ94ABC	Sierra Marine	Electrical	030999884901"
              rows={3}
              className="w-full p-2.5 font-mono text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 resize-none"
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

            {pushedMessage && (
              <span className="block text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 p-2 rounded-lg text-center animate-in fade-in">
                {pushedMessage}
              </span>
            )}
          </div>

          {/* Big Visual Cards with Pulsating Glow Effect & Manual Override Click */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Calculated Verdict Status
              </span>
              <span className="text-[11px] text-slate-400">Click any card to manually override</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {/* PASSED CARD */}
              <button
                onClick={() => overrideSandboxStatus('PASSED')}
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

              {/* FAILED CARD */}
              <button
                onClick={() => overrideSandboxStatus('FAILED')}
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

              {/* MANUAL REVIEW CARD */}
              <button
                onClick={() => overrideSandboxStatus('MANUAL REVIEW')}
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

          {/* Execution Trace Container */}
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

        {/* Right Column: Comparison Matrix & Raw Data (7 cols) */}
        <div className="col-span-7 flex flex-col space-y-4">
          {sandboxResult ? (
            <>
              {/* Granular Comparison Matrix */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      Granular Comparison Matrix
                    </h3>
                  </div>
                  <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {sandboxResult.partSku} • ASIN: {sandboxResult.asin}
                  </span>
                </div>

                {/* Matrix Items */}
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 font-semibold block mb-1">Title Match Score</span>
                    <span className="text-base font-black text-slate-900">{sandboxResult.titleMatchPct}%</span>
                    <span className={`block text-[10px] font-bold mt-0.5 ${sandboxResult.titleMatchPct >= 70 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {sandboxResult.titleMatchPct >= 70 ? 'Threshold Met (≥70%)' : 'Below Threshold (<70%)'}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 font-semibold block mb-1">Price Variance</span>
                    <span className="text-base font-black text-slate-900">
                      {sandboxResult.priceVariancePct > 0 ? `+${sandboxResult.priceVariancePct}%` : `${sandboxResult.priceVariancePct}%`}
                    </span>
                    <span className={`block text-[10px] font-bold mt-0.5 ${Math.abs(sandboxResult.priceVariancePct) <= 15 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {Math.abs(sandboxResult.priceVariancePct) <= 15 ? 'Within Limit (±15%)' : 'Variance Exceeded'}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 font-semibold block mb-1">Image Similarity</span>
                    <span className="text-base font-black text-slate-900">{sandboxResult.imageSimilarityPct}%</span>
                    <span className="block text-[10px] font-bold text-emerald-600 mt-0.5">High Visual Match</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 font-semibold block mb-1">Pack Quantity</span>
                    <span className="text-sm font-bold text-slate-800">
                      {sandboxResult.vendorListing.packQuantity} vs {sandboxResult.amazonListing.packQuantity}
                    </span>
                    <span className={`block text-[10px] font-bold mt-0.5 ${sandboxResult.packQtyMatch ? 'text-emerald-600' : 'text-red-600'}`}>
                      {sandboxResult.packQtyMatch ? 'Exact Match' : 'Pack Discrepancy'}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 font-semibold block mb-1">UPC Match</span>
                    <span className="text-xs font-mono font-bold text-slate-800">{sandboxResult.upc}</span>
                    <span className={`block text-[10px] font-bold mt-0.5 ${sandboxResult.upcMatch ? 'text-emerald-600' : 'text-red-600'}`}>
                      {sandboxResult.upcMatch ? 'Verified 1:1' : 'Barcode Mismatch'}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-slate-500 font-semibold block mb-1">Model / MPN Match</span>
                    <span className="text-xs font-mono font-bold text-slate-800">{sandboxResult.partSku}</span>
                    <span className={`block text-[10px] font-bold mt-0.5 ${sandboxResult.modelMatch ? 'text-emerald-600' : 'text-red-600'}`}>
                      {sandboxResult.modelMatch ? 'Verified MPN' : 'Model Mismatch'}
                    </span>
                  </div>
                </div>

                {/* AI Reasoning Text */}
                <div className="p-3.5 rounded-lg bg-purple-50/50 border border-purple-100">
                  <span className="text-xs font-bold text-purple-900 block mb-1">Claude Haiku 4.5 AI Synthesis:</span>
                  <p className="text-xs text-slate-700 leading-relaxed">{sandboxResult.aiVerdictReason}</p>
                </div>
              </div>

              {/* Side-by-side Raw JSON Payload Viewer */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex-1 flex flex-col min-h-0">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                  <Code2 className="w-4 h-4 text-slate-500" />
                  <span>Raw API & Catalog Response Data</span>
                </span>

                <div className="grid grid-cols-2 gap-3 flex-1 min-h-[140px]">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 overflow-auto font-mono text-[10px]">
                    <span className="font-bold text-blue-700 block mb-1">Seawide Vendor Object:</span>
                    <pre className="text-slate-700">{JSON.stringify(sandboxResult.vendorListing, null, 2)}</pre>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 overflow-auto font-mono text-[10px]">
                    <span className="font-bold text-amber-700 block mb-1">Amazon SP-API Object:</span>
                    <pre className="text-slate-700">{JSON.stringify(sandboxResult.amazonListing, null, 2)}</pre>
                  </div>
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
