import { expect } from '@esm-bundle/chai';
import { setViewport } from '@web/test-runner-commands';
import decorate from '../../blocks/section-metadata/section-metadata.js';
import { loadStyle } from '../../scripts/ak.js';

// EDS flattens section metadata on the server and keeps values as authored, so
// the block receives `Bento`, `3 col`, `Color-Token-Accent`.
const section = (attrs) => {
  const el = document.createElement('div');
  el.className = 'section';
  el.hidden = true; // keeps a background <img loading="lazy"> from fetching
  for (const [key, value] of Object.entries(attrs)) el.dataset[key] = value;
  document.body.append(el);
  return el;
};

describe('section-metadata block: authored-case values (B2)', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('Layout: Bento becomes .layout-bento', async () => {
    const el = section({ layout: 'Bento' });
    await decorate(el);
    expect(el.classList.contains('layout-bento')).to.equal(true);
    expect(el.dataset.layout).to.equal(undefined);
  });

  it('Grid: 3 col does not throw and adds no class', async () => {
    const el = section({ grid: '3 col' });
    await decorate(el);
    expect([...el.classList]).to.deep.equal(['section']);
  });

  it('Grid: 2 to 6 add .grid and .grid-N', async () => {
    for (const value of ['2', '3', '4', '5', '6']) {
      const el = section({ grid: value });
      // eslint-disable-next-line no-await-in-loop
      await decorate(el);
      expect([...el.classList]).to.have.members(['section', 'grid', `grid-${value}`]);
      expect(el.dataset.grid).to.equal(undefined);
    }
  });

  it('an unsupported Grid value (7, 1, a typo) adds nothing', async () => {
    for (const value of ['7', '1', 'tree', 'Three']) {
      const el = section({ grid: value });
      // eslint-disable-next-line no-await-in-loop
      await decorate(el);
      expect([...el.classList]).to.deep.equal(['section']);
      expect(el.dataset.grid).to.equal(undefined);
    }
  });

  it('classifies mixed-case gap, spacing and container values', async () => {
    const el = section({
      grid: '3', gap: 'L', spacing: 'XL', container: '4',
    });
    await decorate(el);
    expect([...el.classList]).to.include.members(['grid', 'grid-3', 'gap-l', 'spacing-xl', 'container-4']);
  });

  it('Container: 4 alone adds .container and .container-4', async () => {
    const el = section({ container: '4' });
    await decorate(el);
    expect([...el.classList]).to.have.members(['section', 'container', 'container-4']);
    expect(el.dataset.container).to.equal(undefined);
  });

  it('Container: 0 or empty adds nothing', async () => {
    for (const value of ['0', '']) {
      const el = section({ container: value });
      // eslint-disable-next-line no-await-in-loop
      await decorate(el);
      expect([...el.classList]).to.deep.equal(['section']);
    }
  });

  it('Container: 2, 4 and 6 add .container and .container-N', async () => {
    for (const value of ['2', '4', '6']) {
      const el = section({ container: value });
      // eslint-disable-next-line no-await-in-loop
      await decorate(el);
      expect([...el.classList]).to.have.members(['section', 'container', `container-${value}`]);
    }
  });

  it('an unsupported Container value (3, a typo) adds nothing', async () => {
    for (const value of ['3', 'wide', 'Wide']) {
      const el = section({ container: value });
      // eslint-disable-next-line no-await-in-loop
      await decorate(el);
      expect([...el.classList]).to.deep.equal(['section']);
      expect(el.dataset.container).to.equal(undefined);
    }
  });

  it('Style: container with an unsupported Container value keeps only .container', async () => {
    const el = section({ container: '3' });
    el.classList.add('container');
    await decorate(el);
    expect([...el.classList]).to.deep.equal(['section', 'container']);
  });

  it('Style: container alone is unchanged', async () => {
    const el = section({});
    el.classList.add('container');
    await decorate(el);
    expect([...el.classList]).to.deep.equal(['section', 'container']);
  });

  it('Style: container with Container: 4 keeps one .container', async () => {
    const el = section({ container: '4' });
    el.classList.add('container');
    await decorate(el);
    expect([...el.classList]).to.deep.equal(['section', 'container', 'container-4']);
  });

  it('Grid: 0 still adds nothing', async () => {
    const el = section({ grid: '0' });
    await decorate(el);
    expect([...el.classList]).to.deep.equal(['section']);
  });

  it('Style: grid with an unsupported Grid value keeps only .grid', async () => {
    const el = section({ grid: '7' });
    el.classList.add('grid');
    await decorate(el);
    expect([...el.classList]).to.deep.equal(['section', 'grid']);
  });

  it('keeps the background URL case as authored', async () => {
    const src = `${window.location.origin}/media/Foo.JPG`;
    const el = section({ background: src });
    await decorate(el);
    const img = el.querySelector('.section-background img');
    expect(img.getAttribute('src')).to.contain('/media/Foo.JPG?');
    expect(el.classList.contains('has-background')).to.equal(true);
    expect(el.dataset.background).to.equal(undefined);
  });

  it('matches the URL scheme case-insensitively', async () => {
    const el = section({ background: `${window.location.origin.replace('http', 'HTTP')}/media/Foo.JPG` });
    await decorate(el);
    expect(el.querySelector('.section-background img').getAttribute('src')).to.contain('/media/Foo.JPG?');
    expect(el.style.backgroundColor).to.equal('');
  });

  it('ignores a .MP4 background in any case', async () => {
    const el = section({ background: `${window.location.origin}/media/Clip.MP4` });
    await decorate(el);
    expect(el.querySelector('picture')).to.equal(null);
  });

  it('resolves a color token in any case', async () => {
    const upper = section({ background: 'Color-Token-Accent' });
    const lower = section({ background: 'color-token-accent' });
    await decorate(upper);
    await decorate(lower);
    expect(upper.style.backgroundColor).to.equal('var(--color-accent)');
    expect(lower.style.backgroundColor).to.equal('var(--color-accent)');
  });

  it('passes a plain CSS color through unchanged', async () => {
    const el = section({ background: 'RGB(10, 20, 30)' });
    await decorate(el);
    expect(el.style.backgroundColor).to.equal('rgb(10, 20, 30)');
  });
});

