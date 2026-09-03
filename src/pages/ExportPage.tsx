import React, { useState, useMemo } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useQCStore } from '../store/useQCStore';
import { useLogStore } from '../store/useLogStore';
import { ExcelService } from '../services/excelService';

export const ExportPage: React.FC = () => {
  const results = useQCStore((s) => s.results);
  const getMetrics = useQCStore((s) => s.getMetrics);
  const statusCounts = useQCStore((s) => s.statusCounts);
  const elapsedSeconds = useQCStore((s) => s.elapsedSeconds);
  const addLog = useLogStore((state) => state.addLog);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  const metrics = useMemo(
    () => getMetrics(),
    [getMetrics, statusCounts, elapsedSeconds, results.length]
  );

  const previewData = useMemo(() => results.slice(0, 10), [results]);

  const handleExport = (type: 'ALL' | 'ISSUES_ONLY' | 'PASSED_ONLY', format: 'XLSX' | 'CSV') => {
    if (results.length === 0) return;

    try {
      if (format === 'XLSX') {
        ExcelService.exportToExcel(results, type);
      } else {
        ExcelService.exportToCSV(results, type);
      }

      const msg = `Successfully generated ${type} export (${format}).`;
      setExportFeedback(msg);
      addLog('SUCCESS', 'SYSTEM', msg);
      setTimeout(() => setExportFeedback(null), 4000);
    } catch (err: any) {
      addLog('ERROR', 'ERROR', `Export failed: ${err?.message || 'Unknown error'}`);
    }
  };

  // Static preview showing only the first 10 items to prevent lag on huge datasets

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      {/* Top Banner */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 shrink-0">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            <span>Export Quality Control Reports</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Download comprehensive discrepancy and listing verification audit spreadsheets for Seawide vendor catalog.
          </p>
        </div>

        {exportFeedback && (
          <span className="text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-3 py-1.5 rounded-lg animate-in fade-in">
            {exportFeedback}
          </span>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-4 gap-4 py-4 shrink-0">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Total Verified</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <span className="text-2xl font-black text-slate-900 mt-1 block">{results.length}</span>
          <span className="text-[11px] text-slate-400 font-medium">Ready for export</span>
        </div>

        <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 uppercase flex items-center space-x-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>PASSED COUNT</span>
            </span>
            <span className="text-xs font-bold text-emerald-700">
              {results.length > 0 ? `${((metrics.passed / results.length) * 100).toFixed(0)}%` : '0%'}
            </span>
          </div>
          <span className="text-2xl font-black text-emerald-900 mt-1 block">{metrics.passed}</span>
          <span className="text-[11px] text-emerald-700 font-medium">Matching vendor & Amazon catalog</span>
        </div>

        <div className="p-4 bg-red-50/60 rounded-xl border border-red-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-red-800 uppercase flex items-center space-x-1">
              <XCircle className="w-4 h-4 text-red-600" />
              <span>FAILED COUNT</span>
            </span>
            <span className="text-xs font-bold text-red-700">
              {results.length > 0 ? `${((metrics.failed / results.length) * 100).toFixed(0)}%` : '0%'}
            </span>
          </div>
          <span className="text-2xl font-black text-red-900 mt-1 block">{metrics.failed}</span>
          <span className="text-[11px] text-red-700 font-medium">Critical title/pack/price discrepancies</span>
        </div>

        <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 uppercase flex items-center space-x-1">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>MANUAL REVIEW</span>
            </span>
            <span className="text-xs font-bold text-amber-700">
              {results.length > 0 ? `${((metrics.manualReview / results.length) * 100).toFixed(0)}%` : '0%'}
            </span>
          </div>
          <span className="text-2xl font-black text-amber-900 mt-1 block">{metrics.manualReview}</span>
          <span className="text-[11px] text-amber-700 font-medium">Marginal threshold deviations</span>
        </div>
      </div>

      {/* Export Triggers Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between shrink-0 mb-4">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Available Export Actions:
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => handleExport('ALL', 'XLSX')}
            disabled={results.length === 0}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all shadow-xs cursor-pointer ${
              results.length === 0
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 active:scale-95'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Download Full Report (.xlsx)</span>
          </button>

          <button
            onClick={() => handleExport('ISSUES_ONLY', 'XLSX')}
            disabled={results.length === 0 || metrics.failed + metrics.manualReview === 0}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all shadow-xs cursor-pointer ${
              results.length === 0 || metrics.failed + metrics.manualReview === 0
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/20 active:scale-95'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Issues Only (.xlsx)</span>
          </button>

          <button
            onClick={() => handleExport('PASSED_ONLY', 'XLSX')}
            disabled={results.length === 0 || metrics.passed === 0}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all shadow-xs cursor-pointer ${
              results.length === 0 || metrics.passed === 0
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20 active:scale-95'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Passed Only (.xlsx)</span>
          </button>

          <button
            onClick={() => handleExport('ALL', 'CSV')}
            disabled={results.length === 0}
            className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all shadow-xs border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer ${
              results.length === 0 ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'
            }`}
          >
            <FileText className="w-4 h-4 text-slate-500" />
            <span>Raw CSV</span>
          </button>
        </div>
      </div>

      {/* Dataset Preview - Limited to first 10 items to prevent lag */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col min-h-0">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs font-bold text-slate-700 uppercase">
            Dataset Schema Preview (Showing first {previewData.length} of {results.length} verified SKUs)
          </span>
          <span className="text-[11px] text-slate-500 font-medium">
            Full batch will be included in the exported XLSX/CSV file.
          </span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {previewData.length > 0 ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Verdict</th>
                  <th className="p-2.5">VENDOR MODEL</th>
                  <th className="p-2.5">ASIN</th>
                  <th className="p-2.5">Brand</th>
                  <th className="p-2.5">Title (AI tokens)</th>
                  <th className="p-2.5">Price (Vendor vs AMZ)</th>
                  <th className="p-2.5">Price Var %</th>
                  <th className="p-2.5">Pack Match</th>
                  <th className="p-2.5">Verdict</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewData.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="p-2.5">
                      <span
                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          r.status === 'PASSED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : r.status === 'FAILED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="p-2.5 font-mono font-bold text-blue-700">{r.vendorModel || r.partSku}</td>
                    <td className="p-2.5 font-mono text-slate-800">{r.asin}</td>
                    <td className="p-2.5 text-slate-600">{r.brand}</td>
                    <td className="p-2.5 font-bold text-slate-800">{r.titleMatchPct}%</td>
                    <td className="p-2.5 font-medium text-slate-700">
                      ${r.vendorListing.price.toFixed(2)} vs ${r.amazonListing.price.toFixed(2)}
                    </td>
                    <td className="p-2.5 font-bold text-slate-800">
                      {r.priceVariancePct > 0 ? `+${r.priceVariancePct}%` : `${r.priceVariancePct}%`}
                    </td>
                    <td className="p-2.5 text-slate-600">{r.packQtyMatch == null ? '—' : r.packQtyMatch ? 'Yes' : 'No'}</td>
                    <td className="p-2.5 max-w-xs truncate text-slate-500 text-[11px]">{r.verdictSentence || r.aiVerdictReason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <FileSpreadsheet className="w-12 h-12 text-slate-300 mb-2" />
              <p className="text-xs text-slate-500 font-medium">
                No items have been processed for export yet. Run QC on the Output tab to generate data.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
