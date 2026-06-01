import { expect } from '@esm-bundle/chai';
import { emit, on, off } from '../../scripts/utils/event-bus.js';

describe('event-bus', () => {
  const handlers = [];

  afterEach(() => {
    // Clean up any registered handlers
    while (handlers.length) {
      const cleanup = handlers.pop();
      cleanup();
    }
  });

  it('emit + on — handler receives the detail payload', () => {
    let received;
    const cleanup = on('test-event', (detail) => { received = detail; });
    handlers.push(cleanup);

    emit('test-event', { value: 42 });
    expect(received).to.deep.equal({ value: 42 });
  });

  it('events are namespaced with atreyu: prefix', () => {
    let nativeTriggered = false;
    const nativeHandler = () => { nativeTriggered = true; };

    // Listen on document for the namespaced event directly
    document.addEventListener('atreyu:ns-check', nativeHandler);

    emit('ns-check', { ok: true });

    expect(nativeTriggered).to.be.true;
    document.removeEventListener('atreyu:ns-check', nativeHandler);
  });

  it('off — removes the listener so handler is no longer called', () => {
    let callCount = 0;
    const handler = () => { callCount += 1; };
    on('remove-test', handler);

    emit('remove-test', {});
    expect(callCount).to.equal(1);

    off('remove-test', handler);
    emit('remove-test', {});
    expect(callCount).to.equal(1);
  });

  it('on returns a cleanup function that works like off', () => {
    let callCount = 0;
    const cleanup = on('cleanup-test', () => { callCount += 1; });

    emit('cleanup-test', {});
    expect(callCount).to.equal(1);

    cleanup();
    emit('cleanup-test', {});
    expect(callCount).to.equal(1);
  });
});
