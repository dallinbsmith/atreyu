import { expect } from '@esm-bundle/chai';
import { setConfig } from '../../scripts/ak.js';
import decorate from '../../blocks/footer/footer.js';

// footer.js fetches a fragment page (via loadFragmentWithFallback →
// loadFragment) and runs it through the real section-decoration pipeline
// (loadArea/decorateSections), so the fixture below is real fragment-page
// HTML — a <main> with two top-level <div> sections — not a pre-built block.
const fragmentHtml = (sections) => `<html><body><main>${sections.map((s) => `<div>${s}</div>`).join('')}</main></body></html>`;

const legalSection = '<ul><li><a href="/privacy">Privacy</a></li><li><a href="/terms">Terms</a></li></ul>';
const copyrightSection = '<p>&copy; 2026 Frame.io. All rights reserved.</p>';

const stubFetch = (html) => {
  const original = window.fetch;
  window.fetch = async () => new Response(html, { status: 200 });
  return () => { window.fetch = original; };
};

const block = () => {
  const el = document.createElement('footer');
  el.className = 'footer';
  document.body.append(el);
  return el;
};

describe('footer', () => {
  before(() => {
    setConfig({
      components: [], hostnames: [], linkBlocks: [], log: () => {},
    });
  });

  let restoreFetch;
  afterEach(() => restoreFetch?.());

  it('normal order: legal (ul) and copyright (p) get correct classes', async () => {
    restoreFetch = stubFetch(fragmentHtml([legalSection, copyrightSection]));
    const el = block();
    await decorate(el);
    const legal = el.querySelector('.section-legal');
    const copyright = el.querySelector('.section-copyright');
    expect(legal?.querySelector('ul a')).to.exist;
    expect(copyright?.querySelector('p')).to.exist;
  });

  it('reordered sections (copyright fetched first, legal second) still classify by content shape', async () => {
    restoreFetch = stubFetch(fragmentHtml([copyrightSection, legalSection]));
    const el = block();
    await decorate(el);
    const legal = el.querySelector('.section-legal');
    const copyright = el.querySelector('.section-copyright');
    expect(legal?.querySelector('ul')).to.exist;
    expect(copyright?.querySelector('p')).to.exist;
    expect(legal).to.not.equal(copyright);
  });

  it('fewer than 2 sections does not throw and appends fragment as-is', async () => {
    restoreFetch = stubFetch(fragmentHtml([copyrightSection]));
    const el = block();
    await decorate(el); // would reject/throw here if the guard regressed
    expect(el.querySelector('.footer-content')).to.exist;
    expect(el.querySelector('.section-legal')).to.not.exist;
    expect(el.querySelector('.section-copyright')).to.not.exist;
  });

  it('double-decorate does not duplicate content', async () => {
    restoreFetch = stubFetch(fragmentHtml([legalSection, copyrightSection]));
    const el = block();
    await decorate(el);
    await decorate(el);
    expect(el.querySelectorAll('.footer-content')).to.have.length(1);
    expect(el.querySelectorAll('.section-legal')).to.have.length(1);
    expect(el.querySelectorAll('.section-copyright')).to.have.length(1);
  });
});
