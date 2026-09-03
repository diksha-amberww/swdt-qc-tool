import React, { memo } from 'react';
import { Loader2, Pause, Square } from 'lucide-react';
import { useQCStore } from '../../store/useQCStore';
import { useLogStore } from '../../store/useLogStore';
import { QcEngine } from '../../services/qcEngine';

/** True only while live batch QC is running / pending — does not include sandbox. */
export function useIsBatchAnalyzing(): boolean {
  const executionState = useQCStore((s) => s.executionState);
  const isAnalysisPending = useQCStore((s) => s.isAnalysisPending);
  return executionState === 'RUNNING' || isAnalysisPending;
}

/** @deprecated Prefer useIsBatchAnalyzing — sandbox no longer locks the app. */
export function useIsAnalyzing(): boolean {
  return useIsBatchAnalyzing();
}

export const AnalyzingOverlay: React.FC = memo(() => {
  const executionState = useQCStore((s) => s.executionState);
  const isAnalysisPending = useQCStore((s) => s.isAnalysisPending);
  const pauseQC = useQCStore((s) => s.pauseQC);
  const stopQC = useQCStore((s) => s.stopQC);
  const addLog = useLogStore((s) => s.addLog);

  const isBatchAnalyzing = executionState === 'RUNNING' || isAnalysisPending;

  if (!isBatchAnalyzing) return null;

  const handlePause = () => {
    pauseQC();
    QcEngine.stopProcessing();
    addLog('WARNING', 'QC_ENGINE', 'Live QC stream paused by operator.');
  };

  const handleStop = () => {
    stopQC();
    QcEngine.stopProcessing();
    addLog('ERROR', 'QC_ENGINE', 'Live QC stream forcibly stopped by operator.');
  };

  return (
    <div
      className="absolute inset-0 z-[40] flex items-center justify-center bg-overlay pointer-events-auto"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Analyzing Product Data"
    >
      <div className="flex flex-col items-center gap-4 px-8 py-7 rounded-2xl bg-card border border-line shadow-xl max-w-sm w-[90%]">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" aria-hidden="true" />
        <p className="text-sm font-bold text-fg tracking-wide text-center">Analyzing Product Data...</p>
        <p className="text-[11px] text-fg-muted text-center">
          Batch QC is running. You can still switch pages — Pause / Stop stay available here when you return to Output.
        </p>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            data-analysis-control
            onClick={handlePause}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-amber-500 hover:bg-amber-600 text-white cursor-pointer shadow-md"
          >
            <Pause className="w-3.5 h-3.5 fill-current" />
            <span>Pause</span>
          </button>
          <button
            type="button"
            data-analysis-control
            onClick={handleStop}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-red-600 hover:bg-red-700 text-white cursor-pointer shadow-md"
          >
            <Square className="w-3 h-3 fill-current" />
            <span>Stop</span>
          </button>
        </div>
      </div>
    </div>
  );
});

AnalyzingOverlay.displayName = 'AnalyzingOverlay';
