import { expect } from '@esm-bundle/chai';
import decorate from '../../blocks/bookend/bookend.js';

const block = (html) => {
  const el = document.createElement('div');
  el.className = 'bookend';
  const row = document.createElement('div');
  const cell = document.createElement('div');
  cell.innerHTML = html;
  row.append(cell);
  el.append(row);
  document.body.append(el);
  return el;
};

describe('bookend', () => {
  it('classes CTA links positionally when neither is pre-classed', () => {
    const el = block('<h2>Title</h2><p><a href="/a">A</a></p>');
    decorate(el);
    const a = el.querySelector('.bookend-cta a');
    expect(a.classList.contains('btn-primary')).to.be.true;
  });

  it('does not override a link already classed .btn (e.g. by decorateButton)', () => {
    const el = block('<h2>Title</h2><p><a class="btn btn-accent" href="/a">A</a></p>');
    decorate(el);
    const a = el.querySelector('.bookend-cta a');
    expect(a.classList.contains('btn-accent')).to.be.true;
    expect(a.classList.contains('btn-primary')).to.be.false;
  });
});
