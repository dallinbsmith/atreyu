import { expect } from '@esm-bundle/chai';
import { setConfig } from '../../scripts/ak.js';

const setMeta = (name, content) => {
  let meta = document.head.querySelector(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = name;
    document.head.append(meta);
  }
  meta.content = content;
  return meta;
};

// lazy.js's module-scope IIFE (styles, SEO injection, dev-mode tooling) is a
// real one-shot bootstrap that should only ever run once — importing the
// real specifier (no cache-bust) exercises that exactly once for this whole
// file, matching production behavior, while still giving every test its own
// call to the exported, repeatedly-callable default().
let lazyModule;
// Stands in for the <link rel="canonical"> EDS renders server-side on every
// page (honoring x-forwarded-host behind the Worker); see the SEO test below.
const SERVER_CANONICAL = 'https://frame.io/features/c2c';
before(async () => {
  document.head.append(Object.assign(document.createElement('link'), { rel: 'canonical', href: SERVER_CANONICAL }));
  setConfig({
    components: [], hostnames: [], linkBlocks: [], log: () => {},
  });
  lazyModule = await import('../../scripts/lazy.js');
});

describe('scripts/lazy.js', () => {
  beforeEach(() => {
    document.body.innerHTML = '<footer></footer>';
  });

  afterEach(() => {
    document.head.querySelector('meta[name="footer"]')?.remove();
  });

  // The default export is intentionally re-invokable: DA Quick Edit can trigger
  // another document load after this module is cached, and footer decoration
  // must run against the fresh nodes.
  it('exports a callable default, distinct from the one-shot bootstrap IIFE', () => {
    expect(lazyModule.default).to.be.a('function');
  });

  // The server-rendered canonical is the single source of truth; two canonicals
  // are a signal Google ignores.
  it('leaves the server-rendered canonical as the only one', async () => {
    // Best-effort: the bootstrap's import chain isn't awaitable. A slower
    // injector could land later and slip past; this failed on the old code.
    await new Promise((resolve) => { setTimeout(resolve, 300); });
    const links = document.head.querySelectorAll('link[rel="canonical"]');
    expect(links).to.have.length(1);
    expect(links[0].href).to.equal(SERVER_CANONICAL);
  });

  it('re-applies footer metadata on every call, not just the first — the actual regression', async () => {
    setMeta('footer', 'dark');
    await lazyModule.default();
    expect(document.querySelector('footer').className).to.equal('dark');

    // Simulate a DA Quick Edit re-render: fresh, undecorated footer node plus
    // changed authored metadata — a second real loadArea() call must re-apply
    // to it, not silently no-op against the cached module.
    document.body.innerHTML = '<footer></footer>';
    setMeta('footer', 'light');
    await lazyModule.default();
    expect(document.querySelector('footer').className).to.equal('light');
  });

  it('removes the footer when metadata is "off", on a repeat call too', async () => {
    setMeta('footer', 'off');
    await lazyModule.default();
    expect(document.querySelector('footer')).to.not.exist;
  });
});
