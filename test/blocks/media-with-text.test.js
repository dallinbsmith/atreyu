import { expect } from '@esm-bundle/chai';
import decorate from '../../blocks/media-with-text/media-with-text.js';

const picture = (src = 'photo.jpg') => `<picture><img src="${src}"></picture>`;

const mediaRow = (inner = picture()) => `<div><div>${inner}</div></div>`;
const textRow = (html = '<h2>Heading</h2><p>Body copy.</p>') => `<div><div>${html}</div></div>`;
const decorationRow = (text = 'decoration: glassborder') => `<div><div><p>${text}</p></div></div>`;

const block = (rowsHtml) => {
  const el = document.createElement('div');
  el.className = 'media-with-text';
  el.innerHTML = rowsHtml.join('');
  document.body.append(el);
  return el;
};

describe('media-with-text', () => {
  it('a plain picture plus a text row renders both, media first', async () => {
    const el = block([mediaRow(), textRow()]);
    await decorate(el);
    const kids = [...el.children];
    expect(kids[0].classList.contains('media-with-text-media')).to.be.true;
    expect(kids[1].classList.contains('media-with-text-text')).to.be.true;
    expect(el.querySelector('.media-with-text-media img[src="photo.jpg"]')).to.exist;
    expect(el.querySelector('.media-with-text-heading').textContent).to.equal('Heading');
  });

  it('an empty block does not throw', async () => {
    const el = block(['<div><div></div></div>']);
    await decorate(el);
    expect(el.querySelector('.media-with-text-media')).to.exist;
    expect(el.querySelector('.media-with-text-text')).to.exist;
  });

  it('a text row with an inline image, authored BEFORE the real media row, does not get misclassified as the media cell', async () => {
    const el = block([textRow('<h2>Heading</h2><p>See our <img src="icon.svg" alt=""> badge.</p>'), mediaRow()]);
    await decorate(el);
    const media = el.querySelector('.media-with-text-media');
    const text = el.querySelector('.media-with-text-text');
    // The real media (photo.jpg) must be the one in .media-with-text-media...
    expect(media.querySelector('img[src="photo.jpg"]')).to.exist;
    // ...and the heading/body text — including the inline icon — must still
    // be in the text container, not swept into the media wrapper.
    expect(text.querySelector('img[src="icon.svg"]')).to.exist;
    expect(el.querySelector('.media-with-text-heading').textContent).to.equal('Heading');
  });

  it('a text row with an inline image, authored AFTER the real media row, does not get misclassified as the media cell', async () => {
    const el = block([mediaRow(), textRow('<h2>Heading</h2><p>See our <img src="icon.svg" alt=""> badge.</p>')]);
    await decorate(el);
    const media = el.querySelector('.media-with-text-media');
    const text = el.querySelector('.media-with-text-text');
    expect(media.querySelector('img[src="photo.jpg"]')).to.exist;
    expect(text.querySelector('img[src="icon.svg"]')).to.exist;
  });

  it('merges multiple text rows into one flat text container', async () => {
    const el = block([mediaRow(), textRow('<h2>Heading</h2>'), textRow('<p>More copy.</p>')]);
    await decorate(el);
    expect(el.querySelectorAll('.media-with-text-text')).to.have.length(1);
    const text = el.querySelector('.media-with-text-text');
    expect(text.querySelector('h2').textContent).to.equal('Heading');
    expect(text.textContent).to.include('More copy.');
  });

  it('recognizes "decoration: glassborder" via the shared parser, in either row order', async () => {
    const before = block([decorationRow(), mediaRow(), textRow()]);
    await decorate(before);
    expect(before.classList.contains('glassborder')).to.be.true;

    const after = block([mediaRow(), textRow(), decorationRow()]);
    await decorate(after);
    expect(after.classList.contains('glassborder')).to.be.true;
  });

  it('removes the decoration line so it never renders as visible stray text', async () => {
    const el = block([mediaRow(), textRow(), decorationRow()]);
    await decorate(el);
    expect(el.textContent).to.not.include('decoration');
  });

  it('a picture wrapped in an .mp4 link is handed to decorateVideoMedia (link consumed, a video element appears)', async () => {
    const el = block([mediaRow(`<a href="https://example.com/clip.mp4">${picture()}</a>`), textRow()]);
    await decorate(el);
    const media = el.querySelector('.media-with-text-media');
    expect(media.querySelector('a[href$=".mp4"]')).to.not.exist;
    expect(media.querySelector('video')).to.exist;
  });

  it('is idempotent — a second decorate() call on an already-decorated block is a no-op', async () => {
    const el = block([mediaRow(), textRow()]);
    await decorate(el);
    const firstMedia = el.querySelector('.media-with-text-media');
    await decorate(el);
    expect(el.querySelector('.media-with-text-media')).to.equal(firstMedia);
    expect(el.querySelectorAll('.media-with-text-media')).to.have.length(1);
  });
});
