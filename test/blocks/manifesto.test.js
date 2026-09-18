import { expect } from '@esm-bundle/chai';
import sinon from 'sinon';
import decorate from '../../blocks/manifesto/manifesto.js';

// Two branches are exercised. The static (reduced-motion) branch is
// deterministic: with hardwareConcurrency = 1, shouldAnimate() is false, so the
// block ships only the resting DOM (image + statement + CTA) — no .is-animating,
// no --progress, no scroll wiring. The animating branch stubs shouldAnimate()
// true (hardwareConcurrency = 8) and swaps in a synchronous IntersectionObserver
// so trackScrollProgress's viewport gate fires in a headless render, then
// asserts --progress is wired. The authored-DOM/a11y contract is identical
// across both branches.

const picture = (src = 'photo.jpg', alt = 'A workspace') => `<picture><img src="${src}" alt="${alt}"></picture>`;
const wistiaCta = (label = 'Watch the video') => `<p><a href="https://fast.wistia.net/embed/iframe/abc123">${label}</a></p>`;
const statement = '<h2>We believe creative work deserves better tools.</h2>';

// Each argument is one cell's innerHTML; every cell is wrapped in its own
// authored row, matching the EDS one-cell-per-row document shape.
const block = (...cellsHtml) => {
  const el = document.createElement('div');
  el.className = 'manifesto';
  cellsHtml.forEach((html) => {
    const row = document.createElement('div');
    const cell = document.createElement('div');
    cell.innerHTML = html;
    row.append(cell);
    el.append(row);
  });
  document.body.append(el);
  return el;
};

// Fires the observed callback synchronously as intersecting so the
// trackScrollProgress viewport gate resolves deterministically in a headless
// render (the real IntersectionObserver fires on its own frame schedule).
class SyncIO {
  constructor(cb) { this.cb = cb; }

  observe(target) { this.cb([{ target, isIntersecting: true }]); }

  unobserve() {}

  disconnect() {}
}

const until = async (fn, ms = 2000) => {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > ms) throw new Error('until: timed out');
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => { setTimeout(r, 10); });
  }
};

const closeAnyModal = () => document.querySelector('.video-modal-close')?.click();

