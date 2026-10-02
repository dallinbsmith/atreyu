import { expect } from '@esm-bundle/chai';
import sinon from 'sinon';
import { onReveal } from '../../../scripts/utils/motion/motion.js';
import { trackScrollProgress } from '../../../scripts/utils/motion/scroll.js';

class FakeIntersectionObserver {
  constructor(callback) {
    this.callback = callback;
    this.disconnected = false;
    FakeIntersectionObserver.instances.push(this);
  }

  observe(target) { this.target = target; }

  unobserve() {}

  disconnect() { this.disconnected = true; }
}
FakeIntersectionObserver.instances = [];

describe('motion signal teardown', () => {
  let originalIO;

  beforeEach(() => {
    originalIO = window.IntersectionObserver;
    window.IntersectionObserver = FakeIntersectionObserver;
    FakeIntersectionObserver.instances = [];
    sinon.stub(navigator, 'hardwareConcurrency').value(8);
  });

  afterEach(() => {
    window.IntersectionObserver = originalIO;
    sinon.restore();
    document.body.innerHTML = '';
  });

  it('trackScrollProgress disconnects its observer and removes shared listeners on abort', () => {
    const add = sinon.spy(window, 'addEventListener');
    const remove = sinon.spy(window, 'removeEventListener');
    const controller = new AbortController();
    const el = document.createElement('div');
    document.body.append(el);

    trackScrollProgress(el, undefined, { signal: controller.signal });
    const io = FakeIntersectionObserver.instances[0];
    io.callback([{ isIntersecting: true, target: el }]);
    expect(add.calledWith('scroll')).to.be.true;
    expect(add.calledWith('resize')).to.be.true;

    controller.abort();
    expect(io.disconnected).to.be.true;
    expect(remove.calledWith('scroll')).to.be.true;
    expect(remove.calledWith('resize')).to.be.true;
  });

  it('trackScrollProgress keeps shared listeners until the last tracked element aborts', () => {
    const remove = sinon.spy(window, 'removeEventListener');
    const a = new AbortController();
    const b = new AbortController();
    const elA = document.createElement('div');
    const elB = document.createElement('div');
    document.body.append(elA, elB);

    trackScrollProgress(elA, undefined, { signal: a.signal });
    trackScrollProgress(elB, undefined, { signal: b.signal });
    FakeIntersectionObserver.instances.forEach((io) => {
      io.callback([{ isIntersecting: true, target: io.target }]);
    });

    a.abort();
    expect(remove.calledWith('scroll')).to.be.false;
    expect(remove.calledWith('resize')).to.be.false;

    b.abort();
    expect(remove.calledWith('scroll')).to.be.true;
    expect(remove.calledWith('resize')).to.be.true;
  });

  it('trackScrollProgress ignores stale observer callbacks after abort', () => {
    const add = sinon.spy(window, 'addEventListener');
    const controller = new AbortController();
    const el = document.createElement('div');
    document.body.append(el);

    trackScrollProgress(el, undefined, { signal: controller.signal });
    const io = FakeIntersectionObserver.instances[0];
    controller.abort();
    io.callback([{ isIntersecting: true, target: el }]);

    expect(add.calledWith('scroll')).to.be.false;
    expect(add.calledWith('resize')).to.be.false;
  });

  it('onReveal disconnects its observer on abort', () => {
    const controller = new AbortController();
    const el = document.createElement('div');
    document.body.append(el);

    onReveal(el, () => {}, { signal: controller.signal });
    const io = FakeIntersectionObserver.instances[0];
    controller.abort();

    expect(io.disconnected).to.be.true;
  });

  it('onReveal ignores stale observer callbacks after abort', () => {
    const controller = new AbortController();
    const el = document.createElement('div');
    const callback = sinon.spy();
    document.body.append(el);

    onReveal(el, callback, { signal: controller.signal });
    const io = FakeIntersectionObserver.instances[0];
    controller.abort();
    io.callback([{ isIntersecting: true, target: el }]);

    expect(callback.called).to.be.false;
  });

  it('does not create observers for an already-aborted signal', () => {
    const controller = new AbortController();
    controller.abort();
    const el = document.createElement('div');

    trackScrollProgress(el, undefined, { signal: controller.signal });
    onReveal(el, () => {}, { signal: controller.signal });

    expect(FakeIntersectionObserver.instances).to.have.length(0);
  });
});
