import { expect } from '@esm-bundle/chai';
import sinon from 'sinon';
import decorate from '../../blocks/image-cloud/image-cloud.js';

// These tests exercise both decoration paths. The deterministic STATIC branch
// (hardwareConcurrency = 1 -> shouldAnimate() is false) is the reduced-motion /
// save-data / low-power resting DOM: every image is built and statically
// positioned, the lockup is readable, and no scroll tracking is wired. The
// ANIMATING branch (hardwareConcurrency = 8) is asserted structurally too --
// per the logo-tile-wall review lesson that unasserted animation paths hide
// regressions -- by stubbing IntersectionObserver so trackScrollProgress fires
// synchronously and checking the scrub wiring (is-scrubbing + a real --progress).

const imgCell = (alt) => `<p><picture><source srcset="/x.webp" type="image/webp"><img src="/x.png" alt="${alt}"></picture></p>`;
const textCell = (html) => `<div>${html}</div>`;

const block = (rows) => {
  const el = document.createElement('div');
  el.className = 'image-cloud';
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

const imagesOf = (el) => [...el.querySelectorAll('.icloud-image')];
const alts = (el) => imagesOf(el).map((w) => w.querySelector('img').getAttribute('alt'));

const until = async (fn, ms = 2000) => {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > ms) throw new Error('until: timed out');
    await new Promise((r) => { setTimeout(r, 10); });
  }
};

// Fires the observed callback synchronously as intersecting so
// trackScrollProgress's IO (which drives --progress) is deterministic in a
// headless render, matching logo-tile-wall.test.js's SyncIO.
class SyncIO {
  constructor(cb) { this.cb = cb; }

  observe(target) { this.cb([{ target, isIntersecting: true }]); }

  unobserve() {}

  disconnect() {}
}

describe('image-cloud', () => {
  afterEach(() => sinon.restore());

  describe('static (reduced-motion) branch', () => {
    beforeEach(() => sinon.stub(navigator, 'hardwareConcurrency').value(1));

    it('builds one positioned image per pictured cell and marks the lockup heading', () => {
      const el = block([
        [textCell('<h2>Made for teams</h2><p>Move faster together.</p>')],
        [imgCell('Editor timeline'), imgCell('Comment thread')],
      ]);
      decorate(el);
      expect(imagesOf(el)).to.have.length(2);
      const lockup = el.querySelector('.icloud-lockup');
      expect(lockup.querySelector('.icloud-heading').textContent).to.equal('Made for teams');
      expect(lockup.querySelector('p').textContent).to.equal('Move faster together.');
    });

    it('reuses the authored picture verbatim and preserves author alt (meaningful and decorative)', () => {
      const el = block([[imgCell('Editor timeline'), imgCell('')]]);
      decorate(el);
      expect(alts(el)).to.deep.equal(['Editor timeline', '']);
      // The optimized <source> from EDS is kept, not stripped/rebuilt.
      expect(imagesOf(el)[0].querySelector('picture source')).to.exist;
    });

    it('anchors each image via --icloud-x/y and its Falkor parallax factor, capping at nine', () => {
      const el = block([[...Array(12)].map(() => imgCell('tile'))]);
      decorate(el);
      const wraps = imagesOf(el);
      // Twelve authored, nine designed anchors: extras are dropped, never
      // stacked pixel-exactly on an existing anchor.
      expect(wraps).to.have.length(9);
      expect(wraps[0].style.getPropertyValue('--icloud-x')).to.equal('16%');
      expect(wraps[0].style.getPropertyValue('--icloud-factor')).to.equal('0.4');
      // Every rendered anchor is a distinct point (no overlapping duplicates).
      const coords = wraps.map((w) => `${w.style.getPropertyValue('--icloud-x')},${w.style.getPropertyValue('--icloud-y')}`);
      expect(new Set(coords).size).to.equal(9);
      wraps.forEach((w) => {
        expect(w.style.getPropertyValue('--icloud-y')).to.not.equal('');
        expect(w.style.getPropertyValue('--icloud-factor')).to.not.equal('');
      });
    });

    it('a second <picture> in one cell renders as its own image (nothing vanishes)', () => {
      const el = block([[`${imgCell('first')}${imgCell('second')}`]]);
      decorate(el);
      expect(alts(el)).to.deep.equal(['first', 'second']);
    });

    it('static branch wires no scroll tracking (no is-scrubbing)', () => {
      const el = block([[imgCell('tile')]]);
      decorate(el);
      expect(el.classList.contains('is-scrubbing')).to.be.false;
    });

    it('image-only authoring (no text cells) still renders the labeled cloud', () => {
      const el = block([[imgCell('Screenshot A'), imgCell('Screenshot B')]]);
      decorate(el);
      expect(alts(el)).to.deep.equal(['Screenshot A', 'Screenshot B']);
      expect(el.querySelector('.icloud-lockup').children).to.have.length(0);
    });

    it('no pictured cells -> no images, no scrub, no throw', () => {
      const el = block([[textCell('<h2>Just words</h2>')]]);
      decorate(el);
      expect(imagesOf(el)).to.have.length(0);
      expect(el.classList.contains('is-scrubbing')).to.be.false;
      expect(el.querySelector('.icloud-heading')).to.exist;
    });

    it('double-decorate is idempotent (guardDecorate) -- content not rebuilt', () => {
      const el = block([[imgCell('a'), imgCell('b')]]);
      decorate(el);
      decorate(el);
      expect(imagesOf(el)).to.have.length(2);
      expect(el.querySelectorAll('.icloud-inner')).to.have.length(1);
    });
  });

  describe('animating branch', () => {
    let realIO;
    beforeEach(() => {
      sinon.stub(navigator, 'hardwareConcurrency').value(8);
      realIO = window.IntersectionObserver;
      window.IntersectionObserver = SyncIO;
    });
    afterEach(() => { window.IntersectionObserver = realIO; });

    it('enables scrub wiring and drives a real --progress value on the block', async () => {
      const el = block([
        [textCell('<h2>Cloud</h2>')],
        [imgCell('tile one'), imgCell('tile two')],
      ]);
      decorate(el);
      // The scrub class is the CSS contract that turns --icloud-drift on.
      expect(el.classList.contains('is-scrubbing')).to.be.true;
      // trackScrollProgress observed the block and, once intersecting, sets a
      // numeric --progress (0..1) that the CSS parallax calc() consumes.
      await until(() => el.style.getPropertyValue('--progress') !== '');
      const p = parseFloat(el.style.getPropertyValue('--progress'));
      expect(p).to.be.within(0, 1);
      // Images still carry their per-image factor so drift differs per tile.
      expect(imagesOf(el)[0].style.getPropertyValue('--icloud-factor')).to.equal('0.4');
    });

    it('no images -> stays static even when animation is allowed', () => {
      const el = block([[textCell('<h2>Words only</h2>')]]);
      decorate(el);
      expect(el.classList.contains('is-scrubbing')).to.be.false;
    });
  });
});
