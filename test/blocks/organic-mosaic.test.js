import { expect } from '@esm-bundle/chai';
import sinon from 'sinon';
import decorate from '../../blocks/organic-mosaic/organic-mosaic.js';

// These tests exercise both decoration paths. The deterministic STATIC branch
// (hardwareConcurrency = 1 -> shouldAnimate() is false) is the reduced-motion /
// save-data / low-power resting DOM: every authored media renders into a valid
// mosaic grid, and no scroll tracking is wired. The ANIMATING branch
// (hardwareConcurrency = 8) is asserted structurally too -- per the
// logo-tile-wall review lesson that unasserted animation paths hide
// regressions -- by stubbing IntersectionObserver so trackScrollProgress fires
// synchronously and checking the scrub wiring (is-scrubbing + a real --progress).

const imgCell = (alt = 'tile') => `<p><picture><source srcset="/x.webp" type="image/webp"><img src="/x.png" alt="${alt}"></picture></p>`;
const videoCell = (alt = 'clip') => `<p><a href="https://example.com/clip.mp4"><picture><img src="/poster.png" alt="${alt}"></picture></a></p>`;

const block = (rows) => {
  const el = document.createElement('div');
  el.className = 'organic-mosaic';
  rows.forEach((cells) => {
    const r = document.createElement('div');
    cells.forEach((html) => {
      const c = document.createElement('div');
      c.innerHTML = html;
      r.append(c);
    });
    el.append(r);
  });
  document.body.append(el);
  return el;
};

// n image cells, each in its own row/cell (the natural media-only authoring).
const gallery = (n) => block([...Array(n)].map((_, i) => [imgCell(`tile ${i}`)]));

const columnsOf = (el) => [...el.querySelectorAll('.organic-mosaic-column')];
const tilesOf = (el) => [...el.querySelectorAll('.organic-mosaic-tile')];
const alts = (el) => [...el.querySelectorAll('.organic-mosaic-tile img')].map((img) => img.getAttribute('alt'));

// scroll.js's trackScrollProgress looks up the global `IntersectionObserver` at
// call-time and its rAF-scheduled update() is real (not stubbed). Swapping the
// global constructor for a fake that CAPTURES each instance lets a test (a) fire
// the "near viewport" entry deterministically and (b) assert how many observers
// a block created -- so double-decorate can be proven to create no second one.
// Pattern matches image-sequence.test.js / hero-cards-transition.test.js.
class FakeIntersectionObserver {
  constructor(callback, options) {
    this.callback = callback;
    this.options = options;
    FakeIntersectionObserver.instances.push(this);
  }

  observe(target) { this.target = target; }

  unobserve() {}

  disconnect() {}
}
FakeIntersectionObserver.instances = [];

// Waits a couple of real animation frames so scroll.js's scheduled update()
// (which writes --progress) has actually run before we assert on it.
const nextFrames = (n = 2) => [...Array(n)].reduce(
  (p) => p.then(() => new Promise((resolve) => { requestAnimationFrame(resolve); })),
  Promise.resolve(),
);

