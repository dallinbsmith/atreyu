import { expect } from '@esm-bundle/chai';
import { getColorScheme, setColorScheme } from '../../scripts/utils/color-scheme.js';

const makeSection = (bg) => {
  const section = document.createElement('div');
  section.style.backgroundColor = bg;
  section.append(document.createElement('div'), document.createElement('div'));
  document.body.append(section);
  return section;
};

describe('color-scheme', () => {
  afterEach(() => document.body.replaceChildren());

  it('returns null for a missing section', () => {
    expect(getColorScheme(null)).to.equal(null);
  });

  it('classifies light and dark backgrounds by relative luminance', () => {
    expect(getColorScheme(makeSection('rgb(255, 255, 255)'))).to.equal('light-scheme');
    expect(getColorScheme(makeSection('rgb(0, 0, 0)'))).to.equal('dark-scheme');
  });

  it('replaces any existing scheme class on every child', () => {
    const section = makeSection('rgb(0, 0, 0)');
    section.firstElementChild.classList.add('light-scheme');
    setColorScheme(section);
    for (const child of section.children) {
      expect(child.classList.contains('dark-scheme')).to.be.true;
      expect(child.classList.contains('light-scheme')).to.be.false;
    }
  });
});
