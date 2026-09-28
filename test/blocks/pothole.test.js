import { expect } from '@esm-bundle/chai';
import sinon from 'sinon';
import decorate from '../../blocks/pothole/pothole.js';

const block = (rowsHtml, classes = '') => {
  const el = document.createElement('div');
  el.className = `pothole ${classes}`.trim();
  rowsHtml.forEach((html) => {
    const row = document.createElement('div');
    const cell = document.createElement('div');
    cell.innerHTML = html;
    row.append(cell);
    el.append(row);
  });
  document.body.append(el);
  return el;
};

// EDS-shaped multi-cell row: each string in `cellsHtml` becomes its own cell
// (sibling `div` under the row), matching the real authoring shape where a
// picture cell and a text cell can live in the SAME row as sibling columns.
const rowWithCells = (cellsHtml) => {
  const el = document.createElement('div');
  el.className = 'pothole';
  const row = document.createElement('div');
  cellsHtml.forEach((html) => {
    const cell = document.createElement('div');
    cell.innerHTML = html;
    row.append(cell);
  });
  el.append(row);
  document.body.append(el);
  return el;
};

const img = '<picture><img src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="></picture>';

// Real IntersectionObserver timing is not deterministic in a headless test
// runner, and scroll.js's trackScrollProgress looks up the global
// `IntersectionObserver` identifier at call-time (not an imported binding) —
// so swapping the global constructor for a fake that just records how many
// times it was constructed lets a test assert on instance count
// deterministically. Restored in afterEach. Pattern matches
// hero-cards-transition.test.js/footer-glow.test.js.
class FakeIntersectionObserver {
  constructor() {
    FakeIntersectionObserver.instances.push(this);
  }

  observe() {}

  unobserve() {}

  disconnect() {}
}
FakeIntersectionObserver.instances = [];

