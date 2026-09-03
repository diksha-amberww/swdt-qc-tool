import type { ComparisonProfile } from './comparisonProfile';

export interface AmazonIdentifierGroup {
  marketplaceId?: string;
  identifiers: { identifierType: string; identifier: string }[];
}

export interface AmazonImageGroup {
  marketplaceId?: string;
  images: { variant?: string; link: string; height?: number; width?: number }[];
}

export interface AmazonRawListing {
  summaries: unknown[];
  attributes: Record<string, unknown>;
  identifiers: AmazonIdentifierGroup[];
  images: AmazonImageGroup[];
  dimensions: unknown[];
  productTypes: { marketplaceId?: string; productType?: string }[];
  relationships: unknown[];
  salesRanks: unknown[];
}

export interface AmazonListingJson {
  source: 'amazon_sp_api';
  fetchedAt: string;
  asin: string;
  marketplaceId: string;
  raw: AmazonRawListing;
  normalized: ComparisonProfile;
  title: string;
  brand: string;
  modelNumber: string;
  upc: string;
}

export function emptyAmazonRawListing(): AmazonRawListing {
  return {
    summaries: [],
    attributes: {},
    identifiers: [],
    images: [],
    dimensions: [],
    productTypes: [],
    relationships: [],
    salesRanks: [],
  };
}