describe('organic-mosaic', () => {
  afterEach(() => sinon.restore());

  describe('static (reduced-motion) branch', () => {
    beforeEach(() => sinon.stub(navigator, 'hardwareConcurrency').value(1));

    it('renders every authored media as a tile distributed across four columns', () => {
      const el = gallery(8);
      decorate(el);
      expect(tilesOf(el)).to.have.length(8);
      expect(columnsOf(el)).to.have.length(4);
      // Round-robin: 8 tiles / 4 columns = 2 tiles each, no empty column.
      columnsOf(el).forEach((col) => {
        expect(col.querySelectorAll('.organic-mosaic-tile')).to.have.length(2);
      });
    });

    it('renders the minimum authored set (5) with no empty/broken column', () => {
      const el = gallery(5);
      decorate(el);
      expect(tilesOf(el)).to.have.length(5);
      expect(columnsOf(el)).to.have.length(4);
      // 5 into 4 columns round-robin -> [2,1,1,1]; every column has >=1 tile.
      const counts = columnsOf(el).map((c) => c.querySelectorAll('.organic-mosaic-tile').length);
      expect(counts).to.deep.equal([2, 1, 1, 1]);
    });

    it('an odd count (7) that does not divide evenly still leaves no empty column', () => {
      const el = gallery(7);
      decorate(el);
      const counts = columnsOf(el).map((c) => c.querySelectorAll('.organic-mosaic-tile').length);
      expect(counts).to.deep.equal([2, 2, 2, 1]);
      counts.forEach((n) => expect(n).to.be.greaterThan(0));
    });

    it('degrades gracefully below the column count (3 media -> 3 columns, none empty)', () => {
      const el = gallery(3);
      decorate(el);
      expect(columnsOf(el)).to.have.length(3);
      columnsOf(el).forEach((col) => {
        expect(col.querySelectorAll('.organic-mosaic-tile')).to.have.length(1);
      });
    });

    it('reuses the authored picture verbatim and preserves author alt (meaningful and decorative)', () => {
      const el = block([[imgCell('Editor timeline'), imgCell('')]]);
      decorate(el);
      expect(alts(el)).to.deep.equal(['Editor timeline', '']);
      // The optimized <source> from EDS is kept, not stripped/rebuilt.
      expect(tilesOf(el)[0].querySelector('picture source')).to.exist;
    });

    it('two <picture>s in one cell each become their own tile (nothing vanishes)', () => {
      const el = block([[`${imgCell('first')}${imgCell('second')}`], [imgCell('third')]]);
      decorate(el);
      expect(alts(el)).to.deep.equal(['first', 'second', 'third']);
    });

    it('a video (.mp4-linked) media cell falls back to its static poster, link unwrapped', () => {
      const el = block([[videoCell('promo clip')], [imgCell('a')], [imgCell('b')]]);
      decorate(el);
      // shouldAnimate() is false here: decorateVideoMedia unwraps the link and
      // keeps the poster picture -- no <video>, valid static resting DOM.
      expect(el.querySelector('video')).to.not.exist;
      expect(el.querySelector('a[href*=".mp4"]')).to.not.exist;
      expect(el.querySelector('.organic-mosaic-tile img[alt="promo clip"]')).to.exist;
    });

    it('wires no scroll tracking (no is-scrubbing, no --progress) in the static branch', () => {
      const el = gallery(6);
      decorate(el);
      expect(el.classList.contains('is-scrubbing')).to.be.false;
      expect(el.style.getPropertyValue('--progress')).to.equal('');
    });

    it('an empty block (no media) does not throw and produces no columns', () => {
      const el = block([['<p>ignored text</p>']]);
      decorate(el);
      expect(tilesOf(el)).to.have.length(0);
      expect(columnsOf(el)).to.have.length(0);
      expect(el.classList.contains('is-scrubbing')).to.be.false;
    });

    it('double-decorate is idempotent (guardDecorate) -- content not rebuilt', () => {
      const el = gallery(6);
      decorate(el);
      decorate(el);
      expect(tilesOf(el)).to.have.length(6);
      expect(el.querySelectorAll('.organic-mosaic-grid')).to.have.length(1);
    });
  });

  describe('animating branch', () => {
    let realIO;
    // Forces the md media query to a known result so the desktop-only JS gate
    // (window.matchMedia(MQ_MD).matches) is deterministic regardless of the
    // headless runner's window size.
    const stubMd = (matches) => sinon.stub(window, 'matchMedia').callsFake((media) => ({
      matches, media, addEventListener: () => {}, removeEventListener: () => {},
    }));

    beforeEach(() => {
      sinon.stub(navigator, 'hardwareConcurrency').value(8);
      realIO = window.IntersectionObserver;
      window.IntersectionObserver = FakeIntersectionObserver;
      FakeIntersectionObserver.instances = [];
    });
    afterEach(() => { window.IntersectionObserver = realIO; });

    it('enables scrub wiring and drives a real --progress value on the block (>=md)', async () => {
      stubMd(true);
      const el = gallery(6);
      decorate(el);
      // The scrub class is the CSS contract that turns per-column drift on.
      expect(el.classList.contains('is-scrubbing')).to.be.true;
      // trackScrollProgress created exactly one observer; fire its near-viewport
      // entry, then let scroll.js's rAF update() write --progress (0..1).
      expect(FakeIntersectionObserver.instances).to.have.length(1);
      FakeIntersectionObserver.instances[0].callback([{ isIntersecting: true, target: el }]);
      await nextFrames();
      const p = parseFloat(el.style.getPropertyValue('--progress'));
      expect(p).to.be.within(0, 1);
      // The static mosaic is still fully present underneath the enhancement.
      expect(tilesOf(el)).to.have.length(6);
      expect(columnsOf(el)).to.have.length(4);
    });

    it('double-decorate does not create a second IntersectionObserver (>=md)', () => {
      stubMd(true);
      const el = gallery(6);
      decorate(el);
      decorate(el);
      expect(FakeIntersectionObserver.instances).to.have.length(1);
      expect(tilesOf(el)).to.have.length(6);
    });

    it('below md (mobile) wires no scrub class and no observer, even when animation is allowed', () => {
      stubMd(false);
      const el = gallery(6);
      decorate(el);
      // Matches the CSS: nothing consumes --progress below md, so the JS must
      // not run the scroll engine there (no per-rAF getBoundingClientRect).
      expect(el.classList.contains('is-scrubbing')).to.be.false;
      expect(FakeIntersectionObserver.instances).to.have.length(0);
      // The static mosaic still renders fully.
      expect(tilesOf(el)).to.have.length(6);
    });

    it('a video media cell is upgraded to a background <video> when animation is allowed', () => {
      stubMd(true);
      const el = block([[videoCell('promo clip')], [imgCell('a')], [imgCell('b')]]);
      decorate(el);
      // decorateVideoMedia consumes the .mp4 link and inserts a <video>.
      expect(el.querySelector('.organic-mosaic-tile video')).to.exist;
      expect(el.querySelector('a[href*=".mp4"]')).to.not.exist;
    });

    it('no media -> stays static even when animation is allowed', () => {
      stubMd(true);
      const el = block([['<p>words only</p>']]);
      decorate(el);
      expect(el.classList.contains('is-scrubbing')).to.be.false;
      expect(FakeIntersectionObserver.instances).to.have.length(0);
    });
  });
});
