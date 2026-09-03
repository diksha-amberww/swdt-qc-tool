import { fetchVendorImage, bufferToDataUrl } from '../vendor/seawideImages';
import type { FetchLike } from '../vendor/seawideHttpClient';

const IMAGE_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export interface CompareImage {
  url: string;
  buffer: Buffer;
  dataUrl: string;
}

type NativeImageModule = typeof import('electron').nativeImage;

interface PixelGrid {
  bitmap: Buffer;
  width: number;
  height: number;
}

export async function compareListingImages(
  vendorUrl: string,
  amazonUrl: string,
  fetchImpl?: FetchLike,
): Promise<number> {
  if (!vendorUrl || !amazonUrl) return 0;
  const [vendor, amazon] = await Promise.all([
    materializeCompareImage(vendorUrl, fetchImpl),
    materializeCompareImage(amazonUrl),
  ]);
  if (!vendor || !amazon) return 0;
  return compareImageBuffers(vendor.buffer, amazon.buffer);
}

export async function compareImageBuffers(vendorBuf: Buffer, amazonBuf: Buffer): Promise<number> {
  try {
    const { nativeImage } = await import('electron');
    return scoreImageSimilarity(nativeImage, vendorBuf, amazonBuf);
  } catch {
    return 0;
  }
}

export async function pickAmazonProductImage(urls: string[]): Promise<CompareImage | null> {
  const unique = [...new Set(urls.filter(Boolean))].slice(0, 6);
  const fetched: { image: CompareImage; logo: boolean }[] = [];
  for (const url of unique) {
    const image = await materializeCompareImage(url);
    if (!image) continue;
    const logo = await isLikelyLogoImage(image.buffer);
    fetched.push({ image, logo });
  }
  return fetched.find((item) => !item.logo)?.image || fetched[0]?.image || null;
}

export async function materializeCompareImage(
  url: string,
  fetchImpl?: FetchLike,
): Promise<CompareImage | null> {
  if (!url) return null;
  if (url.startsWith('data:image/')) {
    const buffer = dataUrlToBuffer(url);
    return buffer ? { url, buffer, dataUrl: url } : null;
  }

  if (fetchImpl) {
    const viaSession = await fetchVendorImage(fetchImpl, url);
    if (viaSession) {
      return { url: viaSession.url, buffer: viaSession.buffer, dataUrl: viaSession.dataUrl };
    }
  }

  return fetchPublicImage(url);
}

function scoreImageSimilarity(nativeImage: NativeImageModule, vendorBuf: Buffer, amazonBuf: Buffer): number {
  const vendorGrid = pixelsOf(nativeImage, vendorBuf, 48, 48);
  const amazonGrid = pixelsOf(nativeImage, amazonBuf, 48, 48);
  if (!vendorGrid || !amazonGrid) return 0;

  const vendorContent = contentGrid(vendorGrid);
  const amazonContent = contentGrid(amazonGrid);

  const dHash = hashSimilarityPct(dHashFromGrid(vendorContent), dHashFromGrid(amazonContent), 64);
  const aHash = hashSimilarityPct(aHashFromGrid(vendorContent), aHashFromGrid(amazonContent), 64);
  const color = histogramIntersectionPct(
    colorHistogram(vendorContent, true),
    colorHistogram(amazonContent, true),
  );
  const raw = Math.min(dHash, aHash, color);

  const vendorLogo = isLikelyLogoGrid(vendorContent);
  const amazonLogo = isLikelyLogoGrid(amazonContent);
  if (vendorLogo !== amazonLogo) {
    return Math.min(raw, 15);
  }
  return raw;
}

function isNearWhite(grid: PixelGrid, x: number, y: number): boolean {
  const i = (y * grid.width + x) * 4;
  const b = grid.bitmap[i];
  const g = grid.bitmap[i + 1];
  const r = grid.bitmap[i + 2];
  return r >= 245 && g >= 245 && b >= 245;
}

function contentGrid(grid: PixelGrid): PixelGrid {
  let minX = grid.width;
  let minY = grid.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      if (isNearWhite(grid, x, y)) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX || maxY < minY) return grid;
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  if (width * height < grid.width * grid.height * 0.08) return grid;

  const bitmap = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const srcStart = ((minY + y) * grid.width + minX) * 4;
    grid.bitmap.copy(bitmap, y * width * 4, srcStart, srcStart + width * 4);
  }
  return { bitmap, width, height };
}

async function isLikelyLogoImage(buffer: Buffer): Promise<boolean> {
  try {
    const { nativeImage } = await import('electron');
    const grid = pixelsOf(nativeImage, buffer, 48, 48);
    return grid ? isLikelyLogoGrid(contentGrid(grid)) : false;
  } catch {
    return false;
  }
}

