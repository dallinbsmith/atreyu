import { expect } from '@esm-bundle/chai';
import { setViewport } from '@web/test-runner-commands';
import decorate from '../../blocks/section-metadata/section-metadata.js';
import { loadStyle } from '../../scripts/ak.js';

// B2: EDS flattens section metadata on the server and keeps values as
// authored, so the block receives `Bento`, `3 col`, `Color-Token-Accent`.
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

  it('Grid: 3 col does not throw and still adds .grid', async () => {
    const el = section({ grid: '3 col' });
    await decorate(el);
    expect(el.classList.contains('grid')).to.equal(true);
    expect(el.classList.contains('grid-3-col')).to.equal(true);
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

  const contentWidth = async ({ style, container }) => {
    const el = document.createElement('div');
    el.className = 'section';
    if (style) el.classList.add(style);
    if (container) el.dataset.container = container;
    el.innerHTML = '<div class="default-content"><p>x</p></div>';
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
});
