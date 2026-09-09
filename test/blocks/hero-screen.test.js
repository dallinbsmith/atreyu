import { expect } from '@esm-bundle/chai';
import sinon from 'sinon';
import decorate from '../../blocks/hero-screen/hero-screen.js';

const block = (rowsHtml) => {
  const el = document.createElement('div');
  el.className = 'hero-screen';
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

describe('hero-screen', () => {
  afterEach(() => sinon.restore());

  it('classifies the row with a picture as media regardless of position', () => {
    const el = block([[img], ['<h1>Title</h1>']]);
    decorate(el);
    expect(el.querySelector('.hero-screen-media picture')).to.exist;
    expect(el.querySelector('.hero-screen-content h1')).to.exist;
  });

  it('single content row (no media) does not throw and has no .hero-screen-media', () => {
    const el = block([['<h1>Just text</h1>']]);
    decorate(el); // Mocha fails the test if this throws
    expect(el.querySelector('.hero-screen-media')).to.not.exist;
    expect(el.querySelector('.hero-screen-content h1')).to.exist;
  });

  it('an unexpected extra content row is merged into content, not misread as media', () => {
    const el = block([[img], ['<h1>Real title</h1>'], ['<p>Extra authored row</p>']]);
    decorate(el);
    const content = el.querySelector('.hero-screen-content');
    expect(content.textContent).to.include('Real title');
    expect(content.textContent).to.include('Extra authored row');
    // the extra row must not have become — or replaced — the media
    expect(el.querySelectorAll('.hero-screen-media').length).to.equal(1);
    expect(el.querySelector('.hero-screen-media picture')).to.exist;
  });

  it('an empty block does not throw', () => {
    const el = document.createElement('div');
    el.className = 'hero-screen';
    document.body.append(el);
    decorate(el); // Mocha fails the test if this throws
  });

  it('wires a Wistia link in the content to open the video modal instead of navigating', () => {
    const el = block([[img], ['<p><a href="https://frameio.wistia.com/medias/abc123">Watch the Video</a></p>']]);
    decorate(el);
    const link = el.querySelector('a');
    const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(evt);
    expect(evt.defaultPrevented).to.be.true;
  });

  it('double-decorate does not attach a second click listener to the video link', () => {
    const wistiaHtml = '<p><a href="https://frameio.wistia.com/medias/abc123">Watch</a></p>';
    const el = block([[img], [wistiaHtml]]);
    decorate(el);
    const link = el.querySelector('a');
    const addSpy = sinon.spy(link, 'addEventListener');
    decorate(el); // second call must be a no-op due to the idempotency guard
    expect(addSpy.callCount).to.equal(0);
    expect(el.querySelectorAll('.hero-screen-content').length).to.equal(1);
  });
});