describe('pothole', () => {
  it('moves the background picture into .pothole-background', () => {
    const el = block([img, '<h2>Title</h2><p>Body</p>']);
    decorate(el);
    expect(el.querySelector('.pothole-background picture')).to.exist;
    expect(el.querySelector('.pothole-background img').alt).to.equal('');
  });

  it('last row becomes .pothole-content', () => {
    const el = block([img, '<h2>Title</h2><p><a href="/a">Go</a></p>']);
    decorate(el);
    expect(el.querySelector('.pothole-content h2')).to.exist;
  });

  it('missing background row → no throw, no .pothole-background', () => {
    const el = block(['<h2>Just text</h2>']);
    expect(() => decorate(el)).to.not.throw();
    expect(el.querySelector('.pothole-background')).to.not.exist;
  });

  it('classes CTA links as .btn with primary/secondary ordering', () => {
    const el = block([img, '<p><a href="/a">A</a></p><p><a href="/b">B</a></p>']);
    decorate(el);
    const links = el.querySelectorAll('.pothole-content a');
    expect(links[0].classList.contains('btn-primary')).to.be.true;
    expect(links[1].classList.contains('btn-secondary')).to.be.true;
  });

  it('[[eyebrow|x]] becomes span.rt-eyebrow inside the content', () => {
    const el = block([img, '<p>[[eyebrow|New]]</p><h2>Title</h2>']);
    decorate(el);
    expect(el.querySelector('.pothole-content .rt-eyebrow')).to.exist;
  });

  it('an author-provided second content row is merged in, not dropped', () => {
    const el = block([img, '<h2>Real content</h2>', '<p>Second row</p>']);
    decorate(el);
    const text = el.querySelector('.pothole-content').textContent;
    expect(text).to.include('Real content');
    expect(text).to.include('Second row');
  });

  it('a link already classed .btn (e.g. by decorateButton) is not re-classed positionally', () => {
    const el = block([img, '<p><a class="btn btn-accent" href="/a">A</a></p>']);
    decorate(el);
    const a = el.querySelector('.pothole-content a');
    expect(a.classList.contains('btn-accent')).to.be.true;
    expect(a.classList.contains('btn-primary')).to.be.false;
  });

  it('assigns pothole-cta-primary/secondary data-testid values', () => {
    const el = block([img, '<p><a href="/a">A</a></p><p><a href="/b">B</a></p>']);
    decorate(el);
    const links = el.querySelectorAll('.pothole-content a');
    expect(links[0].dataset.testid).to.equal('pothole-cta-primary');
    expect(links[1].dataset.testid).to.equal('pothole-cta-secondary');
  });

  it('an empty block does not throw', () => {
    const el = document.createElement('div');
    el.className = 'pothole';
    document.body.append(el);
    expect(() => decorate(el)).to.not.throw();
  });

  it('a picture cell and a sibling text cell in the SAME row: the text is preserved, not dropped', () => {
    const el = rowWithCells([img, '<h2>Real content</h2><p><a href="/a">Go</a></p>']);
    decorate(el);
    expect(el.querySelector('.pothole-background picture')).to.exist;
    const text = el.querySelector('.pothole-content')?.textContent ?? '';
    expect(text).to.include('Real content');
    expect(el.querySelector('.pothole-content a')).to.exist;
  });

  describe('trailing scale: n metadata row', () => {
    it('a "scale: n" trailing row sets --media-scale and is removed from content', () => {
      const el = block([img, '<h2>Title</h2>', 'scale: 1.2']);
      decorate(el);
      expect(el.style.getPropertyValue('--media-scale')).to.equal('1.2');
      expect(el.querySelectorAll(':scope > div')).to.have.length(2);
    });

    it('scale matching is case-insensitive ("Scale: 1.2")', () => {
      const el = block([img, '<h2>Title</h2>', 'Scale: 1.2']);
      decorate(el);
      expect(el.style.getPropertyValue('--media-scale')).to.equal('1.2');
      expect(el.querySelectorAll(':scope > div')).to.have.length(2);
    });

    // Non-numeric values do not match META_RE: the row stays as content.
    ['scale: big', 'Scale: from one editor to a thousand', 'scale: -1', 'scale: 0x10',
      'scale: 1.', 'scale: Infinity'].forEach((text) => {
      it(`"${text}" is not meta: kept as content, --media-scale unset`, () => {
        const el = block([img, '<h2>Title</h2>', `<p>${text}</p>`]);
        decorate(el);
        expect(el.style.getPropertyValue('--media-scale')).to.equal('');
        expect(el.querySelector('.pothole-content').textContent).to.include(text);
      });
    });

    // Numeric but unusable values match META_RE: removed, not applied.
    ['scale: 0', 'scale: 0.0', 'scale: 1e999'].forEach((text) => {
      it(`"${text}" is removed as meta but not applied`, () => {
        const el = block([img, '<h2>Title</h2>', text]);
        decorate(el);
        expect(el.style.getPropertyValue('--media-scale')).to.equal('');
        expect(el.querySelector('.pothole-content').textContent).to.not.include(text);
      });
    });

    it('writes the normalized number, not the raw text ("scale: +1.50" -> "1.5")', () => {
      const el = block([img, '<h2>Title</h2>', 'scale: +1.50']);
      decorate(el);
      expect(el.style.getPropertyValue('--media-scale')).to.equal('1.5');
      expect(el.querySelector('.pothole-content').textContent).to.not.include('scale');
    });

    it('a trailing "glow: blue" row is ordinary content: kept, and adds no class', () => {
      const el = block([img, '<h2>Title</h2>', '<p>glow: blue</p>']);
      decorate(el);
      expect(el.classList.contains('glow-blue')).to.be.false;
      expect(el.querySelector('.pothole-content').textContent).to.include('glow: blue');
    });

    it('a two-cell last row is not read as meta', () => {
      const el = block([img, '<h2>Title</h2>']);
      const row = document.createElement('div');
      row.innerHTML = '<div><p>scale: 1.2</p></div><div><p>more</p></div>';
      el.append(row);
      decorate(el);
      expect(el.style.getPropertyValue('--media-scale')).to.equal('');
      const text = el.querySelector('.pothole-content').textContent;
      expect(text).to.include('scale: 1.2');
      expect(text).to.include('more');
    });

    it('a bare number as the last row is content, not meta (no "scale:" key)', () => {
      const el = block([img, '<h2>Title</h2>', '<p>1.2</p>']);
      decorate(el);
      expect(el.style.getPropertyValue('--media-scale')).to.equal('');
      expect(el.querySelector('.pothole-content').textContent).to.include('1.2');
    });

    it('regression: plain pothole (no variants, no meta row) leaves --media-scale unset', () => {
      const el = block([img, '<h2>Title</h2>']);
      decorate(el);
      expect(el.className).to.equal('pothole');
      expect(el.style.getPropertyValue('--media-scale')).to.equal('');
    });

    it('a single-row block (sole text matching the meta pattern) does not throw and is treated as content', () => {
      const el = block(['<h2>scale: 1.2</h2>']);
      expect(() => decorate(el)).to.not.throw();
      expect(el.style.getPropertyValue('--media-scale')).to.equal('');
      expect(el.querySelector('.pothole-content').textContent).to.include('scale: 1.2');
    });

    it('a 2-row block never treats its last row as metadata', () => {
      const el = block([img, '<p>scale: 1.2</p>']);
      decorate(el);
      expect(el.style.getPropertyValue('--media-scale')).to.equal('');
      expect(el.querySelector('.pothole-content').textContent).to.include('scale: 1.2');
    });

    it('an unrecognized trailing row is left as ordinary content, not consumed as metadata', () => {
      const el = block([img, '<h2>Title</h2>', '<p>not metadata</p>']);
      decorate(el);
      expect(el.querySelector('.pothole-content').textContent).to.include('not metadata');
    });

    it('an author-provided second content row is merged in, not dropped — even alongside a metadata row', () => {
      const el = block([img, '<h2>Real content</h2>', '<p>Second row</p>', 'scale: 1.2']);
      decorate(el);
      const text = el.querySelector('.pothole-content').textContent;
      expect(text).to.include('Real content');
      expect(text).to.include('Second row');
      expect(el.style.getPropertyValue('--media-scale')).to.equal('1.2');
    });
  });

  it('preserves author-set variant classes (layout and glow)', () => {
    const el = block([img, '<h2>Title</h2>'], 'top right-aligned overflow glow-blue');
    decorate(el);
    ['top', 'right-aligned', 'overflow', 'glow-blue'].forEach((c) => {
      expect(el.classList.contains(c)).to.be.true;
    });
  });

  describe('re-decoration idempotency', () => {
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

    it('double-decorate does not create a second IntersectionObserver', () => {
      sinon.stub(navigator, 'hardwareConcurrency').value(8);
      const el = block([img, '<h2>Title</h2><p><a href="/a">Go</a></p>']);

      decorate(el);
      expect(FakeIntersectionObserver.instances).to.have.length(1);

      decorate(el);
      expect(FakeIntersectionObserver.instances).to.have.length(1);
      expect(el.querySelector('.pothole-content h2')?.textContent).to.equal('Title');
    });
  });
});
