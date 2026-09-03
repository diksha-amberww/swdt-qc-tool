import type { CheerioAPI } from 'cheerio';
import { absoluteUrl, cleanText } from './textUtils';
import type { FetchLike } from './seawideHttpClient';
import type { VendorMediaItem } from '../types/vendorListing';

const IMAGE_HOST_RE = /vehiclepartimages\.com|ImageServerAPI/i;
const SKIP_IMAGE_RE = /prop65|headerimages|newsletter|logo-min|restriction|javascript:/i;
const RELATED_THUMB_RE = /maxwidth=70|maxheight=70/i;
const IMAGE_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export function upgradeProductImageUrl(url: string): string {
  const value = cleanText(url);
  if (!value || !IMAGE_HOST_RE.test(value)) return value;
  try {
    const parsed = new URL(value);
    const max = Number(parsed.searchParams.get('maxwidth') || '0');
    if (!parsed.searchParams.has('maxwidth') || max < 800) {
      parsed.searchParams.set('maxwidth', '800');
    }
    parsed.searchParams.delete('maxheight');
    return parsed.toString();
  } catch {
    return value.replace(/maxwidth=\d+/i, 'maxwidth=800');
  }
}

export function isProductImageUrl(url: string): boolean {
  const value = cleanText(url);
  if (!value || SKIP_IMAGE_RE.test(value)) return false;
  if (/\/Suppliers\//i.test(value) || /File=Suppliers\//i.test(value)) return false;
  return IMAGE_HOST_RE.test(value) || /\/Images\//i.test(value);
}

function pushUnique(urls: string[], url: string): void {
  const upgraded = upgradeProductImageUrl(absoluteUrl(url));
  if (!isProductImageUrl(upgraded)) return;
  if (RELATED_THUMB_RE.test(upgraded)) return;
  if (urls.includes(upgraded)) return;
  urls.push(upgraded);
}

export function collectProductImageUrls($: CheerioAPI, extraUrls: string[] = []): string[] {
  const urls: string[] = [];
  const gallery = $('.kaoxa-product-detail-image-gallery, .product-detail-image-gallery, .galleria-container, .galleria-images');

  gallery.find('a[href], img').each((_, el) => {
    const node = $(el);
    pushUnique(urls, node.attr('href') || '');
    pushUnique(urls, node.attr('src') || '');
    pushUnique(urls, node.attr('data-src') || '');
    pushUnique(urls, node.attr('data-big') || '');
    pushUnique(urls, node.attr('data-image') || '');
  });

  $('.product-detail-container img, .product-detail-basic-info img').each((_, el) => {
    const node = $(el);
    if (node.closest('.kao-previously-viewed, .previously-viewed, .carousel, .supplier-header').length) return;
    pushUnique(urls, node.attr('src') || '');
    pushUnique(urls, node.attr('data-src') || '');
  });

  const og = $('meta[property="og:image"]').attr('content') || '';
  if (og) pushUnique(urls, og);

  for (const extra of extraUrls) pushUnique(urls, extra);

  return urls.filter((url) => !RELATED_THUMB_RE.test(url));
}

export function toVendorMediaItems(urls: string[]): VendorMediaItem[] {
  return urls.map((url) => ({ url, title: 'product' }));
}

function supplierPrefixFromUrl(supplierUrl: string): string {
  const match = supplierUrl.match(/\/Suppliers\/[^/]+\/([A-Za-z0-9]+)/i);
  return match ? match[1].toUpperCase() : '';
}

function pidParts(pid: string): { prefix: string; rest: string } {
  const trimmed = pid.trim();
  const match = trimmed.match(/^([A-Za-z]{2,5})(.+)$/);
  if (!match) return { prefix: '', rest: trimmed };
  return { prefix: match[1].toUpperCase(), rest: match[2] };
}

export function constructVendorImageCandidates(input: {
  pid?: string;
  mpn?: string;
  vcpn?: string;
  supplierUrl?: string;
}): string[] {
  const pid = cleanText(input.pid);
  const parts = pidParts(pid);
  const prefix = supplierPrefixFromUrl(input.supplierUrl || '') || parts.prefix;
  if (!prefix) return [];

  const stems = [input.mpn, parts.rest, pid, input.vcpn]
    .map((s) => cleanText(s || ''))
    .filter(Boolean)
    .filter((stem, idx, arr) => arr.findIndex((x) => x.toLowerCase() === stem.toLowerCase()) === idx);

  const urls: string[] = [];
  for (const stem of stems) {
    for (const ext of ['png', 'jpg', 'jpeg']) {
      const encoded = encodeURIComponent(`${prefix}/Images/${stem}.${ext}`).replace(/%2F/g, '/');
      urls.push(`https://seawide.vehiclepartimages.com/ImageServerAPI?File=${encoded}&maxwidth=800`);
    }
  }
  return urls.slice(0, 12);
}

function sniffImageType(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return 'image/gif';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

export interface FetchedVendorImage {
  url: string;
  buffer: Buffer;
  contentType: string;
  dataUrl: string;
}

export function bufferToDataUrl(buffer: Buffer, contentType: string): string {
  return `data:${contentType};base64,${buffer.toString('base64')}`;
}

export async function fetchVendorImage(
  fetchImpl: FetchLike,
  url: string,
): Promise<FetchedVendorImage | null> {
  const target = upgradeProductImageUrl(url);
  if (!target) return null;
  try {
    const response = await fetchImpl(target, {
      method: 'GET',
      headers: {
        accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        referer: 'https://www.seawideb2b.com/',
        'user-agent': IMAGE_UA,
      },
    });
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    const sniffed = sniffImageType(buffer);
    const headerType = (response.headers.get('content-type') || '').split(';')[0].trim();
    const contentType = sniffed || (headerType.startsWith('image/') ? headerType : '');
    if (!contentType || buffer.length < 400) return null;
    return {
      url: target,
      buffer,
      contentType,
      dataUrl: bufferToDataUrl(buffer, contentType),
    };
  } catch {
    return null;
  }
}

export async function resolveWorkingVendorImages(
  fetchImpl: FetchLike,
  candidates: string[],
  limit = 3,
): Promise<{ items: VendorMediaItem[]; first: FetchedVendorImage | null }> {
  const items: VendorMediaItem[] = [];
  let first: FetchedVendorImage | null = null;
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const url = upgradeProductImageUrl(candidate);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const fetched = await fetchVendorImage(fetchImpl, url);
    if (!fetched) continue;
    items.push({ url: fetched.url, title: 'product' });
    if (!first) first = fetched;
    if (items.length >= limit) break;
  }

  return { items, first };
}
