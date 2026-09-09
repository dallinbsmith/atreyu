import { expect } from '@esm-bundle/chai';
import decorate from '../../blocks/case-study/case-study.js';

// Build an EDS-shaped block: rows are divs, each cell is a div.
const block = (rowsHtml) => {
  const el = document.createElement('div');
  el.className = 'case-study';
  rowsHtml.forEach((html) => {
    const row = document.createElement('div');
    const cell = document.createElement('div');
    cell.innerHTML = html;
    row.append(cell);
    el.append(row);
  });
  document.body.append(el);
  return el;
};

const sideRailHtml = '<h2>Acme Corp</h2><a href="/whitepaper.pdf">Download PDF</a><ul><li>50% faster</li><li>2x ROI</li></ul><p>Intro copy</p>';
const articleHtml = '<h3>The Challenge</h3><p>Body copy</p><h3>The Solution</h3><p>More body copy</p>';

describe('case-study', () => {
  it('normal order (side rail first, article second): content lands on the correct side', () => {
    const el = block([sideRailHtml, articleHtml]);
    decorate(el);
    const sideRail = el.querySelector('.case-study-side-rail');
    const article = el.querySelector('.case-study-article');
    expect(sideRail).to.exist;
    expect(article).to.exist;
    expect(sideRail.querySelector('.case-study-download')).to.exist;
    expect(sideRail.querySelector('.case-study-stats')).to.exist;
    expect(article.querySelector('h3').textContent).to.equal('The Challenge');
  });

  it('swapped row order (article authored first, side rail second): classification is still correct by content shape, not position', () => {
    const el = block([articleHtml, sideRailHtml]);
    decorate(el);
    const sideRail = el.querySelector('.case-study-side-rail');
    const article = el.querySelector('.case-study-article');
    expect(sideRail).to.exist;
    expect(article).to.exist;
    expect(sideRail.querySelector('.case-study-download')).to.exist;
    expect(sideRail.querySelector('.case-study-stats')).to.exist;
    expect(article.querySelector('h3').textContent).to.equal('The Challenge');
  });

  it('double-decorate does not throw and produces identical output both times', () => {
    const el = block([sideRailHtml, articleHtml]);
    expect(() => decorate(el)).to.not.throw();
    const firstHtml = el.innerHTML;
    expect(() => decorate(el)).to.not.throw();
    expect(el.innerHTML).to.equal(firstHtml);
    expect(el.querySelectorAll('.case-study-side-rail')).to.have.length(1);
    expect(el.querySelectorAll('.case-study-article')).to.have.length(1);
  });

  it('a row with a completely empty inner cell does not throw', () => {
    const el = document.createElement('div');
    el.className = 'case-study';
    const sideRailRow = document.createElement('div');
    const sideRailCell = document.createElement('div');
    sideRailCell.innerHTML = sideRailHtml;
    sideRailRow.append(sideRailCell);
    // authored row with no inner cell div at all — the empty-cell crash case
    const articleRow = document.createElement('div');
    el.append(sideRailRow, articleRow);
    document.body.append(el);
    expect(() => decorate(el)).to.not.throw();
    expect(el.querySelector('.case-study-side-rail')).to.exist;
    expect(el.querySelector('.case-study-article')).to.exist;
  });
});
