import { expect } from '@esm-bundle/chai';
import sinon from 'sinon';
import decorate from '../../blocks/sticky-background/sticky-background.js';

// Authoring shape: FIRST row is the pinned media, every remaining row is a
// section (single cell -> text lockup, multi cell -> touts group). Each string
// in a row's array becomes its own cell (sibling div under the row).
const cell = (html) => {
  const c = document.createElement('div');
  c.innerHTML = html;
  return c;
};

const block = (rows) => {
  const el = document.createElement('div');
  el.className = 'sticky-background';
  rows.forEach((cells) => {
    const r = document.createElement('div');
    cells.forEach((html) => r.append(cell(html)));
    el.append(r);
  });
  document.body.append(el);
  return el;
};

const pic = '<picture><img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="></picture>';
const videoMedia = `<a href="/clip.mp4">${pic}</a>`;
const lockup = '<h5>Headline</h5><p>Body copy.</p><p><a href="/get">Get the app</a></p>';

const until = async (fn, ms = 2000) => {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > ms) throw new Error('until: timed out');
    await new Promise((r) => { setTimeout(r, 10); });
  }
};

// trackScrollProgress (scroll.js) and decorateVideoMedia both look up the global
// IntersectionObserver identifier at call-time, so swapping the constructor for
// a fake that records construction count makes the animating wiring assertable
// deterministically. Restored in afterEach. Pattern matches pothole.test.js.
class FakeIntersectionObserver {
  constructor() { FakeIntersectionObserver.instances.push(this); }

  observe() {}

  unobserve() {}

  disconnect() {}
}
FakeIntersectionObserver.instances = [];

