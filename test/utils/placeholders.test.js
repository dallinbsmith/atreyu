import { expect } from '@esm-bundle/chai';
import { setConfig } from '../../scripts/ak.js';
import { fillPlaceholder, getPlaceholder } from '../../scripts/utils/placeholders.js';

describe('fillPlaceholder', () => {
  it('fills multiple distinct keys', () => {
    expect(fillPlaceholder('{name}, partner {current} of {total}', { name: 'Acme', current: 2, total: 5 }))
      .to.equal('Acme, partner 2 of 5');
  });

  it('fills every occurrence of a repeated key', () => {
    expect(fillPlaceholder('{n} and {n} again', { n: 'x' })).to.equal('x and x again');
  });

  it('leaves unknown keys intact', () => {
    expect(fillPlaceholder('{current} of {total} ({unknown})', { current: 1, total: 3 }))
      .to.equal('1 of 3 ({unknown})');
  });

  it('ignores inherited Object.prototype keys', () => {
    expect(fillPlaceholder('{constructor} {toString}', {})).to.equal('{constructor} {toString}');
  });

  it('inserts $&, $` and $\' in values literally', () => {
    expect(fillPlaceholder('Select {label}', { label: '$&' })).to.equal('Select $&');
    expect(fillPlaceholder('a {v} b', { v: '$`' })).to.equal('a $` b');
    expect(fillPlaceholder('a {v} b', { v: "$'" })).to.equal("a $' b");
    expect(fillPlaceholder('a {v} b', { v: '$$ $1' })).to.equal('a $$ $1 b');
  });

  it('stringifies numbers, including 0', () => {
    expect(fillPlaceholder('{current} of {total}', { current: 0, total: 10 })).to.equal('0 of 10');
  });

  it('does not re-substitute tokens that appear inside a value', () => {
    expect(fillPlaceholder('{name} {current}', { name: '{current}', current: 3 }))
      .to.equal('{current} 3');
  });

  it('returns a template with no tokens unchanged', () => {
    expect(fillPlaceholder('Carousel', { current: 1 })).to.equal('Carousel');
  });
});

describe('getPlaceholder', () => {
  let originalFetch;

  before(() => {
    setConfig({});
    originalFetch = window.fetch;
    window.fetch = (url, opts) => (url === '/system/placeholders.json'
      ? Promise.resolve(new Response(JSON.stringify({
        data: [
          { Key: 'blankRow', Text: '' },
          { Key: 'filledRow', Text: 'Localized' },
        ],
      })))
      : originalFetch(url, opts));
  });

  after(() => { window.fetch = originalFetch; });

  it('returns the authored text when present (case-insensitive key)', async () => {
    expect(await getPlaceholder('FILLEDROW', 'Fallback')).to.equal('Localized');
  });

  it('falls back when the authored row is blank', async () => {
    expect(await getPlaceholder('blankRow', 'Pause')).to.equal('Pause');
  });

  it('falls back when the key is missing', async () => {
    expect(await getPlaceholder('missingRow', 'Play')).to.equal('Play');
  });

  it('defaults the fallback to an empty string', async () => {
    expect(await getPlaceholder('missingRow')).to.equal('');
  });
});
