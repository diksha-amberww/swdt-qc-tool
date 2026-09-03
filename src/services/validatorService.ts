import { RawInputRow, ValidationSummary, ValidationErrorItem } from '../types/qc';

export const INPUT_HEADER_ROW = 'ASIN\tUPC\tVENDOR MODEL';

type FieldKind = 'asin' | 'upc' | 'vendorModel';

function isHeaderToken(token: string): boolean {
  const t = token.trim().toLowerCase();
  return (
    t.includes('asin') ||
    t.includes('upc') ||
    t.includes('barcode') ||
    t.includes('vendor') ||
    t.includes('model') ||
    t.includes('sku') ||
    t === 'pid'
  );
}

function looksLikeUpc(token: string): boolean {
  const digits = token.replace(/\D/g, '');
  if (!/^\d{8,14}$/.test(digits)) return false;
  // Prefer mostly-numeric tokens (allow spaces/dashes in pasted barcodes)
  const alnum = token.replace(/[\s-]/g, '');
  return /^\d+$/.test(alnum);
}

function looksLikeAsin(token: string): boolean {
  const t = token.trim();
  // Amazon ASINs are 10 alphanumeric; nearly all retail ASINs start with B
  if (/^B[0-9A-Z]{9}$/i.test(t)) return true;
  // Fallback: pure 10-char alnum with no separators (less common ASIN shapes)
  return /^[A-Z0-9]{10}$/i.test(t) && !/[-\/_.]/.test(t) && /[A-Z]/i.test(t) && /\d/.test(t);
}

function classifyToken(token: string): FieldKind {
  const t = token.trim();
  if (looksLikeUpc(t)) return 'upc';
  if (looksLikeAsin(t)) return 'asin';
  return 'vendorModel';
}

/**
 * Map unordered tokens into asin / upc / vendorModel by value shape.
 * Works with any column order and without headers.
 */
