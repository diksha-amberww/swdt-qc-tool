import {
  emptyComparisonProfile,
  emptyPackagingProfile,
  normalizeSpecKey,
  type ComparisonProfile,
  type PackagingProfile,
  type PackagingSignal,
  type SpecEntry,
} from '../types/comparisonProfile';
import {
  emptyAmazonRawListing,
  type AmazonListingJson,
  type AmazonRawListing,
} from '../types/amazonListing';
import { parseLeadingNumber, cleanText } from '../vendor/textUtils';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function flattenAttributeValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((v) => flattenAttributeValue(v)).filter(Boolean).join(' | ');
  }
  if (typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    if (rec.value != null) return flattenAttributeValue(rec.value);
    if (rec.name != null) return flattenAttributeValue(rec.name);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const text = cleanText(flattenAttributeValue(value));
    if (text) return text;
  }
  return '';
}

function extractIdentifier(raw: AmazonRawListing, type: string): string {
  for (const group of raw.identifiers) {
    for (const id of group.identifiers || []) {
      if (id.identifierType?.toUpperCase() === type.toUpperCase() && id.identifier) {
        return id.identifier;
      }
    }
  }
  return '';
}

function attr(raw: AmazonRawListing, key: string): unknown {
  return raw.attributes[key];
}

function collectAmazonImageUrls(raw: AmazonRawListing): string[] {
  type Ranked = { link: string; score: number };
  const ranked: Ranked[] = [];
  for (const group of raw.images) {
    for (const img of group.images || []) {
      if (!img.link) continue;
      if (/_SL75_/i.test(img.link)) continue;
      const variant = (img.variant || '').toUpperCase();
      const width = img.width || 0;
      const height = img.height || 0;
      const area = width * height;
      const aspect = width && height ? width / height : 1;
      const squareBias = 1 / (1 + Math.abs(Math.log(aspect || 1)));
      let score = Math.min(area, 500_000) / 1000 + squareBias * 200;
      if (variant === 'MAIN') score += 80;
      ranked.push({ link: img.link, score });
    }
  }
  ranked.sort((a, b) => b.score - a.score);
  const urls: string[] = [];
  for (const item of ranked) {
    if (!urls.includes(item.link)) urls.push(item.link);
  }
  return urls;
}

