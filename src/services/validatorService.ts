import { RawInputRow, ValidationSummary, ValidationErrorItem } from '../types/qc';

export class ValidatorService {
  /**
   * Parses raw copy-pasted text from Excel / TSV / CSV
   */
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

    // Determine delimiter (Tab, Comma, Pipe, or Semicolon)
    const firstLine = lines[0];
    let delimiter = '\t';
    if (firstLine.includes('\t')) {
      delimiter = '\t';
    } else if (firstLine.includes('|')) {
      delimiter = '|';
    } else if (firstLine.includes(',')) {
      delimiter = ',';
    } else if (firstLine.includes(';')) {
      delimiter = ';';
    }

    // Check if first line is a header
    const firstTokens = firstLine.split(delimiter).map((t) => t.trim().toLowerCase());
    const hasHeader = firstTokens.some((t) =>
      t.includes('sku') || t.includes('asin') || t.includes('brand') || t.includes('line') || t.includes('upc')
    );

    let colMap = {
      partSku: 0,
      asin: 1,
      brand: 2,
      line: 3,
      upc: 4,
    };

    let dataStartIndex = 0;

    if (hasHeader) {
      dataStartIndex = 1;
      firstTokens.forEach((t, idx) => {
        if (t.includes('sku') || t.includes('part')) colMap.partSku = idx;
        else if (t.includes('asin')) colMap.asin = idx;
        else if (t.includes('brand')) colMap.brand = idx;
        else if (t.includes('line')) colMap.line = idx;
        else if (t.includes('upc') || t.includes('barcode')) colMap.upc = idx;
      });
    }

    const validRows: RawInputRow[] = [];
    const errors: ValidationErrorItem[] = [];

    for (let i = dataStartIndex; i < lines.length; i++) {
      const lineStr = lines[i].trim();
      if (!lineStr) continue;

      const rawRowNumber = i + 1;
      const tokens = lineStr.split(delimiter).map((t) => t.trim().replace(/^["']|["']$/g, ''));

      const partSku = (tokens[colMap.partSku] || '').trim();
      const asin = (tokens[colMap.asin] || '').trim();
      const brand = (tokens[colMap.brand] || '').trim();
      const line = (tokens[colMap.line] || '').trim();
      const upc = (tokens[colMap.upc] || '').trim();

      const rowErrors: ValidationErrorItem[] = [];

      if (!partSku) {
        rowErrors.push({ row: rawRowNumber, field: 'PART SKU', message: 'Missing required PART SKU', value: partSku });
      }

      if (!asin) {
        rowErrors.push({ row: rawRowNumber, field: 'ASIN', message: 'Missing required ASIN', value: asin });
      } else if (!/^[A-Z0-9]{10}$/i.test(asin)) {
        rowErrors.push({ row: rawRowNumber, field: 'ASIN', message: 'Invalid ASIN format (must be 10 alphanumeric characters)', value: asin });
      }

      if (!brand) {
        rowErrors.push({ row: rawRowNumber, field: 'Brand', message: 'Missing Brand name', value: brand });
      }

      if (!line) {
        rowErrors.push({ row: rawRowNumber, field: 'Line', message: 'Missing Line/Category', value: line });
      }

      if (!upc) {
        rowErrors.push({ row: rawRowNumber, field: 'UPC', message: 'Missing required UPC/Barcode', value: upc });
      } else if (!/^\d{8,14}$/.test(upc.replace(/\D/g, ''))) {
        rowErrors.push({ row: rawRowNumber, field: 'UPC', message: 'UPC must be 8-14 digits', value: upc });
      }

      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
      } else {
        validRows.push({
          id: `sku-row-${rawRowNumber}-${Math.random().toString(36).substring(2, 7)}`,
          partSku,
          asin: asin.toUpperCase(),
          brand,
          line,
          upc,
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

  /**
   * Sample Preset generator for quick user testing
   */
  static getSamplePreset(): string {
    return [
      'PART SKU\tASIN\tBrand\tLine\tUPC',
      'SKU-SWD-10492\tB0000AXN5U\tSierra Marine\tElectrical\t030999014923',
      'SKU-SWD-20914\tB07KM48P9X\tSeachoice\tHardware & Fasteners\t719249501481',
      'SKU-SWD-33819\tB01N10VZ28\tTeleflex\tSteering & Control\t731957002819',
      'SKU-SWD-44910\tB08XYZ1234\tAttwood\tLighting & Electronics\t022697554910',
      'SKU-SWD-55021\tB001449GTY\tBlue Sea Systems\tCircuit Protection\t632024055021',
      'SKU-SWD-66190\tB09ABC5678\tJabsco\tPlumbing & Pumps\t671880066190',
      'SKU-SWD-77821\tB009088MNO\tRule Industries\tBilge Pumps\t042237077821',
      'SKU-SWD-88934\tB07DFG7890\tAncor Marine\tWire & Cable\t091887088934',
    ].join('\n');
  }
}
