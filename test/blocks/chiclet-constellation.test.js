import { expect } from '@esm-bundle/chai';
import sinon from 'sinon';
import decorate from '../../blocks/chiclet-constellation/chiclet-constellation.js';

// Two branches are exercised. The static (reduced-motion) branch is
// deterministic: with hardwareConcurrency = 1, shouldAnimate() is false, so the
// block ships only the resting, fully-labeled constellation grid — no
// .is-animating, no --progress, no scroll wiring. The animating branch stubs
// shouldAnimate() true (hardwareConcurrency = 8) and swaps in a synchronous
// IntersectionObserver so trackScrollProgress's viewport gate fires in a
// headless render, then asserts the block wired --progress onto itself. The
// authored-DOM/a11y contract (visible label = accessible name, decorative
// icon) is identical across both branches.

const cell = (html) => {
  const c = document.createElement('div');
  c.innerHTML = html;
  return c;
};

const block = (rows) => {
  const el = document.createElement('div');
  el.className = 'chiclet-constellation';
  rows.forEach((cells) => {
    const r = document.createElement('div');
    cells.forEach((html) => r.append(cell(html)));
    el.append(r);
  });
  document.body.append(el);
  return el;
};

const labels = (el) => [...el.querySelectorAll('.cc-item .cc-label')].map((l) => l.textContent);

const until = async (fn, ms = 2000) => {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > ms) throw new Error('until: timed out');
    await new Promise((r) => { setTimeout(r, 10); });
  }
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

