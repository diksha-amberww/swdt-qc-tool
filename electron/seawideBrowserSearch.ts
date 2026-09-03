import { BrowserWindow } from 'electron';
import { configureStealthBrowserWindow, CHROME_USER_AGENT } from './electronStealth';
import { SEAWIDE_PERSIST_PARTITION } from './seawideLogin';
import { buildSearchUrl } from '../scraping/vendor/seawideHttpClient';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function pickDetailUrlScript(vendorModel: string): string {
  const wanted = vendorModel.trim().toLowerCase();
  return `(() => {
    const wanted = ${JSON.stringify(wanted)};
    const links = [...document.querySelectorAll('a[href*="Search/Detail"]')];
    const scored = links.map((a) => {
      const href = a.href || a.getAttribute('href') || '';
      const pidMatch = href.match(/[?&]pid=([^&]+)/i);
      const pid = pidMatch ? decodeURIComponent(pidMatch[1]).toLowerCase() : '';
      let score = 0;
      if (/[?&]rcid=/i.test(href)) score += 4;
      if (/[?&](sid|ssid)=/i.test(href)) score += 4;
      if (/[?&]rpos=/i.test(href)) score += 2;
      if (wanted && pid === wanted) score += 12;
      if (wanted && pid.includes(wanted)) score += 8;
      if (wanted && wanted.includes(pid) && pid.length >= 6) score += 6;
      if (a.closest('.kao-previously-viewed, .carousel, .previously-viewed')) score -= 8;
      if (a.closest('.search-result, .product-result, .kaoxa-search-result, .results-container')) score += 3;
      return { href, score };
    }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
    return scored[0]?.href || null;
  })()`;
}

const COLLECT_IMAGE_URLS_SCRIPT = `(() => {
  const urls = [];
  const seen = new Set();
  const add = (raw) => {
    if (!raw || typeof raw !== 'string') return;
    const href = raw.trim();
    if (!href || seen.has(href)) return;
    if (/javascript:|prop65|headerimages|File=Suppliers\\//i.test(href)) return;
    if (/vehiclepartimages|ImageServerAPI|\\/Images\\//i.test(href)) {
      seen.add(href);
      urls.push(href);
    }
  };
  const gallery = document.querySelector('.kaoxa-product-detail-image-gallery, .galleria-container, .galleria-images, .galleria');
  const scope = gallery || document.querySelector('.product-detail-container') || document;
  for (const el of scope.querySelectorAll('a[href], img')) {
    add(el.getAttribute('href') || el.href);
    add(el.getAttribute('src') || el.src);
    add(el.getAttribute('data-src'));
    add(el.getAttribute('data-big'));
    add(el.getAttribute('data-image'));
  }
  const og = document.querySelector('meta[property="og:image"]');
  if (og) add(og.getAttribute('content'));
  return urls;
})()`;

/**
 * Load the SeaWide search page in a headless Electron window, wait for JS-rendered
 * product links (with rcid/sid/rpos), open the best detail URL, return HTML.
 */
export async function fetchVendorDetailHtmlViaBrowser(
  searchTerm: string,
  vendorModel: string,
): Promise<{ html: string; finalUrl: string; imageUrls: string[] } | null> {
  const searchUrl = buildSearchUrl(searchTerm);
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      partition: SEAWIDE_PERSIST_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  configureStealthBrowserWindow(win);

  try {
    await win.loadURL(searchUrl, { userAgent: CHROME_USER_AGENT });
    await sleep(1500);

    let detailUrl: string | null = null;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      detailUrl = await win.webContents.executeJavaScript(pickDetailUrlScript(vendorModel));
      if (detailUrl) break;
      await sleep(500);
    }
    if (!detailUrl) return null;

    await win.loadURL(detailUrl, {
      userAgent: CHROME_USER_AGENT,
      httpReferrer: searchUrl,
    });

    for (let attempt = 0; attempt < 40; attempt += 1) {
      const ready = await win.webContents.executeJavaScript(`
        Boolean(
          document.querySelector('.product-detail-basic-info span.description')?.textContent?.trim() ||
          document.querySelector('.product-detail-attributes li') ||
          document.querySelector('.product-detail-basic-info h1.title')?.textContent?.trim()
        )
      `);
      if (ready) break;
      await sleep(500);
    }

    for (let attempt = 0; attempt < 16; attempt += 1) {
      const hasImage = await win.webContents.executeJavaScript(`
        Boolean(document.querySelector(
          '.kaoxa-product-detail-image-gallery img[src], .galleria-image img[src], .galleria-images img[src]'
        ))
      `);
      if (hasImage) break;
      await sleep(400);
    }

    const imageUrls: string[] = await win.webContents.executeJavaScript(COLLECT_IMAGE_URLS_SCRIPT);
    const html = await win.webContents.executeJavaScript('document.documentElement.outerHTML');
    const finalUrl = win.webContents.getURL();
    if (!html || !/product-detail-container/i.test(html)) return null;
    return { html, finalUrl, imageUrls: Array.isArray(imageUrls) ? imageUrls : [] };
  } finally {
    win.destroy();
  }
}
