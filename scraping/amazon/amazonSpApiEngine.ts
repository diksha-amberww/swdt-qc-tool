import type { AmazonFetchResult } from '../types/scrapeResult';
import { fetchCatalogItem } from './amazonCatalogClient';
import { mapAmazonCatalogItem } from './amazonCatalogMapper';
import { resolveAmazonCredentials, type AmazonCredentials } from './amazonTokenProvider';

export async function fetchAmazonListing(
  asin: string,
  creds: AmazonCredentials = resolveAmazonCredentials(),
): Promise<AmazonFetchResult> {
  const startedAt = Date.now();
  const timing = () => ({
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
  });

  const trimmed = asin.trim().toUpperCase();
  if (!/^[A-Z0-9]{10}$/.test(trimmed)) {
    return {
      success: false,
      listing: null,
      error: { code: 'INVALID_ASIN', message: `Invalid ASIN: ${asin}` },
      timing: timing(),
    };
  }

  try {
    const { status, body } = await fetchCatalogItem(trimmed, creds);
    if (status === 401 || status === 403) {
      return {
        success: false,
        listing: null,
        error: {
          code: 'AMAZON_AUTH',
          message: 'Amazon SP-API rejected the access token. Check LWA credentials.',
          retryable: true,
        },
        timing: timing(),
      };
    }
    if (status === 404) {
      return {
        success: false,
        listing: null,
        error: { code: 'AMAZON_NOT_FOUND', message: `ASIN ${trimmed} was not found in Catalog Items.` },
        timing: timing(),
      };
    }
    if (status >= 400) {
      const errors = (body.errors as { message?: string }[] | undefined) || [];
      return {
        success: false,
        listing: null,
        error: {
          code: 'AMAZON_HTTP_ERROR',
          message: errors[0]?.message || `Amazon Catalog API HTTP ${status}`,
          retryable: status >= 500,
        },
        timing: timing(),
      };
    }

    const listing = mapAmazonCatalogItem(trimmed, creds.marketplaceId, body);
    return { success: true, listing, timing: timing() };
  } catch (err) {
    return {
      success: false,
      listing: null,
      error: {
        code: 'AMAZON_FETCH_ERROR',
        message: err instanceof Error ? err.message : String(err),
        retryable: true,
      },
      timing: timing(),
    };
  }
}
