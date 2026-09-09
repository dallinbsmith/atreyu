import { expect } from '@esm-bundle/chai';
import { setConfig } from '../../scripts/ak.js';
import decorate from '../../blocks/fragment/fragment.js';

// fragment.js fetches a fragment page (via loadFragmentWithFallback →
// loadFragment) and runs it through the real section-decoration pipeline
// (loadArea/decorateSections), so the fixture below is real fragment-page
// HTML — a <main> with top-level <div> sections — not a pre-built block.
// Same convention as test/blocks/footer.test.js.
const fragmentHtml = (sections) => `<html><body><main>${sections.map((s) => `<div>${s}</div>`).join('')}</main></body></html>`;

const stubFetch = (responder) => {
  const original = window.fetch;
  window.fetch = async (url) => responder(url);
  return () => { window.fetch = original; };
};

// Mirrors real EDS markup: an author-inserted fragment link, alone in its
// own paragraph, inside its own section — so getReplaceEl() walks all the
// way up to the section, matching production shape.
const block = (path) => {
  const section = document.createElement('div');
  section.className = 'section';
  const p = document.createElement('p');
  const a = document.createElement('a');
  a.className = 'fragment auto-block';
  a.href = path;
  p.append(a);
  section.append(p);
  document.body.append(section);
  return a;
};

describe('fragment', () => {
  let restoreFetch;
  afterEach(() => restoreFetch?.());

  describe('with a locale prefix configured', () => {
    before(() => {
      const meta = document.createElement('meta');
      meta.name = 'locale';
      meta.content = '/ja-jp';
      document.head.append(meta);
      setConfig({
        components: [], hostnames: [], linkBlocks: [], log: () => {}, locales: { '/ja-jp': {} },
      });
    });

    it('normal decoration: fetches the locale-prefixed path and replaces the anchor with fragment content', async () => {
      const requested = [];
      restoreFetch = stubFetch(async (url) => {
        requested.push(url);
        return new Response(fragmentHtml(['<p>Hello</p>']), { status: 200 });
      });
      const a = block('/system/fragments/foo');
      await decorate(a);
      expect(requested[0]).to.include('/ja-jp/system/fragments/foo');
      expect(document.body.textContent).to.include('Hello');
      expect(document.body.contains(a)).to.be.false;
    });

    it('locale fallback: falls back to the root path when the locale-prefixed path 404s', async () => {
      restoreFetch = stubFetch(async (url) => (url.includes('/ja-jp/')
        ? new Response('not found', { status: 404 })
        : new Response(fragmentHtml(['<p>Root fallback</p>']), { status: 200 })));
      const a = block('/system/fragments/bar');
      await decorate(a);
      expect(document.body.textContent).to.include('Root fallback');
      expect(document.body.contains(a)).to.be.false;
    });

    it('duplicate ids: two anchors decorated with the same path produce different DOM ids', async () => {
      restoreFetch = stubFetch(async () => new Response(fragmentHtml(['<p>Dup</p>']), { status: 200 }));
      const a1 = block('/system/fragments/dup');
      await decorate(a1);
      const a2 = block('/system/fragments/dup');
      await decorate(a2);
      const ids = [...document.querySelectorAll('.section')].map((el) => el.id).filter(Boolean);
      expect(ids.length).to.be.greaterThan(1);
      expect(new Set(ids).size).to.equal(ids.length);
    });

    it('double-decorate does not trigger a second fetch', async () => {
      let fetchCount = 0;
      restoreFetch = stubFetch(async () => {
        fetchCount += 1;
        return new Response(fragmentHtml(['<p>Once</p>']), { status: 200 });
      });
      const a = block('/system/fragments/once');
      await decorate(a);
      await decorate(a);
      expect(fetchCount).to.equal(1);
    });

    it('a fetch failure removes the anchor from the DOM and logs the error', async () => {
      const logged = [];
      setConfig({
        components: [],
        hostnames: [],
        linkBlocks: [],
        log: (ex) => logged.push(ex),
        locales: { '/ja-jp': {} },
      });
      restoreFetch = stubFetch(async () => new Response('nope', { status: 404 }));
      const a = block('/system/fragments/missing');
      await decorate(a);
      expect(document.body.contains(a)).to.be.false;
      expect(logged.length).to.be.greaterThan(0);
    });
  });
});
