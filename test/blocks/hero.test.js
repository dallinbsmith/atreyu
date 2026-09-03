import { expect } from '@esm-bundle/chai';
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

  it('first foreground cell gets hero-text-start, second gets hero-text-end', async () => {
    const el = block([[img], ['<h1>A</h1>', '<p><a href="/x">Go</a></p>']]);
    await decorate(el);
    expect(el.classList.contains('hero-text-start')).to.be.true;
  });
});
