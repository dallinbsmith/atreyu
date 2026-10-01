import { expect } from '@esm-bundle/chai';
import { setConfig } from '../../scripts/ak.js';
import { getReplaceEl, localeCandidates } from '../../scripts/utils/fragment.js';

// getLocale() reads <meta name="locale"> first, so a test can pick the current
// locale without navigating.
const useLocale = (prefix) => {
  document.head.querySelector('meta[name="locale"]')?.remove();
  if (prefix) {
    const meta = document.createElement('meta');
    meta.name = 'locale';
    meta.content = prefix;
    document.head.append(meta);
  }
  setConfig({
    components: [], hostnames: [], linkBlocks: [], log: () => {}, locales: { '': {}, '/ja-jp': {}, '/de-de': {} },
  });
};

describe('scripts/utils/fragment.js localeCandidates', () => {
  after(() => useLocale(''));

  it('root locale: just the path, no duplicate', () => {
    useLocale('');
    expect(localeCandidates('/system/fragments/foo')).to.deep.equal(['/system/fragments/foo']);
  });

  it('locale page: locale copy first, then root', () => {
    useLocale('/ja-jp');
    expect(localeCandidates('/system/fragments/foo')).to.deep.equal(['/ja-jp/system/fragments/foo', '/system/fragments/foo']);
  });

  it('strips an already-applied current prefix instead of doubling it', () => {
    useLocale('/ja-jp');
    expect(localeCandidates('/ja-jp/system/fragments/foo')).to.deep.equal(['/ja-jp/system/fragments/foo', '/system/fragments/foo']);
  });

  it('leaves a path under another locale alone', () => {
    useLocale('/ja-jp');
    expect(localeCandidates('/de-de/system/fragments/foo')).to.deep.equal(['/de-de/system/fragments/foo']);
  });

  it('respects the prefix boundary: /ja-jpx is not /ja-jp', () => {
    useLocale('/ja-jp');
    expect(localeCandidates('/ja-jpx/foo')).to.deep.equal(['/ja-jp/ja-jpx/foo', '/ja-jpx/foo']);
  });

  it('leaves an absolute or protocol-relative URL alone', () => {
    useLocale('/ja-jp');
    expect(localeCandidates('https://example.com/foo')).to.deep.equal(['https://example.com/foo']);
    expect(localeCandidates('//example.com/foo')).to.deep.equal(['//example.com/foo']);
  });

  it('carries a query/hash through unchanged', () => {
    useLocale('/ja-jp');
    expect(localeCandidates('/foo?x=1#y')).to.deep.equal(['/ja-jp/foo?x=1#y', '/foo?x=1#y']);
  });
});

describe('scripts/utils/fragment.js getReplaceEl', () => {
  it('returns the anchor itself when it has siblings inside its section', () => {
    const section = document.createElement('div');
    section.className = 'section';
    const a = document.createElement('a');
    section.append(a, document.createElement('span'));
    expect(getReplaceEl(a)).to.equal(a);
  });

  it('climbs a single-child wrapper chain, stopping at the section boundary', () => {
    const section = document.createElement('div');
    section.className = 'section';
    const wrapper = document.createElement('div');
    const a = document.createElement('a');
    wrapper.append(a); // a is wrapper's only child
    section.append(wrapper); // wrapper is section's only child
    document.createElement('main').append(section); // section needs a parent to insert after
    // climbs a -> wrapper -> stops at ancestor (section)
    expect(getReplaceEl(a)).to.equal(section);
  });

  // Regression: a detached anchor (or one outside any `.section`) has
  // ancestor === null; without the parentElement guard the loop climbed past
  // the tree root and threw on null.children.
  it('returns null (does not throw) on a detached anchor with no section ancestor', () => {
    const a = document.createElement('a');
    expect(() => getReplaceEl(a)).to.not.throw();
    expect(getReplaceEl(a)).to.be.null;
  });

  // The climb can end on the root of a detached subtree: still nowhere to
  // insert, so null rather than a node whose `.after()` is a silent no-op.
  it('returns null when the climb ends on a parentless wrapper', () => {
    const wrapper = document.createElement('p');
    const a = document.createElement('a');
    wrapper.append(a);
    expect(getReplaceEl(a)).to.be.null;
  });
});
