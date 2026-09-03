import React, { memo } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Eye } from 'lucide-react';
import { QCRowResult, formatPackQty } from '../../types/qc';

interface ResultRowProps {
  row: QCRowResult;
  onSelect: (row: QCRowResult) => void;
}

export const ResultRow: React.FC<ResultRowProps> = memo(({ row, onSelect }) => {
  return (
    <tr
      className="hover:bg-blue-50/40 transition-colors group cursor-pointer contain-paint"
      onClick={() => onSelect(row)}
    >
      <td className="p-3">
        {row.status === 'PASSED' ? (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>PASSED</span>
          </span>
        ) : row.status === 'FAILED' ? (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-red-100 text-red-800 border border-red-300">
            <XCircle className="w-3 h-3 text-red-600" />
            <span>FAILED</span>
          </span>
        ) : (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            <span>REVIEW</span>
          </span>
        )}
      </td>

      <td className="p-3 font-mono font-bold text-blue-700">{row.vendorModel || row.partSku}</td>
      <td className="p-3 font-mono font-semibold text-slate-900">{row.asin}</td>

      <td className="p-3 text-slate-700">
        <span className="font-semibold block">{row.brand || '—'}</span>
        <span className={`text-[11px] font-bold ${row.vendorListing.brand && row.amazonListing.brand ? (row.brandMatch ? 'text-emerald-600' : 'text-red-600') : 'text-amber-600'}`}>
          {row.vendorListing.brand && row.amazonListing.brand
            ? row.brandMatch
              ? 'Brand match'
              : 'Brand mismatch'
            : 'Brand unpublished'}
        </span>
      </td>

      <td className="p-3 text-center">
        <span className={`font-bold ${row.titleSameProduct ? 'text-emerald-700' : 'text-amber-700'}`}>
          {row.titleSameProduct == null ? '—' : row.titleSameProduct ? 'Same' : 'Different'}
        </span>
        <span className="block text-[10px] text-slate-400">{row.titleMatchPct}% tokens</span>
      </td>

      <td className="p-3 text-center">
        <span
          className={`text-[11px] font-bold px-2 py-0.5 rounded ${
            row.packQtyMatch ? 'bg-emerald-50 text-emerald-700' : row.packQtyMatch == null ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {formatPackQty(row.vendorListing.packQuantity)} vs {formatPackQty(row.amazonListing.packQuantity)}
        </span>
      </td>

      <td className="p-3 text-center">
        <span className={`text-[11px] font-bold ${row.upcMatch ? 'text-emerald-700' : 'text-red-600'}`}>
          {row.upcMatch ? 'MATCH' : 'MISMATCH'}
        </span>
      </td>

      <td className="p-3 max-w-xs truncate text-slate-600 text-[11px]" title={row.verdictSentence || row.aiVerdictReason}>
        {row.verdictSentence || row.aiVerdictReason}
      </td>

      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => onSelect(row)}
          className="flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 text-[11px] font-bold transition-colors cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Compare</span>
        </button>
      </td>
    </tr>
  );
});

ResultRow.displayName = 'ResultRow';
