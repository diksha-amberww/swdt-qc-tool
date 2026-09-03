import { parseAndValidateQcResponse } from './claudeQcComparator';
import { DEFAULT_CLAUDE_MODEL, normalizeClaudeModelId } from './claudeCredentials';
import {
  buildAmazonEvidenceBlock,
  buildVendorEvidenceBlock,
  evidenceLooksSlim,
} from './qcEvidenceBuilder';
import { buildExportRow } from '../../src/services/excelService';
import type { QCRowResult } from '../../src/types/qc';
import { emptyComparisonProfile } from '../types/comparisonProfile';
import { emptyAmazonRawListing } from '../types/amazonListing';
import { emptyVendorRawListing } from '../types/vendorListing';
import type { AmazonListingJson } from '../types/amazonListing';
import type { VendorListingJson } from '../types/vendorListing';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function testModelIdNormalization(): void {
  assert(normalizeClaudeModelId('claude-haiku-4.5') === DEFAULT_CLAUDE_MODEL, 'dot id remapped');
  assert(normalizeClaudeModelId('claude-haiku-4.5-20251001') === DEFAULT_CLAUDE_MODEL, 'dotted snapshot remapped');
  assert(normalizeClaudeModelId('') === DEFAULT_CLAUDE_MODEL, 'empty uses default');
  assert(normalizeClaudeModelId('claude-haiku-4-5') === 'claude-haiku-4-5', 'valid alias kept');
  assert(normalizeClaudeModelId('claude-haiku-4-5-20251001') === 'claude-haiku-4-5-20251001', 'pinned id kept');
}

function makeVendor(): VendorListingJson {
  return {
    source: 'seawide',
    scrapedAt: new Date().toISOString(),
    input: { asin: 'B000000001', upc: '123', vendorModel: 'ABC' },
    raw: {
      ...emptyVendorRawListing(),
      shortDescription: 'Single; Case of 12; 12 Ounce',
      attributes: [
        { key: 'Unit Quantity', value: 'Single' },
        { key: 'Unit Size', value: '12 Ounce' },
        { key: 'Mfg. Case Qty.', value: '12' },
        { key: 'Color', value: 'Black' },
      ],
    },
    normalized: {
      ...emptyComparisonProfile(),
      packaging: {
        ...emptyComparisonProfile().packaging,
        unitSize: '12 Ounce',
        unitType: 'Aerosol Can',
        packDescription: 'Single',
        unitQuantity: 1,
      },
    },
    title: 'Dupli-Color Spray 12 oz',
    brand: 'Dupli-Color',
    modelNumber: 'ABC123',
    upc: '123',
  };
}

function makeAmazon(): AmazonListingJson {
  return {
    source: 'amazon_sp_api',
    fetchedAt: new Date().toISOString(),
    asin: 'B000000001',
    marketplaceId: 'ATVPDKIKX0DER',
    raw: {
      ...emptyAmazonRawListing(),
      attributes: {
        item_package_quantity: [{ value: 3 }],
        number_of_items: [{ value: 3 }],
        size: [{ value: '12', unit: 'ounce' }],
        color: [{ value: 'Black' }],
      },
      productTypes: [{ productType: 'AUTO_ACCESSORY' }],
    },
    normalized: emptyComparisonProfile(),
    title: 'Dupli-Color Perfect Match 12 oz (3 Pack)',
    brand: 'Dupli-Color',
    modelNumber: 'ABC123',
    upc: '123',
  };
}

function validPayload(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    titleResult: 'YES',
    imageSimilarityPct: 92,
    vendorPackSize: 1,
    amazonPackSize: 3,
    packConfidence: 'SURE',
    variantConflict: 'NONE',
    ...overrides,
  });
}

function testSchemaValidation(): void {
  const ok = parseAndValidateQcResponse(validPayload());
  assert(ok?.titleResult === 'YES', 'valid payload should parse');
  assert(ok?.imageSimilarityPct === 92, 'image score');
  assert(ok?.vendorPackSize === 1, 'vendor pack');
  assert(ok?.amazonPackSize === 3, 'amazon pack');
  assert(ok?.packConfidence === 'SURE', 'pack confidence');
  assert(ok?.variantConflict === 'NONE', 'variant conflict');

  assert(
    parseAndValidateQcResponse(validPayload({ variantConflict: 'VOLUME' }))?.variantConflict === 'VOLUME',
    'VOLUME variant accepted',
  );
  assert(
    parseAndValidateQcResponse(validPayload({ packConfidence: 'UNSURE' }))?.packConfidence === 'UNSURE',
    'UNSURE pack accepted',
  );

  assert(parseAndValidateQcResponse(validPayload({ titleResult: 'MAYBE' })) == null, 'reject bad title enum');
  assert(parseAndValidateQcResponse(validPayload({ imageSimilarityPct: 101 })) == null, 'reject score >100');
  assert(parseAndValidateQcResponse(validPayload({ imageSimilarityPct: 50.5 })) == null, 'reject decimal score');
  assert(parseAndValidateQcResponse(validPayload({ vendorPackSize: 0 })) == null, 'reject pack zero');
  assert(parseAndValidateQcResponse(validPayload({ packConfidence: 'MAYBE' })) == null, 'reject bad packConfidence');
  assert(parseAndValidateQcResponse(validPayload({ variantConflict: 'OUNCES' })) == null, 'reject bad variant');
  assert(
    parseAndValidateQcResponse(
      JSON.stringify({
        titleResult: 'YES',
        imageSimilarityPct: 50,
        vendorPackSize: 1,
        amazonPackSize: 1,
      }),
    ) == null,
    'reject missing new fields',
  );
  assert(parseAndValidateQcResponse('not json') == null, 'reject prose');
}

