import type { ScrapeInputRow } from '../types/inputRow';
import type { VendorScrapeResult } from '../types/scrapeResult';
import type { VendorListingJson } from '../types/vendorListing';
import { parseSeawideDetailHtml } from './seawideDetailParser';
import {
  buildDetailUrl,
  buildSearchUrl,
  isLoginHtml,
  seawideGet,
  type FetchLike,
} from './seawideHttpClient';
import { resolvePidFromSearch } from './seawideSearch';
import { fetchVendorDetailHtmlViaBrowser } from '../../electron/seawideBrowserSearch';
import {
  constructVendorImageCandidates,
  resolveWorkingVendorImages,
} from './seawideImages';

export interface VendorEngineOptions {
  fetchImpl: FetchLike;
  preferDirectDetail?: boolean;
}

async function attachWorkingImages(
  listing: VendorListingJson,
  fetchImpl: FetchLike,
  extraUrls: string[] = [],
): Promise<VendorListingJson> {
  const candidates = [
    ...listing.raw.images.map((img) => img.url),
    ...extraUrls,
    ...constructVendorImageCandidates({
      pid: listing.raw.config.pid || listing.input.vendorModel,
      mpn: listing.raw.identifiers.manufacturerPartNumber,
      vcpn: listing.raw.config.vcpn,
      supplierUrl: listing.raw.supplier.url,
    }),
  ];
  const resolved = await resolveWorkingVendorImages(fetchImpl, candidates, 3);
  if (!resolved.items.length) return listing;
  listing.raw.images = resolved.items;
  listing.normalized.media.images = resolved.items.map((img) => img.url);
  return listing;
}

function nowTiming(startedAt: number): VendorScrapeResult['timing'] {
  const finished = Date.now();
  return {
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: new Date(finished).toISOString(),
    durationMs: finished - startedAt,
  };
}

/** True when the page has real product content, not just an empty detail shell. */
export function isSubstantiveVendorListing(listing: VendorListingJson): boolean {
  return Boolean(
    listing.title?.trim() ||
      listing.raw.shortDescription?.trim() ||
      listing.raw.longDescription?.trim() ||
      listing.raw.attributes.length > 0 ||
      listing.raw.images.length > 0 ||
      listing.raw.pricing.retailPrice != null ||
      listing.raw.identifiers.manufacturerPartNumber?.trim() ||
      listing.raw.identifiers.keystonePartNumber?.trim() ||
      listing.raw.supplier.name?.trim(),
  );
}

function sessionExpired(sourceUrl: string, startedAt: number): VendorScrapeResult {
  return {
    success: false,
    listing: null,
    error: {
      code: 'VENDOR_SESSION_EXPIRED',
      message: 'SeaWide session expired or login required.',
      retryable: true,
    },
    timing: nowTiming(startedAt),
    sourceUrl,
  };
}