export function identifyRowFields(tokens: string[]): {
  asin: string;
  upc: string;
  vendorModel: string;
  unused: string[];
} {
  const cleaned = tokens.map((t) => t.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  let asin = '';
  let upc = '';
  let vendorModel = '';
  const unused: string[] = [];

  // First pass: high-confidence UPC + ASIN
  const remaining: string[] = [];
  for (const token of cleaned) {
    if (!upc && looksLikeUpc(token)) {
      upc = token.replace(/\D/g, '');
      continue;
    }
    if (!asin && looksLikeAsin(token)) {
      asin = token.toUpperCase();
      continue;
    }
    remaining.push(token);
  }

  // Second pass: leftover tokens → vendor model (prefer the most "model-like")
  if (remaining.length === 1) {
    vendorModel = remaining[0];
  } else if (remaining.length > 1) {
    // Prefer token with letters + digits / hyphens (SeaWide pid style)
    const ranked = [...remaining].sort((a, b) => scoreVendorModel(b) - scoreVendorModel(a));
    vendorModel = ranked[0];
    unused.push(...ranked.slice(1));
  }

  return { asin, upc, vendorModel, unused };
}

function scoreVendorModel(token: string): number {
  let score = 0;
  if (/[A-Za-z]/.test(token)) score += 3;
  if (/\d/.test(token)) score += 2;
  if (/[-_/]/.test(token)) score += 2;
  if (token.length >= 5 && token.length <= 40) score += 1;
  if (looksLikeUpc(token)) score -= 10;
  if (looksLikeAsin(token)) score -= 5;
  return score;
}

export class ValidatorService {
  static INPUT_HEADER = INPUT_HEADER_ROW;
  static identifyFields = identifyRowFields;
  static classifyToken = classifyToken;

  /** Values-only area (header is fixed in the UI, not stored here). */
  static getInputTemplate(): string {
    return '';
  }

  /** Remove a pasted header row if the user copied the full sheet from Excel. */
  static stripHeaderFromPaste(text: string): string {
    const trimmed = text.trim();
    if (!trimmed) return '';

    const lines = trimmed.split(/\r?\n/);
    const firstLine = lines[0] || '';
    let delimiter = '\t';
    if (firstLine.includes('\t')) delimiter = '\t';
    else if (firstLine.includes('|')) delimiter = '|';
    else if (firstLine.includes(',')) delimiter = ',';
    else if (firstLine.includes(';')) delimiter = ';';

    const firstTokens = firstLine.split(delimiter).map((t) => t.trim());
    const hasHeader = firstTokens.length > 0 && firstTokens.every((t) => !t || isHeaderToken(t));
    const dataLines = hasHeader ? lines.slice(1) : lines;
    return dataLines.join('\n').replace(/\n+$/, '');
  }

  static countDataRows(dataOnly: string): number {
    return dataOnly.trim().split(/\r?\n/).filter((l) => l.trim().length > 0).length;
  }

  static toFullInput(dataOnly: string): string {
    const body = dataOnly.trim();
    if (!body) return INPUT_HEADER_ROW;
    return `${INPUT_HEADER_ROW}\n${body}`;
  }

  static parseDataRows(dataOnly: string): ValidationSummary {
    const trimmed = dataOnly.trim();
    if (!trimmed) {
      return {
        isValid: false,
        totalRows: 0,
        validRowsCount: 0,
        invalidRowsCount: 0,
        errors: [{ row: 0, field: 'all', message: 'Add at least one row of values below the header.' }],
        validRows: [],
      };
    }
    return ValidatorService.parseRawText(ValidatorService.toFullInput(trimmed));
  }

  static withHeaderRow(tsvBody: string): string {
    return ValidatorService.stripHeaderFromPaste(tsvBody);
  }

  static parseRawText(rawText: string): ValidationSummary {
    const trimmed = rawText.trim();
    if (!trimmed) {
      return {
        isValid: false,
        totalRows: 0,
        validRowsCount: 0,
        invalidRowsCount: 0,
        errors: [{ row: 0, field: 'all', message: 'Input text is completely empty.' }],
        validRows: [],
      };
    }

    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) {
      return {
        isValid: false,
        totalRows: 0,
        validRowsCount: 0,
        invalidRowsCount: 0,
        errors: [{ row: 0, field: 'all', message: 'No valid rows found in input.' }],
        validRows: [],
      };
    }

    const firstLine = lines[0];
    let delimiter = '\t';
    if (firstLine.includes('\t')) delimiter = '\t';
    else if (firstLine.includes('|')) delimiter = '|';
    else if (firstLine.includes(',')) delimiter = ',';
    else if (firstLine.includes(';')) delimiter = ';';

    const firstTokens = firstLine.split(delimiter).map((t) => t.trim());
    const hasHeader = firstTokens.length > 0 && firstTokens.every((t) => !t || isHeaderToken(t));

    const validRows: RawInputRow[] = [];
    const errors: ValidationErrorItem[] = [];
    const dataStartIndex = hasHeader ? 1 : 0;

    for (let i = dataStartIndex; i < lines.length; i++) {
      const lineStr = lines[i].trim();
      if (!lineStr) continue;

      const rawRowNumber = i + 1;
      const tokens = lineStr.split(delimiter).map((t) => t.trim().replace(/^["']|["']$/g, ''));
      const { asin, upc, vendorModel } = identifyRowFields(tokens);
      const rowErrors: ValidationErrorItem[] = [];

      if (!asin) {
        rowErrors.push({
          row: rawRowNumber,
          field: 'ASIN',
          message: 'Could not detect ASIN (expected 10-char code like B0000AXN5U)',
          value: tokens.join(' | '),
        });
      } else if (!/^[A-Z0-9]{10}$/i.test(asin)) {
        rowErrors.push({
          row: rawRowNumber,
          field: 'ASIN',
          message: 'Invalid ASIN format (must be 10 alphanumeric characters)',
          value: asin,
        });
      }

      if (!upc) {
        rowErrors.push({
          row: rawRowNumber,
          field: 'UPC',
          message: 'Could not detect UPC (expected 8–14 digit barcode)',
          value: tokens.join(' | '),
        });
      } else if (!/^\d{8,14}$/.test(upc)) {
        rowErrors.push({ row: rawRowNumber, field: 'UPC', message: 'UPC must be 8-14 digits', value: upc });
      }

      if (!vendorModel) {
        rowErrors.push({
          row: rawRowNumber,
          field: 'VENDOR MODEL',
          message: 'Could not detect vendor model / SeaWide pid',
          value: tokens.join(' | '),
        });
      }

      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
      } else {
        validRows.push({
          id: `sku-row-${rawRowNumber}-${Math.random().toString(36).substring(2, 7)}`,
          asin: asin.toUpperCase(),
          upc,
          vendorModel,
          partSku: vendorModel,
          rawLineNumber: rawRowNumber,
        });
      }
    }

    const totalRows = lines.length - (hasHeader ? 1 : 0);
    return {
      isValid: errors.length === 0 && validRows.length > 0,
      totalRows,
      validRowsCount: validRows.length,
      invalidRowsCount: totalRows - validRows.length,
      errors,
      validRows,
    };
  }

  static getSampleDataRows(): string {
    return [
      'B0000AXN5U\t686226806970\tPRM80697',
      'B07KM48P9X\t790444031103\tKIT04F-CZ6U51-06',
      'B01N10VZ28\t000000000000\tMST140D',
    ].join('\n');
  }

  static getSamplePreset(): string {
    return ValidatorService.getSampleDataRows();
  }
}
