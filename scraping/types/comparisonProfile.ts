export type SpecEntrySource =
  | 'attribute'
  | 'volumetric'
  | 'dimension'
  | 'embedded_json'
  | 'document'
  | 'amazon_attribute'
  | 'description';

export type PackagingSignalSource =
  | 'attribute'
  | 'description'
  | 'cart_json'
  | 'amazon_attribute'
  | 'title_token';

export type PackagingConfidence = 'high' | 'medium' | 'low' | 'unknown';

export interface IdentifierRecord {
  type: string;
  value: string;
  source: string;
}

export interface PackagingSignal {
  source: PackagingSignalSource;
  field: string;
  rawValue: string;
  parsedNumber: number | null;
}

export interface PackagingProfile {
  unitQuantity: number | null;
  caseQuantity: number | null;
  itemPackageQuantity: number | null;
  unitSize: string | null;
  unitType: string | null;
  isMultipack: boolean | null;
  packDescription: string | null;
  rawSignals: PackagingSignal[];
  confidence: PackagingConfidence;
}

export interface SpecEntry {
  key: string;
  value: string;
  source: SpecEntrySource;
}

export interface PhysicalDimension {
  length?: string;
  width?: string;
  height?: string;
  unit?: string;
}

export interface ComparisonProfile {
  identity: {
    title: string;
    brand: string;
    modelNumber: string;
    manufacturerPartNumber: string;
    supplierName?: string;
    productType?: string;
  };
  identifiers: {
    upc: string;
    ean?: string;
    gtin?: string;
    asin?: string;
    pid?: string;
    vcpn?: string;
    all: IdentifierRecord[];
  };
  packaging: PackagingProfile;
  content: {
    shortDescription: string;
    longDescription: string;
    features: string[];
    bulletPoints: string[];
  };
  specifications: {
    entries: SpecEntry[];
    byKey: Record<string, string>;
  };
  physical: {
    dimensions: PhysicalDimension[];
    weight: { value?: string; unit?: string };
  };
  compliance: {
    prop65?: boolean;
    warnings: string[];
    restrictions: string[];
  };
  media: {
    images: string[];
    documents: { title: string; url: string }[];
  };
  pricing: {
    retailPrice?: number | null;
    currency?: string;
    msrp?: number | null;
  };
  inventory: {
    availability?: string;
    warehouseHints?: string[];
  };
}

export function emptyPackagingProfile(): PackagingProfile {
  return {
    unitQuantity: null,
    caseQuantity: null,
    itemPackageQuantity: null,
    unitSize: null,
    unitType: null,
    isMultipack: null,
    packDescription: null,
    rawSignals: [],
    confidence: 'unknown',
  };
}

export function emptyComparisonProfile(): ComparisonProfile {
  return {
    identity: {
      title: '',
      brand: '',
      modelNumber: '',
      manufacturerPartNumber: '',
    },
    identifiers: {
      upc: '',
      all: [],
    },
    packaging: emptyPackagingProfile(),
    content: {
      shortDescription: '',
      longDescription: '',
      features: [],
      bulletPoints: [],
    },
    specifications: {
      entries: [],
      byKey: {},
    },
    physical: {
      dimensions: [],
      weight: {},
    },
    compliance: {
      warnings: [],
      restrictions: [],
    },
    media: {
      images: [],
      documents: [],
    },
    pricing: {},
    inventory: {},
  };
}

export function normalizeSpecKey(key: string): string {
  return key
    .toLowerCase()
    .replace(/&nbsp;/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