function testEvidenceBlocks(): void {
  const vendorText = buildVendorEvidenceBlock(makeVendor());
  const amazonText = buildAmazonEvidenceBlock(makeAmazon());
  assert(vendorText.includes('=== VENDOR LISTING ==='), 'vendor header');
  assert(vendorText.includes('Dupli-Color Spray 12 oz'), 'vendor title');
  assert(vendorText.includes('Volume:'), 'vendor volume extracted');
  assert(vendorText.includes('12') && /oz|Ounce/i.test(vendorText), 'vendor ounces in volume');
  assert(vendorText.includes('Pack clues:'), 'vendor pack clues');
  assert(!vendorText.includes('Mfg. Case Qty'), 'case qty not dumped as free attrs');
  assert(evidenceLooksSlim(vendorText), 'vendor evidence is slim');

  assert(amazonText.includes('=== AMAZON LISTING ==='), 'amazon header');
  assert(amazonText.includes('AUTO_ACCESSORY'), 'amazon product type');
  assert(amazonText.includes('Pack clues:'), 'amazon pack clues');
  assert(amazonText.includes('item_package_quantity=3'), 'amazon pack qty in clues');
  assert(evidenceLooksSlim(amazonText), 'amazon evidence is slim');
  assert(!amazonText.includes('attr.'), 'no attr. dump prefix');
  assert(!amazonText.includes('signal['), 'no packaging signal dump');
  assert(!amazonText.includes('Bullet points:'), 'no bullet dump');
}

