import React, { useState, useMemo, useDeferredValue, useCallback } from 'react';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Filter,
  Layers,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
} from 'lucide-react';
import { useQCStore } from '../store/useQCStore';
import { useLogStore } from '../store/useLogStore';
import { QcEngine } from '../services/qcEngine';
import { DetailModal } from '../components/output/DetailModal';
import { ResultRow } from '../components/output/ResultRow';
import { QCRowResult, QCStatus } from '../types/qc';
import { useNavigate } from 'react-router-dom';

export const OutputPage: React.FC = () => {
  const navigate = useNavigate();
  const queue = useQCStore((s) => s.queue);
  const results = useQCStore((s) => s.results);
  const executionState = useQCStore((s) => s.executionState);
  const startQC = useQCStore((s) => s.startQC);
  const pauseQC = useQCStore((s) => s.pauseQC);
  const resumeQC = useQCStore((s) => s.resumeQC);
  const stopQC = useQCStore((s) => s.stopQC);
  const resetQC = useQCStore((s) => s.resetQC);
  const setAnalysisPending = useQCStore((s) => s.setAnalysisPending);
  const getMetrics = useQCStore((s) => s.getMetrics);
  const statusCounts = useQCStore((s) => s.statusCounts);
  const elapsedSeconds = useQCStore((s) => s.elapsedSeconds);

  const addLog = useLogStore((state) => state.addLog);
  const [selectedResult, setSelectedResult] = useState<QCRowResult | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | QCStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const deferredSearch = useDeferredValue(searchQuery);
  const [activeBtnPressed, setActiveBtnPressed] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  const metrics = useMemo(() => getMetrics(), [getMetrics, statusCounts, elapsedSeconds, results.length, queue.length]);
  const isRunning = executionState === 'RUNNING';
  const isPaused = executionState === 'PAUSED';
  const handleSelect = useCallback((row: QCRowResult) => setSelectedResult(row), []);

  // 1. Control Handlers: START, PAUSE, RESUME, STOP, RESET
  const handleStart = async () => {
    setActiveBtnPressed('START');
    setTimeout(() => setActiveBtnPressed(null), 250);

    if (queue.length === 0 && results.length === 0) {
      navigate('/upload');
      return;
    }

    setAnalysisPending(true);
    try {
      const sessionOk = await QcEngine.ensureBatchSession();
      if (!sessionOk) {
        addLog('ERROR', 'LOGIN', 'Cannot start batch: Seawide session not available.');
        setAnalysisPending(false);
        return;
      }

      startQC();
      QcEngine.startLiveProcessing();
      addLog('INFO', 'QC_ENGINE', 'Live QC comparison stream started.');
    } catch {
      setAnalysisPending(false);
    }
  };

  const handlePause = () => {
    setActiveBtnPressed('PAUSE');
    setTimeout(() => setActiveBtnPressed(null), 250);
    pauseQC();
    QcEngine.stopProcessing();
    addLog('WARNING', 'QC_ENGINE', 'Live QC stream paused by operator.');
  };

  const handleResume = async () => {
    setActiveBtnPressed('RESUME');
    setTimeout(() => setActiveBtnPressed(null), 250);

    setAnalysisPending(true);
    try {
      const sessionOk = await QcEngine.ensureBatchSession();
      if (!sessionOk) {
        addLog('ERROR', 'LOGIN', 'Cannot resume batch: Seawide session not available.');
        setAnalysisPending(false);
        return;
      }

      resumeQC();
      QcEngine.startLiveProcessing();
      addLog('INFO', 'QC_ENGINE', 'Live QC stream resumed.');
    } catch {
      setAnalysisPending(false);
    }
  };

  const handleStop = () => {
    setActiveBtnPressed('STOP');
    setTimeout(() => setActiveBtnPressed(null), 250);
    stopQC();
    QcEngine.stopProcessing();
    addLog('ERROR', 'QC_ENGINE', 'Live QC stream stopped completely.');
  };

  const handleReset = () => {
    setActiveBtnPressed('RESET');
    setTimeout(() => setActiveBtnPressed(null), 250);
    stopQC();
    QcEngine.stopProcessing();
    resetQC();
    setCurrentPage(1);
    addLog('INFO', 'SYSTEM', 'QC Results and queue state reset.');
  };

  // 2. Filter & Search with Memoization to prevent lag
  const filteredResults = useMemo(() => {
    return results.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (deferredSearch.trim()) {
        const q = deferredSearch.toLowerCase();
        const matchModel = (r.vendorModel || r.partSku).toLowerCase().includes(q);
        const matchAsin = r.asin.toLowerCase().includes(q);
        const matchBrand = (r.brand || '').toLowerCase().includes(q);
        const matchUpc = r.upc.toLowerCase().includes(q);
        const matchReason =
          (r.failReason || '').toLowerCase().includes(q) ||
          (r.aiVerdictReason || '').toLowerCase().includes(q) ||
          (r.variantConflict || '').toLowerCase().includes(q);
        if (!matchModel && !matchAsin && !matchBrand && !matchUpc && !matchReason) {
          return false;
        }
      }
      return true;
    });
  }, [results, statusFilter, deferredSearch]);

  // 3. Pagination calculations
  const totalItems = filteredResults.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedData = useMemo(() => {
    const startIdx = (safeCurrentPage - 1) * pageSize;
    return filteredResults.slice(startIdx, startIdx + pageSize);
  }, [filteredResults, safeCurrentPage, pageSize]);

  // Progress metrics
  const totalDenominator = queue.length > 0 ? queue.length : results.length;
  const completionPercentage = totalDenominator > 0 ? Math.min(100, Math.round((results.length / totalDenominator) * 100)) : 0;
  const skuFractionDisplay = `${results.length} / ${totalDenominator}`;

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      {/* Top Controls & Metrics Banner */}
      <div className="flex flex-col space-y-4 pb-4 border-b border-slate-200 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
              <Layers className="w-5 h-5 text-blue-600" />
              <span>Live QC Comparison Stream</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time listing verification stream comparing Seawide vendor inventory vs Amazon catalog.
            </p>
          </div>

          {/* Fully Integrated Tactile Control Bar: START | PAUSE | RESUME | STOP | RESET */}
          <div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 shadow-inner">
            {/* Start Button (when idle/stopped) */}
            {executionState === 'IDLE' || executionState === 'STOPPED' || executionState === 'COMPLETED' ? (
              <button
                onClick={handleStart}
                disabled={queue.length === 0 && results.length === 0}
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                  queue.length === 0 && results.length === 0
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : activeBtnPressed === 'START'
                    ? 'scale-95 shadow-inner bg-emerald-800 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/30 active:scale-95'
                }`}
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start QC</span>
              </button>
            ) : null}

            {/* Pause Button (when running) */}
            {isRunning ? (
              <button
                onClick={handlePause}
                data-analysis-control
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                  activeBtnPressed === 'PAUSE'
                    ? 'scale-95 shadow-inner bg-amber-800 text-white'
                    : 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/30 active:scale-95'
                }`}
              >
                <Pause className="w-4 h-4 fill-current" />
                <span>Pause</span>
              </button>
            ) : null}

            {/* Resume Button (when paused) */}
            {isPaused ? (
              <button
                onClick={handleResume}
                data-analysis-control
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                  activeBtnPressed === 'RESUME'
                    ? 'scale-95 shadow-inner bg-emerald-800 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/30 active:scale-95'
                }`}
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Resume</span>
              </button>
            ) : null}

            {/* Stop Button (active when running or paused) */}
            <button
              onClick={handleStop}
              data-analysis-control
              disabled={executionState === 'IDLE' || executionState === 'STOPPED'}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                executionState === 'IDLE' || executionState === 'STOPPED'
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : activeBtnPressed === 'STOP'
                  ? 'scale-95 shadow-inner bg-red-800 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/30 active:scale-95'
              }`}
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop</span>
            </button>

            {/* Reset Button */}
            <button
              onClick={handleReset}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-white transition-all cursor-pointer"
              title="Reset Run"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* KPI Banner with Exact SKU Count & Completion Rate */}
        <div className="grid grid-cols-6 gap-3">
          {/* SKU Completion Fraction & Percentage */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Completion Rate</span>
            <div className="flex items-baseline justify-between mt-0.5">
              <span className="text-lg font-black text-blue-700">{skuFractionDisplay}</span>
              <span className="text-xs font-black font-mono text-slate-900 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                {completionPercentage}%
              </span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-blue-600 h-full transition-all duration-300"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>

          <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200 shadow-xs">
            <span className="text-[10px] font-bold text-emerald-700 uppercase block flex items-center space-x-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Passed</span>
            </span>
            <div className="flex items-baseline space-x-1.5 mt-0.5">
              <span className="text-lg font-black text-emerald-800">{metrics.passed}</span>
              <span className="text-[11px] font-bold text-emerald-600">
                {metrics.processed > 0 ? `(${((metrics.passed / metrics.processed) * 100).toFixed(0)}%)` : '(0%)'}
              </span>
            </div>
          </div>

          <div className="p-3 bg-red-50/50 rounded-xl border border-red-200 shadow-xs">
            <span className="text-[10px] font-bold text-red-700 uppercase block flex items-center space-x-1">
              <XCircle className="w-3 h-3 text-red-600" />
              <span>Failed</span>
            </span>
            <div className="flex items-baseline space-x-1.5 mt-0.5">
              <span className="text-lg font-black text-red-800">{metrics.failed}</span>
              <span className="text-[11px] font-bold text-red-600">
                {metrics.processed > 0 ? `(${((metrics.failed / metrics.processed) * 100).toFixed(0)}%)` : '(0%)'}
              </span>
            </div>
          </div>

          <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200 shadow-xs">
            <span className="text-[10px] font-bold text-amber-700 uppercase block flex items-center space-x-1">
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              <span>Manual Review</span>
            </span>
            <div className="flex items-baseline space-x-1.5 mt-0.5">
              <span className="text-lg font-black text-amber-800">{metrics.manualReview}</span>
              <span className="text-[11px] font-bold text-amber-600">
                {metrics.processed > 0 ? `(${((metrics.manualReview / metrics.processed) * 100).toFixed(0)}%)` : '(0%)'}
              </span>
            </div>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase block flex items-center space-x-1">
              <TrendingUp className="w-3 h-3 text-blue-500" />
              <span>Current Speed</span>
            </span>
            <div className="flex items-baseline space-x-1 mt-0.5">
              <span className="text-lg font-black text-slate-900">{metrics.speedSkuPerMin}</span>
              <span className="text-xs text-slate-400 font-medium">SKU/min</span>
            </div>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Est. Time Left</span>
            <div className="flex items-baseline space-x-1 mt-0.5">
              <span className="text-lg font-black text-slate-900">
                {metrics.estimatedSecondsRemaining > 0 ? `${metrics.estimatedSecondsRemaining}s` : '0s'}
              </span>
              <span className="text-xs text-slate-400 font-medium">remaining</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Container with Pagination & Search Controls */}
      <div className="flex-1 min-h-0 pt-4 flex flex-col">
        {/* Toolbar: Category Filters + Search Box + Page Size Customization */}
        <div className="flex items-center justify-between pb-3 shrink-0 gap-4">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Filter:</span>

            {(['ALL', 'PASSED', 'FAILED', 'MANUAL REVIEW'] as const).map((st) => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === st
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Search Box with Clear Button */}
          <div className="flex items-center space-x-3 flex-1 max-w-md justify-end">
            <div className="relative w-full max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by SKU, ASIN, brand, UPC..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* SKUs per page selector */}
            <div className="flex items-center space-x-1.5 text-xs text-slate-600 shrink-0">
              <span className="font-semibold">Show:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-xs"
              >
                <option value={10}>10 SKUs</option>
                <option value={15}>15 SKUs</option>
                <option value={25}>25 SKUs</option>
                <option value={50}>50 SKUs</option>
              </select>
            </div>
          </div>
        </div>

        {/* High Performance Paginated Stream Table */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto">
            {paginatedData.length > 0 ? (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 text-slate-700 font-bold sticky top-0 border-b border-slate-200 shadow-xs backdrop-blur-xs">
                  <tr>
                    <th className="p-3">Status Verdict</th>
                    <th className="p-3">VENDOR MODEL</th>
                    <th className="p-3">ASIN</th>
                    <th className="p-3">Brand</th>
                    <th className="p-3 text-center">Title (AI)</th>
                    <th className="p-3 text-center">Pack Qty</th>
                    <th className="p-3 text-center">UPC Match</th>
                    <th className="p-3">Fail Reason</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedData.map((row) => (
                    <ResultRow key={row.id} row={row} onSelect={handleSelect} />
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 mb-3 border border-blue-100 shadow-xs">
                  <Sparkles className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-slate-800">
                  {results.length > 0 ? 'No SKUs match search criteria' : 'No QC output data yet'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  {results.length > 0
                    ? 'Try clearing the search query or changing category filters.'
                    : queue.length > 0
                    ? 'Queue loaded with SKUs. Click "Start QC" in the control bar to launch the comparison engine.'
                    : 'Upload or paste Seawide product listings to begin quality control inspection.'}
                </p>
                {results.length === 0 && queue.length === 0 && (
                  <button
                    onClick={() => navigate('/upload')}
                    className="mt-4 flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer transition-all"
                  >
                    <span>Go to Upload Section</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Custom Pagination Footer Bar */}
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 select-none">
            <div className="text-xs text-slate-600">
              Showing{' '}
              <strong className="text-slate-900">
                {totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1}
              </strong>{' '}
              to{' '}
              <strong className="text-slate-900">
                {Math.min(safeCurrentPage * pageSize, totalItems)}
              </strong>{' '}
              of <strong className="text-slate-900">{totalItems}</strong> matching SKUs (
              {results.length} total processed)
            </div>

            {/* Page Navigation Controls */}
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={safeCurrentPage <= 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all shadow-xs"
                title="First Page"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>

              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safeCurrentPage <= 1}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all shadow-xs"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>

              <span className="text-xs font-bold text-slate-700 px-2">
                Page {safeCurrentPage} of {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage >= totalPages}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all shadow-xs"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={safeCurrentPage >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all shadow-xs"
                title="Last Page"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Side-by-side Detail Modal */}
      {selectedResult && (
        <DetailModal
          result={selectedResult}
          onClose={() => setSelectedResult(null)}
        />
      )}
    </div>
  );
};
