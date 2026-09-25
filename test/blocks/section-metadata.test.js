import { expect } from '@esm-bundle/chai';
import decorate from '../../blocks/section-metadata/section-metadata.js';

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
