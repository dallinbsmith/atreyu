import { expect } from '@esm-bundle/chai';
import { guardDecorate, registerRedecorator, redecorate } from '../../scripts/utils/lifecycle.js';

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

describe('registerRedecorator / redecorate', () => {
  // The registry is a module-scope Map shared across this whole test file —
  // each test uses its own selector string so registrations never collide
  // with another test's.

  it('calls the registered redecorator with the target', async () => {
    const target = document.createElement('div');
    let received;
    registerRedecorator('.rd-test-one', (el) => { received = el; });

    await redecorate('.rd-test-one', target);

    expect(received).to.equal(target);
  });

  it('awaits an async redecorator before resolving', async () => {
    const target = document.createElement('div');
    let done = false;
    registerRedecorator('.rd-test-two', async () => {
      await new Promise((resolve) => { setTimeout(resolve, 10); });
      done = true;
    });

    await redecorate('.rd-test-two', target);

    expect(done).to.be.true;
  });

  it('re-registering the same selector overwrites the previous redecorator', async () => {
    const target = document.createElement('div');
    const calls = [];
    registerRedecorator('.rd-test-three', () => calls.push('first'));
    registerRedecorator('.rd-test-three', () => calls.push('second'));

    await redecorate('.rd-test-three', target);

    expect(calls).to.deep.equal(['second']);
  });

  it('fails open (no throw) when no redecorator is registered for the selector', async () => {
    const target = document.createElement('div');
    const originalWarn = console.warn;
    let warned = false;
    console.warn = () => { warned = true; };

    try {
      await redecorate('.rd-test-unregistered', target);
    } finally {
      console.warn = originalWarn;
    }

    expect(warned).to.be.true;
  });
});
