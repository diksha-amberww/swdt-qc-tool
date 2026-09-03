import React, { memo, useEffect } from 'react';
import { Cpu, DollarSign, Zap, HardDrive, Wifi, Loader2, FlaskConical } from 'lucide-react';
import { useQCStore } from '../../store/useQCStore';
import { useCostStore } from '../../store/useCostStore';
import { useCredStore } from '../../store/useCredStore';

export const StatusBar: React.FC = memo(() => {
  const queueLen = useQCStore((s) => s.queue.length);
  const resultsLen = useQCStore((s) => s.results.length);
  const executionState = useQCStore((s) => s.executionState);
  const isSandboxRunning = useQCStore((s) => s.isSandboxRunning);
  const isAnalysisPending = useQCStore((s) => s.isAnalysisPending);
  const elapsedSeconds = useQCStore((s) => s.elapsedSeconds);
  const tickElapsed = useQCStore((s) => s.tickElapsed);
  const batchTotalTokens = useCostStore((s) => s.metrics.batchTotalTokens);
  const batchTotalCost = useCostStore((s) => s.metrics.batchTotalCost);
  const isTesting = useCredStore((s) => s.isTesting);

  const credTestRunning = Object.values(isTesting).some(Boolean);
  const batchRunning = executionState === 'RUNNING' || isAnalysisPending;

  useEffect(() => {
    if (executionState !== 'RUNNING') return;
    const interval = setInterval(() => {
      tickElapsed();
    }, 1000);
    return () => clearInterval(interval);
  }, [executionState, tickElapsed]);

  const speed =
    resultsLen > 0 && elapsedSeconds > 0 ? ((resultsLen / elapsedSeconds) * 60).toFixed(1) : '0.0';

  return (
    <footer className="h-8 bg-slate-900 text-slate-200 text-[11px] px-6 flex items-center justify-between shrink-0 select-none border-t border-slate-700">
      <div className="flex items-center space-x-5">
        <div className="flex items-center space-x-1.5">
          <HardDrive className="w-3.5 h-3.5 text-sky-400" />
          <span>Queue: <strong className="text-white">{resultsLen}/{queueLen || resultsLen}</strong></span>
        </div>

        <div className="flex items-center space-x-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>Speed: <strong className="text-white">{speed} SKU/min</strong></span>
        </div>

        <div className="flex items-center space-x-1.5">
          <Cpu className="w-3.5 h-3.5 text-emerald-400" />
          <span>Tokens: <strong className="text-white">{batchTotalTokens.toLocaleString()}</strong></span>
        </div>

        <div className="flex items-center space-x-1.5">
          <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
          <span>Batch Cost: <strong className="text-emerald-300">${batchTotalCost.toFixed(4)}</strong></span>
        </div>

        {batchRunning && (
          <div className="flex items-center space-x-1.5 text-blue-300">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Batch QC running…</span>
          </div>
        )}
        {isSandboxRunning && (
          <div className="flex items-center space-x-1.5 text-purple-300">
            <FlaskConical className="w-3.5 h-3.5" />
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Sandbox running…</span>
          </div>
        )}
        {credTestRunning && (
          <div className="flex items-center space-x-1.5 text-amber-300">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Credential test running…</span>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-4 text-slate-300">
        <div className="flex items-center space-x-1">
          <Wifi className="w-3.5 h-3.5 text-emerald-400" />
          <span>Electron IPC: <strong className="text-white">Connected</strong></span>
        </div>
        <span className="text-slate-400">v1.0.0-rc</span>
      </div>
    </footer>
  );
});

StatusBar.displayName = 'StatusBar';