async function testSingleFetchCall(): Promise<void> {
  let callCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    callCount += 1;
    const body = JSON.parse(String(init?.body || '{}')) as {
      model?: string;
      messages?: { content?: unknown[] }[];
      output_config?: unknown;
      max_tokens?: number;
    };
    assert(body.model === 'claude-haiku-4-5', 'API model id must use hyphen alias');
    assert((body.max_tokens || 0) >= 96, 'max_tokens allows new fields');
    const content = body.messages?.[0]?.content;
    assert(Array.isArray(content), 'multimodal content array expected');
    const imageBlocks = (content as { type: string }[]).filter((b) => b.type === 'image');
    assert(imageBlocks.length === 2, 'exactly two image blocks in one call');
    assert(body.output_config != null, 'structured output expected');

    const textBlocks = (content as { type: string; text?: string }[]).filter((b) => b.type === 'text');
    const joined = textBlocks.map((b) => b.text || '').join('\n');
    assert(evidenceLooksSlim(joined), 'request evidence is slim');
    assert(!joined.includes('signal['), 'no signal dump in API body');
    assert(joined.includes('=== VENDOR LISTING ==='), 'vendor evidence card in body');
    assert(joined.includes('=== AMAZON LISTING ==='), 'amazon evidence card in body');

    return new Response(
      JSON.stringify({
        content: [
          {
            type: 'text',
            text: validPayload({
              titleResult: 'YES',
              imageSimilarityPct: 88,
              vendorPackSize: 1,
              amazonPackSize: 3,
              packConfidence: 'SURE',
              variantConflict: 'NONE',
            }),
          },
        ],
        usage: { input_tokens: 1000, output_tokens: 20 },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };

  try {
    const { compareListingsWithClaude } = await import('./claudeQcComparator');
    const vendor = makeVendor();
    const amazon = makeAmazon();
    const result = await compareListingsWithClaude(
      {
        vendorEvidence: buildVendorEvidenceBlock(vendor),
        amazonEvidence: buildAmazonEvidenceBlock(amazon),
        vendorTitle: vendor.title,
        amazonTitle: amazon.title,
        vendorImage: { mediaType: 'image/jpeg', base64: 'aGVsbG8=' },
        amazonImage: { mediaType: 'image/jpeg', base64: 'aGVsbG8=' },
      },
      { apiKey: 'test-key', model: 'claude-haiku-4.5' },
    );
    assert(callCount === 1, 'exactly one Claude API call');
    assert(result.titleResult === 'YES', 'mock title');
    assert(result.imageSimilarityPct === 88, 'mock image');
    assert(result.vendorPackSize === 1, 'mock vendor pack');
    assert(result.amazonPackSize === 3, 'mock amazon pack');
    assert(result.packConfidence === 'SURE', 'mock pack confidence');
    assert(result.variantConflict === 'NONE', 'mock variant');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testNoRetryOnFailure(): Promise<void> {
  let callCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    callCount += 1;
    return new Response(JSON.stringify({ error: { message: 'rate limited' } }), { status: 429 });
  };
  try {
    const { compareListingsWithClaude } = await import('./claudeQcComparator');
    const vendor = makeVendor();
    const amazon = makeAmazon();
    const result = await compareListingsWithClaude(
      {
        vendorEvidence: buildVendorEvidenceBlock(vendor),
        amazonEvidence: buildAmazonEvidenceBlock(amazon),
        vendorTitle: vendor.title,
        amazonTitle: amazon.title,
        vendorImage: null,
        amazonImage: null,
      },
      { apiKey: 'test-key', model: 'claude-haiku-4-5' },
    );
    assert(callCount === 1, 'no retry on API failure');
    assert(result.skipped === 'api_error', 'api_error flagged');
    assert(result.titleResult == null, 'no fabricated title on failure');
    assert(result.packConfidence == null, 'no fabricated packConfidence on failure');
    assert(result.variantConflict == null, 'no fabricated variant on failure');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function testExportRow(): void {
  const row = {
    id: 'qc-test',
    vendorModel: 'ABC',
    partSku: 'ABC',
    asin: 'B000000001',
    brand: 'Dupli-Color',
    line: '',
    upc: '123',
    vendorListing: {
      title: 'Vendor title',
      price: 10,
      packQuantity: 1,
      caseQuantity: null,
      imageUrl: 'https://example.com/v.jpg',
      modelNumber: 'ABC',
      upc: '123',
      brand: 'Dupli-Color',
      availability: '',
    },
    amazonListing: {
      title: 'Amazon title',
      price: 12,
      packQuantity: 3,
      caseQuantity: null,
      imageUrl: 'https://example.com/a.jpg',
      modelNumber: 'ABC',
      upc: '123',
      brand: 'Dupli-Color',
      availability: '',
    },
    vendorListingFull: {
      ...makeVendor(),
      raw: {
        ...makeVendor().raw,
        shortDescription: 'Vendor short desc for export',
      },
      normalized: {
        ...makeVendor().normalized,
        specifications: {
          entries: [{ key: 'Color', value: 'Black', source: 'attribute' as const }],
          byKey: { color: 'Black' },
        },
      },
    },
    amazonListingFull: {
      ...makeAmazon(),
      normalized: {
        ...emptyComparisonProfile(),
        content: {
          shortDescription: '',
          longDescription: '',
          features: [],
          bulletPoints: ['Amazon bullet one'],
        },
        specifications: {
          entries: [{ key: 'Size', value: '12 oz', source: 'attribute' as const }],
          byKey: { size: '12 oz' },
        },
      },
    },
    titleMatchPct: 42,
    priceVariancePct: 20,
    imageSimilarityPct: 88,
    packQtyMatch: false,
    upcMatch: true,
    modelMatch: true,
    brandMatch: true,
    specMatchPct: 0,
    descriptionMatchPct: 0,
    titleSameProduct: true,
    titleResult: 'YES' as const,
    variantConflict: 'VOLUME',
    packConfidence: 'SURE' as const,
    failReason: 'PACK',
    checks: [],
    verdictSentence: 'FAILED: PACK',
    status: 'FAILED' as const,
    aiVerdictReason: 'PACK',
    aiTokensUsed: { input: 100, output: 20 },
    confidenceScore: 0.5,
    timestamp: '12:00',
  } satisfies QCRowResult;

  const exported = buildExportRow(row);
  assert(exported['Title Result'] === 'YES', 'export title YES/NO only');
  assert(exported['Image Comparison Percentage'] === 88, 'export image pct');
  assert(exported['Pack Size Vendor'] === 1, 'export vendor pack');
  assert(exported['Pack Size Amazon'] === 3, 'export amazon pack');
  assert(exported['Fail Reason'] === 'PACK', 'export fail reason');
  assert(exported['Variant Conflict'] === 'VOLUME', 'export variant');
  assert(exported['Description Vendor'] === 'Vendor short desc for export', 'export vendor description');
  assert(String(exported['Description Amazon']).includes('Amazon bullet'), 'export amazon description');
  assert(String(exported['Specs Vendor']).includes('Color'), 'export vendor specs');
  assert(String(exported['Specs Amazon']).includes('Size'), 'export amazon specs');
  assert(!('Verdict Sentence' in exported), 'verdict sentence column removed');
  assert(!('Vendor Pack Attributes' in exported), 'pack attr dump removed');
  assert(!('Specs Match %' in exported), 'specs match % removed');
  assert(!('Title Comparison' in exported), 'duplicate title comparison column removed');
}

async function main(): Promise<void> {
  testModelIdNormalization();
  testSchemaValidation();
  testEvidenceBlocks();
  testExportRow();
  await testSingleFetchCall();
  await testNoRetryOnFailure();
  process.stderr.write('All unified Claude QC fixture checks passed.\n');
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
