export type ModelMatchReason =
  | 'empty'
  | 'exact'
  | 'containment'
  | 'zero_normalized'
  | 'token_overlap'
  | 'mismatch';

export interface ModelMatchDetail {
  match: boolean;
  reason: ModelMatchReason;
  vendorNormalized: string;
  amazonNormalized: string;
}

const MIN_CONTAINMENT_LEN = 3;

/** Lowercase, keep alphanumerics only — kills spaces, dashes, slashes, symbols, case. */
export function normalizeModel(value: string): string {
  return (value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** Strip leading zeros inside numeric runs: bgm0521 -> bgm521, 0089 -> 89. */
function zeroStrip(value: string): string {
  return value.replace(/\d+/g, (run) => String(Number(run)));
}

/** Split into letter/digit tokens: s24bgm0521 -> [s, 24, bgm, 0521]. */
function modelTokens(value: string): string[] {
  return value.match(/[a-z]+|\d+/g) || [];
}

/**
 * Lenient model/part-number comparison.
 * YES on: exact, prefix/suffix containment (vendor codes like S24/DPL around the core),
 * leading-zero differences, and shared concurrent token cores.
 * NO only when the alphanumeric cores are genuinely different.
 */
export function modelMatchDetail(vendorModel: string, amazonModel: string): ModelMatchDetail {
  const v = normalizeModel(vendorModel);
  const a = normalizeModel(amazonModel);
  const detail = (reason: ModelMatchReason, match: boolean): ModelMatchDetail => ({
    match,
    reason,
    vendorNormalized: v,
    amazonNormalized: a,
  });

  if (!v || !a) return detail('empty', false);
  if (v === a) return detail('exact', true);

  // Prefix/suffix containment: BGM0521 inside S24BGM0521 / DPLBGM0521.
  const shorter = v.length <= a.length ? v : a;
  const longer = v.length <= a.length ? a : v;
  if (shorter.length >= MIN_CONTAINMENT_LEN && longer.includes(shorter)) {
    return detail('containment', true);
  }

  // Leading-zero tolerant comparison: BGM0521 vs BGM521.
  const vz = zeroStrip(v);
  const az = zeroStrip(a);
  if (vz === az) return detail('zero_normalized', true);
  const shorterZ = vz.length <= az.length ? vz : az;
  const longerZ = vz.length <= az.length ? az : vz;
  if (shorterZ.length >= MIN_CONTAINMENT_LEN && longerZ.includes(shorterZ)) {
    return detail('zero_normalized', true);
  }

  // Token overlap: every token of the smaller set appears (zero-normalized) in the other.
  const vt = modelTokens(vz);
  const at = modelTokens(az);
  if (vt.length && at.length) {
    const [small, big] = vt.length <= at.length ? [vt, at] : [at, vt];
    const significant = small.filter((t) => t.length >= 2 || /\d/.test(t));
    if (
      significant.length > 0 &&
      significant.every((t) => big.some((o) => o === t || o.includes(t) || t.includes(o)))
    ) {
      return detail('token_overlap', true);
    }
  }

  return detail('mismatch', false);
}

export function modelsMatch(vendorModel: string, amazonModel: string): boolean {
  return modelMatchDetail(vendorModel, amazonModel).match;
}
