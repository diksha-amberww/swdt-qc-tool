export function normalizeUpcDigits(value: string | null | undefined): string {
  return (value || '').replace(/\D/g, '');
}

export function upcsMatch(a: string, b: string): boolean {
  const left = normalizeUpcDigits(a);
  const right = normalizeUpcDigits(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const pad = (v: string) => v.padStart(14, '0');
  if (pad(left) === pad(right)) return true;
  const stripLeading = (v: string) => v.replace(/^0+/, '') || '0';
  return stripLeading(left) === stripLeading(right);
}
