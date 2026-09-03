import {
  buildDetailUrl,
  parseSearchResultPids,
  type HttpGetResult,
  type SearchDetailLink,
} from './seawideHttpClient';
import { extractSid } from './textUtils';

export interface SearchResolution {
  pid: string;
  detailHref: string;
  sid?: string;
  rcid?: string;
  rpos?: string;
  matchType: 'exact_model' | 'first_result';
  candidateCount: number;
}

export function scoreSearchDetailLink(link: SearchDetailLink, vendorModel?: string): number {
  let score = 0;
  if (link.rcid) score += 4;
  if (link.sid) score += 4;
  if (link.rpos) score += 2;
  const wanted = (vendorModel || '').trim().toLowerCase();
  if (wanted && link.pid.toLowerCase() === wanted) score += 12;
  return score;
}

function rankSearchCandidates(links: SearchDetailLink[], vendorModel?: string): SearchDetailLink[] {
  return [...links]
    .map((link) => ({ link, score: scoreSearchDetailLink(link, vendorModel) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.link);
}

export function resolvePidFromSearch(
  searchPage: HttpGetResult,
  vendorModel?: string,
): SearchResolution | null {
  const candidates = rankSearchCandidates(parseSearchResultPids(searchPage.html), vendorModel);
  if (candidates.length === 0) return null;

  const searchSid = extractSid(searchPage.finalUrl) || extractSid(searchPage.html);
  const chosen = candidates[0];
  const sid = chosen.sid || searchSid || undefined;

  const detailHref =
    chosen.rcid || sid
      ? buildDetailUrl(chosen.pid, {
          sid,
          rcid: chosen.rcid,
          rpos: chosen.rpos,
        })
      : chosen.href;

  const wanted = (vendorModel || '').trim().toLowerCase();
  const exact = wanted ? chosen.pid.toLowerCase() === wanted : false;

  return {
    pid: chosen.pid,
    detailHref,
    sid,
    rcid: chosen.rcid,
    rpos: chosen.rpos,
    matchType: exact ? 'exact_model' : 'first_result',
    candidateCount: candidates.length,
  };
}