describe('chiclet-constellation', () => {
  afterEach(() => sinon.restore());

  describe('static (reduced-motion) branch', () => {
    beforeEach(() => sinon.stub(navigator, 'hardwareConcurrency').value(1));

    it('builds one accessibly-named chiclet per authored row inside a single list', () => {
      const el = block([
        ['<span class="icon icon-ps"></span>', 'Photoshop'],
        ['<span class="icon icon-ai"></span>', 'Illustrator'],
      ]);
      decorate(el);
      expect(el.querySelectorAll('.cc-list')).to.have.length(1);
      expect(el.querySelectorAll('.cc-item')).to.have.length(2);
      expect(labels(el)).to.deep.equal(['Photoshop', 'Illustrator']);
      // Every chiclet: visible text label = accessible name; icon is decorative.
      el.querySelectorAll('.cc-item').forEach((item) => {
        expect(item.querySelector('.cc-label').textContent).to.have.length.above(0);
        expect(item.querySelector('.cc-icon').getAttribute('aria-hidden')).to.equal('true');
      });
    });

    it('two-cell "| Label | :icon: |" (text-first) resolves the label regardless of cell order', () => {
      // The block advertises order-independent classification: the icon cell is
      // the mark whether it is first or second, and the text cell is the name.
      const el = block([['Photoshop', '<span class="icon icon-ps"></span>']]);
      decorate(el);
      const item = el.querySelector('.cc-item');
      expect(item.querySelector('.cc-label').textContent).to.equal('Photoshop');
      expect(item.querySelector('.cc-icon .icon')).to.exist;
      expect(item.querySelector('.cc-icon').getAttribute('aria-hidden')).to.equal('true');
    });

    it('is static: no is-animating class and no --progress set', () => {
      const el = block([['<span class="icon icon-ps"></span>', 'Photoshop']]);
      decorate(el);
      expect(el.classList.contains('is-animating')).to.be.false;
      expect(el.style.getPropertyValue('--progress')).to.equal('');
    });

    it('stamps a per-item --i stagger index in authored order', () => {
      const el = block([['x', 'Photoshop'], ['y', 'Illustrator'], ['z', 'Premiere']]);
      decorate(el);
      const idx = [...el.querySelectorAll('.cc-item')].map((i) => i.style.getPropertyValue('--i'));
      expect(idx).to.deep.equal(['0', '1', '2']);
    });

    it('promotes an authored link to wrap the chiclet; a link-less chiclet is a span', () => {
      const el = block([
        ['<span class="icon icon-ps"></span>', '<a href="/ps">Photoshop</a>'],
        ['<span class="icon icon-ai"></span>', 'Illustrator'],
      ]);
      decorate(el);
      const [linked, plain] = el.querySelectorAll('.cc-chiclet');
      expect(linked.tagName).to.equal('A');
      expect(linked.getAttribute('href')).to.equal('/ps');
      expect(linked.querySelector('.cc-label').textContent).to.equal('Photoshop');
      expect(plain.tagName).to.equal('SPAN');
      expect(plain.hasAttribute('href')).to.be.false;
    });

    it('keeps an authored image mark, labels it from the text cell, and clears its alt', () => {
      const el = block([['<img src="/x.png" alt="stale">', 'Illustrator']]);
      decorate(el);
      const item = el.querySelector('.cc-item');
      expect(item.querySelector('.cc-icon img')).to.exist;
      expect(item.querySelector('.cc-label').textContent).to.equal('Illustrator');
      // Visible label owns the name, so the image alt is emptied to avoid a
      // double announcement, and the mark is decorative.
      expect(item.querySelector('img').getAttribute('alt')).to.equal('');
      expect(item.querySelector('.cc-icon').getAttribute('aria-hidden')).to.equal('true');
    });

    it('image-only chiclet (no text cell) derives its accessible name from the img alt', () => {
      const el = block([['<img src="/x.png" alt="Premiere">']]);
      decorate(el);
      const item = el.querySelector('.cc-item');
      expect(item).to.exist;
      expect(item.querySelector('.cc-label').textContent).to.equal('Premiere');
      expect(item.querySelector('img').getAttribute('alt')).to.equal('');
    });

    it('single-cell "| :icon: Label |" renders with the label as accessible name', () => {
      // The most natural single-column EDS shape: icon and label share one cell.
      // The icon span contributes no text, so the cell text is the label.
      const el = block([['<span class="icon icon-ps"></span>Photoshop']]);
      decorate(el);
      const item = el.querySelector('.cc-item');
      expect(item).to.exist;
      expect(item.querySelector('.cc-label').textContent).to.equal('Photoshop');
      expect(item.querySelector('.cc-icon .icon')).to.exist;
      expect(item.querySelector('.cc-icon').getAttribute('aria-hidden')).to.equal('true');
    });

    it('an <a> wrapping icon+label in one cell renders as a link with the right name', () => {
      const el = block([['<a href="/ps"><span class="icon icon-ps"></span>Photoshop</a>']]);
      decorate(el);
      const chiclet = el.querySelector('.cc-chiclet');
      expect(chiclet.tagName).to.equal('A');
      expect(chiclet.getAttribute('href')).to.equal('/ps');
      expect(chiclet.querySelector('.cc-label').textContent).to.equal('Photoshop');
      expect(chiclet.querySelector('.cc-icon').getAttribute('aria-hidden')).to.equal('true');
    });

    it('a chiclet with no derivable name is dropped (with a dev warn), never shipped unlabeled', () => {
      const warn = sinon.stub(console, 'warn');
      const el = block([['<img src="/x.png" alt="">'], ['<span class="icon icon-ps"></span>', 'Photoshop']]);
      decorate(el);
      expect(labels(el)).to.deep.equal(['Photoshop']);
      expect(el.querySelectorAll('.cc-item')).to.have.length(1);
      // The drop is diagnosable off prod (test host is dev).
      expect(warn.calledOnce).to.be.true;
    });

    it('double-decorate is idempotent (guardDecorate) — not rebuilt from garbage', () => {
      const el = block([['<span class="icon icon-ps"></span>', 'Photoshop']]);
      decorate(el);
      decorate(el);
      expect(labels(el)).to.deep.equal(['Photoshop']);
      expect(el.querySelectorAll('.cc-list')).to.have.length(1);
    });

    it('rows that filter to nothing leave an empty list, no raw authored divs', () => {
      const el = block([['<img src="/x.png" alt="">']]);
      decorate(el);
      expect(el.querySelectorAll('.cc-item')).to.have.length(0);
      expect(el.querySelector('.cc-list')).to.exist;
      // No leftover authored <div> rows outside the built list.
      expect([...el.children].every((c) => c.classList.contains('cc-list'))).to.be.true;
    });

    it('no authored rows -> no-op, no throw', () => {
      const el = block([]);
      expect(() => decorate(el)).to.not.throw();
      expect(el.querySelectorAll('.cc-item')).to.have.length(0);
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

    it('adds is-animating and still ships the labeled, decorative-icon DOM', () => {
      const el = block([
        ['<span class="icon icon-ps"></span>', 'Photoshop'],
        ['<span class="icon icon-ai"></span>', 'Illustrator'],
      ]);
      decorate(el);
      expect(el.classList.contains('is-animating')).to.be.true;
      expect(labels(el)).to.deep.equal(['Photoshop', 'Illustrator']);
      el.querySelectorAll('.cc-item').forEach((item) => {
        expect(item.querySelector('.cc-icon').getAttribute('aria-hidden')).to.equal('true');
      });
    });

    it('wires trackScrollProgress: --progress (0..1) is set on the block once in view', async () => {
      const el = block([['<span class="icon icon-ps"></span>', 'Photoshop']]);
      decorate(el);
      await until(() => el.style.getPropertyValue('--progress') !== '');
      const p = Number(el.style.getPropertyValue('--progress'));
      expect(p).to.be.a('number').and.not.be.NaN;
      expect(p).to.be.at.least(0);
      expect(p).to.be.at.most(1);
    });
  });
});
