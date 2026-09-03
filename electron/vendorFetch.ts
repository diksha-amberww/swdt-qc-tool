import { session } from 'electron';
import { SEAWIDE_PERSIST_PARTITION } from './seawideLogin';
import type { FetchLike } from '../scraping/vendor/seawideHttpClient';

export function getVendorPartitionFetch(): FetchLike {
  const ses = session.fromPartition(SEAWIDE_PERSIST_PARTITION);
  return async (url, init) => {
    const response = await ses.fetch(url, {
      method: init?.method || 'GET',
      headers: init?.headers as Record<string, string> | undefined,
      redirect: 'follow',
    });
    return response as unknown as Response;
  };
}
