import { expect } from '@esm-bundle/chai';
import { getReplaceEl } from '../../scripts/utils/fragment.js';

describe('scripts/utils/fragment.js getReplaceEl', () => {
  it('returns the anchor itself when it has siblings inside its section', () => {
    const section = document.createElement('div');
    section.className = 'section';
    const a = document.createElement('a');
    section.append(a, document.createElement('span'));
    expect(getReplaceEl(a)).to.equal(a);
  });

  it('climbs a single-child wrapper chain, stopping at the section boundary', () => {
    const section = document.createElement('div');
    section.className = 'section';
    const wrapper = document.createElement('div');
    const a = document.createElement('a');
    wrapper.append(a); // a is wrapper's only child
    section.append(wrapper); // wrapper is section's only child
    // climbs a -> wrapper -> stops at ancestor (section)
    expect(getReplaceEl(a)).to.equal(section);
  });

  // Regression: a detached anchor (or one outside any `.section`) has
  // ancestor === null; without the parentElement guard the loop climbed past
  // the tree root and threw on null.children.
  it('does not throw on a detached anchor with no section ancestor', () => {
    const a = document.createElement('a');
    expect(() => getReplaceEl(a)).to.not.throw();
    expect(getReplaceEl(a)).to.equal(a);
  });
});
