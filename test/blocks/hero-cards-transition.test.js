import { expect } from '@esm-bundle/chai';
import decorate from '../../blocks/hero-cards-transition/hero-cards-transition.js';

// A single text-only row (no picture) is enough to exercise the CTA-classing
// path; collect() falls back to default poster tiles for the card wall.
const block = (html) => {
  const el = document.createElement('div');
  const row = document.createElement('div');
  row.innerHTML = html;
  el.append(row);
  document.body.append(el);
  return el;
};

describe('hero-cards-transition CTA classing', () => {
  it('classes a plain CTA link positionally', () => {
    const el = block('<h1>Title</h1><p><a href="/a">A</a></p>');
    decorate(el);
    const a = el.querySelector('.hc-cta a');
    expect(a.classList.contains('btn-primary')).to.be.true;
  });

  it('does not override a link already classed .btn (e.g. by decorateButton)', () => {
    const el = block('<h1>Title</h1><p><a class="btn btn-accent" href="/a">A</a></p>');
    decorate(el);
    const a = el.querySelector('.hc-cta a');
    expect(a.classList.contains('btn-accent')).to.be.true;
    expect(a.classList.contains('btn-primary')).to.be.false;
  });
});
