import { expect } from '@esm-bundle/chai';
import sinon from 'sinon';
import decorate from '../../blocks/hero-transition-v4/hero-transition-v4.js';

const block = (rowsHtml) => {
  const el = document.createElement('div');
  el.className = 'hero-transition-v4';
  rowsHtml.forEach((cellsHtml) => {
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

const img = '<picture><img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="></picture>';

// Real IntersectionObserver timing is not deterministic in a headless test
// runner — swap the global constructor for a fake that just records how many
// times it was constructed. motion.js's onReveal looks up the global
// `IntersectionObserver` identifier at call-time, not an imported binding, so
// this substitution works without touching the module. Pattern matches
// hero-cards-transition.test.js / footer-glow.test.js.
class FakeIntersectionObserver {
  constructor() {
    FakeIntersectionObserver.instances.push(this);
  }

  observe() {}

  unobserve() {}

  disconnect() {}
}
FakeIntersectionObserver.instances = [];

describe('hero-transition-v4', () => {
  afterEach(() => sinon.restore());

  it('a single picture row decorates into .hero-transition-v4-media', () => {
    const el = block([[img]]);
    decorate(el);
    expect(el.querySelector('.hero-transition-v4-media picture')).to.exist;
  });

  it('a row with a picture cell and a sibling text cell in the same row keeps the text (Fix 1 regression)', () => {
    const el = block([[img, '<p>Caption</p>']]);
    decorate(el);
    expect(el.querySelector('.hero-transition-v4-media picture')).to.exist;
    expect(el.textContent).to.include('Caption');
  });

  it('an extra separate row is still merged in, not dropped', () => {
    const el = block([[img], ['<p>Extra authored row</p>']]);
    decorate(el);
    expect(el.querySelector('.hero-transition-v4-media picture')).to.exist;
    expect(el.textContent).to.include('Extra authored row');
  });

  it('an empty block (no rows) does not throw', () => {
    const el = document.createElement('div');
    el.className = 'hero-transition-v4';
    document.body.append(el);
    expect(() => decorate(el)).to.not.throw();
  });

  describe('re-decoration idempotency (Fix 2)', () => {
    let originalIO;

    beforeEach(() => {
      originalIO = window.IntersectionObserver;
      window.IntersectionObserver = FakeIntersectionObserver;
      FakeIntersectionObserver.instances = [];
    });

    afterEach(() => {
      window.IntersectionObserver = originalIO;
    });

    it('double-decorate does not lose content, strip DOM wrapping, or register a second observer', () => {
      sinon.stub(navigator, 'hardwareConcurrency').value(8);
      const el = block([[img], ['<p>Extra caption</p>']]);

      decorate(el);
      expect(el.querySelector('.hero-transition-v4-media picture')).to.exist;
      expect(el.textContent).to.include('Extra caption');
      // the merged extra cell keeps its own wrapping div — same shape as an
      // authored cell, not unwrapped down to its bare <p>
      expect(el.querySelector('div > p')).to.exist;
      const htmlBefore = el.innerHTML;
      const observerCountBefore = FakeIntersectionObserver.instances.length;
      expect(observerCountBefore).to.equal(1);

      decorate(el); // must be a no-op due to the idempotency guard

      expect(el.innerHTML).to.equal(htmlBefore);
      expect(el.textContent).to.include('Extra caption');
      expect(el.querySelector('div > p')).to.exist;
      expect(FakeIntersectionObserver.instances.length).to.equal(observerCountBefore);
    });
  });
});
