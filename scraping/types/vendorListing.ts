import type { ComparisonProfile } from './comparisonProfile';
import type { ScrapeInputRow } from './inputRow';

export interface KeyValuePair {
  key: string;
  value: string;
}

export interface VendorMediaItem {
  url: string;
  title?: string;
  alt?: string;
}

export interface VendorDocument {
  title: string;
  url: string;
  type?: string;
}

export interface VendorInventoryRow {
  location: string;
  qty: string;
  status: string;
}

export interface VendorRelatedProduct {
  pid: string;
  title: string;
  url: string;
}

export interface VendorCartMetadata {
  caseQuantity: number | null;
  quantityToAdd: number | null;
  vendorProductNumber: string;
  partSource: string;
  partSourceNumber: string;
  isKit: boolean | null;
  orderability: unknown;
}

export interface VendorRawListing {
  detailUrl: string;
  searchContext: {
    searchTerm: string;
    searchUrl?: string;
    referrerUpc?: string;
  };
  config: {
    pid: string;
    vcpn: string;
    sid?: string;
    ssid?: string;
  };
  titleHtml: string;
  shortDescription: string;
  longDescription: string;
  descriptionSegments: string[];
  identifiers: {
    manufacturerPartNumber: string;
    keystonePartNumber: string;
    vendorProductNumber: string;
    partSourceNumber: string;
  };
  supplier: {
    name: string;
    code: string;
    url: string;
  };
  pricing: {
    retailPrice: number | null;
    costPrice: number | null;
    currency: string;
    msrp: number | null;
  };
  attributes: KeyValuePair[];
  volumetrics: KeyValuePair[];
  features: string[];
  documents: VendorDocument[];
  images: VendorMediaItem[];
  videos: VendorMediaItem[];
  cartMetadata: VendorCartMetadata;
  inventory: {
    rows: VendorInventoryRow[];
  };
  kitInfo: unknown | null;
  inTheBox: string[];
  fitment: string[];
  restrictions: string[];
  relatedProducts: VendorRelatedProduct[];
  embeddedJson: Record<string, unknown>;
}

export interface VendorListingJson {
  source: 'seawide';
  scrapedAt: string;
  input: ScrapeInputRow;
  raw: VendorRawListing;
  normalized: ComparisonProfile;
  title: string;
  brand: string;
  modelNumber: string;
  upc: string;
}

export function emptyVendorCartMetadata(): VendorCartMetadata {
  return {
    caseQuantity: null,
    quantityToAdd: null,
    vendorProductNumber: '',
    partSource: '',
    partSourceNumber: '',
    isKit: null,
    orderability: null,
  };
}

export function emptyVendorRawListing(): VendorRawListing {
  return {
    detailUrl: '',
    searchContext: { searchTerm: '' },
    config: { pid: '', vcpn: '' },
    titleHtml: '',
    shortDescription: '',
    longDescription: '',
    descriptionSegments: [],
    identifiers: {
      manufacturerPartNumber: '',
      keystonePartNumber: '',
      vendorProductNumber: '',
      partSourceNumber: '',
    },
    supplier: { name: '', code: '', url: '' },
    pricing: {
      retailPrice: null,
      costPrice: null,
      currency: 'USD',
      msrp: null,
    },
    attributes: [],
    volumetrics: [],
    features: [],
    documents: [],
    images: [],
    videos: [],
    cartMetadata: emptyVendorCartMetadata(),
    inventory: { rows: [] },
    kitInfo: null,
    inTheBox: [],
    fitment: [],
    restrictions: [],
    relatedProducts: [],
    embeddedJson: {},
  };
}
