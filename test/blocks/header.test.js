import { expect } from '@esm-bundle/chai';
import { setConfig } from '../../scripts/ak.js';
import decorate from '../../blocks/header/header.js';

// header.js/header-nav.js/header-actions.js are one block (three source
// files under a 100-line-each budget) — one test file covering all three,
// matching this project's existing precedent for other multi-file blocks
// (form.test.js covers form.js + form-*.js, quote-interactive.test.js
// covers quote-interactive.js + its siblings; neither splits per source file).

// Real fragment-page shape: a <main> with top-level <div> sections, same as
// footer.test.js — header.js fetches this via loadFragmentWithFallback →
// loadFragment, which runs the real section-decoration pipeline
// (loadArea/decorateSections), not a pre-built block.
const fragmentHtml = (sections) => `<html><body><main>${sections.map((s) => `<div>${s}</div>`).join('')}</main></body></html>`;

// Realistic whitespace-containing brand markup (regression for Fix 4): the
// leading text node ("\n  ") lands at childNodes[0], the <img> at [1] — the
// old children.length > 1 ? children[1] : children[0] logic picked the
// image instead of the "Frame.io" text node.
const brandSection = `<p><a href="/">
  <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E" alt="">
  Frame.io
</a></p>`;

const navSection = '<ul><li><p><a href="/features">Features</a></p></li>'
  + '<li><p><a href="/pricing">Pricing</a></p></li></ul>';

const navWithMega = '<ul><li><p><a href="/features">Features</a></p>'
  + '<div class="fragment-content"><div class="section">Column</div></div></li>'
  + '<li><p><a href="/pricing">Pricing</a></p></li></ul>';

const actionsSection = '<p><a href="/tools/widgets/scheme"><span class="icon icon-scheme"></span>Scheme</a></p>'
  + '<p><a href="/tools/widgets/language"><span class="icon icon-language"></span>Language</a></p>';

const languageFragmentHtml = fragmentHtml(['<ul><li><a href="/en-us">English</a></li><li><a href="/ja-jp">Japanese</a></li></ul>']);

// Distinguishes the lazily-fetched /languages fragment from the eagerly
// fetched header fragment itself, and counts language fetches so the
// in-flight-guard regression test (Fix 3) can assert exactly one fetch.
const stubFetch = (headerHtml) => {
  const original = window.fetch;
  let languageFetchCount = 0;
  window.fetch = async (url) => {
    const href = String(url);
    if (href.includes('/languages')) {
      languageFetchCount += 1;
      return new Response(languageFragmentHtml, { status: 200 });
    }
    if (href.includes('/system/fragments/nav/header')) {
      return new Response(headerHtml, { status: 200 });
    }
    return original(url);
  };
  return {
    restore: () => { window.fetch = original; },
    languageFetchCount: () => languageFetchCount,
  };
};

const block = () => {
  const el = document.createElement('header');
  el.className = 'header';
  document.body.append(el);
  return el;
};

const tick = (ms = 50) => new Promise((r) => { setTimeout(r, ms); });