// The CSS sizes `.container-N` only inside `.container`, so these compare
// rendered widths: `Container: N` alone must match `Style: container` plus
// `Container: N` at the md breakpoint and below it.
describe('section-metadata block: container widths', () => {
  before(async () => {
    await loadStyle('/styles/styles.css');
    await loadStyle('/blocks/section-metadata/section-metadata.css');
  });

  afterEach(async () => {
    document.body.innerHTML = '';
    await setViewport({ width: 800, height: 600 });
  });

  const contentWidth = async ({ style, container, wrapper = 'default-content' }) => {
    const el = document.createElement('div');
    el.className = 'section';
    if (style) el.classList.add(style);
    if (container) el.dataset.container = container;
    el.innerHTML = `<div class="${wrapper}"><p>x</p></div>`;
    document.body.append(el);
    await decorate(el);
    return el.firstElementChild.getBoundingClientRect().width;
  };

  for (const width of [375, 800]) {
    it(`Container: 4 alone matches Style: container + Container: 4 at ${width}px`, async () => {
      await setViewport({ width, height: 600 });
      const full = await contentWidth({});
      const both = await contentWidth({ style: 'container', container: '4' });
      const alone = await contentWidth({ container: '4' });
      expect(alone).to.equal(both);
      expect(alone).to.not.equal(full);
    });
  }

  // `Container: N` is N sixths of `--grid-container-width`, centred, at every
  // viewport, for both default content and blocks. The content area is 83.4% of the viewport below
  // 1440px and 1120px from 1440px up (styles.css `:root`).
  const EXPECTED = {
    375: { 2: 104.25, 4: 208.5, 6: 312.75 },
    800: { 2: 222.4, 4: 444.8, 6: 667.2 },
    1440: { 2: 373.33, 4: 746.67, 6: 1120 },
  };
  const TOLERANCE = 1; // subpixel rounding

  for (const [width, sizes] of Object.entries(EXPECTED)) {
    describe(`at ${width}px`, () => {
      beforeEach(() => setViewport({ width: Number(width), height: 600 }));

      for (const [n, px] of Object.entries(sizes)) {
        it(`Container: ${n} is ${n}/6 of the content area (~${px}px)`, async () => {
          const w = await contentWidth({ container: n });
          expect(w).to.be.closeTo(px, TOLERANCE);
        });
      }

      it(`Container: 4 also constrains .block-content (~${sizes[4]}px)`, async () => {
        const w = await contentWidth({ container: '4', wrapper: 'block-content' });
        expect(w).to.be.closeTo(sizes[4], TOLERANCE);
      });

      it('orders Container: 2 < 4 < 6', async () => {
        const two = await contentWidth({ container: '2' });
        const four = await contentWidth({ container: '4' });
        const six = await contentWidth({ container: '6' });
        expect(four - two).to.be.greaterThan(TOLERANCE);
        expect(six - four).to.be.greaterThan(TOLERANCE);
      });

      it('Container: 6 matches the default content width', async () => {
        const full = await contentWidth({});
        const six = await contentWidth({ container: '6' });
        expect(six).to.be.closeTo(full, TOLERANCE);
      });

      it('Style: container alone keeps the default content width', async () => {
        const full = await contentWidth({});
        const styled = await contentWidth({ style: 'container' });
        expect(styled).to.be.closeTo(full, TOLERANCE);
      });

      it('an unsupported value (Container: 3) falls back to the default width', async () => {
        const full = await contentWidth({});
        const three = await contentWidth({ container: '3' });
        expect(three).to.be.closeTo(full, TOLERANCE);
      });

      // Blocks are full-bleed by default; `.container` would cap them.
      for (const value of ['3', 'wide']) {
        it(`Container: ${value} leaves .block-content at the default width`, async () => {
          const full = await contentWidth({ wrapper: 'block-content' });
          const w = await contentWidth({ container: value, wrapper: 'block-content' });
          const el = [...document.querySelectorAll('.section')].at(-1);
          expect(w).to.be.closeTo(full, TOLERANCE);
          expect(w).to.be.greaterThan(sizes[6] + TOLERANCE);
          expect(el.classList.contains('container')).to.equal(false);
        });
      }

      it('centres the constrained content', async () => {
        const w = await contentWidth({ container: '2' });
        const { left } = document.querySelector('.section > .default-content').getBoundingClientRect();
        const sectionWidth = document.querySelector('.section').getBoundingClientRect().width;
        expect(left).to.be.closeTo((sectionWidth - w) / 2, TOLERANCE);
      });
    });
  }
});

