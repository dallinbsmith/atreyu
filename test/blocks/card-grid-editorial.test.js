import { expect } from '@esm-bundle/chai';
import sinon from 'sinon';
import decorate from '../../blocks/card-grid-editorial/card-grid-editorial.js';

// Matches carousel.test.js's fixture convention: a real photo (.jpg, wide) vs
// a small graphic (.svg, narrow) are what inferMediaLayout() actually keys off.
const photo = (src = 'card.jpg') => `<picture><img src="${src}" width="1600"></picture>`;
const logo = (src = 'logo.svg') => `<picture><img src="${src}" width="80"></picture>`;

const cardRow = ({
  media = photo(), withLogo = false, heading = 'Headline', link = '<a href="/story">Read more</a>',
} = {}) => `<div>${media}${withLogo ? logo() : ''}<h3>${heading}</h3><p>${link}</p></div>`;

const block = (rowsHtml) => {
  const el = document.createElement('div');
  el.className = 'card-grid-editorial';
  rowsHtml.forEach((html) => {
    const row = document.createElement('div');
    row.innerHTML = html;
    el.append(row);
  });
  document.body.append(el);
  return el;
};

describe('card-grid-editorial', () => {
  it('builds a card from image/heading/link, whole card is one link', async () => {
    const el = block([cardRow({ heading: 'Real headline', link: '<a href="/a">Go</a>' })]);
    await decorate(el);
    const card = el.querySelector('.cge-card');
    expect(card.tagName).to.equal('A');
    expect(card.getAttribute('href')).to.equal('/a');
    expect(card.querySelector('.cge-title').textContent).to.equal('Real headline');
    expect(card.querySelector('.cge-cta').textContent).to.equal('Go');
    expect(card.querySelector('.cge-media picture')).to.exist;
  });

  it('a second, smaller picture in the row is treated as the logo overlay, not a second content image', async () => {
    const el = block([cardRow({ withLogo: true })]);
    await decorate(el);
    const pics = el.querySelectorAll('.cge-media picture');
    expect(pics).to.have.length(2);
    expect(pics[0].querySelector('img').getAttribute('src')).to.equal('card.jpg');
    expect(pics[1].querySelector('img').getAttribute('src')).to.equal('logo.svg');
  });

  it('two real photos in one row: the second is dropped, not misread as the logo', async () => {
    const el = block([cardRow({ media: photo('card.jpg') + photo('card2.jpg') })]);
    await decorate(el);
    const pics = el.querySelectorAll('.cge-media picture');
    expect(pics).to.have.length(1);
    expect(pics[0].querySelector('img').getAttribute('src')).to.equal('card.jpg');
  });

  it('grid becomes visible (cge-in) even in the common case of 6 or fewer cards', async () => {
    // shouldAnimate() forced false so onReveal's immediate (non-observer)
    // branch fires synchronously — otherwise this races real
    // IntersectionObserver timing in the test browser.
    sinon.stub(navigator, 'hardwareConcurrency').value(1);
    const el = block([cardRow()]);
    await decorate(el);
    expect(el.classList.contains('cge-in')).to.be.true;
    sinon.restore();
  });

  it('a row with no link or no heading is skipped gracefully, not thrown', async () => {
    const el = block([
      cardRow(),
      `<div>${photo()}<p>No heading here</p></div>`,
      '<div><h3>No image or link</h3></div>',
    ]);
    expect(() => decorate(el)).to.not.throw();
    await decorate(el);
    expect(el.querySelectorAll('.cge-card')).to.have.length(1);
  });

  it('6 or fewer cards: no show-more toggle rendered', async () => {
    const el = block(Array.from({ length: 6 }, (_, i) => cardRow({ heading: `Card ${i}` })));
    await decorate(el);
    expect(el.querySelectorAll('.cge-card')).to.have.length(6);
    expect(el.querySelector('.cge-toggle')).to.not.exist;
  });

  it('more than 6 cards: extras start hidden behind a toggle, expand/collapse works', async () => {
    const el = block(Array.from({ length: 8 }, (_, i) => cardRow({ heading: `Card ${i}` })));
    await decorate(el);
    const cards = [...el.querySelectorAll('.cge-card')];
    expect(cards).to.have.length(8);
    expect(cards.slice(0, 6).every((c) => !c.classList.contains('cge-hidden'))).to.be.true;
    expect(cards.slice(6).every((c) => c.classList.contains('cge-hidden'))).to.be.true;

    const toggle = el.querySelector('.cge-toggle');
    expect(toggle.getAttribute('aria-expanded')).to.equal('false');

    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).to.equal('true');
    expect(cards.slice(6).every((c) => !c.classList.contains('cge-hidden'))).to.be.true;
    expect(document.activeElement).to.equal(cards[6]);

    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).to.equal('false');
    expect(cards.slice(6).every((c) => c.classList.contains('cge-hidden'))).to.be.true;
  });

  it('collapsing while focus is inside a card being hidden moves focus to the toggle instead of stranding it', async () => {
    const el = block(Array.from({ length: 8 }, (_, i) => cardRow({ heading: `Card ${i}` })));
    await decorate(el);
    const cards = [...el.querySelectorAll('.cge-card')];
    const toggle = el.querySelector('.cge-toggle');

    toggle.click(); // expand
    cards[7].focus();
    expect(document.activeElement).to.equal(cards[7]);

    toggle.click(); // collapse — cards[7] is about to become display: none
    expect(document.activeElement).to.equal(toggle);
    expect(cards[7].classList.contains('cge-hidden')).to.be.true;
  });

  it('double-decorate does not duplicate cards or throw', async () => {
    const el = block([cardRow(), cardRow({ heading: 'Second' })]);
    await decorate(el);
    await decorate(el);
    expect(el.querySelectorAll('.cge-card')).to.have.length(2);
  });

  it('a card authored with no image at all still renders (heading + link, no media wrapper)', async () => {
    const el = block(['<div><h3>No image</h3><p><a href="/x">Go</a></p></div>']);
    await decorate(el);
    const card = el.querySelector('.cge-card');
    expect(card).to.exist;
    expect(card.querySelector('.cge-media')).to.not.exist;
    expect(card.querySelector('.cge-title').textContent).to.equal('No image');
  });

  it('reuses the real, already-decorated <a> as the card root instead of rebuilding one, preserving attributes ak.js already set', async () => {
    // Simulates the real pipeline order: ak.js's decorateLink() already ran
    // (setting target/rel) before this block's own decorate() ever runs.
    const el = block([cardRow({ link: '<a href="/x" target="_blank" rel="noopener noreferrer">Go</a>' })]);
    await decorate(el);
    const card = el.querySelector('.cge-card');
    expect(card.tagName).to.equal('A');
    expect(card.getAttribute('href')).to.equal('/x');
    expect(card.target).to.equal('_blank');
    expect(card.rel).to.equal('noopener noreferrer');
  });

  it('empty block (no rows) does not throw', async () => {
    const el = block([]);
    await decorate(el);
    expect(el.querySelectorAll('.cge-card')).to.have.length(0);
  });
});
