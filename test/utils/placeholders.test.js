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
          { Key: 'freeTrialCta', Text: 'Start Free Trial' },
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

  it('resolves bare (un-namespaced) keys, like the live freeTrialCta, from the legacy sheet', async () => {
    expect(await getPlaceholder('freeTrialCta', 'x')).to.equal('Start Free Trial');
  });
});

describe('getPlaceholder namespaces', () => {
  let originalFetch;
  let calls;
  const sheets = {
    '/system/placeholders.json': [{ Key: 'freeTrialCta', Text: 'Start Free Trial' }, { Key: 'submit', Text: 'Legacy' }],
    '/system/placeholders/forms.json': [{ Key: 'submit', Text: 'Send' }, { Key: 'blank', Text: '' }],
    '/system/placeholders/tile-table.json': [{ Key: 'prev', Text: 'Back' }],
    '/ja-jp/system/placeholders/forms.json': [{ Key: 'submit', Text: '送信' }],
  };
  const setLocale = (prefix) => {
    document.head.querySelector('meta[name="locale"]')?.remove();
    if (prefix) document.head.append(Object.assign(document.createElement('meta'), { name: 'locale', content: prefix }));
    setConfig({ locales: { '': {}, '/ja-jp': {} } });
  };
  const count = (url) => calls.filter((u) => u === url).length;

  before(() => {
    originalFetch = window.fetch;
    window.fetch = (url) => {
      calls.push(url);
      return Promise.resolve(sheets[url]
        ? new Response(JSON.stringify({ data: sheets[url] }))
        : new Response('', { status: 404 }));
    };
  });
  beforeEach(() => {
    calls = [];
    setLocale('');
  });
  after(() => {
    window.fetch = originalFetch;
    setLocale('');
  });

  it('routes a namespaced key to its sheet, matching the name case-insensitively', async () => {
    expect(await getPlaceholder('forms.SUBMIT', 'Submit')).to.equal('Send');
    expect(await getPlaceholder('tile-table.prev', 'Previous')).to.equal('Back');
  });

  it('never reads a namespaced key from the legacy sheet', async () => {
    expect(await getPlaceholder('media.submit', 'Fallback')).to.equal('Fallback');
    expect(count('/system/placeholders.json')).to.equal(0);
  });

  it('fetches a namespace once and only when a key in it is used', async () => {
    sheets['/system/placeholders/controls.json'] = [{ Key: 'pause', Text: 'Stop' }];
    await Promise.all([getPlaceholder('controls.pause'), getPlaceholder('controls.play')]);
    expect(await getPlaceholder('controls.pause')).to.equal('Stop');
    expect(count('/system/placeholders/controls.json')).to.equal(1);
    expect(calls).to.deep.equal(['/system/placeholders/controls.json']);
  });

  it('does not cache a failed fetch', async () => {
    await getPlaceholder('nav.main', 'Main');
    await getPlaceholder('nav.main', 'Main');
    expect(count('/system/placeholders/nav.json')).to.equal(2);
  });

  it('falls back on a blank row', async () => {
    expect(await getPlaceholder('forms.blank', 'Fallback')).to.equal('Fallback');
  });

  it('reads the locale prefix and falls back to code, not English, on a miss', async () => {
    setLocale('/ja-jp');
    expect(await getPlaceholder('forms.submit', 'Submit')).to.equal('送信');
    expect(await getPlaceholder('tile-table.prev', 'Previous')).to.equal('Previous');
    expect(calls).to.include('/ja-jp/system/placeholders/tile-table.json');
    expect(count('/system/placeholders/tile-table.json')).to.equal(0);
  });
});
