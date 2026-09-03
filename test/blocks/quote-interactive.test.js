import { expect } from '@esm-bundle/chai';
import decorate from '../../blocks/quote-interactive/quote-interactive.js';

// Row shape: head row (heading), then one row per quote with
// category / quote / attribution cells.
const build = (slides) => {
  const el = document.createElement('div');
  el.className = 'quote-interactive';
  const head = document.createElement('div');
  head.innerHTML = '<h2>Customer quotes</h2>';
  el.append(head);
  slides.forEach(([cat, quote, attr]) => {
    const row = document.createElement('div');
    [cat, quote, attr].forEach((text) => {
      const cell = document.createElement('div');
      cell.textContent = text;
      row.append(cell);
    });
    el.append(row);
  });
  document.body.append(el);
  return el;
};

describe('quote-interactive', () => {
  it('builds one tab and one panel per slide row', () => {
    const el = build([['Sports', 'Great tool', 'Alex'], ['Film', 'Loved it', 'Sam']]);
    decorate(el);
    expect(el.querySelectorAll('.qi-tab')).to.have.length(2);
    expect(el.querySelectorAll('.qi-panel')).to.have.length(2);
  });

  it('activates only the first tab/panel initially', () => {
    const el = build([['Sports', 'Great tool', 'Alex'], ['Film', 'Loved it', 'Sam']]);
    decorate(el);
    const tabs = [...el.querySelectorAll('.qi-tab')];
    const panels = [...el.querySelectorAll('.qi-panel')];
    expect(tabs[0].getAttribute('aria-selected')).to.equal('true');
    expect(panels[0].hasAttribute('hidden')).to.be.false;
    expect(panels[1].hasAttribute('hidden')).to.be.true;
  });

  it('clicking a tab switches the active tab and visible panel', () => {
    const el = build([['Sports', 'Great tool', 'Alex'], ['Film', 'Loved it', 'Sam'], ['Music', 'Solid', 'Jo']]);
    decorate(el);
    const tabs = [...el.querySelectorAll('.qi-tab')];
    const panels = [...el.querySelectorAll('.qi-panel')];
    tabs[2].click();
    expect(tabs[2].getAttribute('aria-selected')).to.equal('true');
    expect(tabs[0].getAttribute('aria-selected')).to.equal('false');
    expect(panels[2].hasAttribute('hidden')).to.be.false;
    expect(panels[0].hasAttribute('hidden')).to.be.true;
  });

  it('a single-slide block does not throw (no tabs to switch between)', () => {
    const el = build([['Sports', 'Great tool', 'Alex']]);
    expect(() => decorate(el)).to.not.throw();
  });
});