function isLikelyLogoGrid(grid: PixelGrid): boolean {
  const { stddev } = luminanceStats(grid, true);
  const hist = colorHistogram(grid, true);
  const dominantShare = Math.max(...hist);
  const distinct = hist.filter((share) => share >= 0.04).length;
  if (dominantShare >= 0.35 && distinct <= 5 && stddev < 52) return true;
  if (distinct <= 3 && stddev < 40) return true;
  return false;
}

function pixelsOf(
  nativeImage: NativeImageModule,
  buffer: Buffer,
  width: number,
  height: number,
): PixelGrid | null {
  const resized = nativeImage.createFromBuffer(buffer).resize({ width, height });
  if (resized.isEmpty()) return null;
  const size = resized.getSize();
  const bitmap = resized.getBitmap();
  if (!bitmap || !size.width || !size.height) return null;
  return { bitmap, width: size.width, height: size.height };
}

function luminanceAt(grid: PixelGrid, x: number, y: number): number {
  const i = (y * grid.width + x) * 4;
  const b = grid.bitmap[i];
  const g = grid.bitmap[i + 1];
  const r = grid.bitmap[i + 2];
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function sampleGrid(grid: PixelGrid, width: number, height: number): number[] {
  const values: number[] = [];
  for (let y = 0; y < height; y += 1) {
    const srcY = Math.min(grid.height - 1, Math.round((y / (height - 1)) * (grid.height - 1)));
    for (let x = 0; x < width; x += 1) {
      const srcX = Math.min(grid.width - 1, Math.round((x / (width - 1)) * (grid.width - 1)));
      values.push(luminanceAt(grid, srcX, srcY));
    }
  }
  return values;
}

function dHashFromGrid(grid: PixelGrid): bigint {
  const values = sampleGrid(grid, 9, 8);
  let hash = 0n;
  let bit = 0n;
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      if (values[y * 9 + x] > values[y * 9 + x + 1]) hash |= 1n << bit;
      bit += 1n;
    }
  }
  return hash;
}

function aHashFromGrid(grid: PixelGrid): bigint {
  const values = sampleGrid(grid, 8, 8);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  let hash = 0n;
  let bit = 0n;
  for (const value of values) {
    if (value >= mean) hash |= 1n << bit;
    bit += 1n;
  }
  return hash;
}

function colorHistogram(grid: PixelGrid, skipWhite = false): number[] {
  const bins = 4;
  const hist = new Array(bins * bins * bins).fill(0);
  let total = 0;
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      if (skipWhite && isNearWhite(grid, x, y)) continue;
      const i = (y * grid.width + x) * 4;
      const b = grid.bitmap[i];
      const g = grid.bitmap[i + 1];
      const r = grid.bitmap[i + 2];
      const rq = Math.min(bins - 1, Math.floor((r / 256) * bins));
      const gq = Math.min(bins - 1, Math.floor((g / 256) * bins));
      const bq = Math.min(bins - 1, Math.floor((b / 256) * bins));
      hist[rq * bins * bins + gq * bins + bq] += 1;
      total += 1;
    }
  }
  if (total === 0) return hist;
  return hist.map((count) => count / total);
}

function luminanceStats(grid: PixelGrid, skipWhite = false): { mean: number; stddev: number } {
  const values: number[] = [];
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      if (skipWhite && isNearWhite(grid, x, y)) continue;
      values.push(luminanceAt(grid, x, y));
    }
  }
  if (!values.length) return { mean: 0, stddev: 0 };
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return { mean, stddev: Math.sqrt(variance) };
}

function histogramIntersectionPct(a: number[], b: number[]): number {
  let intersection = 0;
  for (let i = 0; i < a.length; i += 1) {
    intersection += Math.min(a[i], b[i]);
  }
  return Math.round(intersection * 100);
}

function hashSimilarityPct(a: bigint, b: bigint, bits: number): number {
  const distance = hammingDistance(a, b);
  return Math.round(((bits - distance) / bits) * 100);
}

function hammingDistance(a: bigint, b: bigint): number {
  let x = a ^ b;
  let count = 0;
  while (x) {
    count += Number(x & 1n);
    x >>= 1n;
  }
  return count;
}

async function fetchPublicImage(url: string): Promise<CompareImage | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': IMAGE_UA,
        referer: 'https://www.amazon.com/',
        accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 400) return null;
    const contentType = (response.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
    const type = contentType.startsWith('image/') ? contentType : 'image/jpeg';
    return { url, buffer, dataUrl: bufferToDataUrl(buffer, type) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function dataUrlToBuffer(dataUrl: string): Buffer | null {
  const match = dataUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
  if (!match) return null;
  try {
    return Buffer.from(match[1], 'base64');
  } catch {
    return null;
  }
}
