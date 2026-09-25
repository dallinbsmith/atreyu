import { expect } from '@esm-bundle/chai';
import { setConfig, loadArea } from '../../scripts/ak.js';
import { redecorate } from '../../scripts/utils/lifecycle.js';
import decorate from '../../blocks/header/header.js';

// header.js and its sibling files are one block (split by concern), one test
// file covering all of them,
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

// Real bug found authoring actual nav content, 2026-09-21: these fixtures
// used to hand-author the mega-menu's ALREADY-RESOLVED shape
// (`.fragment-content > .section > .default-content`) directly inside the
// header fragment's own HTML, never exercising the real nested-fragment-link
// resolution path (blocks/fragment/fragment.js -> scripts/utils/fragment.js's
// replaceElWithFragment) at all. That assumed shape was wrong — every
// mega-menu authored in real DA content resolves to a single top-level
// section, which replaceElWithFragment UNWRAPS (discards its own
// `.fragment-content` wrapper, splices the bare section in place) — so
// production shipped a permanently-open, unstyled mega-menu with these
// tests all green. Fixed by routing a real second fetch through `stubFetch`
// for the nested fragment link, exercising the actual resolution pipeline.
const navWithRealMegaMenu = (megaMenuPath) => '<ul><li><p><a href="#">Features</a></p>'
  + `<p><a href="${megaMenuPath}">Features menu</a></p></li>`
  + '<li><p><a href="/pricing">Pricing</a></p></li></ul>';

// The common real shape (one top-level section) — what fragment.js's
// replaceElWithFragment() actually UNWRAPS, discarding `.fragment-content`.
const oneSectionMegaMenu = fragmentHtml(['<h3>Analytics</h3><ul><li><a href="/reports">Reports</a></li><li><a href="/insights">Insights</a></li></ul>']);

// The other real shape (2+ top-level sections) — the one case where
// replaceElWithFragment DOES preserve `.fragment-content`. Both shapes must
// resolve to a working, closed-by-default mega-menu.
const twoSectionMegaMenu = fragmentHtml([
  '<h3>Analytics</h3><ul><li><a href="/a">A</a></li></ul>',
  '<h3>Analytics</h3><ul><li><a href="/b">B</a></li></ul>',
]);

// The real Enterprise shape, confirmed against DA content
// (/system/fragments/nav/header/enterprise): TWO heading+list pairs
// authored as flat siblings inside a SINGLE top-level section — not two
// separate sections. fragment.js unwraps this to the single-section shape
// (oneSectionMegaMenu's case), and heading.nextElementSibling already
// handles multiple pairs as plain siblings regardless of section nesting.
const twoGroupsOneSectionMegaMenu = fragmentHtml([
  '<h3>Industries</h3><ul><li><a href="/enterprise">Overview</a></li></ul>'
  + '<h3>Use Cases</h3><ul><li><a href="/enterprise/video-workflows">Video</a></li></ul>',
]);

const headingNoListMegaMenu = fragmentHtml(['<h3>Just a heading</h3><p>Some text, no list.</p>']);

// A mega-menu item authored with no subcategory heading at all — just a
// bare list. Real content today is always heading+list, but nothing
// guarantees every future item will have a label (ref_mega_menu_and_layer_
// order_findings memory).
const looseListMegaMenu = fragmentHtml(['<ul><li><a href="/x">X</a></li><li><a href="/y">Y</a></li></ul>']);

// Code-review fix regression (real bug): a shell holding a recognized
// heading+list group PLUS other sibling content (here, a trailing
// paragraph+link) used to be judged "emptied" the moment the group was
// extracted, silently destroying the paragraph along with the shell.
const mixedContentMegaMenu = fragmentHtml([
  '<h3>Analytics</h3><ul><li><a href="/reports">Reports</a></li></ul><p>Need help? <a href="/contact">Contact us</a>.</p>',
]);

const actionsSection = '<p><a href="/tools/widgets/scheme"><span class="icon icon-scheme"></span>Scheme</a></p>'
  + '<p><a href="/tools/widgets/language"><span class="icon icon-language"></span>Language</a></p>';

