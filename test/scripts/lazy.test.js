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
before(async () => {
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

  // Bug-squash fix, 2026-09-18: lazy.js used to be a bare top-level IIFE with
  // no export — ak.js's `import('./lazy.js')` on a second loadArea() call
  // (DA Quick Edit's re-render) resolved the already-cached module without
  // re-running anything, so footer/pzn never re-decorated past the first
  // page load. A real default export is the fix; this pins that it exists
  // and is a genuinely re-invokable function, not a one-shot side effect.
  it('exports a callable default, distinct from the one-shot bootstrap IIFE', () => {
    expect(lazyModule.default).to.be.a('function');
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
