import { expect } from '@esm-bundle/chai';
import decorate from '../../blocks/hero-cards/hero-cards.js';

// EDS-shaped `Hero Cards` block (the old, pre-rename table header): rows are
// divs, cells are divs. hero-cards-transition's own fallback poster/chin data
// covers the rest, so a single heading row is enough to exercise delegation.
const block = (html) => {
  const el = document.createElement('div');
  el.className = 'hero-cards';
  const row = document.createElement('div');
  row.innerHTML = html;
  el.append(row);
  document.body.append(el);
  return el;
};

describe('hero-cards (back-compat shim)', () => {
  it('renames the class to hero-cards-transition and delegates to its real init', async () => {
    const el = block('<h1>Title</h1><p><a href="/a">A</a></p>');
    await decorate(el);

    expect(el.classList.contains('hero-cards')).to.be.false;
    expect(el.classList.contains('hero-cards-transition')).to.be.true;
    // hero-cards-transition's real DOM output (stage/wall) appears — proves
    // delegation actually ran the real init, not just the class swap.
    expect(el.querySelector('.hc-stage')).to.exist;
    expect(el.querySelector('.hc-wall')).to.exist;
  });

  // The bug both reviewers found (via live browser reproduction): hero-cards.css
  // nested its `@import` inside `@layer blocks { }`, which browsers silently
  // drop — real pages authored with the old `Hero Cards` header got fully
  // working JS but zero styling. This test proves the FIX (hero-cards.js's
  // explicit loadStyle() call) actually gets hero-cards-transition.css's real
  // rules applied to a real decorated element in a real browser — a test that
  // only asserted loadStyle() was CALLED with the right URL would not prove
  // this; computed style is the only thing that proves the CSS truly loaded.
  it('actually applies hero-cards-transition.css styling to the decorated element', async () => {
    const el = block('<h1>Title</h1>');
    await decorate(el);

    const styles = getComputedStyle(el);
    expect(styles.position).to.equal('relative');
    expect(styles.zIndex).to.equal('1');
  });
});
