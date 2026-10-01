import { expect } from '@esm-bundle/chai';
import { setConfig } from '../../scripts/ak.js';

// Separate file from schedule.test.js: getLocale reads the locale <meta> inside
// setConfig, so the meta must exist first, and this file's config must not
// share a page with schedule.test.js's (wtr runs each file in its own page).
const meta = document.createElement('meta');
meta.name = 'locale';
meta.content = '/ja-jp';
document.head.append(meta);
setConfig({
  components: [], hostnames: [], linkBlocks: [], locales: { '': {}, '/ja-jp': {} }, log: () => {},
});
const { default: decorate } = await import('../../blocks/schedule/schedule.js');

const page = (text) => `<html><body><main><div><p>${text}</p></div></main></body></html>`;

describe('schedule on a locale page', () => {
  let original;
  let section;
  beforeEach(() => { original = window.fetch; });
  afterEach(() => {
    window.fetch = original;
    section?.remove();
  });
  after(() => {
    meta.remove();
    setConfig({ components: [], hostnames: [], linkBlocks: [], log: () => {} });
  });

  it('falls back to the root event fragment when the locale copy 404s', async () => {
    const requested = [];
    window.fetch = async (url) => {
      requested.push(String(url));
      if (String(url).endsWith('.json')) {
        const fragment = `${window.location.origin}/system/fragments/promo`;
        return new Response(JSON.stringify({ data: [{ name: 'default', start: '', end: '', fragment }] }));
      }
      if (url === '/system/fragments/promo') return new Response(page('Root promo'));
      return new Response('not found', { status: 404 });
    };
    section = document.createElement('div');
    section.className = 'section';
    const a = document.createElement('a');
    a.href = '/schedules/test.json';
    section.append(a, document.createElement('p'));
    document.body.append(section);
    await decorate(a);
    expect(requested.slice(1)).to.deep.equal(['/ja-jp/system/fragments/promo', '/system/fragments/promo']);
    expect(section.textContent).to.include('Root promo');
  });

  it('still prefers the translated event fragment when it exists', async () => {
    window.fetch = async (url) => {
      if (String(url).endsWith('.json')) {
        const fragment = `${window.location.origin}/system/fragments/promo`;
        return new Response(JSON.stringify({ data: [{ name: 'default', start: '', end: '', fragment }] }));
      }
      return new Response(page(url === '/ja-jp/system/fragments/promo' ? 'JA promo' : 'Root promo'));
    };
    section = document.createElement('div');
    section.className = 'section';
    const a = document.createElement('a');
    a.href = '/schedules/test.json';
    section.append(a, document.createElement('p'));
    document.body.append(section);
    await decorate(a);
    expect(section.textContent).to.include('JA promo');
    expect(section.textContent).to.not.include('Root promo');
  });

  it('accepts a relative fragment path and fetches each candidate once when all fail', async () => {
    const requested = [];
    window.fetch = async (url) => {
      requested.push(String(url));
      if (String(url).endsWith('.json')) {
        return new Response(JSON.stringify({ data: [{ name: 'default', start: '', end: '', fragment: '/system/fragments/gone' }] }));
      }
      return new Response('not found', { status: 404 });
    };
    section = document.createElement('div');
    section.className = 'section';
    const a = document.createElement('a');
    a.href = '/schedules/test.json';
    section.append(a, document.createElement('p'));
    document.body.append(section);
    await decorate(a);
    expect(requested.slice(1)).to.deep.equal(['/ja-jp/system/fragments/gone', '/system/fragments/gone']);
  });
});