export function buildAmazonPackagingProfile(
  raw: AmazonRawListing,
  title: string,
  bullets: string[],
): PackagingProfile {
  const profile = emptyPackagingProfile();
  const signals: PackagingSignal[] = [];

  const push = (field: string, value: unknown) => {
    const rawValue = flattenAttributeValue(value);
    if (!rawValue) return;
    signals.push({
      source: 'amazon_attribute',
      field,
      rawValue,
      parsedNumber: parseLeadingNumber(rawValue),
    });
  };

  push('item_package_quantity', attr(raw, 'item_package_quantity'));
  push('number_of_items', attr(raw, 'number_of_items'));
  push('unit_count', attr(raw, 'unit_count'));
  push('case_pack_quantity', attr(raw, 'case_pack_quantity'));
  push('size', attr(raw, 'size'));
  push('size_map', attr(raw, 'size_map'));
  push('item_volume', attr(raw, 'item_volume'));
  push('liquid_volume', attr(raw, 'liquid_volume'));

  // Pack size = COUNT of items delivered. Ounces, fluid ounces, gallons, feet etc.
  // are contents/size — never pack size.
  const packTokenRe = /\b(single|pack of \d+|\d+\s*[- ]?pack|\d+\s*[- ]?(count|ct|pcs|pieces))\b/i;
  // A case/box/carton of N is ONE deliverable container holding N — N is case qty, not pack size.
  const caseTokenRe = /\b(?:case|box|carton)\s+of\s+(\d+)\b/i;
  const volumeOrDimRe =
    /\b(\d+(?:\.\d+)?)\s*(fl\.?\s*oz|oz|ounce|ounces|ml|\bl\b|liter|liters|gal|gallon|gallons|ft|feet|\bin\b|inch|inches|mm|cm)\b/i;

  const titlePack = title.match(packTokenRe);
  if (titlePack) {
    signals.push({
      source: 'title_token',
      field: 'title',
      rawValue: titlePack[0],
      parsedNumber: parseLeadingNumber(titlePack[0]),
    });
  }
  const titleCase = title.match(caseTokenRe);
  if (titleCase) {
    signals.push({
      source: 'title_token',
      field: 'case_token',
      rawValue: titleCase[0],
      parsedNumber: Number(titleCase[1]) || null,
    });
  }

  for (const bullet of bullets) {
    const bulletPack = bullet.match(packTokenRe);
    if (bulletPack) {
      signals.push({
        source: 'description',
        field: 'bullet',
        rawValue: bulletPack[0],
        parsedNumber: parseLeadingNumber(bulletPack[0]),
      });
    }
    const bulletCase = bullet.match(caseTokenRe);
    if (bulletCase) {
      signals.push({
        source: 'description',
        field: 'case_token',
        rawValue: bulletCase[0],
        parsedNumber: Number(bulletCase[1]) || null,
      });
    }
  }

  // Pack cues often live in Amazon size / size_map ("12 oz (Pack of 3)").
  for (const sizeField of ['size', 'size_map'] as const) {
    const sizeVal = flattenAttributeValue(attr(raw, sizeField));
    if (!sizeVal) continue;
    const sizePack = sizeVal.match(packTokenRe);
    if (sizePack) {
      signals.push({
        source: 'amazon_attribute',
        field: `${sizeField}_pack_token`,
        rawValue: sizePack[0],
        parsedNumber: parseLeadingNumber(sizePack[0]),
      });
    }
  }

  profile.rawSignals = signals;

  const pkgQty = signals.find((s) => s.field === 'item_package_quantity')?.parsedNumber ?? null;
  const numItems = signals.find((s) => s.field === 'number_of_items')?.parsedNumber ?? null;
  const titleQty = signals.find((s) => s.source === 'title_token' && s.field === 'title')?.parsedNumber ?? null;
  const bulletQty = signals.find((s) => s.source === 'description' && s.field === 'bullet')?.parsedNumber ?? null;
  const sizePackQty =
    signals.find((s) => s.field === 'size_pack_token' || s.field === 'size_map_pack_token')?.parsedNumber ?? null;
  const textQty = titleQty ?? bulletQty ?? sizePackQty;
  const caseTokenQty = signals.find((s) => s.field === 'case_token')?.parsedNumber ?? null;

  // unit_count is only pack size when its unit is a plain count; "12 Fl Oz" is contents.
  const unitCountAttr = attr(raw, 'unit_count');
  const unitCountFirst = Array.isArray(unitCountAttr) ? unitCountAttr[0] : unitCountAttr;
  const unitCountRec =
    unitCountFirst && typeof unitCountFirst === 'object'
      ? (unitCountFirst as Record<string, unknown>)
      : null;
  const unitCountNum =
    parseLeadingNumber(
      flattenAttributeValue(unitCountRec ? (unitCountRec.value ?? '') : (unitCountAttr ?? '')),
    ) ?? null;
  const unitCountUnit = unitCountRec
    ? flattenAttributeValue(unitCountRec.unit ?? unitCountRec.unit_type ?? '')
    : '';
  const unitCountIsCount =
    unitCountNum != null &&
    /count|each|\bct\b|\bea\b|piece/i.test(unitCountUnit) &&
    !/oz|ounce|fl\s*oz|gal|gallon|\bft\b|feet|\bin\b|inch|\blb\b|pound|\bml\b|\bl\b|liter|litre|sheet/i.test(
      unitCountUnit,
    );

  const sizeText = flattenAttributeValue(
    attr(raw, 'size') || attr(raw, 'size_map') || attr(raw, 'item_volume') || attr(raw, 'liquid_volume'),
  );
  const volumeOrDimOnly =
    textQty == null &&
    pkgQty == null &&
    numItems == null &&
    !unitCountIsCount &&
    (volumeOrDimRe.test(sizeText) ||
      volumeOrDimRe.test(title) ||
      Boolean(flattenAttributeValue(attr(raw, 'item_volume'))) ||
      Boolean(flattenAttributeValue(attr(raw, 'liquid_volume'))));

  profile.itemPackageQuantity = pkgQty;
  if (pkgQty != null) {
    profile.unitQuantity = pkgQty;
  } else if (numItems != null && (textQty == null || numItems === textQty)) {
    profile.unitQuantity = numItems;
  } else if (textQty != null) {
    profile.unitQuantity = textQty;
  } else if (unitCountIsCount) {
    profile.unitQuantity = unitCountNum;
  } else if (caseTokenQty != null) {
    // "Case/box of N" with no other count signal → one container delivered.
    profile.unitQuantity = 1;
  } else if (volumeOrDimOnly) {
    // fl oz / gallons / feet etc. without Pack of X → pack 1.
    profile.unitQuantity = 1;
  } else {
    // No multipack cue → treat as single (aligned with vendor default).
    profile.unitQuantity = 1;
  }

  const casePack = signals.find((s) => s.field === 'case_pack_quantity')?.parsedNumber ?? null;
  const resolvedCase = casePack != null && casePack > 0 ? casePack : caseTokenQty;
  profile.caseQuantity = resolvedCase != null && resolvedCase > 0 ? resolvedCase : null;
  profile.unitSize =
    flattenAttributeValue(attr(raw, 'size') || attr(raw, 'item_volume') || attr(raw, 'liquid_volume')) || null;
  profile.unitType = flattenAttributeValue(attr(raw, 'size_map')) || null;
  profile.packDescription =
    signals.find(
      (s) =>
        s.source === 'title_token' ||
        s.source === 'description' ||
        s.field === 'size_pack_token' ||
        s.field === 'size_map_pack_token',
    )?.rawValue ||
    (profile.unitQuantity != null
      ? profile.unitQuantity === 1
        ? 'Single'
        : `Pack of ${profile.unitQuantity}`
      : null);
  profile.isMultipack = profile.unitQuantity != null ? profile.unitQuantity > 1 : null;

  if (pkgQty != null && (numItems == null || pkgQty === numItems)) {
    profile.confidence = 'high';
  } else if (numItems != null && textQty != null && numItems === textQty) {
    profile.confidence = 'medium';
  } else if (textQty != null || volumeOrDimOnly) {
    profile.confidence = 'medium';
  } else if (profile.unitQuantity != null) {
    profile.confidence = 'low';
  } else if (signals.length > 0) {
    profile.confidence = 'low';
  }

  return profile;
}

