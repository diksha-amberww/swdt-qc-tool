import * as XLSX from 'xlsx';
import { QCRowResult, RawInputRow } from '../types/qc';

export class ExcelService {
  /**
   * Reads an Excel or CSV file buffer and returns raw rows for validation
   */
  static parseExcelFile(data: ArrayBuffer | Uint8Array | number[]): RawInputRow[] {
    const uint8 = data instanceof Uint8Array ? data : new Uint8Array(data);
    const workbook = XLSX.read(uint8, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Parse to JSON array of objects
    const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
    
    const rows: RawInputRow[] = [];
    
    jsonData.forEach((row, index) => {
      // Find keys flexibly
      let partSku = '';
      let asin = '';
      let brand = '';
      let line = '';
      let upc = '';
      
      for (const [key, val] of Object.entries(row)) {
        const lower = key.trim().toLowerCase();
        const strVal = String(val).trim();
        if (lower.includes('sku') || lower.includes('part')) partSku = strVal;
        else if (lower.includes('asin')) asin = strVal;
        else if (lower.includes('brand')) brand = strVal;
        else if (lower.includes('line') || lower.includes('category')) line = strVal;
        else if (lower.includes('upc') || lower.includes('barcode')) upc = strVal;
      }
      
      rows.push({
        id: `excel-row-${index + 1}-${Math.random().toString(36).substring(2, 6)}`,
        partSku,
        asin,
        brand,
        line,
        upc,
        rawLineNumber: index + 2, // Header is line 1
      });
    });
    
    return rows;
  }

  /**
   * Exports QC results into an Excel (.xlsx) file
   */
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
      'OVERRIDE': r.manualOverride ? 'YES (Manual)' : 'NO (AI)',
      'PART SKU': r.partSku,
      'ASIN': r.asin,
      'BRAND': r.brand,
      'CATEGORY/LINE': r.line,
      'UPC': r.upc,
      'TITLE MATCH %': `${r.titleMatchPct}%`,
      'PRICE VARIANCE %': `${r.priceVariancePct > 0 ? '+' : ''}${r.priceVariancePct}%`,
      'IMAGE SIMILARITY %': `${r.imageSimilarityPct}%`,
      'PACK QTY MATCH': r.packQtyMatch ? 'MATCH' : 'MISMATCH',
      'UPC MATCH': r.upcMatch ? 'MATCH' : 'MISMATCH',
      'VENDOR TITLE': r.vendorListing.title,
      'VENDOR PRICE ($)': r.vendorListing.price.toFixed(2),
      'VENDOR PACK QTY': r.vendorListing.packQuantity,
      'AMAZON TITLE': r.amazonListing.title,
      'AMAZON PRICE ($)': r.amazonListing.price.toFixed(2),
      'AMAZON PACK QTY': r.amazonListing.packQuantity,
      'AI VERDICT REASON': r.aiVerdictReason,
      'TIMESTAMP': r.timestamp,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataRows);

    // Auto calculate column widths
    const colWidths = Object.keys(dataRows[0] || {}).map((key) => {
      const maxLen = Math.max(
        key.length,
        ...dataRows.map((row) => String(row[key as keyof typeof row] || '').length)
      );
      return { wch: Math.min(Math.max(maxLen + 2, 10), 45) };
    });
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `QC_${type}_RESULTS`);

    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `SWDT_VENDOR_QC_${type}_${dateStr}.xlsx`;

    // Download via SheetJS browser helper
    XLSX.writeFile(workbook, fileName);
  }

  /**
   * Exports QC results to CSV
   */
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
      'PART SKU': r.partSku,
      'ASIN': r.asin,
      'BRAND': r.brand,
      'CATEGORY/LINE': r.line,
      'UPC': r.upc,
      'TITLE MATCH %': `${r.titleMatchPct}%`,
      'PRICE VARIANCE %': `${r.priceVariancePct}%`,
      'IMAGE SIMILARITY %': `${r.imageSimilarityPct}%`,
      'VENDOR TITLE': `"${r.vendorListing.title.replace(/"/g, '""')}"`,
      'AMAZON TITLE': `"${r.amazonListing.title.replace(/"/g, '""')}"`,
      'AI VERDICT REASON': `"${r.aiVerdictReason.replace(/"/g, '""')}"`,
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
