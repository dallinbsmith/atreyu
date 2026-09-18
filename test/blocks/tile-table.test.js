import { expect } from '@esm-bundle/chai';
import decorate from '../../blocks/tile-table/tile-table.js';

// EDS-shaped block: each row is a div with three cells — name / detail / link.
const block = (rows) => {
  const el = document.createElement('div');
  el.className = 'tile-table';
  rows.forEach(([name, detail, href, linkText]) => {
    const row = document.createElement('div');
    const nameCell = document.createElement('div');
    nameCell.textContent = name;
    const detailCell = document.createElement('div');
    detailCell.textContent = detail;
    const linkCell = document.createElement('div');
    linkCell.innerHTML = `<a href="${href}">${linkText}</a>`;
    row.append(nameCell, detailCell, linkCell);
    el.append(row);
  });
  document.body.append(el);
  return el;
};

const rows = [
  ['Acme', 'Sync tool', '/acme', 'Learn'],
  ['Globex', 'Review tool', '/globex', 'Learn'],
];

describe('tile-table', () => {
  it('builds one tile per authored row inside a single grid', () => {
    const el = block(rows);
    decorate(el);
    expect(el.querySelectorAll('.tt-grid')).to.have.length(1);
    expect(el.querySelectorAll('.tt-tile')).to.have.length(2);
    expect(el.querySelector('.tt-label')?.textContent).to.equal('Acme');
  });

  // Guard against re-decoration: after the first pass el.children is [grid], so
  // an unguarded second pass would read the grid's own tile <button>s as
  // name/detail/link cells and rebuild the block from garbage. The guardDecorate
  // check must make the second call a no-op.
  it('double-decorate leaves exactly one grid of the original tiles, not a rebuild', () => {
    const el = block(rows);
    decorate(el);
    decorate(el);
    expect(el.querySelectorAll('.tt-grid')).to.have.length(1);
    expect(el.querySelectorAll('.tt-tile')).to.have.length(2);
    expect(el.querySelector('.tt-label')?.textContent).to.equal('Acme');
  });
});
