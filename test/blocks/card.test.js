import { expect } from '@esm-bundle/chai';
import decorate from '../../blocks/card/card.js';

// Build an EDS-shaped card block: one row, whose direct-child divs are the
// authored cells. Real cards are authored as a single cell holding picture +
// heading + body + CTA link all together (card.js unwraps the picture into
// its own sibling div, leaving the rest as the content cell).
const block = (cellsHtml, classes = '') => {
  const el = document.createElement('div');
  el.className = `card ${classes}`.trim();
  const row = document.createElement('div');
  cellsHtml.forEach((html) => {
    const cell = document.createElement('div');
    cell.innerHTML = html;
    row.append(cell);
  });
  el.append(row);
  document.body.append(el);
  return el;
};

describe('card', () => {
  it('decorates a normal single-cell card: picture, content, and CTA land in their own containers', () => {
    const el = block([
      '<p><picture><img src="card.jpg"></picture></p><h3>Card Title</h3><p>Body copy</p><p><a href="/go">Go</a></p>',
    ]);
    decorate(el);
    const inner = el.querySelector('.card-inner');
    expect(inner).to.exist;
    expect(inner.querySelector('.card-picture-container picture')).to.exist;
    expect(inner.querySelector('.card-content-container h3').textContent).to.equal('Card Title');
    expect(inner.querySelector('.card-content-container p:not(:has(a))').textContent).to.equal('Body copy');
    expect(inner.querySelector('.card-cta-container a').getAttribute('href')).to.equal('/go');
  });

  // Regression for the positional/class-absence `:not([class])` selector: an
  // authored media cell, once its picture is extracted, is left behind as an
  // empty unclassed div. The old positional query could grab that empty
  // leftover (document order) instead of the real content cell.
  it('an extra (media) column left empty after picture extraction is not misclassified as content', () => {
    const el = block([
      '<p><picture><img src="card.jpg"></picture></p>',
      '<h3>Card Title</h3><p>Body copy</p><p><a href="/go">Go</a></p>',
    ]);
    decorate(el);
    const inner = el.querySelector('.card-inner');
    expect(inner.querySelectorAll('.card-content-container')).to.have.length(1);
    const con = inner.querySelector('.card-content-container');
    expect(con.querySelector('h3').textContent).to.equal('Card Title');
    expect(inner.querySelector('.card-cta-container a').getAttribute('href')).to.equal('/go');
  });

  // Regression for the positional `div:last-of-type > p:last-of-type a` CTA
  // selector: a CTA paragraph followed by a later, link-less paragraph is no
  // longer the literal last paragraph, so a positional lookup would miss it.
  it('finds the CTA link even when it is not the last authored paragraph', () => {
    const el = block([
      '<h3>Card Title</h3><p><a href="/go">Go</a></p><p>Trailing disclaimer text</p>',
    ]);
    decorate(el);
    const cta = el.querySelector('.card-cta-container a');
    expect(cta).to.exist;
    expect(cta.getAttribute('href')).to.equal('/go');
  });

  it('decorating twice is idempotent — no throw, no duplicate containers', () => {
    const el = block([
      '<h3>Card Title</h3><p>Body copy</p><p><a href="/go">Go</a></p>',
    ]);
    decorate(el);
    decorate(el);
    expect(() => decorate(el)).to.not.throw();
    expect(el.querySelectorAll('.card-content-container')).to.have.length(1);
    expect(el.querySelectorAll('.card-cta-container')).to.have.length(1);
    expect(el.querySelector('.card-cta-container a').getAttribute('href')).to.equal('/go');
  });

  it('an empty block (zero rows) does not throw', () => {
    const el = document.createElement('div');
    el.className = 'card';
    document.body.append(el);
    expect(() => decorate(el)).to.not.throw();
  });
});