describe('header', () => {
  before(() => {
    setConfig({
      components: [], hostnames: [], linkBlocks: [], log: () => {},
    });
  });

  let restoreFetch;
  afterEach(() => restoreFetch?.());

  it('normal order: brand/nav/actions classified correctly', async () => {
    const stub = stubFetch(fragmentHtml([brandSection, navSection, actionsSection]));
    restoreFetch = stub.restore;
    const el = block();
    await decorate(el);

    const brand = el.querySelector('.brand-section');
    const nav = el.querySelector('.main-nav-section');
    const actions = el.querySelector('.actions-section');
    expect(brand?.querySelector('a')).to.exist;
    expect(nav?.querySelector('nav > ul.main-nav-list')).to.exist;
    expect(actions).to.exist;
  });

  it('reordered sections (actions, brand, nav) still classify by content shape', async () => {
    const stub = stubFetch(fragmentHtml([actionsSection, brandSection, navSection]));
    restoreFetch = stub.restore;
    const el = block();
    await decorate(el);

    const brand = el.querySelector('.brand-section');
    const nav = el.querySelector('.main-nav-section');
    const actions = el.querySelector('.actions-section');
    expect(brand?.querySelector('ul')).to.not.exist;
    expect(brand?.querySelectorAll('a')).to.have.length(1);
    expect(nav?.querySelector('ul')).to.exist;
    expect(actions?.querySelector('ul')).to.not.exist;
    expect(brand).to.not.equal(nav);
    expect(nav).to.not.equal(actions);
  });

  it('stamps .mega-menu on nested fragment content and toggles the item without following the href', async () => {
    const stub = stubFetch(fragmentHtml([brandSection, navWithMega, actionsSection]));
    restoreFetch = stub.restore;
    const el = block();
    await decorate(el);

    const item = el.querySelector('.main-nav-item');
    const link = item.querySelector('.main-nav-link');
    const menu = item.querySelector('.fragment-content.mega-menu');
    expect(menu).to.exist;
    expect(item.querySelector('.mega-menu .fragment-content')).to.not.exist;
    expect(link.getAttribute('aria-expanded')).to.equal('false');

    link.click();
    expect(item.classList.contains('is-open')).to.be.true;
    expect(link.getAttribute('aria-expanded')).to.equal('true');
  });

  it('classifies the last actions-section content link as .action-primary instead of relying on a structural selector', async () => {
    const realLinksActions = '<p><a href="/login">Log in</a></p><p><a href="/signup">Sign up</a></p>';
    const stub = stubFetch(fragmentHtml([brandSection, navSection, realLinksActions]));
    restoreFetch = stub.restore;
    const el = block();
    await decorate(el);

    const actions = el.querySelector('.actions-section');
    const primary = actions.querySelector('.action-primary');
    expect(primary?.textContent.trim()).to.equal('Sign up');
    expect(actions.querySelector('a[href="/login"]').classList.contains('action-primary')).to.be.false;
  });

  it('stamps .action-primary on the last real CTA even when widget markers follow it', async () => {
    const mixed = '<p><a href="/login">Log in</a></p>'
      + '<p><a href="/signup">Sign up</a></p>'
      + '<p><a href="/tools/widgets/scheme"><span class="icon icon-scheme"></span>Scheme</a></p>';
    const stub = stubFetch(fragmentHtml([brandSection, navSection, mixed]));
    restoreFetch = stub.restore;
    const el = block();
    await decorate(el);

    const actions = el.querySelector('.actions-section');
    expect(actions.querySelector('.action-primary')?.textContent.trim()).to.equal('Sign up');
    expect(actions.querySelector('.action-wrapper.scheme')).to.exist;
  });

  it('treats a brand section that also holds the nav toggle as brand, not actions', async () => {
    const brandWithToggle = `${brandSection}`
      + '<p><a href="/tools/widgets/toggle"><span class="icon icon-more"></span>Menu</a></p>';
    const stub = stubFetch(fragmentHtml([brandWithToggle, navSection, actionsSection]));
    restoreFetch = stub.restore;
    const el = block();
    await decorate(el);

    expect(el.querySelector('.brand-section .brand-text')?.textContent.trim()).to.equal('Frame.io');
    expect(el.querySelector('.brand-section .action-wrapper.toggle')).to.exist;
    expect(el.querySelector('.actions-section .action-wrapper.toggle')).to.not.exist;
  });

  it('moves a nav toggle authored in the actions section into brand', async () => {
    const actionsWithToggle = `${actionsSection}`
      + '<p><a href="/tools/widgets/toggle"><span class="icon icon-toggle"></span>Menu</a></p>';
    const stub = stubFetch(fragmentHtml([brandSection, navSection, actionsWithToggle]));
    restoreFetch = stub.restore;
    const el = block();
    await decorate(el);

    expect(el.querySelector('.brand-section .action-wrapper.toggle')).to.exist;
    expect(el.querySelector('.actions-section .action-wrapper.toggle')).to.not.exist;
  });

  it('double-decorate does not duplicate content', async () => {
    const stub = stubFetch(fragmentHtml([brandSection, navSection, actionsSection]));
    restoreFetch = stub.restore;
    const el = block();
    await decorate(el);
    await decorate(el);

    expect(el.querySelectorAll('.header-content')).to.have.length(1);
    expect(el.querySelectorAll('.brand-section')).to.have.length(1);
    expect(el.querySelectorAll('.main-nav-section')).to.have.length(1);
    expect(el.querySelectorAll('.actions-section')).to.have.length(1);
    expect(el.querySelectorAll('button')).to.have.length(2);
  });

  it('brand link with whitespace-containing markup extracts the text node, not the image', async () => {
    const stub = stubFetch(fragmentHtml([brandSection, navSection, actionsSection]));
    restoreFetch = stub.restore;
    const el = block();
    await decorate(el);

    const brandText = el.querySelector('.brand-text');
    expect(brandText?.textContent.trim()).to.equal('Frame.io');
    expect(brandText?.querySelector('img')).to.not.exist;
    expect(el.querySelector('.brand-section img')).to.exist;
  });

  it('language toggle: rapid double-click only fetches once and produces exactly one .language.menu', async () => {
    const stub = stubFetch(fragmentHtml([brandSection, navSection, actionsSection]));
    restoreFetch = stub.restore;
    const el = block();
    await decorate(el);

    const btn = el.querySelector('button[aria-label="Select language"]');
    btn.click();
    btn.click();
    await tick();

    expect(stub.languageFetchCount()).to.equal(1);
    expect(el.querySelectorAll('.language.menu')).to.have.length(1);
  });

  it('language toggle: aria-expanded is set on init and flips on toggle', async () => {
    const stub = stubFetch(fragmentHtml([brandSection, navSection, actionsSection]));
    restoreFetch = stub.restore;
    const el = block();
    await decorate(el);

    const btn = el.querySelector('button[aria-label="Select language"]');
    expect(btn.getAttribute('aria-expanded')).to.equal('false');

    btn.click();
    await tick();
    expect(btn.getAttribute('aria-expanded')).to.equal('true');

    btn.click();
    await tick();
    expect(btn.getAttribute('aria-expanded')).to.equal('false');
  });

  it('closing a dropdown does not drop Escape handling while mobile nav is open', async () => {
    const actionsWithToggle = `${actionsSection}`
      + '<p><a href="/tools/widgets/toggle"><span class="icon icon-toggle"></span>Menu</a></p>';
    const stub = stubFetch(fragmentHtml([brandSection, navSection, actionsWithToggle]));
    restoreFetch = stub.restore;
    const el = block();
    await decorate(el);

    el.querySelector('.action-wrapper.toggle button').click();
    const lang = el.querySelector('button[aria-label="Select language"]');
    lang.click();
    await tick();
    lang.click();
    await tick();

    expect(el.classList.contains('is-mobile-open')).to.be.true;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(el.classList.contains('is-mobile-open')).to.be.false;
  });

  it('Escape closes an open dropdown before the mobile nav', async () => {
    const actionsWithToggle = `${actionsSection}`
      + '<p><a href="/tools/widgets/toggle"><span class="icon icon-toggle"></span>Menu</a></p>';
    const stub = stubFetch(fragmentHtml([brandSection, navSection, actionsWithToggle]));
    restoreFetch = stub.restore;
    const el = block();
    await decorate(el);

    el.querySelector('.action-wrapper.toggle button').click();
    const lang = el.querySelector('button[aria-label="Select language"]');
    lang.click();
    await tick();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(el.querySelector('.actions-section.is-open')).to.not.exist;
    expect(el.classList.contains('is-mobile-open')).to.be.true;

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(el.classList.contains('is-mobile-open')).to.be.false;
  });
});
