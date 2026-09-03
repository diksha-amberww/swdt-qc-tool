import { load, type CheerioAPI } from 'cheerio';
import {
  emptyComparisonProfile,
  normalizeSpecKey,
  type ComparisonProfile,
  type SpecEntry,
} from '../types/comparisonProfile';
import type { ScrapeInputRow } from '../types/inputRow';
import {
  emptyVendorRawListing,
  type VendorCartMetadata,
  type VendorListingJson,
  type VendorRawListing,
} from '../types/vendorListing';
import { buildVendorPackagingProfile } from './seawidePackagingParser';
import { collectProductImageUrls, toVendorMediaItems } from './seawideImages';
import {
  absoluteUrl,
  cleanText,
  extractOnclickJsonObjects,
  extractPidFromHref,
  extractSearchTerm,
  extractSid,
  extractSupplierCode,
  parsePrice,
  splitBrandAndModel,
  tryParseJson,
} from './textUtils';

function isBrandModelHeading(heading: string, brand: string, model: string): boolean {
  const compact = heading.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const expected = `${brand}${model}`.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return Boolean(compact) && Boolean(expected) && compact === expected;
}

function resolveVendorTitle(
  heading: string,
  shortDescription: string,
  brand: string,
  model: string,
): string {
  const desc = cleanText(shortDescription);
  const h1 = cleanText(heading);
  if (desc && (!h1 || isBrandModelHeading(h1, brand, model) || desc.length > h1.length + 8)) {
    return desc;
  }
  return h1 || desc || [brand, model].filter(Boolean).join(' ');
}

function labeledValue(root: ReturnType<CheerioAPI>, selector: string): string {
  const container = root.find(selector).first();
  if (!container.length) return '';
  const labeled = cleanText(container.find('.row-value').first().text());
  if (labeled) return labeled;
  return cleanText(container.text().replace(/^[^:]+:/, ''));
}

function pairList($: CheerioAPI, selector: string): { key: string; value: string }[] {
  const pairs: { key: string; value: string }[] = [];
  $(selector).each((_, el) => {
    const item = $(el);
    const key = cleanText(item.find('.attribute-name').first().text()).replace(/:$/, '');
    const value = cleanText(item.find('.attribute-value').first().text());
    if (key || value) pairs.push({ key, value });
  });
  return pairs;
}

function parseCartMetadata(html: string): VendorCartMetadata {
  const objects = extractOnclickJsonObjects(html);
  const first = objects[0] || {};
  const orderability = (first.Orderability as Record<string, unknown> | undefined) || null;
  const caseFromOrderability =
    typeof orderability?.CaseQuantity === 'number' ? orderability.CaseQuantity : null;
  return {
    caseQuantity:
      typeof first.CaseQuantity === 'number' ? first.CaseQuantity : caseFromOrderability,
    quantityToAdd: typeof first.QuantityToAdd === 'number' ? first.QuantityToAdd : null,
    vendorProductNumber: String(first.VendorProductNumber || ''),
    partSource: String(first.PartSource || ''),
    partSourceNumber: String(first.PartSourceNumber || ''),
    isKit: typeof first.IsKit === 'boolean' ? first.IsKit : null,
    orderability,
  };
}

function parseConfig($: CheerioAPI): { pid: string; vcpn: string; sid?: string; ssid?: string } {
  const raw = $('.product-detail-container').attr('data-config') || '';
  const parsed = tryParseJson<Record<string, string>>(raw) || {};
  return {
    pid: String(parsed.pid || ''),
    vcpn: String(parsed.vcpn || ''),
    sid: parsed.sid ? String(parsed.sid) : undefined,
    ssid: parsed.ssid ? String(parsed.ssid) : undefined,
  };
}