describe('sticky-background', () => {
  afterEach(() => sinon.restore());

  // Under hardwareConcurrency = 1, shouldAnimate() is false: trackScrollProgress
  // is a no-op (no IntersectionObserver, no --sbg-edge writes) and the media
  // falls back to its static poster. This is the resting DOM every user gets
  // before/without motion, so it carries the real accessible content.
  describe('static (reduced-motion) branch', () => {
    beforeEach(() => sinon.stub(navigator, 'hardwareConcurrency').value(1));

    it('builds one .sbg-media from the first row and one section per remaining row', () => {
      const el = block([[pic], [lockup], [lockup]]);
      decorate(el);
      expect(el.querySelector('.sbg-inner')).to.exist;
      expect(el.querySelectorAll('.sbg-media')).to.have.length(1);
      expect(el.querySelector('.sbg-media picture')).to.exist;
      expect(el.querySelectorAll('.sbg-section')).to.have.length(2);
    });

    it('a single-cell section is a text lockup that keeps the real heading and anchor CTA', () => {
      const el = block([[pic], [lockup]]);
      decorate(el);
      const section = el.querySelector('.sbg-section-text');
      expect(section).to.exist;
      const title = section.querySelector('.sbg-lockup-title');
      expect(title.tagName).to.equal('H5'); // real semantic heading, not faked
      const ctaLink = section.querySelector('.sbg-lockup-cta a');
      expect(ctaLink).to.exist; // real anchor CTA survives
      expect(ctaLink.getAttribute('href')).to.equal('/get');
    });

    it('a multi-cell section is a touts group with one tout per cell', () => {
      const el = block([[pic], ['<h5>One</h5><p>a</p>', '<h5>Two</h5><p>b</p>']]);
      decorate(el);
      const touts = el.querySelector('.sbg-section-touts');
      expect(touts).to.exist;
      expect(touts.querySelectorAll('.sbg-tout')).to.have.length(2);
      expect(touts.querySelectorAll('.sbg-tout-title')).to.have.length(2);
    });

    it('repeated touts in a group get DISTINCT CTA data-testids (per-index id)', () => {
      const el = block([[pic], ['<h5>One</h5><p><a href="/a">A</a></p>', '<h5>Two</h5><p><a href="/b">B</a></p>']]);
      decorate(el);
      const ids = [...el.querySelectorAll('.sbg-section-touts .sbg-tout-cta a')].map((a) => a.dataset.testid);
      expect(ids).to.have.length(2);
      expect(new Set(ids).size).to.equal(2); // no collision on the shared prefix
    });

    it('row shape drives classification: 1 cell = text lockup, 2+ cells = touts (minimal case)', () => {
      // Single-cell row must be a text lockup, never a 1-item touts group.
      const single = block([[pic], ['<h5>Only</h5>']]);
      decorate(single);
      expect(single.querySelector('.sbg-section-text')).to.exist;
      expect(single.querySelector('.sbg-section-touts')).to.not.exist;
      // The smallest touts group is two cells.
      const pair = block([[pic], ['<h5>A</h5>', '<h5>B</h5>']]);
      decorate(pair);
      expect(pair.querySelector('.sbg-section-touts')).to.exist;
      expect(pair.querySelector('.sbg-section-text')).to.not.exist;
    });

    it('all CTA data-testids are globally unique across multiple lockup AND touts sections', () => {
      // The primary StickyBackground shape: several scrolling text lockups plus
      // touts groups over one pinned media. Every CTA testid must be unique, or
      // analytics attribution and test automation both break on collisions.
      const el = block([
        [pic],
        ['<h5>Lockup 1</h5><p><a href="/l1">L1</a></p>'],
        ['<h5>Tout A</h5><p><a href="/ta">TA</a></p>', '<h5>Tout B</h5><p><a href="/tb">TB</a></p>'],
        ['<h5>Lockup 2</h5><p><a href="/l2">L2</a></p>'],
        ['<h5>Tout C</h5><p><a href="/tc">TC</a></p>', '<h5>Tout D</h5><p><a href="/td">TD</a></p>'],
      ]);
      decorate(el);
      const ids = [...el.querySelectorAll('.sbg-section a[data-testid]')].map((a) => a.dataset.testid);
      expect(ids).to.have.length(6);
      expect(new Set(ids).size).to.equal(ids.length); // no duplicates anywhere
    });

    it('an empty authored section row produces no blank section (dropped, not min-height gap)', () => {
      const el = block([[pic], [lockup], []]);
      decorate(el);
      expect(el.querySelectorAll('.sbg-section')).to.have.length(1);
    });

    it('the pinned media image is decorative (alt cleared)', () => {
      const el = block([[pic], [lockup]]);
      decorate(el);
      expect(el.querySelector('.sbg-media img').getAttribute('alt')).to.equal('');
    });

    it('an .mp4 media falls back to its static poster picture — no video, no toggle', () => {
      const el = block([[videoMedia], [lockup]]);
      decorate(el);
      expect(el.querySelector('.sbg-media-frame picture')).to.exist;
      expect(el.querySelector('.sbg-media-frame video')).to.not.exist;
      expect(el.querySelector('.video-pause-toggle')).to.not.exist;
    });

    it('double-decorate is idempotent (guardDecorate) — not rebuilt', () => {
      const el = block([[pic], [lockup]]);
      decorate(el);
      decorate(el);
      expect(el.querySelectorAll('.sbg-inner')).to.have.length(1);
      expect(el.querySelectorAll('.sbg-section')).to.have.length(1);
    });

    it('a first row without a picture builds sections but no media, without throwing', () => {
      const el = block([['<p>no media here</p>'], [lockup]]);
      expect(() => decorate(el)).to.not.throw();
      expect(el.querySelector('.sbg-media')).to.not.exist;
      expect(el.querySelectorAll('.sbg-section')).to.have.length(1);
    });

    it('media row with no sections is a no-op (needs at least one section)', () => {
      const el = block([[pic]]);
      decorate(el);
      expect(el.querySelector('.sbg-inner')).to.not.exist;
    });

    it('an empty block does not throw', () => {
      const el = document.createElement('div');
      el.className = 'sticky-background';
      document.body.append(el);
      expect(() => decorate(el)).to.not.throw();
    });
  });

  // Under hardwareConcurrency = 8, shouldAnimate() is true: trackScrollProgress
  // wires up its IntersectionObserver (the --sbg-edge progress driver) and the
  // .mp4 media becomes a real looping <video> with a WCAG pause control. The
  // real heading + anchor CTA must survive this branch too.
  describe('animating branch', () => {
    let realIO;
    beforeEach(() => {
      sinon.stub(navigator, 'hardwareConcurrency').value(8);
      realIO = window.IntersectionObserver;
      window.IntersectionObserver = FakeIntersectionObserver;
      FakeIntersectionObserver.instances = [];
    });
    afterEach(() => { window.IntersectionObserver = realIO; });

    it('wires exactly one scroll-progress observer and keeps the real heading + anchor CTA', () => {
      const el = block([[pic], [lockup]]);
      decorate(el);
      expect(FakeIntersectionObserver.instances).to.have.length(1);
      expect(el.querySelector('.sbg-lockup-title').tagName).to.equal('H5');
      expect(el.querySelector('.sbg-lockup-cta a[href="/get"]')).to.exist;
    });

    it('double-decorate does not create a second progress observer', () => {
      const el = block([[pic], [lockup]]);
      decorate(el);
      decorate(el);
      expect(FakeIntersectionObserver.instances).to.have.length(1);
    });

    it('an .mp4 media becomes a looping <video> with a pause toggle', async () => {
      const el = block([[videoMedia], [lockup]]);
      decorate(el);
      const video = el.querySelector('.sbg-media-frame video');
      expect(video).to.exist;
      expect(video.loop).to.equal(true);
      expect(video.muted).to.equal(true);
      // The toggle is appended after an async i18n label lookup (fire-and-forget
      // in decorateVideoMedia), so wait for it rather than asserting synchronously.
      await until(() => el.querySelector('.video-pause-toggle'));
      expect(el.querySelector('.sbg-media .video-pause-toggle')).to.exist;
    });
  });
});
