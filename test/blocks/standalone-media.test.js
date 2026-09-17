import { expect } from '@esm-bundle/chai';
import decorate from '../../blocks/standalone-media/standalone-media.js';

const picture = (src = 'photo.jpg') => `<picture><img src="${src}"></picture>`;

// One row, one cell: the documented single-cell authoring contract.
const mediaRow = (inner = picture()) => `<div><div>${inner}</div></div>`;
// A standalone decoration row — its own row/cell, no media in it. This is
// the exact shape that made cell order matter (the regression under test).
const decorationRow = (text = 'decoration: glassborder') => `<div><div><p>${text}</p></div></div>`;

const block = (rowsHtml) => {
  const el = document.createElement('div');
  el.className = 'standalone-media';
  el.innerHTML = rowsHtml.join('');
  document.body.append(el);
  return el;
};

describe('standalone-media', () => {
  it('a plain picture (no link) renders as-is, no crash', async () => {
    const el = block([mediaRow()]);
    await decorate(el);
    expect(el.querySelector('.standalone-media-media img[src="photo.jpg"]')).to.exist;
  });

  it('an empty block does not throw', async () => {
    const el = block(['<div><div></div></div>']);
    await decorate(el);
    expect(el.querySelector('.standalone-media-media')).to.exist;
  });

  it('finds the media cell by shape (picture), not position — decoration row BEFORE the media row', async () => {
    const el = block([decorationRow(), mediaRow()]);
    await decorate(el);
    expect(el.querySelector('.standalone-media-media img[src="photo.jpg"]')).to.exist;
    expect(el.classList.contains('glassborder')).to.be.true;
  });

  it('finds the media cell by shape (picture), not position — decoration row AFTER the media row', async () => {
    const el = block([mediaRow(), decorationRow()]);
    await decorate(el);
    expect(el.querySelector('.standalone-media-media img[src="photo.jpg"]')).to.exist;
    expect(el.classList.contains('glassborder')).to.be.true;
  });

  it('removes the decoration line so it never renders as visible stray text', async () => {
    const el = block([mediaRow(), decorationRow()]);
    await decorate(el);
    expect(el.textContent.trim()).to.equal('');
  });

  it('recognizes "decoration: glassborder" inside a compound bentos-style line', async () => {
    const el = block([mediaRow(), decorationRow('decoration: glassborder; bg: full')]);
    await decorate(el);
    expect(el.classList.contains('glassborder')).to.be.true;
  });

  it('recognizes "decoration: glassborder" with a trailing semicolon (bentos.js\'s real separator syntax)', async () => {
    const el = block([mediaRow(), decorationRow('decoration: glassborder;')]);
    await decorate(el);
    expect(el.classList.contains('glassborder')).to.be.true;
  });

  it('an unrecognized decoration value does not add the class', async () => {
    const el = block([mediaRow(), decorationRow('decoration: sparkles')]);
    await decorate(el);
    expect(el.classList.contains('glassborder')).to.be.false;
  });

  it('no decoration line at all → no glassborder class, no crash', async () => {
    const el = block([mediaRow()]);
    await decorate(el);
    expect(el.classList.contains('glassborder')).to.be.false;
  });

  it('a picture wrapped in an .mp4 link is handed to decorateVideoMedia (link consumed, a video element appears)', async () => {
    const el = block([mediaRow(`<a href="https://example.com/clip.mp4">${picture()}</a>`)]);
    await decorate(el);
    const media = el.querySelector('.standalone-media-media');
    expect(media.querySelector('a[href$=".mp4"]')).to.not.exist;
    expect(media.querySelector('video')).to.exist;
  });

  it('a picture wrapped in a Wistia link is wired to open the video modal on click, not treated as background video', async () => {
    const el = block([mediaRow('<a href="https://fast.wistia.net/embed/iframe/abc123">'
      + `${picture()}</a>`)]);
    await decorate(el);
    const media = el.querySelector('.standalone-media-media');
    // Wistia link survives (decorateVideoMedia only acts on .mp4 hrefs) and
    // is still the real click target wireVideoModalLinks wired.
    const link = media.querySelector('a');
    expect(link).to.exist;
    link.click();
    expect(document.querySelector('.video-modal')).to.exist;
    document.querySelector('.video-modal-close')?.click();
  });

  it('is idempotent — a second decorate() call on an already-decorated block is a no-op', async () => {
    const el = block([mediaRow()]);
    await decorate(el);
    const first = el.querySelector('.standalone-media-media');
    await decorate(el);
    expect(el.querySelector('.standalone-media-media')).to.equal(first);
    expect(el.querySelectorAll('.standalone-media-media')).to.have.length(1);
  });
});