export function parseSeawideDetailHtml(
  html: string,
  input: ScrapeInputRow,
  options?: { detailUrl?: string; extraImageUrls?: string[] },
): VendorListingJson {
  const $ = load(html);
  const raw = emptyVendorRawListing();
  const detailUrl = options?.detailUrl || '';
  raw.detailUrl = detailUrl;

  const redir =
    $('.search-summary-container').attr('data-redir') ||
    $('.vehicle-display-container').attr('data-redir') ||
    '';
  const searchTerm = extractSearchTerm(redir) || input.upc;
  raw.searchContext = {
    searchTerm,
    searchUrl: redir ? absoluteUrl(redir) : undefined,
    referrerUpc: /^\d{8,14}$/.test(searchTerm) ? searchTerm : input.upc,
  };

  raw.config = parseConfig($);
  if (!raw.config.pid) raw.config.pid = input.vendorModel;

  const basic = $('.product-detail-basic-info').first();
  raw.titleHtml = cleanText(basic.find('h1.title').first().text());
  raw.shortDescription = cleanText(basic.find('span.description').first().text());
  raw.descriptionSegments = raw.shortDescription
    .split(';')
    .map((s) => cleanText(s))
    .filter(Boolean);
  raw.longDescription = cleanText($('.product-detail-description').first().text());

  const ordering = $('.product-detail-ordering').first();
  raw.identifiers.manufacturerPartNumber = labeledValue(ordering, '.product-detail-secondary-identifier');
  raw.identifiers.keystonePartNumber = labeledValue(ordering, '.product-detail-primary-identifier');

  const supplierText = labeledValue(ordering, '.product-detail-supplier');
  const supplierParsed = extractSupplierCode(supplierText);
  const supplierHref = ordering.find('.product-detail-supplier a').attr('href') || '';
  raw.supplier = {
    name: supplierParsed.name,
    code: supplierParsed.code,
    url: absoluteUrl(supplierHref),
  };

  raw.pricing.retailPrice = parsePrice($('.product-detail-header-pricing-amount').first().text());
  raw.pricing.costPrice = parsePrice($('.pricing-cost .product-detail-pricing-amount, .pricing-cost').first().text());
  raw.pricing.msrp = parsePrice($('.pricing-MSRP, .pricing-msrp').first().text());
  raw.pricing.currency = /USD/i.test($('.product-detail-header-pricing-amount').first().text() || '')
    ? 'USD'
    : 'USD';

  raw.attributes = pairList($, '.product-detail-attributes li');
  raw.volumetrics = pairList($, '.kaoxa-product-detail-volumetrics li, .product-detail-volumetrics li');

  raw.features = $('.product-detail-features li.feature')
    .map((_, el) => cleanText($(el).text()))
    .get()
    .filter(Boolean);

  raw.documents = $('.product-detail-documents a')
    .map((_, el) => {
      const a = $(el);
      return {
        title: cleanText(a.text()),
        url: absoluteUrl(a.attr('href') || ''),
        type: cleanText(a.closest('div').find('h1').first().text()) || 'document',
      };
    })
    .get()
    .filter((d) => d.url);

  raw.images = toVendorMediaItems(collectProductImageUrls($, options?.extraImageUrls));

  raw.videos = $('.kaoxa-product-video-gallery a[href], .kaoxa-product-video-gallery iframe')
    .map((_, el) => {
      const node = $(el);
      const url = absoluteUrl(node.attr('href') || node.attr('src') || '');
      return url ? { url, title: cleanText(node.attr('title') || '') } : null;
    })
    .get()
    .filter((v): v is { url: string; title: string } => Boolean(v));

  raw.cartMetadata = parseCartMetadata(html);
  raw.identifiers.vendorProductNumber = raw.cartMetadata.vendorProductNumber || raw.config.vcpn;
  raw.identifiers.partSourceNumber = raw.cartMetadata.partSourceNumber || raw.identifiers.keystonePartNumber;

  raw.inventory.rows = $('.product-detail-inventory .warehouse')
    .map((_, el) => {
      const wh = $(el);
      return {
        location: cleanText(wh.find('.wh').first().text()),
        qty: cleanText(wh.find('.val').first().text()),
        status: cleanText(wh.find('.estimatedDelivery').first().text()) || 'listed',
      };
    })
    .get()
    .filter((row) => row.location);

  const kitText = cleanText($('.kaoxa-product-detail-kit-info').text());
  raw.kitInfo = kitText ? kitText : null;

  raw.inTheBox = $('.kaoxa-product-detail-intheboxitems li, .product-detail-intheboxitems li')
    .map((_, el) => cleanText($(el).text()))
    .get()
    .filter(Boolean);

  raw.fitment = $('.product-detail-fitment-list li, .kaoxa-product-detail-fitment-list li')
    .map((_, el) => cleanText($(el).text()))
    .get()
    .filter(Boolean);

  const prop65 = cleanText($('.detail-p65-warning').text());
  if (prop65) raw.restrictions.push(prop65);
  $('.product-detail-restrictions').each((_, el) => {
    const text = cleanText($(el).text());
    if (text) raw.restrictions.push(text);
  });

  raw.relatedProducts = $('a[href*="Search/Detail?pid="]')
    .map((_, el) => {
      const a = $(el);
      if (a.closest('.kao-previously-viewed, .previously-viewed, .carousel').length) return null;
      const href = a.attr('href') || '';
      const pid = extractPidFromHref(href);
      if (pid && raw.config.pid && pid.toLowerCase() === raw.config.pid.toLowerCase()) return null;
      const title = cleanText(a.attr('title') || a.text());
      return pid && title
        ? { pid, title, url: absoluteUrl(href) }
        : null;
    })
    .get()
    .filter((p): p is { pid: string; title: string; url: string } => Boolean(p))
    .filter((p, idx, arr) => arr.findIndex((x) => x.pid === p.pid) === idx)
    .slice(0, 10);

  const hiddenPid = $('#ProductDetailResult_ProductId').attr('value');
  if (hiddenPid) raw.embeddedJson.productId = hiddenPid;
  raw.embeddedJson.searchSid = extractSid(redir) || raw.config.sid || raw.config.ssid || '';

  const split = splitBrandAndModel(
    raw.titleHtml,
    raw.identifiers.manufacturerPartNumber,
    raw.identifiers.keystonePartNumber,
  );
  const brand = raw.supplier.name || split.brand;
  const modelNumber =
    raw.identifiers.manufacturerPartNumber ||
    raw.identifiers.keystonePartNumber ||
    split.modelNumber;
  const title = resolveVendorTitle(raw.titleHtml, raw.shortDescription, brand, modelNumber);

  const packaging = buildVendorPackagingProfile(raw);
  const specEntries: SpecEntry[] = [
    ...raw.attributes.map((a) => ({ key: a.key, value: a.value, source: 'attribute' as const })),
    ...raw.volumetrics.map((a) => ({ key: a.key, value: a.value, source: 'volumetric' as const })),
    ...raw.documents.map((d) => ({ key: d.type || 'document', value: d.title, source: 'document' as const })),
  ];
  const byKey: Record<string, string> = {};
  for (const entry of specEntries) {
    const nk = normalizeSpecKey(entry.key);
    if (nk && !byKey[nk]) byKey[nk] = entry.value;
  }

  const lengthAttr = raw.attributes.find((a) => /length/i.test(a.key));
  const widthAttr = raw.attributes.find((a) => /width/i.test(a.key));
  const heightAttr = raw.attributes.find((a) => /height/i.test(a.key));

  const normalized: ComparisonProfile = emptyComparisonProfile();
  normalized.identity = {
    title,
    brand,
    modelNumber,
    manufacturerPartNumber: raw.identifiers.manufacturerPartNumber,
    supplierName: raw.supplier.name,
  };
  normalized.identifiers = {
    upc: input.upc,
    pid: raw.config.pid,
    vcpn: raw.config.vcpn,
    all: [
      input.upc ? { type: 'UPC', value: input.upc, source: 'input' } : null,
      raw.config.pid ? { type: 'PID', value: raw.config.pid, source: 'seawide' } : null,
      raw.config.vcpn ? { type: 'VCPN', value: raw.config.vcpn, source: 'seawide' } : null,
      raw.identifiers.manufacturerPartNumber
        ? { type: 'MPN', value: raw.identifiers.manufacturerPartNumber, source: 'seawide' }
        : null,
      raw.identifiers.keystonePartNumber
        ? { type: 'KEYSTONE', value: raw.identifiers.keystonePartNumber, source: 'seawide' }
        : null,
    ].filter((x): x is { type: string; value: string; source: string } => Boolean(x)),
  };
  normalized.packaging = packaging;
  normalized.content = {
    shortDescription: raw.shortDescription,
    longDescription: raw.longDescription,
    features: raw.features,
    bulletPoints: raw.features,
  };
  normalized.specifications = { entries: specEntries, byKey };
  if (lengthAttr || widthAttr || heightAttr) {
    normalized.physical.dimensions = [
      {
        length: lengthAttr?.value,
        width: widthAttr?.value,
        height: heightAttr?.value,
      },
    ];
  }
  normalized.compliance = {
    prop65: Boolean(prop65),
    warnings: prop65 ? [prop65] : [],
    restrictions: raw.restrictions,
  };
  normalized.media = {
    images: raw.images.map((i) => i.url),
    documents: raw.documents.map((d) => ({ title: d.title, url: d.url })),
  };
  normalized.pricing = {
    retailPrice: raw.pricing.retailPrice,
    currency: raw.pricing.currency,
    msrp: raw.pricing.msrp,
  };
  const inStock = raw.inventory.rows.some((r) => parseInt(r.qty.replace(/\D/g, ''), 10) > 0);
  normalized.inventory = {
    availability: raw.inventory.rows.length
      ? inStock
        ? 'In Stock'
        : 'See warehouse breakdown'
      : '',
    warehouseHints: raw.inventory.rows.map((r) => `${r.location}: ${r.qty}`),
  };

  return {
    source: 'seawide',
    scrapedAt: new Date().toISOString(),
    input,
    raw,
    normalized,
    title,
    brand,
    modelNumber,
    upc: input.upc,
  };
}
