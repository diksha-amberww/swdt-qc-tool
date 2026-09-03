import { brandsMatch } from './brandComparator';

export interface ClaudeCredentials {
  apiKey: string;
  model: string;
  endpointUrl?: string;
}

export interface TitleAiResult {
  sameProduct: boolean | null;
  confidence: number;
  reason: string;
  tokensUsed: { input: number; output: number };
  skipped?: string;
}

export interface TitleAiContext {
  vendorBrand?: string;
  amazonBrand?: string;
  vendorModel?: string;
  amazonModel?: string;
}

const TITLE_AI_SYSTEM = `You compare two product listing titles from a vendor catalog and Amazon.
They may use completely different wording, extra marketing text, or different word order, but still represent the same sellable product.
Treat matching brand + model/part number as the same product even if the title wording differs.
Reply with JSON only, no markdown: {"sameProduct":true|false,"confidence":0-1,"reason":"one short sentence"}`;

const TITLE_AI_CACHE = new Map<string, TitleAiResult>();

function compactId(value: string): string {
  return value.toLowerCase().replace(/[\s-]/g, '');
}

function cacheKey(vendorTitle: string, amazonTitle: string, ctx: TitleAiContext): string {
  return [
    vendorTitle,
    amazonTitle,
    ctx.vendorBrand || '',
    ctx.amazonBrand || '',
    ctx.vendorModel || '',
    ctx.amazonModel || '',
  ]
    .map((s) => s.toLowerCase().replace(/\s+/g, ' ').trim())
    .join('||');
}

function modelsLookSame(left: string, right: string): boolean {
  const a = compactId(left);
  const b = compactId(right);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function deterministicTitleMatch(
  vendorTitle: string,
  amazonTitle: string,
  ctx: TitleAiContext,
): TitleAiResult | null {
  const vendorModel = ctx.vendorModel || '';
  const amazonModel = ctx.amazonModel || '';
  const modelPresent = Boolean(vendorModel && amazonModel);
  const modelMatch = modelPresent && modelsLookSame(vendorModel, amazonModel);
  const brandMatch = brandsMatch(ctx.vendorBrand || '', ctx.amazonBrand || '');

  if (modelMatch && (brandMatch || !ctx.vendorBrand || !ctx.amazonBrand)) {
    return {
      sameProduct: true,
      confidence: brandMatch ? 1 : 0.92,
      reason: brandMatch
        ? `Brand and model match (${ctx.vendorBrand} ${vendorModel}); titles describe the same part.`
        : `Model numbers match (${vendorModel}); titles describe the same part.`,
      tokensUsed: { input: 0, output: 0 },
      skipped: 'deterministic_model_match',
    };
  }

  if (modelPresent && !modelMatch && ctx.vendorBrand && ctx.amazonBrand && !brandMatch) {
    return {
      sameProduct: false,
      confidence: 0.95,
      reason: `Model numbers differ (${vendorModel} vs ${amazonModel}) and brands differ.`,
      tokensUsed: { input: 0, output: 0 },
      skipped: 'deterministic_model_mismatch',
    };
  }

  if (modelMatch && vendorTitle && amazonTitle) {
    return {
      sameProduct: true,
      confidence: 0.9,
      reason: `Model numbers match (${vendorModel}) even though title wording differs.`,
      tokensUsed: { input: 0, output: 0 },
      skipped: 'deterministic_model_match',
    };
  }

  return null;
}

export async function compareTitlesWithAi(
  vendorTitle: string,
  amazonTitle: string,
  creds: ClaudeCredentials,
  ctx: TitleAiContext = {},
): Promise<TitleAiResult> {
  const key = cacheKey(vendorTitle, amazonTitle, ctx);
  const cached = TITLE_AI_CACHE.get(key);
  if (cached) return { ...cached, tokensUsed: { input: 0, output: 0 }, skipped: cached.skipped || 'cache' };

  const deterministic = deterministicTitleMatch(vendorTitle, amazonTitle, ctx);
  if (deterministic) {
    TITLE_AI_CACHE.set(key, deterministic);
    return deterministic;
  }

  if (!creds.apiKey) {
    return {
      sameProduct: null,
      confidence: 0,
      reason: 'Claude API key is not configured; title sameness was not checked with AI.',
      tokensUsed: { input: 0, output: 0 },
      skipped: 'missing_api_key',
    };
  }
  if (!vendorTitle.trim() || !amazonTitle.trim()) {
    return {
      sameProduct: null,
      confidence: 0,
      reason: 'One or both titles are missing.',
      tokensUsed: { input: 0, output: 0 },
      skipped: 'missing_title',
    };
  }

  try {
    const response = await fetch(creds.endpointUrl || 'https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': creds.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: creds.model || 'claude-haiku-4.5',
        max_tokens: 160,
        temperature: 0,
        system: TITLE_AI_SYSTEM,
        messages: [
          {
            role: 'user',
            content: `Vendor brand: ${ctx.vendorBrand || '(unknown)'}\nVendor model: ${ctx.vendorModel || '(unknown)'}\nVendor title: ${vendorTitle}\nAmazon brand: ${ctx.amazonBrand || '(unknown)'}\nAmazon model: ${ctx.amazonModel || '(unknown)'}\nAmazon title: ${amazonTitle}`,
          },
        ],
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
      return {
        sameProduct: null,
        confidence: 0,
        reason: json.error?.message || `Title AI request failed (HTTP ${response.status}).`,
        tokensUsed,
        skipped: 'api_error',
      };
    }

    const text = (json.content || []).map((block) => block.text || '').join('\n');
    const parsed = parseTitleAiJson(text);
    if (!parsed) {
      return {
        sameProduct: null,
        confidence: 0,
        reason: 'Title AI returned an unreadable response.',
        tokensUsed,
        skipped: 'parse_error',
      };
    }

    const result: TitleAiResult = {
      sameProduct: Boolean(parsed.sameProduct),
      confidence: clamp01(parsed.confidence),
      reason:
        parsed.reason ||
        (parsed.sameProduct
          ? 'Titles represent the same product.'
          : 'Titles do not represent the same product.'),
      tokensUsed,
    };
    TITLE_AI_CACHE.set(key, result);
    return result;
  } catch (err) {
    return {
      sameProduct: null,
      confidence: 0,
      reason: err instanceof Error ? err.message : 'Title AI request failed.',
      tokensUsed: { input: 0, output: 0 },
      skipped: 'network_error',
    };
  }
}

function clamp01(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.min(1, Math.max(0, num));
}

function parseTitleAiJson(text: string): { sameProduct?: boolean; confidence?: number; reason?: string } | null {
  const trimmed = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  try {
    return JSON.parse(trimmed) as { sameProduct?: boolean; confidence?: number; reason?: string };
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as { sameProduct?: boolean; confidence?: number; reason?: string };
    } catch {
      return null;
    }
  }
}
