import { expect } from '@esm-bundle/chai';
import decorate from '../../blocks/bentos/bentos.js';

// Build an EDS-shaped bentos block: rows are divs, each row's direct
// children are card divs (bentos treats row.children as cards directly,
// unlike side-by-side's row > div > div cell shape).
const block = (rows) => {
  const el = document.createElement('div');
  el.className = 'bentos';
  rows.forEach((cardsHtml) => {
    const row = document.createElement('div');
    cardsHtml.forEach((html) => {
      const card = document.createElement('div');
      card.innerHTML = html;
      row.append(card);
    });
    el.append(row);
  });
  document.body.append(el);
  return el;
};

const card = (n) => `<h3>Card ${n}</h3><p>body ${n}</p><p><a href="/${n}">go</a></p>`;

describe('bentos', () => {
  it('assigns unique data-testids across multiple authored rows (no collisions)', () => {
    const el = block([
      [card(0), card(1)],
      [card(2)],
    ]);
    decorate(el);
    const testids = [...el.querySelectorAll('.bento-card-cta a')].map((a) => a.dataset.testid);
    expect(testids).to.deep.equal([
      'bento-card-0-cta-primary',
      'bento-card-1-cta-primary',
      'bento-card-2-cta-primary',
    ]);
    expect(new Set(testids).size).to.equal(testids.length);
  });

  it('decorates each card via decorateTout (title/body/cta classes + .bento-card)', () => {
    const el = block([[card(0)]]);
    decorate(el);
    const c = el.querySelector('.bento-card');
    expect(c).to.exist;
    expect(c.querySelector('.bento-card-title')).to.exist;
    expect(c.querySelector('.bento-card-body')).to.exist;
    const cta = c.querySelector('.bento-card-cta a');
    expect(cta.classList.contains('btn')).to.be.true;
    expect(cta.classList.contains('btn-primary')).to.be.true;
  });

  it('places a jpg image as background media and marks the card data-media-layout', () => {
    const el = block([['<picture><img src="photo.jpg"></picture><h3>Head</h3><p>copy</p>']]);
    decorate(el);
    const media = el.querySelector('.bento-card-media');
    expect(media.classList.contains('bg')).to.be.true;
    expect(el.querySelector('.bento-card[data-media-layout="background"]')).to.exist;
  });

  it('sets --card-count on each row based on its own card count', () => {
    const el = block([[card(0), card(1)], [card(2)]]);
    decorate(el);
    const rows = [...el.children];
    expect(rows[0].style.getPropertyValue('--card-count')).to.equal('2');
    expect(rows[1].style.getPropertyValue('--card-count')).to.equal('1');
  });
});