export function mapAmazonCatalogItem(
  asin: string,
  marketplaceId: string,
  body: Record<string, unknown>,
): AmazonListingJson {
  const raw = emptyAmazonRawListing();
  raw.summaries = asArray(body.summaries);
  raw.attributes = (body.attributes as Record<string, unknown>) || {};
  raw.identifiers = asArray(body.identifiers);
  raw.images = asArray(body.images);
  raw.dimensions = asArray(body.dimensions);
  raw.productTypes = asArray(body.productTypes);
  raw.relationships = asArray(body.relationships);
  raw.salesRanks = asArray(body.salesRanks);

  const summary = (raw.summaries[0] || {}) as Record<string, unknown>;
  const title = firstString(summary.itemName, attr(raw, 'item_name'));
  const brand = firstString(summary.brand, attr(raw, 'brand'), attr(raw, 'manufacturer'));
  const modelNumber = firstString(
    attr(raw, 'model_number'),
    attr(raw, 'part_number'),
    attr(raw, 'model'),
    summary.modelNumber,
  );
  const upc = extractIdentifier(raw, 'UPC') || extractIdentifier(raw, 'GTIN') || extractIdentifier(raw, 'EAN');
  const ean = extractIdentifier(raw, 'EAN');
  const gtin = extractIdentifier(raw, 'GTIN');
  const productType = String(raw.productTypes[0]?.productType || summary.productType || '');

  const bullets = asArray<string>(
    (summary.bulletPoints as string[]) || flattenAttributeValue(attr(raw, 'bullet_point')).split(' | '),
  ).map((b) => cleanText(b)).filter(Boolean);

  const specEntries: SpecEntry[] = Object.entries(raw.attributes).map(([key, value]) => ({
    key,
    value: flattenAttributeValue(value),
    source: 'amazon_attribute' as const,
  }));
  const byKey: Record<string, string> = {};
  for (const entry of specEntries) {
    const nk = normalizeSpecKey(entry.key);
    if (nk && !byKey[nk]) byKey[nk] = entry.value;
  }

  const identifiersAll = raw.identifiers.flatMap((group) =>
    (group.identifiers || []).map((id) => ({
      type: id.identifierType,
      value: id.identifier,
      source: 'amazon',
    })),
  );

  const imageUrls = collectAmazonImageUrls(raw);
  const packaging = buildAmazonPackagingProfile(raw, title, bullets);

  const dims = raw.dimensions[0] as Record<string, unknown> | undefined;
  const itemDims = (dims?.item || dims?.package || dims) as Record<string, unknown> | undefined;

  const normalized: ComparisonProfile = emptyComparisonProfile();
  normalized.identity = {
    title,
    brand,
    modelNumber,
    manufacturerPartNumber: firstString(attr(raw, 'part_number'), attr(raw, 'model_number')),
    productType,
  };
  normalized.identifiers = {
    upc,
    ean: ean || undefined,
    gtin: gtin || undefined,
    asin,
    all: [
      { type: 'ASIN', value: asin, source: 'amazon' },
      ...identifiersAll,
    ],
  };
  normalized.packaging = packaging;
  normalized.content = {
    shortDescription: firstString(summary.itemName),
    longDescription: firstString(attr(raw, 'product_description'), attr(raw, 'description')),
    features: bullets,
    bulletPoints: bullets,
  };
  normalized.specifications = { entries: specEntries, byKey };
  if (itemDims) {
    const length = itemDims.length as Record<string, unknown> | undefined;
    const width = itemDims.width as Record<string, unknown> | undefined;
    const height = itemDims.height as Record<string, unknown> | undefined;
    const weight = itemDims.weight as Record<string, unknown> | undefined;
    normalized.physical.dimensions = [
      {
        length: length ? flattenAttributeValue(length) : undefined,
        width: width ? flattenAttributeValue(width) : undefined,
        height: height ? flattenAttributeValue(height) : undefined,
        unit: String(length?.unit || width?.unit || ''),
      },
    ];
    if (weight) {
      normalized.physical.weight = {
        value: flattenAttributeValue(weight.value ?? weight),
        unit: String(weight.unit || ''),
      };
    }
  }
  normalized.media = { images: imageUrls, documents: [] };
  const listPrice = Number(flattenAttributeValue(attr(raw, 'list_price')));
  normalized.pricing = {
    retailPrice: Number.isFinite(listPrice) && listPrice > 0 ? listPrice : null,
    currency: 'USD',
  };
  normalized.inventory = { availability: String(summary.itemClassification || '') };

  return {
    source: 'amazon_sp_api',
    fetchedAt: new Date().toISOString(),
    asin,
    marketplaceId,
    raw,
    normalized,
    title,
    brand,
    modelNumber,
    upc,
  };
}
