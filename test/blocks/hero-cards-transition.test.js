import { expect } from '@esm-bundle/chai';
import sinon from 'sinon';
import decorate from '../../blocks/hero-cards-transition/hero-cards-transition.js';

// A single text-only row (no picture) is enough to exercise the CTA-classing
// path; collect() falls back to default poster tiles for the card wall.
const block = (html) => {
  const el = document.createElement('div');
  const row = document.createElement('div');
  row.innerHTML = html;
  el.append(row);
  document.body.append(el);
  return el;
};

// EDS-shaped multi-row block: each entry in `rows` is one authored row, and
// each string in that row's array becomes its own cell (row.children entry) —
// matching collect()'s `cells = [...row.children]` model, so a picture cell
// and its sibling chin-text cells can be authored as siblings, not nested.
const rowsBlock = (rows) => {
  const el = document.createElement('div');
  rows.forEach((cellsHtml) => {
    const row = document.createElement('div');
    cellsHtml.forEach((html) => {
      const cell = document.createElement('div');
      cell.innerHTML = html;
      row.append(cell);
    });
    el.append(row);
  });
  document.body.append(el);
  return el;
};

// Real IntersectionObserver timing is not deterministic in a headless test
// runner — swap the global constructor for a fake that just records how many
// times it was constructed (motion.js's onReveal and scroll.js's
// trackScrollProgress both look up the global `IntersectionObserver`
// identifier at call-time, not an imported binding, so this substitution
// works without touching either module). Restored in afterEach. Pattern
// matches footer-glow.test.js.
class FakeIntersectionObserver {
  constructor() {
    FakeIntersectionObserver.instances.push(this);
  }

  observe() {}

  unobserve() {}

  disconnect() {}
}
FakeIntersectionObserver.instances = [];

describe('hero-cards-transition CTA classing', () => {
  it('classes a plain CTA link positionally', () => {
    const el = block('<h1>Title</h1><p><a href="/a">A</a></p>');
    decorate(el);
    const a = el.querySelector('.hc-cta a');
    expect(a.classList.contains('btn-primary')).to.be.true;
  });

  it('does not override a link already classed .btn (e.g. by decorateButton)', () => {
    const el = block('<h1>Title</h1><p><a class="btn btn-accent" href="/a">A</a></p>');
    decorate(el);
    const a = el.querySelector('.hc-cta a');
    expect(a.classList.contains('btn-accent')).to.be.true;
    expect(a.classList.contains('btn-primary')).to.be.false;
  });
});

describe('hero-cards-transition collect() row classification', () => {
  it('detects a lone image with no sibling chin text as the section background', () => {
    const el = rowsBlock([
      ['<picture><img src="bg.jpg"></picture>'],
    ]);
    decorate(el);
    const bgImg = el.querySelector('.hc-bg img');
    expect(bgImg).to.exist;
    expect(bgImg.src).to.contain('bg.jpg');
    expect(el.querySelector('.hc-wall img[src$="bg.jpg"]')).to.not.exist;
  });

  it('a single-picture row with sibling chin text becomes one card, not the background', () => {
    const el = rowsBlock([
      ['<picture><img src="card.jpg"></picture>', 'Some Title', 'Some Author', '2024-01-01'],
    ]);
    decorate(el);
    expect(el.querySelector('.hc-bg')).to.not.exist;
    expect(el.querySelector('.hc-wall img[src$="card.jpg"]')).to.exist;
  });

  it('a multi-picture row becomes multiple cards', () => {
    const el = rowsBlock([
      ['<picture><img src="a.jpg"></picture>', '<picture><img src="b.jpg"></picture>'],
    ]);
    decorate(el);
    expect(el.querySelector('.hc-wall img[src$="a.jpg"]')).to.exist;
    expect(el.querySelector('.hc-wall img[src$="b.jpg"]')).to.exist;
  });

  it('chin metadata (title/author/date) reaches the rendered .hc-chin-* elements', () => {
    const el = rowsBlock([
      ['<picture><img src="card2.jpg"></picture>', 'My Title', 'My Author', '2024-01-15'],
    ]);
    decorate(el);
    const tile = [...el.querySelectorAll('.hc-tile')].find((t) => t.querySelector('img[src$="card2.jpg"]'));
    expect(tile.querySelector('.hc-chin-title').textContent).to.equal('My Title');
    expect(tile.querySelector('.hc-chin-author').textContent).to.equal('My Author');
    const expectedDate = new Date('2024-01-15')
      .toLocaleDateString(document.documentElement.lang || undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    expect(tile.querySelector('.hc-chin-date').textContent).to.equal(expectedDate);
  });
});

describe('hero-cards-transition "more" icon', () => {
  it('renders as a real SVG element, not an empty icon span', () => {
    const el = rowsBlock([['<h1>Title</h1>']]);
    decorate(el);
    const more = el.querySelector('.hc-tile .hc-more');
    expect(more).to.exist;
    expect(more.namespaceURI).to.equal('http://www.w3.org/2000/svg');
    expect(el.querySelector('.hc-tile span.icon')).to.not.exist;
  });
});

describe('hero-cards-transition re-decoration idempotency', () => {
  let originalIO;

  beforeEach(() => {
    originalIO = window.IntersectionObserver;
    window.IntersectionObserver = FakeIntersectionObserver;
    FakeIntersectionObserver.instances = [];
  });

  afterEach(() => {
    window.IntersectionObserver = originalIO;
    sinon.restore();
  });

  it('double-decorate does not corrupt title/CTA content, duplicate scroll tracking, or change tile count', () => {
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
    const el = rowsBlock([
      ['<h1>Title</h1>'],
      ['<p><a href="/a">Go</a></p>'],
    ]);

    decorate(el);
    const tileCountBefore = el.querySelectorAll('.hc-tile').length;
    const titleBefore = el.querySelector('.hc-title')?.textContent;
    const ctaCountBefore = el.querySelectorAll('.hc-cta').length;
    const ioCountBefore = FakeIntersectionObserver.instances.length;
    expect(titleBefore).to.equal('Title');
    expect(ctaCountBefore).to.equal(1);
    expect(ioCountBefore).to.be.greaterThan(0);

    decorate(el);

    expect(el.querySelectorAll('.hc-tile').length).to.equal(tileCountBefore);
    expect(el.querySelector('.hc-title')?.textContent).to.equal(titleBefore);
    expect(el.querySelectorAll('.hc-cta').length).to.equal(ctaCountBefore);
    expect(FakeIntersectionObserver.instances.length).to.equal(ioCountBefore);
  });
});
