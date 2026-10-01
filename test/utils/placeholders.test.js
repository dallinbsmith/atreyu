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
  let originalWarn;
  let calls;
  let warnings;
  const sheets = {
    '/system/placeholders/forms.json': [
      { Key: 'submit', Text: 'Send' },
      { Key: 'blank', Text: '' },
      { Key: 'a.b', Text: 'Dotted' },
    ],
    '/system/placeholders/tile-table.json': [{ Key: 'prev', Text: 'Back' }],
    '/system/placeholders/controls.json': [{ Key: 'pause', Text: 'Stop' }],
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
    originalWarn = console.warn;
    console.warn = (msg) => warnings.push(msg);
    window.fetch = (url) => {
      calls.push(url);
      if (url.endsWith('/flaky.json')) return Promise.resolve(new Response('', { status: 503 }));
      return Promise.resolve(sheets[url]
        ? new Response(JSON.stringify({ data: sheets[url] }))
        : new Response('', { status: 404 }));
    };
  });
  beforeEach(() => {
    calls = [];
    warnings = [];
    setLocale('');
  });
  after(() => {
    window.fetch = originalFetch;
    console.warn = originalWarn;
    setLocale('');
  });

  it('routes a namespaced key to its sheet, matching the row key case-insensitively', async () => {
    expect(await getPlaceholder('forms.SUBMIT', 'Submit')).to.equal('Send');
    expect(await getPlaceholder('tile-table.prev', 'Previous')).to.equal('Back');
  });

  it('treats only the text before the first dot as the namespace', async () => {
    expect(await getPlaceholder('forms.a.b', 'Fallback')).to.equal('Dotted');
  });

  it('never reads the legacy sheet for a key missing from its namespace', async () => {
    expect(await getPlaceholder('media.freeTrialCta', 'Fallback')).to.equal('Fallback');
    expect(calls).to.deep.equal(['/system/placeholders/media.json']);
  });

  it('returns the fallback for a bare key without fetching, and warns', async () => {
    expect(await getPlaceholder('freeTrialCta', 'Fallback')).to.equal('Fallback');
    expect(calls).to.deep.equal([]);
    expect(warnings).to.have.length(1);
  });

  it('rejects an invalid namespace or empty row key without fetching', async () => {
    for (const key of ['...x', 'Forms.submit', '.foo', 'forms.', 'f0rms.x', '-x.y']) {
      expect(await getPlaceholder(key, 'Fallback')).to.equal('Fallback');
    }
    expect(calls).to.deep.equal([]);
    expect(warnings).to.have.length(6);
  });

  it('fetches a namespace once and only when a key in it is used', async () => {
    await Promise.all([getPlaceholder('controls.pause'), getPlaceholder('controls.play')]);
    expect(await getPlaceholder('controls.pause')).to.equal('Stop');
    expect(calls).to.deep.equal(['/system/placeholders/controls.json']);
  });

  it('does not cache a transient failure', async () => {
    await getPlaceholder('flaky.main', 'Main');
    await getPlaceholder('flaky.main', 'Main');
    expect(count('/system/placeholders/flaky.json')).to.equal(2);
  });

  it('fetches a missing (404) sheet once across staggered calls', async () => {
    setLocale('/ja-jp');
    expect(await getPlaceholder('pricing.monthly', 'Monthly')).to.equal('Monthly');
    expect(await getPlaceholder('pricing.yearly', 'Yearly')).to.equal('Yearly');
    expect(await getPlaceholder('pricing.monthly', 'Monthly')).to.equal('Monthly');
    expect(count('/ja-jp/system/placeholders/pricing.json')).to.equal(1);
  });

  it('falls back on a blank row or a missing key', async () => {
    expect(await getPlaceholder('forms.blank', 'Pause')).to.equal('Pause');
    expect(await getPlaceholder('forms.missing', 'Play')).to.equal('Play');
  });

  it('defaults the fallback to an empty string', async () => {
    expect(await getPlaceholder('forms.missing')).to.equal('');
  });

  it('reads the locale prefix and falls back to code, not English, on a miss', async () => {
    setLocale('/ja-jp');
    expect(await getPlaceholder('forms.submit', 'Submit')).to.equal('送信');
    expect(await getPlaceholder('tile-table.prev', 'Previous')).to.equal('Previous');
    expect(calls).to.include('/ja-jp/system/placeholders/tile-table.json');
    expect(count('/system/placeholders/tile-table.json')).to.equal(0);
  });
});
