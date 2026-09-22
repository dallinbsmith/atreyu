import { expect } from '@esm-bundle/chai';
import { setConfig, loadArea } from '../../scripts/ak.js';
import { redecorate } from '../../scripts/utils/lifecycle.js';
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

  it('UC-02: redecorates .footer-content via the real registered redecorator, keeping the wrapper class after a chrome-swap-style replacement', async () => {
    restoreFetch = stubFetch(fragmentHtml([legalSection, copyrightSection]));
    const el = block();
    await decorate(el);

    // Simulate experimentation.js's applyChallenger: replaceChildren() with
    // raw, undecorated variant content shaped like a real fetched
    // `.plain.html` response (two top-level <div> "sections"), then run the
    // exact same loadArea() + redecorate() sequence applyChallenger runs for
    // a selector-scoped (UC-02) swap.
    const footerTarget = el.querySelector('.footer-content');
    footerTarget.replaceChildren();
    footerTarget.insertAdjacentHTML('beforeend', '<div><ul><li><a href="/new-privacy">New Privacy</a></li></ul></div>');
    footerTarget.insertAdjacentHTML('beforeend', '<div><p>&copy; 2027 Frame.io. All rights reserved.</p></div>');

    await loadArea({ area: footerTarget });
    await redecorate('.footer-content', footerTarget);

    // The wrapper's own box-layout class must survive — this is the real bug
    // the Senior Software Engineer's review caught: a raw replaceChildren()
    // swap has no way to know .footer-content's layout CSS depends on this
    // class staying on the wrapper.
    expect(footerTarget.classList.contains('footer-content')).to.be.true;
    expect(footerTarget.querySelector('.section-legal a[href="/new-privacy"]')).to.exist;
    expect(footerTarget.querySelector('.section-copyright')?.textContent).to.include('2027');
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
