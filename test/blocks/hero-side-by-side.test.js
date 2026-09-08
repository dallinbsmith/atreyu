import { expect } from '@esm-bundle/chai';
import decorate from '../../blocks/hero-side-by-side/hero-side-by-side.js';

const block = (rowsHtml) => {
  const el = document.createElement('div');
  el.className = 'hero-side-by-side';
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

describe('hero-side-by-side', () => {
  it('classifies the row with a picture as media regardless of position', () => {
    const el = block([[img], ['<h1>Title</h1>']]);
    decorate(el);
    expect(el.querySelector('.hero-side-by-side-media picture')).to.exist;
    expect(el.querySelector('.hero-side-by-side-content h1')).to.exist;
  });

  it('single content row (no media) adds no-media and does not throw', () => {
    const el = block([['<h1>Just text</h1>']]);
    decorate(el); // Mocha fails the test if this throws
    expect(el.querySelector('.hero-side-by-side-media')).to.not.exist;
    expect(el.classList.contains('no-media')).to.be.true;
    expect(el.querySelector('.hero-side-by-side-content h1')).to.exist;
  });

  it('an unexpected extra content row is merged into content, not misread as media', () => {
    const el = block([[img], ['<h1>Real title</h1>'], ['<p>Extra authored row</p>']]);
    decorate(el);
    const content = el.querySelector('.hero-side-by-side-content');
    expect(content.textContent).to.include('Real title');
    expect(content.textContent).to.include('Extra authored row');
    expect(el.querySelectorAll('.hero-side-by-side-media').length).to.equal(1);
    expect(el.querySelector('.hero-side-by-side-media picture')).to.exist;
  });

  it('an empty block does not throw', () => {
    const el = document.createElement('div');
    el.className = 'hero-side-by-side';
    document.body.append(el);
    decorate(el); // Mocha fails the test if this throws
    expect(el.classList.contains('no-media')).to.be.true;
    expect(el.classList.contains('no-text')).to.be.true;
  });

  it('a media-only row (no real text) adds no-text and does not append an empty content div', () => {
    const el = block([[img]]);
    decorate(el);
    expect(el.classList.contains('no-text')).to.be.true;
    expect(el.querySelector('.hero-side-by-side-content')).to.not.exist;
    expect(el.querySelector('.hero-side-by-side-media picture')).to.exist;
  });

  it('wires a Wistia link in the content to open the video modal instead of navigating', () => {
    const el = block([[img], ['<p><a href="https://frameio.wistia.com/medias/abc123">Watch Overview</a></p>']]);
    decorate(el);
    const link = el.querySelector('a');
    const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(evt);
    expect(evt.defaultPrevented).to.be.true;
  });
});
