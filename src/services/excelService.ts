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

      // Always fall back to value-shape detection (also fills gaps / headerless sheets)
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
    let filtered = results;
    if (type === 'ISSUES_ONLY') {
      filtered = results.filter((r) => r.status === 'FAILED' || r.status === 'MANUAL REVIEW');
    } else if (type === 'PASSED_ONLY') {
      filtered = results.filter((r) => r.status === 'PASSED');
    }

    const dataRows = filtered.map((r, i) => ({
      '#': i + 1,
      'QC VERDICT': r.status,
      'OVERRIDE': r.manualOverride ? 'YES (Manual)' : 'NO (Engine)',
      'VENDOR MODEL': r.vendorModel || r.partSku,
      'ASIN': r.asin,
      'BRAND': r.brand,
      'UPC INPUT': r.upc,
      'UPC MATCH': r.upcMatch ? 'MATCH' : 'MISMATCH',
      'AMAZON UPC': r.amazonListing.upc,
      'BRAND MATCH': r.brandMatch ? 'MATCH' : 'MISMATCH',
      'MODEL MATCH': r.modelMatch ? 'MATCH' : 'MISMATCH',
      'TITLE SAME PRODUCT': r.titleSameProduct == null ? 'NOT CHECKED' : r.titleSameProduct ? 'YES' : 'NO',
      'TITLE TOKEN %': `${r.titleMatchPct}%`,
      'IMAGE SIMILARITY %': `${r.imageSimilarityPct}%`,
      'SPECS MATCH %': `${r.specMatchPct}%`,
      'DESCRIPTION MATCH %': `${r.descriptionMatchPct}%`,
      'PRICE VARIANCE %': `${r.priceVariancePct > 0 ? '+' : ''}${r.priceVariancePct}%`,
      'PACK QTY MATCH': r.packQtyMatch == null ? 'UNKNOWN' : r.packQtyMatch ? 'MATCH' : 'MISMATCH',
      'VENDOR PACK QTY': r.vendorListing.packQuantity ?? '',
      'AMAZON PACK QTY': r.amazonListing.packQuantity ?? '',
      'VENDOR CASE QTY': r.vendorListing.caseQuantity ?? '',
      'AMAZON CASE QTY': r.amazonListing.caseQuantity ?? '',
      'VENDOR PACK SIGNALS': JSON.stringify(r.vendorListingFull?.normalized.packaging.rawSignals || []),
      'AMAZON PACK SIGNALS': JSON.stringify(r.amazonListingFull?.normalized.packaging.rawSignals || []),
      'VENDOR TITLE': r.vendorListing.title,
      'AMAZON TITLE': r.amazonListing.title,
      'VENDOR ATTRIBUTES': JSON.stringify(r.vendorListingFull?.raw.attributes || []),
      'VERDICT SENTENCE': r.verdictSentence || r.aiVerdictReason,
      'TIMESTAMP': r.timestamp,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataRows);
    const colWidths = Object.keys(dataRows[0] || {}).map((key) => {
      const maxLen = Math.max(
        key.length,
        ...dataRows.map((row) => String(row[key as keyof typeof row] || '').length),
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
    let filtered = results;
    if (type === 'ISSUES_ONLY') {
      filtered = results.filter((r) => r.status === 'FAILED' || r.status === 'MANUAL REVIEW');
    } else if (type === 'PASSED_ONLY') {
      filtered = results.filter((r) => r.status === 'PASSED');
    }

    const dataRows = filtered.map((r, i) => ({
      '#': i + 1,
      'QC VERDICT': r.status,
      'VENDOR MODEL': r.vendorModel || r.partSku,
      'ASIN': r.asin,
      'BRAND': r.brand,
      'UPC': r.upc,
      'UPC MATCH': r.upcMatch ? 'MATCH' : 'MISMATCH',
      'TITLE SAME PRODUCT': r.titleSameProduct == null ? 'NOT CHECKED' : r.titleSameProduct ? 'YES' : 'NO',
      'PACK QTY MATCH': r.packQtyMatch == null ? 'UNKNOWN' : r.packQtyMatch ? 'MATCH' : 'MISMATCH',
      'VENDOR TITLE': `"${r.vendorListing.title.replace(/"/g, '""')}"`,
      'AMAZON TITLE': `"${r.amazonListing.title.replace(/"/g, '""')}"`,
      'VERDICT SENTENCE': `"${(r.verdictSentence || r.aiVerdictReason).replace(/"/g, '""')}"`,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataRows);
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
