import {
  amazonApiHost,
  getAmazonAccessToken,
  resolveAmazonCredentials,
  type AmazonCredentials,
} from './amazonTokenProvider';

export const CATALOG_INCLUDED_DATA =
  'attributes,identifiers,images,summaries,dimensions,productTypes,relationships,salesRanks';

export async function fetchCatalogItem(
  asin: string,
  creds: AmazonCredentials = resolveAmazonCredentials(),
): Promise<{ status: number; body: Record<string, unknown> }> {
  const { accessToken } = await getAmazonAccessToken(creds);
  const host = amazonApiHost(creds.region);
  const url = new URL(`${host}/catalog/2022-04-01/items/${encodeURIComponent(asin)}`);
  url.searchParams.set('marketplaceIds', creds.marketplaceId);
  url.searchParams.set('includedData', CATALOG_INCLUDED_DATA);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'x-amz-access-token': accessToken,
      accept: 'application/json',
      'user-agent': 'SWDT-Vendor-QC/1.0 (Language=TypeScript)',
    },
  });

  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, body };
}
