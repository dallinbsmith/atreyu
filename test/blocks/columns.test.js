import { expect } from '@esm-bundle/chai';
import decorate from '../../blocks/columns/columns.js';

// Build an EDS-shaped columns block: rows are divs, each cell is a div.
const block = (classes, rowsHtml) => {
  const el = document.createElement('div');
  el.className = `columns ${classes}`.trim();
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

const picture = '<picture><img src="cover.jpg"></picture>';

describe('columns', () => {
  describe('image-cover variant', () => {
    it('a bare <picture> direct child is classified cover-image and its row gets cover-row', () => {
      const el = block('image-cover', [[picture, '<h3>Title</h3><p>Body copy</p>']]);
      decorate(el);
      const cols = el.querySelectorAll('.col');
      expect(cols[0].classList.contains('cover-image')).to.be.true;
      expect(cols[0].classList.contains('cover-content')).to.be.false;
      expect(cols[0].closest('.row').classList.contains('cover-row')).to.be.true;
    });

    // Regression for the bug: real authored images arrive as
    // `<p><picture>...</picture></p>` (the author put the image on its own
    // line) — the old direct-child nodeName check saw a <p> and fell through
    // to cover-content, silently never applying the cover-image CSS treatment.
    it('a <p>-wrapped picture (the realistic authoring shape) is also classified cover-image', () => {
      const el = block('image-cover', [[`<p>${picture}</p>`, '<h3>Title</h3><p>Body copy</p>']]);
      decorate(el);
      const cols = el.querySelectorAll('.col');
      expect(cols[0].classList.contains('cover-image')).to.be.true;
      expect(cols[0].classList.contains('cover-content')).to.be.false;
      expect(cols[0].closest('.row').classList.contains('cover-row')).to.be.true;
    });

    it('a column with real text content and no image is classified cover-content and its row does not get cover-row', () => {
      const el = block('image-cover', [['<h3>Title</h3><p>Body copy</p>', '<h3>Other</h3><p>More copy</p>']]);
      decorate(el);
      const cols = el.querySelectorAll('.col');
      expect(cols[0].classList.contains('cover-content')).to.be.true;
      expect(cols[0].classList.contains('cover-image')).to.be.false;
      expect(cols[0].closest('.row').classList.contains('cover-row')).to.be.false;
    });

    it('an image alongside real body text in the same column is not misclassified as cover-image', () => {
      const el = block('image-cover', [[`<p>${picture}</p><p>Caption text</p>`, '<h3>Other</h3>']]);
      decorate(el);
      const cols = el.querySelectorAll('.col');
      expect(cols[0].classList.contains('cover-content')).to.be.true;
      expect(cols[0].classList.contains('cover-image')).to.be.false;
    });
  });

  describe('base decoration', () => {
    it('assigns row/row-N and col/col-N classes and sets --child-count on each row', () => {
      const el = block('', [
        ['<p>One</p>', '<p>Two</p>', '<p>Three</p>'],
        ['<p>Four</p>'],
      ]);
      decorate(el);
      const rows = el.querySelectorAll('.row');
      expect(rows).to.have.length(2);
      expect(rows[0].classList.contains('row-1')).to.be.true;
      expect(rows[1].classList.contains('row-2')).to.be.true;
      expect(rows[0].style.getPropertyValue('--child-count')).to.equal('3');
      expect(rows[1].style.getPropertyValue('--child-count')).to.equal('1');

      const cols = rows[0].querySelectorAll('.col');
      expect(cols).to.have.length(3);
      expect(cols[0].classList.contains('col-1')).to.be.true;
      expect(cols[1].classList.contains('col-2')).to.be.true;
      expect(cols[2].classList.contains('col-3')).to.be.true;
    });

    it('does not add cover-image/cover-content classes without the image-cover variant', () => {
      const el = block('', [[picture, '<p>Body</p>']]);
      decorate(el);
      const cols = el.querySelectorAll('.col');
      expect(cols[0].classList.contains('cover-image')).to.be.false;
      expect(cols[0].classList.contains('cover-content')).to.be.false;
    });
  });
});
