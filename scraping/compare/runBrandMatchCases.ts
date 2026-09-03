import { brandMatchDetail, brandsMatch } from './brandComparator';

interface BrandCase {
  left: string;
  right: string;
  expect: boolean;
  note: string;
}

const CASES: BrandCase[] = [
  { left: 'VHT / Duplicolor', right: 'Dupli-Color', expect: true, note: 'screenshot: slash multi-brand vs hyphenated' },
  { left: 'Dupli-Color', right: 'Duplicolor', expect: true, note: 'hyphen vs one word' },
  { left: 'DUPLICOLOR', right: 'dupli color', expect: true, note: 'case + space vs compact' },
  { left: '3M', right: '3m', expect: true, note: 'short brand case difference' },
  { left: "O'Reilly", right: 'Oreilly', expect: true, note: 'apostrophe punctuation' },
  { left: 'ACDelco / GM', right: 'ACDelco', expect: true, note: 'partial multi-brand' },
  { left: 'Bosch', right: 'Bosch Automotive Tools', expect: true, note: 'containment of longer listing brand' },
  { left: 'GE', right: 'General Electric', expect: true, note: 'alias shortform/longform' },
  { left: 'LG Electronics', right: 'LG', expect: true, note: 'short token exact on longer brand' },
  { left: 'Hewlett-Packard', right: 'HP', expect: true, note: 'alias hyphenated longform' },
  { left: 'Sony', right: 'Samsung', expect: false, note: 'distinct brands' },
  { left: 'GE', right: 'Orange', expect: false, note: 'short brand must not contain-match' },
  { left: 'Pro', right: 'Professional', expect: false, note: 'short prefix must not fuzzy/contain' },
  { left: '', right: 'Bosch', expect: false, note: 'empty vendor' },
];

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function main(): void {
  for (const testCase of CASES) {
    const detail = brandMatchDetail(testCase.left, testCase.right);
    const reverse = brandsMatch(testCase.right, testCase.left);
    assert(
      detail.match === testCase.expect,
      `${testCase.note}: "${testCase.left}" vs "${testCase.right}" expected ${testCase.expect}, got ${detail.match} (${detail.reason})`,
    );
    assert(
      reverse === testCase.expect,
      `${testCase.note}: reverse "${testCase.right}" vs "${testCase.left}" expected ${testCase.expect}, got ${reverse}`,
    );
    console.log(
      `ok  ${testCase.expect ? 'MATCH   ' : 'NO MATCH'}  ${JSON.stringify(testCase.left)} ↔ ${JSON.stringify(testCase.right)}  [${detail.reason}]`,
    );
  }
  console.log(`\n${CASES.length} brand cases passed.`);
}

main();
