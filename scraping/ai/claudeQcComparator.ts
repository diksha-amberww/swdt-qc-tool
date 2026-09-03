import type { AmazonListingJson } from '../types/amazonListing';
import type { VendorListingJson } from '../types/vendorListing';
import type { ClaudeImagePayload } from '../compare/imageComparator';
import { DEFAULT_CLAUDE_MODEL, normalizeClaudeModelId } from './claudeCredentials';

export interface ClaudeCredentials {
  apiKey: string;
  model: string;
  endpointUrl?: string;
}

export type TitleResult = 'YES' | 'NO';
export type PackConfidence = 'SURE' | 'UNSURE';
export type VariantConflict =
  | 'NONE'
  | 'SIZE'
  | 'VOLUME'
  | 'AGE'
  | 'VOLTAGE'
  | 'COLOR'
  | 'PRODUCT';

export interface ClaudeQcResult {
  titleResult: TitleResult | null;
  imageSimilarityPct: number | null;
  vendorPackSize: number | null;
  amazonPackSize: number | null;
  packConfidence: PackConfidence | null;
  variantConflict: VariantConflict | null;
  tokensUsed: { input: number; output: number };
  skipped?: string;
  error?: string;
}

/** Prebuilt slim evidence cards + images only — never full listing JSON. */
export interface ClaudeQcInput {
  vendorEvidence: string;
  amazonEvidence: string;
  vendorTitle: string;
  amazonTitle: string;
  vendorImage: ClaudeImagePayload | null;
  amazonImage: ClaudeImagePayload | null;
}

const QC_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'titleResult',
    'imageSimilarityPct',
    'vendorPackSize',
    'amazonPackSize',
    'packConfidence',
    'variantConflict',
  ],
  properties: {
    titleResult: { type: 'string', enum: ['YES', 'NO'] },
    imageSimilarityPct: { type: 'integer' },
    vendorPackSize: { type: 'integer' },
    amazonPackSize: { type: 'integer' },
    packConfidence: { type: 'string', enum: ['SURE', 'UNSURE'] },
    variantConflict: {
      type: 'string',
      enum: ['NONE', 'SIZE', 'VOLUME', 'AGE', 'VOLTAGE', 'COLOR', 'PRODUCT'],
    },
  },
} as const;

