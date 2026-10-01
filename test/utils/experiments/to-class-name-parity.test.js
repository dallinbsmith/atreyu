import { expect } from '@esm-bundle/chai';
import { toClassName as akToClassName } from '../../../scripts/ak.js';
import { toClassName } from '../../../scripts/utils/experiments/config.js';

// config.js keeps its own copy so the experiments panel never loads ak.js.
// This table keeps the two from drifting apart.
const INPUTS = [
  // case and spaces
  'Hero', 'HERO TEST', 'hero test', '  Padded  ', 'Tab\tand\nnewline',
  // punctuation and runs of separators
  'A/B -- Test_2', 'foo.bar,baz', 'Launch: Q4!', 'a___b', 'x--y',
  // leading/trailing dashes and separators
  '-lead', 'trail-', '--both--', '-', '---', ' / ',
  // numbers
  '2026', '3 col', 'v2.0.1', 'Grid 6',
  // unicode
  'ÄBC', 'Café Crème', '日本語', 'naïve-🙂-emoji', 'straße',
  // empty and non-strings
  '', null, undefined, 0, 42, true, {}, ['a'], Symbol('s'),
];

const label = (v) => (typeof v === 'symbol' ? v.toString() : JSON.stringify(v) ?? String(v));

describe('toClassName parity: experiments/config.js vs ak.js', () => {
  INPUTS.forEach((input) => {
    it(`matches for ${label(input)}`, () => {
      expect(toClassName(input)).to.equal(akToClassName(input));
    });
  });

  it('agrees on known outputs (both copies, not just each other)', () => {
    const expected = [
      ['A/B -- Test_2', 'a-b-test-2'],
      ['--both--', 'both'],
      ['Café Crème', 'caf-cr-me'],
      ['3 col', '3-col'],
      ['', ''],
      [42, ''],
    ];
    expected.forEach(([input, out]) => {
      expect(toClassName(input), label(input)).to.equal(out);
      expect(akToClassName(input), label(input)).to.equal(out);
    });
  });
});
