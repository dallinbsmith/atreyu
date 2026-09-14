import { expect } from '@esm-bundle/chai';
import { guardDecorate } from '../../scripts/utils/lifecycle.js';

describe('guardDecorate', () => {
  it('returns true and sets the dataset key on the first call', () => {
    const el = document.createElement('div');
    expect(guardDecorate(el, 'fooDecorated')).to.be.true;
    expect(el.dataset.fooDecorated).to.equal('true');
  });

  it('returns false on a repeat call, without re-running the caller\'s logic', () => {
    const el = document.createElement('div');
    let calls = 0;
    const decorate = () => {
      if (!guardDecorate(el, 'fooDecorated')) return;
      calls += 1;
    };
    decorate();
    decorate();
    expect(calls).to.equal(1);
  });

  it('two different names on the same el are independent guards', () => {
    const el = document.createElement('div');
    expect(guardDecorate(el, 'a')).to.be.true;
    expect(guardDecorate(el, 'b')).to.be.true;
    expect(guardDecorate(el, 'a')).to.be.false;
  });
});