const QC_SYSTEM_PROMPT = `You are a product QC engine comparing one vendor catalog listing with one Amazon listing.

Evaluate ALL outputs together from the slim text evidence cards and both product images. Reason internally but return ONLY the required JSON schema — no prose, no markdown, no explanation fields.

TITLE (titleResult: YES or NO only)
- YES only when both listings identify the SAME exact sellable product AND variant (size, volume/oz, age/weight range, voltage, color, model). Brand+model alone is NOT enough if any variant axis conflicts.
- NO when they are only the same broad category, same brand alone, or different products/variants.
- NO on any concrete conflict: color, model/part number, size/dims, volume (oz/ml/gal), age/weight, voltage, gauge, material variant, style, or included components that make different sellable units.
- Category-only similarity without positive evidence of the same product is NO.

VARIANT CONFLICT (variantConflict — required even when titleResult is YES)
- NONE when no concrete variant conflict.
- SIZE for length/width/dims/tape size/roll length mismatches.
- VOLUME for ounces/ml/gal/net-contents mismatches (NOT pack count).
- AGE for child/adult/age or body-weight range mismatches.
- VOLTAGE for volt mismatches.
- COLOR for color/finish variant mismatches.
- PRODUCT when they are different products beyond a single axis above.
- Prefer the most specific axis. Do not use VOLUME for pack-count differences.

IMAGE (imageSimilarityPct: integer 0-100 only)
- Score ONLY from the two product images. Never invent similarity from titles or text when an image is missing.
- If either image is marked unavailable, is logo-only, watermark-only, or not a product photo → return 0.
- Score how similar the actual product is, not the photography.
- Ignore background, crop, angle, lighting, scale, ordinary watermarks, and ordinary packaging-design differences.
- Lifestyle vs packshot of the SAME SKU/color/count is OK (high score).
- Different color, model markings, shape, visible pack count, or SKU → 0-45.
- Use this fixed rubric:
  0-20 clear different product OR missing/unusable image on either side
  21-45 uncertain / category-level only / same category different SKU
  46-70 likely same product with notable differences
  71-90 strong same product
  91-100 near-identical product
- Examples: same spray can, white vs lifestyle background -> 85-95; same item boxed vs loose -> 75-90; same brand different model/color -> 0-25.

PACK SIZE (vendorPackSize, amazonPackSize: integers >= 1; packConfidence: SURE or UNSURE)
- Pack size = count of sellable items/containers delivered to the customer.
- NEVER use ounces, fluid ounces, gallons, liters, ml, pounds, feet, inches, dimensions, or area as pack size. Those belong in VOLUME/SIZE / variantConflict.
- Volume or length alone with no multipack cue ("Pack of N", "N-pack", item_package_quantity, number_of_items) → pack 1 for that side.
- 12 oz spray can with no multipack statement -> pack 1. 12 oz (3 pack) / size "Pack of 3" -> pack 3.
- box/case/book of 100 screws/sheets delivered as ONE container -> pack 1.
- Kit/set piece-count ("Set Of 3", "3-piece") is NOT automatically multipack 3 — if one side says kit/set and the other says pack 1 for the same SKU, set packConfidence UNSURE and prefer pack 1 on both when evidence is ambiguous.
- If Amazon pack fields conflict (e.g. item_package_quantity vs number_of_items vs "Pack of N" in size), set packConfidence UNSURE.
- Vendor MFG case qty is NOT customer pack size.
- Resolve each side independently. If no valid pack count, return 1 for that side.
- packConfidence SURE only when evidence is clear and consistent across attributes and wording.`;

function unavailable(reason: string, skipped: string, tokens = { input: 0, output: 0 }): ClaudeQcResult {
  return {
    titleResult: null,
    imageSimilarityPct: null,
    vendorPackSize: null,
    amazonPackSize: null,
    packConfidence: null,
    variantConflict: null,
    tokensUsed: tokens,
    skipped,
    error: reason,
  };
}

function buildUserContent(input: ClaudeQcInput): Array<
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
> {
  const blocks: Array<
    | { type: 'text'; text: string }
    | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  > = [];

  blocks.push({ type: 'text', text: input.vendorEvidence });

  if (input.vendorImage) {
    blocks.push({ type: 'text', text: 'VENDOR PRODUCT IMAGE:' });
    blocks.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: input.vendorImage.mediaType,
        data: input.vendorImage.base64,
      },
    });
  } else {
    blocks.push({ type: 'text', text: 'VENDOR PRODUCT IMAGE: unavailable (could not fetch/decode)' });
  }

  blocks.push({ type: 'text', text: input.amazonEvidence });

  if (input.amazonImage) {
    blocks.push({ type: 'text', text: 'AMAZON PRODUCT IMAGE:' });
    blocks.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: input.amazonImage.mediaType,
        data: input.amazonImage.base64,
      },
    });
  } else {
    blocks.push({ type: 'text', text: 'AMAZON PRODUCT IMAGE: unavailable (could not fetch/decode)' });
  }

  blocks.push({
    type: 'text',
    text: 'Evaluate title, image similarity, pack size, packConfidence, and variantConflict. Return ONLY the JSON object with titleResult, imageSimilarityPct, vendorPackSize, amazonPackSize, packConfidence, variantConflict.',
  });

  return blocks;
}

export function parseAndValidateQcResponse(text: string): ClaudeQcResult | null {
  return validateQcPayload(parseResponseText(text));
}

