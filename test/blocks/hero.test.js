import { expect } from '@esm-bundle/chai';
import sinon from 'sinon';
import decorate from '../../blocks/hero/hero.js';

const block = (rowsHtml) => {
  const el = document.createElement('div');
  el.className = 'hero';
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

describe('hero', () => {
  afterEach(() => sinon.restore());

  it('classifies the row with a picture as background regardless of position', async () => {
    const el = block([[img], ['<h1>Title</h1>']]);
    await decorate(el);
    expect(el.querySelector('.hero-background picture')).to.exist;
    expect(el.querySelector('.hero-foreground h1')).to.exist;
  });

  it('single content row (no background) does not throw and has no .hero-background', async () => {
    const el = block([['<h1>Just text</h1>']]);
    await decorate(el); // Mocha fails the test if this rejects — no chai-as-promised needed
    expect(el.querySelector('.hero-background')).to.not.exist;
    expect(el.querySelector('.hero-foreground h1')).to.exist;
  });

  it('an unexpected extra content row is merged into foreground, not misread as background', async () => {
    const el = block([[img], ['<h1>Real title</h1>'], ['<p>Extra authored row</p>']]);
    await decorate(el);
    const fg = el.querySelector('.hero-foreground');
    expect(fg.textContent).to.include('Real title');
    expect(fg.textContent).to.include('Extra authored row');
    // the extra row must not have become — or replaced — the background
    expect(el.querySelectorAll('.hero-background').length).to.equal(1);
    expect(el.querySelector('.hero-background picture')).to.exist;
  });

  it('an empty block does not throw', async () => {
    const el = document.createElement('div');
    el.className = 'hero';
    document.body.append(el);
    await decorate(el); // Mocha fails the test if this rejects
  });

  it('first foreground cell gets hero-text-start, never hero-text-end, even with 2+ text cells', async () => {
    const el = block([[img], ['<h1>A</h1>', '<p><a href="/x">Go</a></p>']]);
    await decorate(el);
    expect(el.classList.contains('hero-text-start')).to.be.true;
    expect(el.classList.contains('hero-text-end')).to.be.false;
  });

  it('a row mixing a picture cell with a heading cell keeps the heading in the foreground', async () => {
    const el = block([[img, '<h1>Title</h1>']]);
    await decorate(el);
    expect(el.querySelector('.hero-background picture')).to.exist;
    expect(el.querySelector('.hero-foreground h1')).to.exist;
    expect(el.querySelector('.hero-background h1')).to.not.exist;
  });

  it('double-decorate does not attach a second click listener to the video link', async () => {
    const wistiaHtml = '<p><a href="https://frameio.wistia.com/medias/abc123">Watch</a></p>';
    const el = block([[img], ['<h1>Title</h1>', wistiaHtml]]);
    await decorate(el);
    const link = el.querySelector('a');
    const addSpy = sinon.spy(link, 'addEventListener');
    await decorate(el); // second call must be a no-op due to the idempotency guard
    expect(addSpy.callCount).to.equal(0);
    expect(el.querySelectorAll('.hero-foreground').length).to.equal(1);
  });

  it('a plain paragraph preceding the heading (not an authored eyebrow) does not get hero-detail', async () => {
    const el = block([['<p>Some intro</p><h1>Title</h1>']]);
    await decorate(el);
    const p = el.querySelector('p');
    expect(p.classList.contains('hero-detail')).to.be.false;
  });

  it('an authored eyebrow ([[eyebrow|text]]) gets hero-detail', async () => {
    const el = block([['<p>[[eyebrow|Featured]]</p><h1>Title</h1>']]);
    await decorate(el);
    const eyebrowP = el.querySelector('.rt-eyebrow')?.closest('p');
    expect(eyebrowP).to.exist;
    expect(eyebrowP.classList.contains('hero-detail')).to.be.true;
  });
});
