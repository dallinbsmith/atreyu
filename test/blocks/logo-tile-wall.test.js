import { expect } from '@esm-bundle/chai';
import sinon from 'sinon';
import decorate from '../../blocks/logo-tile-wall/logo-tile-wall.js';

// getPlaceholder and loadPartnerLogo both hit the real (404-ing) test server and
// gracefully fall back to English defaults / empty icon — same pattern as
// logo-wall.test.js, no fetch stubbing needed. These tests exercise the
// deterministic static (reduced-motion) branch: with hardwareConcurrency = 1,
// shouldAnimate() is false, so onReveal() invokes the callback immediately with
// { immediate: true } and no marquee/clone/toggle is created. The
// IntersectionObserver-driven animating branch is intentionally not asserted
// here — it is non-deterministic in a headless render and its motion is a pure
// enhancement over this fully-labeled resting state.

const tile = (html) => {
  const c = document.createElement('div');
  c.innerHTML = html;
  return c;
};

const block = (rows) => {
  const el = document.createElement('div');
  el.className = 'logo-tile-wall';
  rows.forEach((cells) => {
    const r = document.createElement('div');
    cells.forEach((html) => r.append(tile(html)));
    el.append(r);
  });
  document.body.append(el);
  return el;
};

const labels = (el) => [...el.querySelectorAll('.ltw-tile .ltw-label')].map((l) => l.textContent);

const until = async (fn, ms = 2000) => {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > ms) throw new Error('until: timed out');
    await new Promise((r) => { setTimeout(r, 10); });
  }
};

// Fires the observed callback synchronously as intersecting, so the onReveal()
// -> animate() path is deterministic in a headless render (the real
// IntersectionObserver fires on its own frame schedule).
class SyncIO {
  constructor(cb) { this.cb = cb; }

  observe(target) { this.cb([{ target, isIntersecting: true }]); }

  unobserve() {}

  disconnect() {}
}

describe('logo-tile-wall', () => {
  afterEach(() => sinon.restore());

  describe('static (reduced-motion) branch', () => {
    beforeEach(() => sinon.stub(navigator, 'hardwareConcurrency').value(1));

    it('builds one row per authored row and one accessibly-named tile per cell', () => {
      const el = block([['Acme', 'Globex'], ['Initech']]);
      decorate(el);
      expect(el.querySelectorAll('.ltw-row')).to.have.length(2);
      expect(labels(el)).to.deep.equal(['Acme', 'Globex', 'Initech']);
      // Every tile has a visible text label = its accessible name; the fetched
      // brand mark is decorative.
      el.querySelectorAll('.ltw-tile').forEach((t) => {
        expect(t.querySelector('.ltw-label').textContent).to.have.length.above(0);
        expect(t.querySelector('.ltw-logo').getAttribute('aria-hidden')).to.equal('true');
      });
    });

    it('no clone, no pause toggle, no is-animating', () => {
      const el = block([['Acme', 'Globex']]);
      decorate(el);
      expect(el.querySelectorAll('.ltw-track')).to.have.length(1);
      expect(el.querySelector('.ltw-toggle')).to.not.exist;
      expect(el.classList.contains('is-animating')).to.be.false;
    });

    it('an authored <img> tile keeps the image, labels it, and marks it decorative', () => {
      const el = block([['<img src="/x.png" alt="stale"> Adobe']]);
      decorate(el);
      const t = el.querySelector('.ltw-tile');
      expect(t.querySelector('img')).to.exist;
      expect(t.querySelector('.ltw-label').textContent).to.equal('Adobe');
      // The visible label owns the name, so the image alt is cleared to avoid a
      // double announcement.
      expect(t.querySelector('img').getAttribute('alt')).to.equal('');
      expect(t.querySelector('.ltw-logo').getAttribute('aria-hidden')).to.equal('true');
    });

    it('image-only tile (no text) derives its accessible name from the img alt', () => {
      const el = block([['<img src="/x.png" alt="Framestore">']]);
      decorate(el);
      const t = el.querySelector('.ltw-tile');
      expect(t).to.exist;
      expect(t.querySelector('.ltw-label').textContent).to.equal('Framestore');
      expect(t.querySelector('.ltw-logo').getAttribute('aria-hidden')).to.equal('true');
      // alt cleared once the derived visible label owns the name.
      expect(t.querySelector('img').getAttribute('alt')).to.equal('');
    });

    it('image with neither text nor alt is dropped, never shipped unlabeled', () => {
      const el = block([['<img src="/x.png" alt="">', 'Acme']]);
      decorate(el);
      expect(labels(el)).to.deep.equal(['Acme']);
      expect(el.querySelectorAll('.ltw-tile')).to.have.length(1);
    });

    it('double-decorate is idempotent (guardDecorate) — content not rebuilt from garbage', () => {
      const el = block([['Acme', 'Globex']]);
      decorate(el);
      decorate(el);
      expect(labels(el)).to.deep.equal(['Acme', 'Globex']);
      expect(el.querySelectorAll('.ltw-row')).to.have.length(1);
    });

    it('rows that filter to nothing clear the raw authored DOM (no unstyled leftovers)', () => {
      const el = block([['<img src="/x.png" alt="">']]);
      decorate(el);
      expect(el.querySelector('.ltw-row')).to.not.exist;
      expect(el.children).to.have.length(0);
    });

    it('no authored rows → no-op, no throw', () => {
      const el = block([]);
      decorate(el);
      expect(el.querySelector('.ltw-row')).to.not.exist;
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

    // Guards the seam contract that was broken: the animated element must be the
    // width:max-content .ltw-scroller holding [track, aria-hidden clone] — NOT
    // the overflow/mask viewport row. If the track were a direct child of the
    // row (the old shape), translateX(-50%) resolves against the clamped viewport
    // and the marquee snaps back mid-scroll.
    it('builds viewport row → max-content scroller → track + aria-hidden clone', async () => {
      const el = block([['Acme', 'Globex']]);
      decorate(el);
      await until(() => el.classList.contains('is-animating'));
      const row = el.querySelector('.ltw-row');
      const scroller = row.querySelector(':scope > .ltw-scroller');
      expect(scroller, 'scroller wraps the track').to.exist;
      // The track lives inside the scroller, never directly under the viewport row.
      expect(row.querySelector(':scope > .ltw-track')).to.equal(null);
      const tracks = scroller.querySelectorAll(':scope > .ltw-track');
      expect(tracks).to.have.length(2);
      expect(tracks[0].getAttribute('aria-hidden')).to.equal(null);
      expect(tracks[1].getAttribute('aria-hidden')).to.equal('true');
    });

    it('ships one pause toggle that pauses via is-paused on the block', async () => {
      const el = block([['Acme', 'Globex']]);
      decorate(el);
      await until(() => el.querySelector('.ltw-toggle'));
      const toggles = el.querySelectorAll('.ltw-toggle');
      expect(toggles).to.have.length(1);
      toggles[0].click();
      expect(el.classList.contains('is-paused')).to.be.true;
    });
  });
});
