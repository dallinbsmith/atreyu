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

  it('merges two separate CTA paragraphs into one .bookend-cta container, styling both links', () => {
    const el = block('<h2>Title</h2><p><a href="/a">A</a></p><p><a href="/b">B</a></p>');
    decorate(el);
    const ctaContainers = el.querySelectorAll('.bookend-cta');
    expect(ctaContainers).to.have.length(1);
    const links = ctaContainers[0].querySelectorAll('a');
    expect(links).to.have.length(2);
    expect(links[0].classList.contains('btn-primary')).to.be.true;
    expect(links[1].classList.contains('btn-secondary')).to.be.true;
  });
});
