import React, { useState, useMemo, useDeferredValue } from 'react';
import {
  Terminal,
  Trash2,
  Pause,
  Play,
  Download,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
} from 'lucide-react';
import { useLogStore } from '../store/useLogStore';
import { LogLevel, LogCategory } from '../types/log';

export const LogsPage: React.FC = () => {
  const {
    logs,
    activeLevelFilter,
    activeCategoryFilter,
    searchQuery,
    isStreamingPaused,
    clearLogs,
    setActiveLevelFilter,
    setActiveCategoryFilter,
    setSearchQuery,
    setIsStreamingPaused,
  } = useLogStore();

  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(30);
  const deferredSearch = useDeferredValue(searchQuery);

  // Memoized filter to prevent UI render lagging on thousands of logs
  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      // Level filter
      if (activeLevelFilter !== 'ALL' && l.level !== activeLevelFilter) return false;
      // Category filter
      if (activeCategoryFilter !== 'ALL' && l.category !== activeCategoryFilter) return false;
      // Search query
      if (deferredSearch.trim()) {
        const q = deferredSearch.toLowerCase();
        const matchMsg = l.message.toLowerCase().includes(q);
        const matchSku = l.sku?.toLowerCase().includes(q);
        const matchAsin = l.asin?.toLowerCase().includes(q);
        const matchCat = l.category.toLowerCase().includes(q);
        if (!matchMsg && !matchSku && !matchAsin && !matchCat) return false;
      }
      return true;
    });
  }, [logs, activeLevelFilter, activeCategoryFilter, deferredSearch]);

  // Pagination for logs
  const totalItems = filteredLogs.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedLogs = useMemo(() => {
    const startIdx = (safeCurrentPage - 1) * pageSize;
    return filteredLogs.slice(startIdx, startIdx + pageSize);
  }, [filteredLogs, safeCurrentPage, pageSize]);

  const handleExportLogs = (format: 'TXT' | 'JSON') => {
    let content = '';
    if (format === 'JSON') {
      content = JSON.stringify(logs, null, 2);
    } else {
      content = logs
        .map(
          (l) =>
            `[${l.timestamp}] [${l.level}] [${l.category}] ${l.sku ? `[SKU: ${l.sku}] ` : ''}${l.message}`
        )
        .join('\n');
    }

    const blob = new Blob([content], { type: format === 'JSON' ? 'application/json' : 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `SWDT_QC_LOGS_${new Date().toISOString().slice(0, 10)}.${format.toLowerCase()}`;
    link.click();
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'SUCCESS':
        return (
          <span className="flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>SUCCESS</span>
          </span>
        );
      case 'ERROR':
        return (
          <span className="flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-black bg-red-100 text-red-800 border border-red-300">
            <XCircle className="w-3 h-3 text-red-600" />
            <span>ERROR</span>
          </span>
        );
      case 'WARNING':
        return (
          <span className="flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            <span>WARN</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <Info className="w-3 h-3 text-blue-600" />
            <span>INFO</span>
          </span>
        );
    }
  };

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      {/* Top Banner */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 shrink-0">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
            <Terminal className="w-5 h-5 text-indigo-600" />
            <span>System & Scraping Activity Logs</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Full diagnostic trace spanning Seawide portal login, GET APIs, Amazon SP-API items query, AI comparisons, and system events.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsStreamingPaused(!isStreamingPaused)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer ${
              isStreamingPaused
                ? 'bg-amber-600 text-white'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            {isStreamingPaused ? (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Resume Stream</span>
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause Logs</span>
              </>
            )}
          </button>

          <button
            onClick={clearLogs}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-red-50 text-slate-700 hover:text-red-700 hover:border-red-200 text-xs font-medium transition-all shadow-xs cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Logs</span>
          </button>

          <button
            onClick={() => handleExportLogs('TXT')}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-xs cursor-pointer"
            title="Export as Text"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export TXT</span>
          </button>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="py-3 flex items-center justify-between gap-4 shrink-0">
        {/* Level Filters */}
        <div className="flex items-center space-x-1.5">
          <span className="text-xs font-bold text-slate-500 mr-1 flex items-center space-x-1">
            <Filter className="w-3.5 h-3.5" />
            <span>LEVEL:</span>
          </span>
          {(['ALL', 'INFO', 'SUCCESS', 'WARNING', 'ERROR'] as LogLevel[]).map((lvl) => (
            <button
              key={lvl}
              onClick={() => {
                setActiveLevelFilter(lvl);
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                activeLevelFilter === lvl
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>

        {/* Category Filters */}
        <div className="flex items-center space-x-1 overflow-x-auto">
          {(
            [
              'ALL',
              'SYSTEM',
              'LOGIN',
              'SCRAPER',
              'AMAZON_API',
              'QC_ENGINE',
              'AI_CALL',
              'ERROR',
            ] as const
          ).map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setActiveCategoryFilter(cat);
                setCurrentPage(1);
              }}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                activeCategoryFilter === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Box & Per-Page Customizer */}
        <div className="flex items-center space-x-2 shrink-0">
          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search logs..."
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

          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-700 shadow-xs"
          >
            <option value={20}>20/page</option>
            <option value={30}>30/page</option>
            <option value={50}>50/page</option>
            <option value={100}>100/page</option>
          </select>
        </div>
      </div>

      {/* Logs Terminal Box */}
      <div className="flex-1 bg-slate-950 text-slate-200 rounded-xl border border-slate-800 shadow-inner overflow-hidden flex flex-col min-h-0 font-mono text-xs">
        {/* Terminal Header */}
        <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400 select-none">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            <span className="ml-2 font-bold text-slate-300">qc-live-runtime-stream.log</span>
          </div>
          <span>
            Showing {paginatedLogs.length} of {filteredLogs.length} filtered entries {isStreamingPaused && '(STREAM PAUSED)'}
          </span>
        </div>

        {/* Paginated Log Rows */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {paginatedLogs.length > 0 ? (
            paginatedLogs.map((log) => (
              <div
                key={log.id}
                onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                className="group flex flex-col hover:bg-slate-900/90 px-2 py-1 rounded transition-colors cursor-pointer border-l-2 border-transparent hover:border-blue-500"
              >
                <div className="flex items-start space-x-3">
                  <span className="text-slate-500 shrink-0 select-none">{log.timestamp}</span>

                  <div className="shrink-0">{getLevelBadge(log.level)}</div>

                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-800 text-cyan-300 shrink-0">
                    {log.category}
                  </span>

                  {log.sku && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-900 shrink-0">
                      {log.sku}
                    </span>
                  )}

                  {log.asin && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-900 shrink-0">
                      {log.asin}
                    </span>
                  )}

                  <span className="flex-1 text-slate-200 leading-relaxed break-all">
                    {log.message}
                  </span>
                </div>

                {/* Optional expanded details */}
                {log.details && expandedLogId === log.id && (
                  <div className="mt-2 ml-16 p-2 rounded bg-black/60 border border-slate-800 text-slate-400 text-[11px] overflow-x-auto">
                    <pre>{typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}</pre>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="h-full flex items-center justify-center text-slate-600">
              No matching log entries found for current filters.
            </div>
          )}
        </div>

        {/* Log Pagination Controls */}
        <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs select-none">
          <span className="text-slate-400">
            Page <strong className="text-slate-200">{safeCurrentPage}</strong> of{' '}
            <strong className="text-slate-200">{totalPages}</strong>
          </span>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={safeCurrentPage <= 1}
              className="p-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              title="First"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage <= 1}
              className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center space-x-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage >= totalPages}
              className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer flex items-center space-x-1"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={safeCurrentPage >= totalPages}
              className="p-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              title="Last"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