function parseResponseText(text: string): Record<string, unknown> | null {
  const trimmed = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

const VARIANT_VALUES = new Set<VariantConflict>([
  'NONE',
  'SIZE',
  'VOLUME',
  'AGE',
  'VOLTAGE',
  'COLOR',
  'PRODUCT',
]);

function validateQcPayload(raw: Record<string, unknown> | null): ClaudeQcResult | null {
  if (!raw) return null;
  const titleResult = raw.titleResult;
  if (titleResult !== 'YES' && titleResult !== 'NO') return null;

  const imageSimilarityPct = Number(raw.imageSimilarityPct);
  if (!Number.isInteger(imageSimilarityPct) || imageSimilarityPct < 0 || imageSimilarityPct > 100) {
    return null;
  }

  const vendorPackSize = Number(raw.vendorPackSize);
  const amazonPackSize = Number(raw.amazonPackSize);
  if (
    !Number.isInteger(vendorPackSize) ||
    vendorPackSize < 1 ||
    !Number.isInteger(amazonPackSize) ||
    amazonPackSize < 1
  ) {
    return null;
  }

  const packConfidence = raw.packConfidence;
  if (packConfidence !== 'SURE' && packConfidence !== 'UNSURE') return null;

  const variantConflict = raw.variantConflict;
  if (typeof variantConflict !== 'string' || !VARIANT_VALUES.has(variantConflict as VariantConflict)) {
    return null;
  }

  return {
    titleResult,
    imageSimilarityPct,
    vendorPackSize,
    amazonPackSize,
    packConfidence,
    variantConflict: variantConflict as VariantConflict,
    tokensUsed: { input: 0, output: 0 },
  };
}

export function applyClaudePackSizes(
  vendor: VendorListingJson,
  amazon: AmazonListingJson,
  vendorPackSize: number,
  amazonPackSize: number,
): void {
  vendor.normalized.packaging.unitQuantity = vendorPackSize;
  vendor.normalized.packaging.itemPackageQuantity = vendorPackSize;
  vendor.normalized.packaging.isMultipack = vendorPackSize > 1;
  vendor.normalized.packaging.confidence = 'high';

  amazon.normalized.packaging.unitQuantity = amazonPackSize;
  amazon.normalized.packaging.itemPackageQuantity = amazonPackSize;
  amazon.normalized.packaging.isMultipack = amazonPackSize > 1;
  amazon.normalized.packaging.confidence = 'high';
}

export async function compareListingsWithClaude(
  input: ClaudeQcInput,
  creds: ClaudeCredentials,
): Promise<ClaudeQcResult> {
  if (!creds.apiKey) {
    return unavailable(
      'Claude API key is not configured; unified QC comparison was not run.',
      'missing_api_key',
    );
  }
  if (!input.vendorTitle.trim() || !input.amazonTitle.trim()) {
    return unavailable('One or both titles are missing.', 'missing_title');
  }
  if (!input.vendorEvidence.trim() || !input.amazonEvidence.trim()) {
    return unavailable('One or both evidence cards are missing.', 'missing_evidence');
  }

  const userContent = buildUserContent(input);

  try {
    const response = await fetch(creds.endpointUrl || 'https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': creds.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: normalizeClaudeModelId(creds.model || DEFAULT_CLAUDE_MODEL),
        max_tokens: 96,
        temperature: 0,
        system: QC_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
        output_config: {
          format: {
            type: 'json_schema',
            schema: QC_OUTPUT_SCHEMA,
          },
        },
      }),
    });

    const json = (await response.json()) as {
      content?: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
      error?: { message?: string };
    };

    const tokensUsed = {
      input: json.usage?.input_tokens || 0,
      output: json.usage?.output_tokens || 0,
    };

    if (!response.ok) {
      return unavailable(
        json.error?.message || `Claude QC request failed (HTTP ${response.status}).`,
        'api_error',
        tokensUsed,
      );
    }

    const text = (json.content || []).map((block) => block.text || '').join('\n');
    const parsed = validateQcPayload(parseResponseText(text));
    if (!parsed) {
      return unavailable('Claude QC returned an invalid or unreadable response.', 'parse_error', tokensUsed);
    }

    return { ...parsed, tokensUsed };
  } catch (err) {
    return unavailable(
      err instanceof Error ? err.message : 'Claude QC request failed.',
      'network_error',
    );
  }
}
