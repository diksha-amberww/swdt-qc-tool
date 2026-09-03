import * as XLSX from 'xlsx';
import { QCRowResult, RawInputRow } from '../types/qc';
import { identifyRowFields } from './validatorService';

function headerLooksNamed(keys: string[]): boolean {
  return keys.some((key) => {
    const lower = key.trim().toLowerCase();
    return (
      lower.includes('asin') ||
      lower.includes('upc') ||
      lower.includes('barcode') ||
      lower.includes('vendor') ||
      lower.includes('model') ||
      lower.includes('sku') ||
      lower === 'pid'
    );
  });
}

function checkVerdict(r: QCRowResult, name: string): string {
  const check = r.checks?.find((c) => c.name === name);
  if (!check) return 'UNKNOWN';
  return check.result.toUpperCase();
}

function emptyToBlank(value: unknown): string | number {
  if (value == null || value === '') return '';
  return value as string | number;
}

function clipExportText(value: string, max = 500): string {
  const text = value.replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function vendorDescriptionText(r: QCRowResult): string {
  const full = r.vendorListingFull;
  if (!full) return '';
  return clipExportText(
    full.raw.shortDescription ||
      full.raw.longDescription ||
      full.normalized.content.shortDescription ||
      full.normalized.content.longDescription ||
      '',
  );
}

function amazonDescriptionText(r: QCRowResult): string {
  const full = r.amazonListingFull;
  if (!full) return '';
  const bullets = (full.normalized.content.bulletPoints || []).join('; ');
  return clipExportText(
    full.normalized.content.shortDescription ||
      full.normalized.content.longDescription ||
      bullets ||
      '',
  );
}

function specsText(
  entries: { key: string; value: string }[] | undefined,
  byKey: Record<string, string> | undefined,
): string {
  if (entries?.length) {
    return clipExportText(
      entries
        .slice(0, 25)
        .map((e) => `${e.key}: ${e.value}`)
        .join('; '),
    );
  }
  if (byKey && Object.keys(byKey).length) {
    return clipExportText(
      Object.entries(byKey)
        .slice(0, 25)
        .map(([k, v]) => `${k}: ${v}`)
        .join('; '),
    );
  }
  return '';
}

function filterResults(
  results: QCRowResult[],
  type: 'ALL' | 'ISSUES_ONLY' | 'PASSED_ONLY',
): QCRowResult[] {
  if (type === 'ISSUES_ONLY') {
    return results.filter((r) => r.status === 'FAILED' || r.status === 'MANUAL REVIEW');
  }
  if (type === 'PASSED_ONLY') {
    return results.filter((r) => r.status === 'PASSED');
  }
  return results;
}

/** Exported for fixture checks — keep column set in sync with EXPORT_HEADERS. */
export function buildExportRow(r: QCRowResult): Record<string, string | number> {
  const titleResult =
    r.titleResult ??
    (r.titleSameProduct == null ? 'UNKNOWN' : r.titleSameProduct ? 'YES' : 'NO');

  return {
    ASIN: r.asin || '',
    'VENDOR MODEL': r.vendorModel || r.partSku || '',
    VERDICT: r.status,
    'Fail Reason': r.failReason || '',

    'Pack Size Vendor': emptyToBlank(r.vendorListing.packQuantity),
    'Pack Size Amazon': emptyToBlank(r.amazonListing.packQuantity),
    'Pack Size Result': checkVerdict(r, 'pack size'),

    'Brand Vendor': r.vendorListing.brand || '',
    'Brand Amazon': r.amazonListing.brand || '',
    'Brand Result': checkVerdict(r, 'brand'),

    'Title Vendor': r.vendorListing.title || '',
    'Title Amazon': r.amazonListing.title || '',
    'Title Result': titleResult,

    'Model Number Vendor': r.vendorListing.modelNumber || '',
    'Model Number Amazon': r.amazonListing.modelNumber || '',
    'Model Number Result': checkVerdict(r, 'model'),

    'UPC Vendor': r.upc || '',
    'UPC Amazon': r.amazonListing.upc || '',
    'UPC Result': checkVerdict(r, 'UPC'),

    'Image Comparison Percentage': r.imageSimilarityPct ?? 0,
    'Image Result': checkVerdict(r, 'image'),

    'Variant Conflict': r.variantConflict || '',

    'Description Vendor': vendorDescriptionText(r),
    'Description Amazon': amazonDescriptionText(r),
    'Specs Vendor': specsText(
      r.vendorListingFull?.normalized.specifications.entries,
      r.vendorListingFull?.normalized.specifications.byKey,
    ),
    'Specs Amazon': specsText(
      r.amazonListingFull?.normalized.specifications.entries,
      r.amazonListingFull?.normalized.specifications.byKey,
    ),

    'Case Qty Vendor': emptyToBlank(r.vendorListing.caseQuantity),
    'Case Qty Amazon': emptyToBlank(r.amazonListing.caseQuantity),
    'Price Vendor': emptyToBlank(r.vendorListing.price || ''),
    'Price Amazon': emptyToBlank(r.amazonListing.price || ''),
    'Price Variance %': r.priceVariancePct ?? 0,
    'Vendor URL': r.vendorListingFull?.raw.detailUrl || '',
    Errors: (r.errors || []).join(' | '),
    Override: r.manualOverride ? 'YES (Manual)' : 'NO (Engine)',
    Timestamp: r.timestamp || '',
  };
}

export class ExcelService {
  static parseExcelFile(data: ArrayBuffer | Uint8Array | number[]): RawInputRow[] {
    const uint8 = data instanceof Uint8Array ? data : new Uint8Array(data);
    const workbook = XLSX.read(uint8, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
    const rows: RawInputRow[] = [];
    const namedHeaders = jsonData.length > 0 && headerLooksNamed(Object.keys(jsonData[0]));

    jsonData.forEach((row, index) => {
      let asin = '';
      let upc = '';
      let vendorModel = '';

      if (namedHeaders) {
        for (const [key, val] of Object.entries(row)) {
          const lower = key.trim().toLowerCase();
          const strVal = String(val).trim();
          if (!strVal) continue;
          if (lower.includes('asin')) asin = strVal;
          else if (lower.includes('upc') || lower.includes('barcode')) upc = strVal;
          else if (
            lower.includes('vendor model') ||
            lower.includes('vendormodel') ||
            lower.includes('model') ||
            lower.includes('pid') ||
            lower.includes('sku')
          ) {
            vendorModel = strVal;
          }
        }
      }

      const values = Object.values(row).map((v) => String(v ?? '').trim()).filter(Boolean);
      const detected = identifyRowFields(values);
      asin = asin || detected.asin;
      upc = (upc || detected.upc).replace(/\D/g, '');
      vendorModel = vendorModel || detected.vendorModel;

      rows.push({
        id: `excel-row-${index + 1}-${Math.random().toString(36).substring(2, 6)}`,
        asin,
        upc,
        vendorModel,
        partSku: vendorModel,
        rawLineNumber: index + (namedHeaders ? 2 : 1),
      });
    });

    return rows;
  }

  static exportToExcel(results: QCRowResult[], type: 'ALL' | 'ISSUES_ONLY' | 'PASSED_ONLY' = 'ALL'): void {
    const filtered = filterResults(results, type);
    const dataRows = filtered.map((r) => buildExportRow(r));
    const headers = EXPORT_HEADERS;
    const worksheet = dataRows.length
      ? XLSX.utils.json_to_sheet(dataRows)
      : XLSX.utils.aoa_to_sheet([headers]);

    const colWidths = headers.map((key) => {
      const maxLen = Math.max(
        key.length,
        ...dataRows.map((row) => String(row[key] ?? '').length),
      );
      return { wch: Math.min(Math.max(maxLen + 2, 10), 45) };
    });
    worksheet['!cols'] = colWidths;
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `QC_${type}_RESULTS`);
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `SWDT_VENDOR_QC_${type}_${dateStr}.xlsx`);
  }

  static exportToCSV(results: QCRowResult[], type: 'ALL' | 'ISSUES_ONLY' | 'PASSED_ONLY' = 'ALL'): void {
    const filtered = filterResults(results, type);
    const dataRows = filtered.map((r) => buildExportRow(r));
    const worksheet = dataRows.length
      ? XLSX.utils.json_to_sheet(dataRows)
      : XLSX.utils.aoa_to_sheet([EXPORT_HEADERS]);
    const csvContent = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `SWDT_VENDOR_QC_${type}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

/** Stable header order matching buildExportRow key insertion order. */
const EXPORT_HEADERS: string[] = [
  'ASIN',
  'VENDOR MODEL',
  'VERDICT',
  'Fail Reason',
  'Pack Size Vendor',
  'Pack Size Amazon',
  'Pack Size Result',
  'Brand Vendor',
  'Brand Amazon',
  'Brand Result',
  'Title Vendor',
  'Title Amazon',
  'Title Result',
  'Model Number Vendor',
  'Model Number Amazon',
  'Model Number Result',
  'UPC Vendor',
  'UPC Amazon',
  'UPC Result',
  'Image Comparison Percentage',
  'Image Result',
  'Variant Conflict',
  'Description Vendor',
  'Description Amazon',
  'Specs Vendor',
  'Specs Amazon',
  'Case Qty Vendor',
  'Case Qty Amazon',
  'Price Vendor',
  'Price Amazon',
  'Price Variance %',
  'Vendor URL',
  'Errors',
  'Override',
  'Timestamp',
];
