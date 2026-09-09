import { expect } from '@esm-bundle/chai';
import decorate from '../../blocks/faq/faq.js';

// Build an EDS-shaped FAQ block: rows are divs, each cell is a div.
// Pass `[question]` (single-element tuple) to author a row with no answer
// column at all — i.e. only one child div, matching real malformed authoring.
const block = (rows) => {
  const el = document.createElement('div');
  el.className = 'faq';
  rows.forEach(([question, answer]) => {
    const row = document.createElement('div');
    const qCol = document.createElement('div');
    qCol.textContent = question;
    row.append(qCol);
    if (answer !== undefined) {
      const aCol = document.createElement('div');
      aCol.innerHTML = answer;
      row.append(aCol);
    }
    el.append(row);
  });
  document.body.append(el);
  return el;
};

describe('faq', () => {
  it('decorates a 2-row FAQ into details/summary with correct question/answer content', () => {
    const el = block([['Q1', '<p>A1</p>'], ['Q2', '<p>A2</p>']]);
    decorate(el);

    const items = el.querySelectorAll('.faq-item');
    expect(items).to.have.length(2);
    expect(items[0].tagName).to.equal('DETAILS');
    expect(items[0].querySelector('summary.faq-question').textContent).to.equal('Q1');
    expect(items[0].querySelector('.faq-answer').textContent.trim()).to.equal('A1');
    expect(items[1].querySelector('summary.faq-question').textContent).to.equal('Q2');
    expect(items[1].querySelector('.faq-answer').textContent.trim()).to.equal('A2');

    // original authored rows are gone — only the built .faq-item <details> remain
    expect(el.querySelectorAll(':scope > div')).to.have.length(0);
  });

  it('skips a row whose question is empty/whitespace-only (regression for empty accessible-name fix)', () => {
    const el = block([['   ', '<p>Answer</p>'], ['Real Q', '<p>Real A</p>']]);
    decorate(el);

    const items = el.querySelectorAll('.faq-item');
    expect(items).to.have.length(1);
    expect(items[0].querySelector('summary').textContent).to.equal('Real Q');
  });

  it('skips a row missing its answer column without throwing', () => {
    const el = block([['Only a question, no answer column']]);

    expect(() => decorate(el)).to.not.throw();
    expect(el.querySelectorAll('.faq-item')).to.have.length(0);
    // the malformed row is still removed from the DOM by the unconditional cleanup
    expect(el.querySelectorAll(':scope > div')).to.have.length(0);
  });

  it('double decorate produces identical output both times and does not throw', () => {
    const el = block([['Q1', '<p>A1</p>'], ['Q2', '<p>A2</p>']]);
    decorate(el);
    const firstHtml = el.innerHTML;

    expect(() => decorate(el)).to.not.throw();
    expect(el.innerHTML).to.equal(firstHtml);
    expect(el.querySelectorAll('.faq-item')).to.have.length(2);
  });
});
