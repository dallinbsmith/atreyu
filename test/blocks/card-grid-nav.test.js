import { expect } from '@esm-bundle/chai';
import decorate from '../../blocks/card-grid-nav/card-grid-nav.js';

// Build an EDS-shaped block: each row is [media, label, link] — card-grid-nav
// reads all three from anywhere within the row, not from specific cells.
const block = (rowsHtml) => {
  const el = document.createElement('div');
  el.className = 'card-grid-nav';
  rowsHtml.forEach((html) => {
    const row = document.createElement('div');
    row.innerHTML = html;
    el.append(row);
  });
  document.body.append(el);
  return el;
};

const linkRow = () => '<picture><img src="feature.png" alt="Feature icon"></picture><h3>Feature Title</h3><p><a href="/feature-page">Learn more</a></p>';
const noLinkRow = () => '<picture><img src="other.png" alt="Other icon"></picture><h3>No Link Card</h3>';

describe('card-grid-nav', () => {
  it('a row with a link becomes an <a> card carrying the href and heading text as label', () => {
    const el = block([linkRow()]);
    decorate(el);
    const card = el.querySelector('.cgn-card');
    expect(card.tagName).to.equal('A');
    expect(card.getAttribute('href')).to.equal('/feature-page');
    expect(card.querySelector('.cgn-label').textContent).to.equal('Feature Title');
    expect(card.querySelector('.cgn-media img[src="feature.png"]')).to.exist;
  });

  it('a row with no link becomes an inert <div> card, still carrying the heading as label', () => {
    const el = block([noLinkRow()]);
    decorate(el);
    const card = el.querySelector('.cgn-card');
    expect(card.tagName).to.equal('DIV');
    expect(card.hasAttribute('href')).to.be.false;
    expect(card.querySelector('.cgn-label').textContent).to.equal('No Link Card');
  });

  // Regression for the confirmed re-decoration data-loss bug: a second call on
  // an already-decorated element must be a no-op, not silently downgrade the
  // real <a> card (with its href) into an inert <div> with a fallback label.
  it('decorating an already-decorated element twice is idempotent — href/tag/label are unchanged', () => {
    const el = block([linkRow()]);
    decorate(el);
    const before = el.querySelector('.cgn-card');
    const beforeState = {
      tag: before.tagName,
      href: before.getAttribute('href'),
      label: before.querySelector('.cgn-label').textContent,
    };

    decorate(el);
    const after = el.querySelector('.cgn-card');
    const afterState = {
      tag: after.tagName,
      href: after.getAttribute('href'),
      label: after.querySelector('.cgn-label').textContent,
    };

    expect(afterState).to.deep.equal(beforeState);
    expect(afterState.tag).to.equal('A');
    expect(afterState.href).to.equal('/feature-page');
  });
});
