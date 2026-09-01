import React, { memo } from 'react';
import { Anchor, ShieldCheck, Activity, Database } from 'lucide-react';
import { useQCStore } from '../../store/useQCStore';
import { useCredStore } from '../../store/useCredStore';
import { ThemeToggle } from '../ui/ThemeToggle';

export const Header: React.FC = memo(() => {
  const executionState = useQCStore((state) => state.executionState);
  const amazonConnected = useCredStore((state) => state.credentials.amazon.isConnected);
  const vendorConnected = useCredStore((state) => state.credentials.vendor.isConnected);
  const claudeConnected = useCredStore((state) => state.credentials.claude.isConnected);

  const isLive = executionState === 'RUNNING';

  return (
    <header className="h-16 bg-header border-b border-line px-6 flex items-center justify-between shrink-0 select-none">
      {/* Brand & Vendor Title */}
      <div className="flex items-center space-x-3.5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white">
          <Anchor className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base font-black tracking-tight text-fg uppercase">
              SWDT VENDOR QC TOOL
            </h1>
            <span className="text-[11px] font-semibold tracking-wide bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
              seawide distribution
            </span>
          </div>
          <p className="text-xs text-fg-muted font-medium">
            Amazon SP-API & Vendor Portal Listing Comparator
          </p>
        </div>
      </div>

      {/* Status & Indicators */}
      <div className="flex items-center space-x-3">
        <ThemeToggle />

        {/* System State Badge */}
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-muted border border-line text-xs">
          <span className="relative flex h-2.5 w-2.5">
            {isLive ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-400"></span>
            )}
          </span>
          <span className="font-semibold text-fg-secondary">
            {executionState === 'RUNNING'
              ? 'RUNNING BATCH'
              : executionState === 'PAUSED'
              ? 'STREAM PAUSED'
              : executionState === 'COMPLETED'
              ? 'BATCH FINISHED'
              : 'ENGINE READY'}
          </span>
        </div>

        {/* Integration Quick Health */}
        <div className="hidden md:flex items-center space-x-2 text-xs text-fg-secondary">
          <div className="flex items-center space-x-1 px-2.5 py-1 rounded bg-muted border border-line" title="Amazon SP-API Connection">
            <Database className={`w-3.5 h-3.5 ${amazonConnected ? 'text-emerald-600' : 'text-slate-400'}`} />
            <span className="font-medium">SP-API</span>
          </div>
          <div className="flex items-center space-x-1 px-2.5 py-1 rounded bg-muted border border-line" title="Seawide Distribution Vendor Portal Connection">
            <ShieldCheck className={`w-3.5 h-3.5 ${vendorConnected ? 'text-blue-600' : 'text-slate-400'}`} />
            <span className="font-medium">Vendor Portal</span>
          </div>
          <div className="flex items-center space-x-1 px-2.5 py-1 rounded bg-muted border border-line" title="Claude Haiku 4.5 AI Engine">
            <Activity className={`w-3.5 h-3.5 ${claudeConnected ? 'text-indigo-600' : 'text-slate-400'}`} />
            <span className="font-medium">Claude Haiku 4.5</span>
          </div>
        </div>
      </div>
    </header>
  );
});

Header.displayName = 'Header';
