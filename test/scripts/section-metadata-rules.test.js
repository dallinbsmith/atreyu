import { expect } from '@esm-bundle/chai';
import { loadArea } from '../../scripts/ak.js';
import { promoteAnchors } from '../../scripts/scripts.js';
import { sectionKeyIssues } from '../../experiments-panel/sources.js';

// B2. Importing scripts.js runs loadPage(), which installs the real config,
// including the decorateArea hook. loadArea({ area }) then runs the real
// hook, ak.js decorateSections and the real section-metadata block.
const PROBE_URL = new URL('./fixtures/section-metadata/probe.plain.html', import.meta.url);

const mount = (html) => {
  const area = document.createElement('div');
  area.hidden = true; // keeps background <img loading="lazy"> from fetching
  area.innerHTML = html;
  document.body.append(area);
  return area;
};

// A client-built table, shaped like personalize.js audienceRow() and
// guard.js carryOverSectionMeta.
const table = (rows) => `<div class="section-metadata">${rows
  .map(([k, v]) => `<div><div>${k}</div><div>${v}</div></div>`).join('')}</div>`;

describe('section metadata follows the server rules (B2)', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  describe('server-flattened probe page (2026-09-25)', () => {
    let section;

    beforeEach(async () => {
      const area = mount(await (await fetch(PROBE_URL)).text());
      await loadArea({ area });
      section = area.querySelector(':scope > div');
    });

    it('keeps style classes and applies the layout values as classes', () => {
      expect([...section.classList]).to.include.members(['container', 'dark', 'section', 'grid', 'grid-3', 'layout-bento']);
      expect(section.dataset.grid).to.equal(undefined);
      expect(section.dataset.layout).to.equal(undefined);
    });

    it('keeps the background URL case', () => {
      expect(section.querySelector('.section-background img').getAttribute('src'))
        .to.match(/^https:\/\/example\.com\/Foo\.JPG\?/);
    });

    it('an authored Id wins over Anchor, and data-anchor is removed', () => {
      expect(section.id).to.equal('pricing');
      expect(section.hasAttribute('data-anchor')).to.equal(false);
    });

    it('leaves plugin-owned keys as the server wrote them, and the panel flags them', async () => {
      expect(section.dataset.audience).to.equal('Mobile');
      const issues = sectionKeyIssues(`<main>${await (await fetch(PROBE_URL)).text()}</main>`);
      expect(issues).to.have.length(1);
      expect(issues[0]).to.contain('Section 1').and.contain('"audience"');
    });
  });

  describe('Anchor hook (scripts.js promoteAnchors)', () => {
    it('turns data-anchor into a unique lowercase slug id and removes it', async () => {
      const heading = document.createElement('h2');
      heading.id = 'pricing-table';
      document.body.append(heading);
      const area = mount('<div data-anchor="Pricing Table"><p>a</p></div><div data-anchor="Pricing Table"><p>b</p></div>');
      await loadArea({ area });
      const sections = [...area.querySelectorAll(':scope > div')];
      expect(sections.map((s) => s.id)).to.deep.equal(['pricing-table-2', 'pricing-table-3']);
      expect(sections.some((s) => s.hasAttribute('data-anchor'))).to.equal(false);
    });

    it('document path: main > div[data-anchor], with no argument, is idempotent', () => {
      const main = document.createElement('main');
      main.innerHTML = '<div data-anchor="Pricing Table"><p>a</p></div>';
      document.body.append(main);
      const section = main.firstElementChild;
      promoteAnchors();
      expect(section.id).to.equal('pricing-table');
      expect(section.hasAttribute('data-anchor')).to.equal(false);
      promoteAnchors();
      expect(section.id).to.equal('pricing-table');
    });

    it('an existing id wins', () => {
      const area = mount('<div id="plans" data-anchor="Pricing Table"></div>');
      promoteAnchors(area);
      const [section] = area.children;
      expect(section.id).to.equal('plans');
      expect(section.hasAttribute('data-anchor')).to.equal(false);
    });

    it('sets no id when the anchor slugs to empty', () => {
      const area = mount('<div data-anchor="!!!"></div>');
      promoteAnchors(area);
      expect(area.children[0].hasAttribute('id')).to.equal(false);
    });

    it('only touches sections, not nested elements', () => {
      const area = mount('<div><p data-anchor="Inner">x</p></div>');
      promoteAnchors(area);
      expect(area.querySelector('p').dataset.anchor).to.equal('Inner');
    });
  });

  describe('ak.js client parser (tables built in the browser)', () => {
    it('parses a client-built Audience row and removes the table', async () => {
      const area = mount(`<div><p>Hero</p>${table([['Audience: mobile', '<a href="/v/mobile">/v/mobile</a>']])}</div>`);
      await loadArea({ area });
      const section = area.querySelector('.section');
      expect(section.querySelector('.section-metadata')).to.equal(null);
      expect(section.getAttribute('data-audience:-mobile')).to.equal(new URL('/v/mobile', window.location.href).href);
    });

    it('keeps mixed-case values as authored and classifies layout values', async () => {
      const area = mount(`<div><p>x</p>${table([['Layout', 'Bento'], ['Note', 'Keep Case']])}</div>`);
      await loadArea({ area });
      const section = area.querySelector('.section');
      expect(section.dataset.note).to.equal('Keep Case');
      expect(section.classList.contains('layout-bento')).to.equal(true);
    });

    it('keeps a background URL case as authored, end to end', async () => {
      const src = `${window.location.origin}/media/Foo.JPG`;
      const area = mount(`<div><p>x</p>${table([['Background', src]])}</div>`);
      await loadArea({ area });
      expect(area.querySelector('.section-background img').getAttribute('src')).to.contain('/media/Foo.JPG?');
    });

    it('turns style into classes, per paragraph, ignoring an empty entry', async () => {
      const area = mount(`<div><p>x</p>${table([['Style', '<p>Container, Dark,</p><p>Peek Background</p>']])}</div>`);
      await loadArea({ area });
      expect([...area.querySelector('.section').classList])
        .to.include.members(['container', 'dark', 'peek-background']);
    });

    it('joins comma-split text the way the server does', async () => {
      const area = mount(`<div><p>x</p>${table([['Experiment Variants', ' B , C ']])}</div>`);
      await loadArea({ area });
      expect(area.querySelector('.section').getAttribute('data-experiment-variants')).to.equal('B,C');
    });

    it('an Id row sets the id with the server rule, and wins over Anchor in either order', async () => {
      const area = mount([
        `<div><p>a</p>${table([['Id', '2026 Pricing']])}</div>`,
        `<div><p>b</p>${table([['Anchor', 'Deals'], ['Id', 'Offers']])}</div>`,
        `<div><p>c</p>${table([['Id', 'Promo'], ['Anchor', 'Deals']])}</div>`,
      ].join(''));
      await loadArea({ area });
      expect([...area.querySelectorAll('.section')].map((s) => s.id)).to.deep.equal(['pricing', 'offers', 'promo']);
    });

    it('de-duplicates an Anchor against its own detached area, like promoteAnchors', async () => {
      // A fragment is decorated before it is inserted, so document.querySelector
      // can't see its sibling ids; slugifyUnique is given section.getRootNode().
      const area = document.createElement('div');
      area.innerHTML = [
        '<div id="pricing-table"><p>a</p></div>',
        `<div><p>b</p>${table([['Anchor', 'Pricing Table']])}</div>`,
      ].join('');
      await loadArea({ area });
      expect([...area.querySelectorAll('.section')].map((s) => s.id))
        .to.deep.equal(['pricing-table', 'pricing-table-2']);
    });
  });
});
