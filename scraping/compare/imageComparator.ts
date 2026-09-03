import { fetchVendorImage, bufferToDataUrl } from '../vendor/seawideImages';
import type { FetchLike } from '../vendor/seawideHttpClient';

const IMAGE_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const CLAUDE_MAX_LONG_EDGE = 512;
const JPEG_QUALITY = 70;

export interface CompareImage {
  url: string;
  buffer: Buffer;
  dataUrl: string;
}

export interface ClaudeImagePayload {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  base64: string;
}

type NativeImageModule = typeof import('electron').nativeImage;

interface PixelGrid {
  bitmap: Buffer;
  width: number;
  height: number;
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

/** Resize/encode one image for Claude vision without changing compare-image selection. */
export async function prepareImageForClaude(image: CompareImage | null): Promise<ClaudeImagePayload | null> {
  if (!image?.buffer?.length) return null;
  try {
    const { nativeImage } = await import('electron');
    return encodeForClaude(nativeImage, image.buffer);
  } catch {
    return fallbackEncodeForClaude(image.buffer);
  }
}

function encodeForClaude(nativeImage: NativeImageModule, buffer: Buffer): ClaudeImagePayload | null {
  const img = nativeImage.createFromBuffer(buffer);
  if (img.isEmpty()) return null;

  const { width, height } = img.getSize();
  if (!width || !height) return null;

  const longEdge = Math.max(width, height);
  let working = img;
  if (longEdge > CLAUDE_MAX_LONG_EDGE) {
    const scale = CLAUDE_MAX_LONG_EDGE / longEdge;
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));
    working = img.resize({ width: targetW, height: targetH, quality: 'best' });
  }

  const bitmap = working.getBitmap();
  const hasAlpha = bitmap.length >= working.getSize().width * working.getSize().height * 4 &&
    bitmap.some((byte, index) => index % 4 === 3 && byte < 255);
  if (hasAlpha) {
    const png = working.toPNG();
    return { mediaType: 'image/png', base64: png.toString('base64') };
  }

  const jpeg = working.toJPEG(JPEG_QUALITY);
  return { mediaType: 'image/jpeg', base64: jpeg.toString('base64') };
}

function fallbackEncodeForClaude(buffer: Buffer): ClaudeImagePayload | null {
  if (buffer.length < 400) return null;
  return { mediaType: 'image/jpeg', base64: buffer.toString('base64') };
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

function isNearWhite(grid: PixelGrid, x: number, y: number): boolean {
  const i = (y * grid.width + x) * 4;
  const b = grid.bitmap[i];
  const g = grid.bitmap[i + 1];
  const r = grid.bitmap[i + 2];
  return r >= 245 && g >= 245 && b >= 245;
}

function luminanceAt(grid: PixelGrid, x: number, y: number): number {
  const i = (y * grid.width + x) * 4;
  const b = grid.bitmap[i];
  const g = grid.bitmap[i + 1];
  const r = grid.bitmap[i + 2];
  return 0.299 * r + 0.587 * g + 0.114 * b;
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