// `.grid` alone makes `.block-content` a one-column CSS grid: `Gap:` then
// spaces the blocks, margins stop collapsing, and a block grows to its widest
// content instead of the section width. Without a `grid-N` rule nothing sets
// the column count, so an unsupported value must lay out like no Grid row.
describe('section-metadata block: unsupported Grid values keep the default layout', () => {
  before(async () => {
    await loadStyle('/styles/styles.css');
    await loadStyle('/blocks/section-metadata/section-metadata.css');
  });

  afterEach(async () => {
    document.body.innerHTML = '';
    await setViewport({ width: 800, height: 600 });
  });

  const render = async (data) => {
    const el = document.createElement('div');
    el.className = 'section';
    Object.assign(el.dataset, data);
    el.innerHTML = `<div class="block-content">
      <div class="a"><div style="width: 2000px; height: 10px"></div></div>
      <div class="b"><p>x</p></div>
    </div>`;
    document.body.append(el);
    await decorate(el);
    const [a, b] = el.querySelectorAll('.block-content > div');
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    return { width: ra.width, gap: rb.top - ra.bottom };
  };

  for (const width of [375, 800, 1440]) {
    for (const value of ['7', '1', 'tree']) {
      it(`Grid: ${value} with Gap: l matches no Grid row at ${width}px`, async () => {
        await setViewport({ width, height: 600 });
        const plain = await render({ gap: 'l' });
        const grid = await render({ grid: value, gap: 'l' });
        expect(grid).to.deep.equal(plain);
      });
    }
  }
});