const languageFragmentHtml = fragmentHtml(['<ul><li><a href="/en-us">English</a></li><li><a href="/ja-jp">Japanese</a></li></ul>']);

// Distinguishes the lazily-fetched /languages fragment from the eagerly
// fetched header fragment itself, and counts language fetches so the
// in-flight-guard regression test (Fix 3) can assert exactly one fetch.
const stubFetch = (headerHtml, megaMenuRoutes = {}) => {
  const original = window.fetch;
  let languageFetchCount = 0;
  window.fetch = async (url) => {
    const href = String(url);
    // Checked before the general header path below — a mega-menu route's
    // path is always a sub-path of the header fragment's own path.
    const megaMenuMatch = Object.entries(megaMenuRoutes).find(([path]) => href.includes(path));
    if (megaMenuMatch) return new Response(megaMenuMatch[1], { status: 200 });
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
    // Real bug found authoring actual nav content, 2026-09-21: `linkBlocks: []`
    // here meant the fragment auto-block pattern (scripts.js's real
    // `{ fragment: '/system/fragments/' }`) could never match anything, so
    // every mega-menu test below was silently exercising zero real fragment
    // resolution — matching real production config closes that gap, not
    // just the hand-authored-fixture one.
    setConfig({
      components: ['fragment', 'schedule'],
      hostnames: [],
      linkBlocks: [{ fragment: '/system/fragments/' }, { schedule: '/schedules/' }],
      log: () => {},
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

  it('stamps .mega-menu on the resolved fragment and toggles the item without following the href (real single-section shape)', async () => {
    const stub = stubFetch(
      fragmentHtml([brandSection, navWithRealMegaMenu('/system/fragments/nav/header/features-1'), actionsSection]),
      { '/system/fragments/nav/header/features-1': oneSectionMegaMenu },
    );
    restoreFetch = stub.restore;
    const el = block();
    await decorate(el);

    const item = el.querySelector('.main-nav-item');
    const link = item.querySelector('.main-nav-link');
    const menu = item.querySelector('.mega-menu');
    expect(menu).to.exist;
    expect(menu.querySelector('a[href="/reports"]')).to.exist;
    // The actual production bug: without the fix, no element ever gets
    // .mega-menu (fragment.js strips .fragment-content for this single-
    // section shape), so the content renders permanently visible/unstyled
    // instead of closed-by-default.
    expect(menu.classList.contains('is-open')).to.be.false;
    expect(link.getAttribute('aria-expanded')).to.equal('false');

    link.click();
    expect(item.classList.contains('is-open')).to.be.true;
    expect(link.getAttribute('aria-expanded')).to.equal('true');
  });

  it('prepends an h2 mirroring the trigger link\'s own text, sibling to .mega-menu-links (Fix 3, 2026-09-21 parity pass)', async () => {
    const stub = stubFetch(
      fragmentHtml([brandSection, navWithRealMegaMenu('/system/fragments/nav/header/heading-1'), actionsSection]),
      { '/system/fragments/nav/header/heading-1': oneSectionMegaMenu },
    );
    restoreFetch = stub.restore;
    const el = block();
    await decorate(el);

    const menu = el.querySelector('.mega-menu');
    const heading = menu.querySelector('.mega-menu-heading');
    expect(heading?.tagName).to.equal('H2');
    // navWithRealMegaMenu's trigger link (the first <p><a>, matched by
    // `:scope > p > a`) is "Features" — the second link ("Features menu")
    // is the fragment-resolving link, never the trigger itself.
    expect(heading?.textContent).to.equal('Features');
    // Not a grid item alongside the real content — a separate element
    // entirely, so it can never consume one of .mega-menu-links' auto-fit
    // columns.
    expect(menu.querySelector('.mega-menu-links').contains(heading)).to.be.false;
    expect(menu.firstElementChild).to.equal(heading);
  });

  it('also stamps .mega-menu when fragment.js preserves .fragment-content (real multi-section shape)', async () => {
    const stub = stubFetch(
      fragmentHtml([brandSection, navWithRealMegaMenu('/system/fragments/nav/header/features-2'), actionsSection]),
      { '/system/fragments/nav/header/features-2': twoSectionMegaMenu },
    );
    restoreFetch = stub.restore;
    const el = block();
    await decorate(el);

    const menu = el.querySelector('.main-nav-item .mega-menu');
    expect(menu).to.exist;
    expect(menu.querySelectorAll('a[href="/a"], a[href="/b"]')).to.have.length(2);
  });

  it('groups a mega-menu heading immediately followed by a <ul> into an ARIA-labelled .nav-subcategory', async () => {
    const stub = stubFetch(
      fragmentHtml([brandSection, navWithRealMegaMenu('/system/fragments/nav/header/subcats-1'), actionsSection]),
      { '/system/fragments/nav/header/subcats-1': oneSectionMegaMenu },
    );
    restoreFetch = stub.restore;
    const el = block();
    await decorate(el);

    const group = el.querySelector('.nav-subcategory');
    expect(group).to.exist;
    const heading = group.querySelector('h3');
    expect(heading.id).to.be.a('string').and.not.empty;
    expect(group.getAttribute('role')).to.equal('group');
    expect(group.getAttribute('aria-labelledby')).to.equal(heading.id);
    expect(group.querySelector('ul li a[href="/reports"]')).to.exist;
  });

  it('assigns distinct de-duped ids to two subcategory groups sharing the same heading text', async () => {
    // Asserts the real property under test (de-dup produces two DIFFERENT
    // ids) rather than an exact literal starting point — this test file
    // never removes a decorated header between tests (pre-existing
    // convention, not this test's to fix), so an earlier test's leftover
    // "Analytics" heading can shift what slugifyUnique's first available
    // suffix actually is; a leaked stale id must not make this test flaky.
    const stub = stubFetch(
      fragmentHtml([brandSection, navWithRealMegaMenu('/system/fragments/nav/header/subcats-2'), actionsSection]),
      { '/system/fragments/nav/header/subcats-2': twoSectionMegaMenu },
    );
    restoreFetch = stub.restore;
    const el = block();
    await decorate(el);

    const groups = el.querySelectorAll('.nav-subcategory');
    expect(groups).to.have.length(2);
    const [firstHeading, secondHeading] = [...groups].map((g) => g.querySelector('h3'));
    expect(firstHeading.id).to.be.a('string').and.not.empty;
    expect(secondHeading.id).to.be.a('string').and.not.empty;
    expect(firstHeading.id).to.not.equal(secondHeading.id);
    expect(groups[0].getAttribute('aria-labelledby')).to.equal(firstHeading.id);
    expect(groups[1].getAttribute('aria-labelledby')).to.equal(secondHeading.id);
  });

  it('leaves a mega-menu heading with no following <ul> undecorated (no .nav-subcategory wrapper)', async () => {
    const stub = stubFetch(
      fragmentHtml([brandSection, navWithRealMegaMenu('/system/fragments/nav/header/no-list')]),
      { '/system/fragments/nav/header/no-list': headingNoListMegaMenu },
    );
    restoreFetch = stub.restore;
    const el = block();
    await decorate(el);

    expect(el.querySelector('.nav-subcategory')).to.not.exist;
    expect(el.querySelector('.mega-menu h3')?.textContent).to.equal('Just a heading');
    // Real bug found building the structural flatten below: nothing was
    // extracted from this item's wrapper (no .nav-subcategory, no loose
    // <ul>), so it must be left completely untouched rather than deleted
    // wholesale along with its real content. Flatten target is
    // .mega-menu-links (header-nav.js's wrapper for flattened content,
    // sibling of .mega-menu-heading), not .mega-menu itself — see Fix 3
    // (2026-09-21 parity pass).
    expect(el.querySelector('.mega-menu-links').children).to.have.length(1);
  });

  // Structural flatten (ref_mega_menu_and_layer_order_findings memory): CSS
  // Grid only distributes an element's DIRECT children. Before this fix,
  // `.mega-menu` always had exactly 1 direct child (whichever wrapper shape
  // fragment.js's unwrap produced) regardless of how many real subcategory
  // groups existed 1-2 DOM levels below — so `grid-template-columns` always
  // saw 1 item. These tests assert the real DOM shape after decoration, not
  // just that the groups/lists exist somewhere in the subtree.
  it('flattens a single .nav-subcategory directly onto .mega-menu-links, discarding the wrapper shell (real single-section shape)', async () => {
    const stub = stubFetch(
      fragmentHtml([brandSection, navWithRealMegaMenu('/system/fragments/nav/header/flatten-1'), actionsSection]),
      { '/system/fragments/nav/header/flatten-1': oneSectionMegaMenu },
    );
    restoreFetch = stub.restore;
    const el = block();
    await decorate(el);

    // Flatten target is .mega-menu-links (header-nav.js's wrapper for the
    // flattened content, sibling of the real .mega-menu-heading — see Fix 3,
    // 2026-09-21 parity pass), not .mega-menu itself.
    const menu = el.querySelector('.mega-menu');
    const links = menu.querySelector('.mega-menu-links');
    expect(links.children).to.have.length(1);
    expect(links.children[0].classList.contains('nav-subcategory')).to.be.true;
    expect(menu.querySelector('.section, .fragment-content, .default-content')).to.not.exist;
  });

  it('flattens two .nav-subcategory groups directly onto .mega-menu-links, discarding the wrapper shell (real multi-section shape)', async () => {
    const stub = stubFetch(
      fragmentHtml([brandSection, navWithRealMegaMenu('/system/fragments/nav/header/flatten-2'), actionsSection]),
      { '/system/fragments/nav/header/flatten-2': twoSectionMegaMenu },
    );
    restoreFetch = stub.restore;
    const el = block();
    await decorate(el);

    const menu = el.querySelector('.mega-menu');
    const links = menu.querySelector('.mega-menu-links');
    expect(links.children).to.have.length(2);
    expect([...links.children].every((child) => child.classList.contains('nav-subcategory'))).to.be.true;
    expect(menu.querySelector('.section, .fragment-content, .default-content')).to.not.exist;
    expect(menu.querySelectorAll('a[href="/a"], a[href="/b"]')).to.have.length(2);
  });

  it('flattens two heading+list pairs authored as flat siblings in one section (real Enterprise shape)', async () => {
    const stub = stubFetch(
      fragmentHtml([brandSection, navWithRealMegaMenu('/system/fragments/nav/header/flatten-3'), actionsSection]),
      { '/system/fragments/nav/header/flatten-3': twoGroupsOneSectionMegaMenu },
    );
    restoreFetch = stub.restore;
    const el = block();
    await decorate(el);

    const menu = el.querySelector('.mega-menu');
    const links = menu.querySelector('.mega-menu-links');
    expect(links.children).to.have.length(2);
    expect([...links.children].every((child) => child.classList.contains('nav-subcategory'))).to.be.true;
    expect(menu.querySelector('.section, .fragment-content, .default-content')).to.not.exist;
    expect(menu.querySelector('a[href="/enterprise"]')).to.exist;
    expect(menu.querySelector('a[href="/enterprise/video-workflows"]')).to.exist;
  });

  it('flattens a heading-less <ul> directly onto .mega-menu-links as a bare list, not wrapped in .nav-subcategory', async () => {
    const stub = stubFetch(
      fragmentHtml([brandSection, navWithRealMegaMenu('/system/fragments/nav/header/loose-list'), actionsSection]),
      { '/system/fragments/nav/header/loose-list': looseListMegaMenu },
    );
    restoreFetch = stub.restore;
    const el = block();
    await decorate(el);

    const menu = el.querySelector('.mega-menu');
    const links = menu.querySelector('.mega-menu-links');
    expect(links.children).to.have.length(1);
    expect(links.children[0].tagName).to.equal('UL');
    expect(links.children[0].classList.contains('nav-subcategory')).to.be.false;
    expect(menu.querySelector('a[href="/x"]')).to.exist;
    expect(menu.querySelector('.section, .fragment-content, .default-content')).to.not.exist;
  });

  it('does not destroy sibling content when a shell has both a recognized group and other content (code-review fix)', async () => {
    const stub = stubFetch(
      fragmentHtml([brandSection, navWithRealMegaMenu('/system/fragments/nav/header/mixed'), actionsSection]),
      { '/system/fragments/nav/header/mixed': mixedContentMegaMenu },
    );
    restoreFetch = stub.restore;
    const el = block();
    await decorate(el);

    const menu = el.querySelector('.mega-menu');
    // The recognized group still extracts correctly...
    expect(menu.querySelector('.nav-subcategory a[href="/reports"]')).to.exist;
    // ...but the trailing paragraph+link must survive somewhere under
    // .mega-menu, not be silently deleted along with the shell it lived in.
    expect(menu.querySelector('a[href="/contact"]')).to.exist;
    expect(menu.textContent).to.include('Need help?');
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

  it('cta: prefix labels a link as .action-primary regardless of list position and strips the prefix from the displayed text', async () => {
    const ctaFirst = '<p><a href="/signup">cta: Sign up</a></p><p><a href="/login">Log in</a></p>';
    const stub = stubFetch(fragmentHtml([brandSection, navSection, ctaFirst]));
    restoreFetch = stub.restore;
    const el = block();
    await decorate(el);

    const actions = el.querySelector('.actions-section');
    const primary = actions.querySelector('.action-primary');
    expect(primary?.getAttribute('href')).to.equal('/signup');
    expect(primary?.textContent.trim()).to.equal('Sign up');
    expect(actions.querySelector('a[href="/login"]').classList.contains('action-primary')).to.be.false;
  });

  it('cta: prefix on a link that is not last still wins over the last-link fallback', async () => {
    const ctaNotLast = '<p><a href="/login">Log in</a></p>'
      + '<p><a href="/signup">cta: Sign up</a></p>'
      + '<p><a href="/pricing">See pricing</a></p>';
    const stub = stubFetch(fragmentHtml([brandSection, navSection, ctaNotLast]));
    restoreFetch = stub.restore;
    const el = block();
    await decorate(el);

    const actions = el.querySelector('.actions-section');
    expect(actions.querySelectorAll('.action-primary')).to.have.length(1);
    expect(actions.querySelector('.action-primary').getAttribute('href')).to.equal('/signup');
    expect(actions.querySelector('a[href="/pricing"]').classList.contains('action-primary')).to.be.false;
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

  it('UC-02: redecorates .main-nav-section via the real registered redecorator after a chrome-swap-style replacement', async () => {
    const stub = stubFetch(fragmentHtml([brandSection, navSection, actionsSection]));
    restoreFetch = stub.restore;
    const el = block();
    await decorate(el);

    // Simulate experimentation.js's applyChallenger: replaceChildren() with
    // raw, undecorated variant content shaped like a real fetched
    // `.plain.html` response (a top-level <div> "section" wrapping the new
    // nav markup), then run the exact same loadArea() + redecorate()
    // sequence applyChallenger runs for a selector-scoped (UC-02) swap.
    const navTarget = el.querySelector('.main-nav-section');
    navTarget.replaceChildren();
    navTarget.insertAdjacentHTML('beforeend', '<div><ul><li><p><a href="/new-feature">New Feature</a></p></li></ul></div>');

    await loadArea({ area: navTarget });
    await redecorate('.main-nav-section', navTarget);

    expect(navTarget.querySelector('nav > ul.main-nav-list')).to.exist;
    const newLink = navTarget.querySelector('a[href="/new-feature"]');
    expect(newLink.closest('.main-nav-item')).to.exist;
    expect(newLink.closest('.main-nav-item').querySelector('.main-nav-link')).to.equal(newLink);
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