describe('manifesto', () => {
  afterEach(() => {
    sinon.restore();
    closeAnyModal(); // release the video-modal singleton between tests
    document.querySelectorAll('.manifesto, .video-modal').forEach((n) => n.remove());
  });

  describe('static (reduced-motion) branch', () => {
    beforeEach(() => sinon.stub(navigator, 'hardwareConcurrency').value(1));

    it('renders image, statement and the CTA, media before content', () => {
      const el = block(picture(), `${statement}${wistiaCta()}`);
      decorate(el);
      const kids = [...el.children];
      expect(kids[0].classList.contains('manifesto-media')).to.be.true;
      expect(kids[1].classList.contains('manifesto-content')).to.be.true;
      expect(el.querySelector('.manifesto-media img[src="photo.jpg"]')).to.exist;
      expect(el.querySelector('.manifesto-heading').textContent).to.contain('creative work');
      expect(el.querySelector('.manifesto-cta a').textContent).to.equal('Watch the video');
    });

    it('is static: no is-animating class, no --progress set', () => {
      const el = block(picture(), statement);
      decorate(el);
      expect(el.classList.contains('is-animating')).to.be.false;
      expect(el.style.getPropertyValue('--progress')).to.equal('');
    });

    it('keeps the meaningful image alt as its accessible name', () => {
      const el = block(picture('photo.jpg', 'A designer at work'), statement);
      decorate(el);
      expect(el.querySelector('.manifesto-media img').getAttribute('alt')).to.equal('A designer at work');
    });

    it('classifies the image by shape, not position — CTA/text row authored BEFORE the image row', () => {
      const el = block(`${statement}${wistiaCta()}`, picture());
      decorate(el);
      expect(el.querySelector('.manifesto-media img[src="photo.jpg"]')).to.exist;
      expect(el.querySelector('.manifesto-content .manifesto-heading')).to.exist;
      // media wrapper holds no statement text
      expect(el.querySelector('.manifesto-media').textContent.trim()).to.equal('');
    });

    it('a statement referencing an inline mark is not misclassified as the image cell', () => {
      const el = block(
        '<h2>Trusted by teams <img src="badge.svg" alt=""> everywhere.</h2>',
        picture(),
      );
      decorate(el);
      expect(el.querySelector('.manifesto-media img[src="photo.jpg"]')).to.exist;
      // the inline badge stays inside the statement, not swept into media
      expect(el.querySelector('.manifesto-content img[src="badge.svg"]')).to.exist;
    });

    it('the Wistia CTA opens the accessible video modal on click instead of navigating', () => {
      const el = block(picture(), `${statement}${wistiaCta()}`);
      decorate(el);
      const link = el.querySelector('.manifesto-cta a');
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      link.dispatchEvent(event);
      expect(event.defaultPrevented).to.be.true;
      expect(document.querySelector('.video-modal')).to.exist;
    });

    it('missing video link: renders image + statement with no dead CTA and no modal wiring', () => {
      const el = block(picture(), statement);
      decorate(el);
      expect(el.querySelector('.manifesto-media img')).to.exist;
      expect(el.querySelector('.manifesto-heading')).to.exist;
      expect(el.querySelector('a')).to.not.exist; // no fabricated button/link
      // a stray click anywhere never conjures a modal
      el.querySelector('.manifesto-content')?.click();
      expect(document.querySelector('.video-modal')).to.not.exist;
    });

    it('a non-Wistia CTA link is left as a plain link, never wired to a modal', () => {
      const el = block(picture(), `${statement}<p><a href="/pricing">See pricing</a></p>`);
      decorate(el);
      const link = el.querySelector('.manifesto-content a');
      expect(link.getAttribute('href')).to.equal('/pricing');
      // Suppress the synthetic click's real navigation (the block leaves a
      // plain link, so nothing else would); the point under test is only that
      // the block did NOT wire this non-Wistia link to the video modal.
      const noNav = (e) => e.preventDefault();
      document.addEventListener('click', noNav, true);
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      document.removeEventListener('click', noNav, true);
      expect(document.querySelector('.video-modal')).to.not.exist;
    });

    it('image-only (no statement): renders just the media, no empty content wrapper', () => {
      const el = block(picture());
      decorate(el);
      expect(el.querySelector('.manifesto-media img')).to.exist;
      expect(el.querySelector('.manifesto-content')).to.not.exist;
      expect([...el.children]).to.have.length(1);
    });

    it('statement-only (no image): renders content without a media wrapper', () => {
      const el = block(`${statement}${wistiaCta()}`);
      decorate(el);
      expect(el.querySelector('.manifesto-media')).to.not.exist;
      expect(el.querySelector('.manifesto-heading')).to.exist;
      expect(el.querySelector('.manifesto-cta a')).to.exist;
    });

    it('an empty block does not throw', () => {
      const el = block('');
      expect(() => decorate(el)).to.not.throw();
    });

    it('is idempotent — a second decorate() is a no-op (guardDecorate), CTA wired once', () => {
      const el = block(picture(), `${statement}${wistiaCta()}`);
      decorate(el);
      const firstMedia = el.querySelector('.manifesto-media');
      decorate(el);
      expect(el.querySelector('.manifesto-media')).to.equal(firstMedia);
      expect(el.querySelectorAll('.manifesto-media')).to.have.length(1);
      expect(el.querySelectorAll('.manifesto-content')).to.have.length(1);
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

    it('adds is-animating and still ships the full resting DOM (image + statement + CTA)', () => {
      const el = block(picture(), `${statement}${wistiaCta()}`);
      decorate(el);
      expect(el.classList.contains('is-animating')).to.be.true;
      expect(el.querySelector('.manifesto-media img[src="photo.jpg"]')).to.exist;
      expect(el.querySelector('.manifesto-heading')).to.exist;
      expect(el.querySelector('.manifesto-cta a')).to.exist;
    });

    it('wires trackScrollProgress: --progress (0..1) is set on the block once in view', async () => {
      const el = block(picture(), statement);
      decorate(el);
      await until(() => el.style.getPropertyValue('--progress') !== '');
      const p = Number(el.style.getPropertyValue('--progress'));
      expect(p).to.be.a('number').and.not.be.NaN;
      expect(p).to.be.at.least(0);
      expect(p).to.be.at.most(1);
    });
  });
});
