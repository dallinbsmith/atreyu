import { expect } from '@esm-bundle/chai';
import { guardDecorate, withLifecycle } from '../../scripts/utils/lifecycle.js';

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

describe('withLifecycle', () => {
  it('runs the wrapped decorate function on first call', async () => {
    const el = document.createElement('div');
    let calls = 0;
    const decorated = withLifecycle(() => { calls += 1; });
    await decorated(el);
    expect(calls).to.equal(1);
  });

  it('runs a previously-returned cleanup before re-running on a second call', async () => {
    const el = document.createElement('div');
    const cleaned = [];
    let run = 0;
    const decorate = () => {
      run += 1;
      const mine = run;
      return () => cleaned.push(mine);
    };
    const decorated = withLifecycle(decorate);
    await decorated(el);
    expect(cleaned).to.deep.equal([]);
    await decorated(el);
    // the first run's cleanup fired before the second run started
    expect(cleaned).to.deep.equal([1]);
  });

  it('a decorate function returning nothing leaves no cleanup registered (no throw on repeat)', async () => {
    const el = document.createElement('div');
    const decorated = withLifecycle(() => undefined);
    await decorated(el);
    await decorated(el); // must not throw
  });

  it('cleanups for different elements are tracked independently', async () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    const cleaned = [];
    const decorated = withLifecycle((el) => () => cleaned.push(el === a ? 'a' : 'b'));
    await decorated(a);
    await decorated(b);
    // re-running on `a` must only fire `a`'s cleanup, not `b`'s
    await decorated(a);
    expect(cleaned).to.deep.equal(['a']);
  });

  it('passes through extra arguments to the wrapped decorate function', async () => {
    const el = document.createElement('div');
    let seen;
    const decorated = withLifecycle((_el, extra) => { seen = extra; });
    await decorated(el, 'payload');
    expect(seen).to.equal('payload');
  });
});
