import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
  ClipboardPaste,
  FileUp,
} from 'lucide-react';
import { useQCStore } from '../store/useQCStore';
import { useLogStore } from '../store/useLogStore';
import { ValidatorService } from '../services/validatorService';
import { ExcelService } from '../services/excelService';
import { MockQCEngine } from '../services/mockQCEngine';

export const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    rawInputText,
    setRawInputText,
    uploadedFileName,
    setUploadedFileName,
    validationSummary,
    setValidationSummary,
    startQC,
  } = useQCStore();

  const addLog = useLogStore((state) => state.addLog);

  const [activeTab, setActiveTab] = useState<'TEXT' | 'FILE'>('TEXT');
  const [isDragging, setIsDragging] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // Handle Text Validation
  const handleValidate = () => {
    setIsValidating(true);
    setTimeout(() => {
      const summary = ValidatorService.parseRawText(rawInputText);
      setValidationSummary(summary);
      setIsValidating(false);

      if (summary.isValid) {
        addLog('SUCCESS', 'SYSTEM', `Successfully validated ${summary.validRowsCount} product rows ready for QC.`);
      } else {
        addLog('WARNING', 'SYSTEM', `Validation flagged ${summary.errors.length} issue(s) in uploaded dataset.`);
      }
    }, 250);
  };

  // Load Preset
  const handleLoadSample = () => {
    const sample = ValidatorService.getSamplePreset();
    setRawInputText(sample);
    setUploadedFileName('sample_seawide_listings.tsv');
    const summary = ValidatorService.parseRawText(sample);
    setValidationSummary(summary);
    addLog('INFO', 'SYSTEM', 'Loaded sample Seawide marine listing dataset.');
  };

  // Handle Excel/CSV File Upload
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      if (buffer) {
        try {
          const parsedRows = ExcelService.parseExcelFile(buffer);
          // Convert to TSV text
          const tsvLines = [
            'PART SKU\tASIN\tBrand\tLine\tUPC',
            ...parsedRows.map((r) => `${r.partSku}\t${r.asin}\t${r.brand}\t${r.line}\t${r.upc}`),
          ].join('\n');
          
          setRawInputText(tsvLines);
          setUploadedFileName(file.name);
          const summary = ValidatorService.parseRawText(tsvLines);
          setValidationSummary(summary);
          addLog('SUCCESS', 'SYSTEM', `Imported ${parsedRows.length} rows from file: ${file.name}`);
        } catch (err: any) {
          addLog('ERROR', 'ERROR', `Failed to parse Excel file: ${err?.message || 'Unknown format'}`);
        }
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Electron Native File Dialog Fallback or Native Drag
  const handleNativeFileSelect = async () => {
    if (window.electronAPI) {
      const result = await window.electronAPI.openFileDialog([
        { name: 'Excel & CSV Files', extensions: ['xlsx', 'xls', 'csv'] },
      ]);
      if (result && result.buffer) {
        const parsedRows = ExcelService.parseExcelFile(new Uint8Array(result.buffer));
        const tsvLines = [
          'PART SKU\tASIN\tBrand\tLine\tUPC',
          ...parsedRows.map((r) => `${r.partSku}\t${r.asin}\t${r.brand}\t${r.line}\t${r.upc}`),
        ].join('\n');
        setRawInputText(tsvLines);
        setUploadedFileName(result.name);
        const summary = ValidatorService.parseRawText(tsvLines);
        setValidationSummary(summary);
        addLog('SUCCESS', 'SYSTEM', `Imported ${parsedRows.length} rows from ${result.name}`);
      }
    }
  };

  const handleStartQC = async () => {
    if (!validationSummary || validationSummary.validRowsCount === 0) return;

    addLog('INFO', 'QC_ENGINE', `Preparing batch for ${validationSummary.validRowsCount} SKUs — checking Seawide session...`);
    const sessionOk = await MockQCEngine.ensureBatchSession();
    if (!sessionOk) {
      addLog('ERROR', 'LOGIN', 'Batch start aborted: Seawide login session could not be established.');
      return;
    }

    startQC();
    MockQCEngine.startLiveProcessing();
    addLog('INFO', 'QC_ENGINE', `Starting Live QC Comparison batch for ${validationSummary.validRowsCount} SKUs.`);
    navigate('/output');
  };

  const handleClear = () => {
    setRawInputText('');
    setUploadedFileName(null);
    setValidationSummary(null);
  };

  const detectedRowCount = useMemo(
    () => (rawInputText ? rawInputText.split('\n').filter(Boolean).length : 0),
    [rawInputText]
  );

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      {/* Top Banner */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 shrink-0">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center space-x-2">
            <span>Product Ingestion & Data Validation</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Vendor: Seawide Distribution
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Provide SKU inventory feed to cross-compare Seawide catalog data with live Amazon listings.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleLoadSample}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Load Sample SKUs</span>
          </button>

          <button
            onClick={handleClear}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-medium transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Input Box, Right Validation & Stats */}
      <div className="flex-1 grid grid-cols-12 gap-6 pt-4 min-h-0">
        {/* Left Column: Data Input (7 cols) */}
        <div className="col-span-7 flex flex-col h-full min-h-0 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 bg-slate-50/70 shrink-0">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setActiveTab('TEXT')}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'TEXT'
                    ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>Copy-Paste Table (TSV)</span>
              </button>

              <button
                onClick={() => setActiveTab('FILE')}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'FILE'
                    ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileUp className="w-3.5 h-3.5" />
                <span>Upload File (.xlsx / .csv)</span>
              </button>
            </div>

            {uploadedFileName && (
              <span className="text-[11px] font-medium text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded truncate max-w-[200px]">
                {uploadedFileName}
              </span>
            )}
          </div>

          {/* Tab Content */}
          <div className="flex-1 p-4 min-h-0 flex flex-col">
            {activeTab === 'TEXT' ? (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                  <span>Required Columns: <strong>PART SKU | ASIN | Brand | Line | UPC</strong></span>
                  <span>Paste rows directly from Excel / Google Sheets</span>
                </div>
                <textarea
                  value={rawInputText}
                  onChange={(e) => setRawInputText(e.target.value)}
                  placeholder={`PART SKU\tASIN\tBrand\tLine\tUPC\nSKU-SWD-10492\tB0000AXN5U\tSierra Marine\tElectrical\t030999014923`}
                  className="flex-1 w-full p-3 font-mono text-xs text-slate-800 bg-slate-50/50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none overflow-auto leading-relaxed"
                  spellCheck={false}
                />
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-center items-center">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files.length > 0) {
                      handleFileUpload(e.dataTransfer.files[0]);
                    }
                  }}
                  className={`w-full h-full border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-6 text-center transition-all ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50/40'
                      : 'border-slate-300 hover:border-slate-400 bg-slate-50/30'
                  }`}
                >
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 mb-3 border border-blue-100 shadow-xs">
                    <FileSpreadsheet className="w-7 h-7" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800">
                    Drag and drop your Excel / CSV sheet here
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">
                    Supports .xlsx, .xls, or .csv files containing Seawide vendor catalog listings.
                  </p>

                  <div className="mt-4 flex items-center space-x-3">
                    <label className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs cursor-pointer transition-all">
                      Browse Files
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handleFileUpload(e.target.files[0]);
                          }
                        }}
                      />
                    </label>

                    {window.electronAPI && (
                      <button
                        onClick={handleNativeFileSelect}
                        className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-all cursor-pointer"
                      >
                        Native Explorer
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
            <span className="text-xs text-slate-500 font-medium">
              {rawInputText ? `${detectedRowCount} rows detected` : 'No data entered'}
            </span>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleValidate}
                disabled={!rawInputText.trim() || isValidating}
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer ${
                  !rawInputText.trim() || isValidating
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-slate-900 hover:bg-black text-white'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isValidating ? 'Validating...' : 'Validate Data'}</span>
              </button>

              <button
                onClick={handleStartQC}
                disabled={!validationSummary || validationSummary.validRowsCount === 0}
                className={`flex items-center space-x-2 px-5 py-2 rounded-lg text-xs font-extrabold tracking-wide uppercase transition-all shadow-md cursor-pointer ${
                  !validationSummary || validationSummary.validRowsCount === 0
                    ? 'bg-emerald-300 text-emerald-700 cursor-not-allowed opacity-60'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30 active:scale-95'
                }`}
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start QC Batch</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Validation Checks & Preview (5 cols) */}
        <div className="col-span-5 flex flex-col h-full min-h-0 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between shrink-0">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Validation Diagnostic Report
            </h3>
            {validationSummary && (
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  validationSummary.isValid
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                }`}
              >
                {validationSummary.isValid ? 'ALL VALID' : `${validationSummary.invalidRowsCount} ISSUES`}
              </span>
            )}
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {/* Checklist */}
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 bg-slate-50/60 text-xs">
                <div className="flex items-center space-x-2">
                  <span className={`w-2 h-2 rounded-full ${validationSummary ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  <span className="font-semibold text-slate-700">1. Required Columns Present</span>
                </div>
                <span className="text-slate-500 font-mono text-[11px]">PART SKU, ASIN, Brand, Line, UPC</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 bg-slate-50/60 text-xs">
                <div className="flex items-center space-x-2">
                  <span className={`w-2 h-2 rounded-full ${validationSummary?.isValid ? 'bg-emerald-500' : validationSummary ? 'bg-amber-500' : 'bg-slate-300'}`} />
                  <span className="font-semibold text-slate-700">2. Data Format & Length Verification</span>
                </div>
                <span className="text-slate-500 font-mono text-[11px]">10-char ASIN, 8-14 digit UPC</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 bg-slate-50/60 text-xs">
                <div className="flex items-center space-x-2">
                  <span className={`w-2 h-2 rounded-full ${validationSummary?.validRowsCount ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  <span className="font-semibold text-slate-700">3. Ingestion Completeness</span>
                </div>
                <span className="text-slate-500 font-mono text-[11px]">No blank essential cells</span>
              </div>
            </div>

            {/* Validation Breakdown Summary */}
            {validationSummary ? (
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-100">
                    <span className="block text-xs font-semibold text-blue-600">Total Rows</span>
                    <span className="text-base font-black text-blue-900">{validationSummary.totalRows}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-100">
                    <span className="block text-xs font-semibold text-emerald-600">Ready for QC</span>
                    <span className="text-base font-black text-emerald-900">{validationSummary.validRowsCount}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-100">
                    <span className="block text-xs font-semibold text-amber-600">Errors Flagged</span>
                    <span className="text-base font-black text-amber-900">{validationSummary.errors.length}</span>
                  </div>
                </div>

                {validationSummary.errors.length > 0 && (
                  <div className="border border-red-200 rounded-lg p-3 bg-red-50/50 space-y-2">
                    <div className="flex items-center space-x-1.5 text-xs font-bold text-red-800">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      <span>Issues to resolve:</span>
                    </div>
                    <ul className="text-[11px] text-red-700 space-y-1 pl-5 list-disc max-h-36 overflow-y-auto">
                      {validationSummary.errors.map((err, idx) => (
                        <li key={idx}>
                          Row {err.row}: <strong>{err.field}</strong> - {err.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Valid Parsed Rows Preview */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-700 block">Parsed Valid SKUs Preview:</span>
                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-100 text-slate-700 sticky top-0">
                        <tr>
                          <th className="p-2 font-semibold">PART SKU</th>
                          <th className="p-2 font-semibold">ASIN</th>
                          <th className="p-2 font-semibold">Brand</th>
                          <th className="p-2 font-semibold">UPC</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {validationSummary.validRows.slice(0, 10).map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50">
                            <td className="p-2 font-mono text-blue-700">{r.partSku}</td>
                            <td className="p-2 font-mono text-slate-900">{r.asin}</td>
                            <td className="p-2 text-slate-600">{r.brand}</td>
                            <td className="p-2 font-mono text-slate-500">{r.upc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {validationSummary.validRows.length > 10 && (
                    <span className="text-[10px] text-slate-400 block text-right">
                      + {validationSummary.validRows.length - 10} more rows
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-44 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-lg">
                <Upload className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-xs text-slate-500 font-medium">
                  Paste or upload Seawide data, then click <strong>"Validate Data"</strong> to run automated checks.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