async function fetchDetailViaSearch(
  fetchImpl: FetchLike,
  input: ScrapeInputRow,
  startedAt: number,
): Promise<{ html: string; sourceUrl: string; imageUrls: string[] } | VendorScrapeResult> {
  const vendorModel = input.vendorModel.trim();
  const upc = input.upc.trim();
  if (!upc && !vendorModel) {
    return {
      success: false,
      listing: null,
      error: { code: 'MISSING_LOOKUP', message: 'Need vendorModel or UPC to scrape SeaWide.' },
      timing: nowTiming(startedAt),
    };
  }

  const searchTerm = upc || vendorModel;
  const searchPage = await seawideGet(fetchImpl, buildSearchUrl(searchTerm));
  if (isLoginHtml(searchPage.html, searchPage.finalUrl)) {
    return sessionExpired(searchPage.finalUrl, startedAt);
  }

  const resolved = resolvePidFromSearch(searchPage, vendorModel);
  if (resolved) {
    const detail = await seawideGet(fetchImpl, resolved.detailHref, searchPage.finalUrl);
    if (!isLoginHtml(detail.html, detail.finalUrl)) {
      const listing = parseSeawideDetailHtml(detail.html, input, { detailUrl: detail.finalUrl });
      if (isSubstantiveVendorListing(listing)) {
        return { html: detail.html, sourceUrl: detail.finalUrl, imageUrls: [] };
      }
    }
  }

  try {
    const browserDetail = await fetchVendorDetailHtmlViaBrowser(searchTerm, vendorModel);
    if (browserDetail) {
      const listing = parseSeawideDetailHtml(browserDetail.html, input, {
        detailUrl: browserDetail.finalUrl,
        extraImageUrls: browserDetail.imageUrls,
      });
      if (isSubstantiveVendorListing(listing)) {
        return {
          html: browserDetail.html,
          sourceUrl: browserDetail.finalUrl,
          imageUrls: browserDetail.imageUrls || [],
        };
      }
    }
  } catch {
    /* browser search failed */
  }

  return {
    success: false,
    listing: null,
    error: {
      code: resolved ? 'PARSE_FAILED' : 'VENDOR_NOT_FOUND',
      message: resolved
        ? 'SeaWide search found a product link but the detail page had no parseable catalog data.'
        : `No SeaWide listing found for ${vendorModel || upc}. Search results may require a logged-in browser session.`,
    },
    timing: nowTiming(startedAt),
    sourceUrl: searchPage.finalUrl,
  };
}

async function tryDirectDetail(
  fetchImpl: FetchLike,
  vendorModel: string,
): Promise<{ html: string; sourceUrl: string } | null> {
  const sourceUrl = buildDetailUrl(vendorModel);
  const direct = await seawideGet(fetchImpl, sourceUrl);
  if (isLoginHtml(direct.html, direct.finalUrl)) {
    throw new Error('VENDOR_SESSION_EXPIRED');
  }
  if (direct.status >= 400 || !/product-detail-container/i.test(direct.html)) {
    return null;
  }
  return { html: direct.html, sourceUrl: direct.finalUrl };
}

export async function scrapeVendorListing(
  input: ScrapeInputRow,
  options: VendorEngineOptions,
): Promise<VendorScrapeResult> {
  const startedAt = Date.now();
  const fetchImpl = options.fetchImpl;
  const vendorModel = input.vendorModel.trim();

  try {
    let detailHtml = '';
    let sourceUrl = '';

    if (vendorModel && options.preferDirectDetail !== false) {
      try {
        const direct = await tryDirectDetail(fetchImpl, vendorModel);
        if (direct) {
          const candidate = parseSeawideDetailHtml(direct.html, input, { detailUrl: direct.sourceUrl });
          if (isSubstantiveVendorListing(candidate)) {
            return {
              success: true,
              listing: await attachWorkingImages(candidate, fetchImpl),
              timing: nowTiming(startedAt),
              sourceUrl: direct.sourceUrl,
            };
          }
        }
      } catch (err) {
        if (err instanceof Error && err.message === 'VENDOR_SESSION_EXPIRED') {
          return sessionExpired('', startedAt);
        }
        throw err;
      }
    }

    const searchResult = await fetchDetailViaSearch(fetchImpl, input, startedAt);
    if ('success' in searchResult) return searchResult;
    detailHtml = searchResult.html;
    sourceUrl = searchResult.sourceUrl;

    const listing = parseSeawideDetailHtml(detailHtml, input, {
      detailUrl: sourceUrl,
      extraImageUrls: searchResult.imageUrls,
    });
    if (!isSubstantiveVendorListing(listing)) {
      return {
        success: false,
        listing: null,
        error: {
          code: 'PARSE_FAILED',
          message:
            'SeaWide returned an empty product page. The PID/UPC may be wrong, or the listing may not exist on SeaWide.',
        },
        timing: nowTiming(startedAt),
        sourceUrl,
      };
    }

    return {
      success: true,
      listing: await attachWorkingImages(listing, fetchImpl, searchResult.imageUrls),
      timing: nowTiming(startedAt),
      sourceUrl,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      listing: null,
      error: { code: 'VENDOR_FETCH_ERROR', message, retryable: true },
      timing: nowTiming(startedAt),
    };
  }
}
