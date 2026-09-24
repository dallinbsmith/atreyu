import { expect } from '@esm-bundle/chai';
import sinon from 'sinon';
import {
  carryOverSectionMeta,
  removeLeftoverConfigBlocks,
  withVariantTimeout,
} from '../../../scripts/utils/experiments/guard.js';

describe('scripts/utils/experiments/guard.js', () => {
  const realFetch = window.fetch;
  let clock;

  afterEach(() => {
    window.fetch = realFetch;
    clock?.restore();
    clock = null;
    document.body.innerHTML = '';
  });

  it('aborts same-origin /v/ GET fetches without caller signals', async () => {
    clock = sinon.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const calls = [];
    window.fetch = (url, init = {}) => {
      calls.push({
        path: new URL(url, window.location.origin).pathname,
        hasSignal: Boolean(init.signal),
      });
      return new Promise((resolve, reject) => {
        if (init.signal.aborted) {
          reject(new DOMException('aborted', 'AbortError'));
          return;
        }
        init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      });
    };
    const stub = window.fetch;

    const pending = withVariantTimeout(() => fetch('/v/hang'), { ms: 1000 }).catch((ex) => ex.name);
    await clock.tickAsync(1000);

    expect(await pending).to.equal('AbortError');
    expect(calls).to.deep.equal([{ path: '/v/hang', hasSignal: true }]);
    expect(window.fetch).to.equal(stub);
  });

  it('keeps the timeout active while the response body stalls', async () => {
    clock = sinon.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let bodyController;
    window.fetch = (url, init = {}) => {
      const body = new ReadableStream({
        start: (controller) => {
          bodyController = controller;
          controller.enqueue(new TextEncoder().encode('partial'));
          init.signal.addEventListener('abort', () => controller.error(new DOMException('aborted', 'AbortError')));
        },
      });
      return Promise.resolve(new Response(body));
    };

    let completed = false;
    const pending = withVariantTimeout(async () => {
      const resp = await fetch('/v/slow-body');
      return resp.text();
    }, { ms: 1000 }).catch((ex) => ex.name).finally(() => {
      completed = true;
    });

    await Promise.resolve();
    expect(bodyController).to.not.equal(undefined);
    await clock.tickAsync(1000);
    await pending;

    expect(completed).to.equal(true);
  });

  it('leaves non-/v/, cross-origin, non-GET, and caller-signal fetches untouched', async () => {
    const caller = new AbortController();
    const calls = [];
    window.fetch = async (url, init = {}) => {
      calls.push({
        path: new URL(url, window.location.origin).pathname,
        method: init.method ?? 'GET',
        signal: init.signal,
      });
      return new Response('');
    };

    await withVariantTimeout(async () => {
      await fetch('/api/data');
      await fetch('/vx/not-a-variant');
      await fetch(new URL('/v/url-object', window.location.origin), null);
      await fetch('/v/signaled', { signal: caller.signal });
      await fetch('/v/post', { method: 'POST' });
      await fetch('https://example.com/v/cross');
    });

    expect(calls.map(({ path }) => path)).to.deep.equal([
      '/api/data',
      '/vx/not-a-variant',
      '/v/url-object',
      '/v/signaled',
      '/v/post',
      '/v/cross',
    ]);
    expect(calls.map(({ signal }) => Boolean(signal))).to.deep.equal([
      false, false, true, true, false, false,
    ]);
    expect(calls[3].signal).to.equal(caller.signal);
  });

  it('rejects a /v/ fetch issued after the deadline immediately', async () => {
    clock = sinon.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let release;
    window.fetch = (url, init = {}) => new Promise((resolve, reject) => {
      if (init.signal?.aborted) {
        reject(new DOMException('aborted', 'AbortError'));
        return;
      }
      init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });
    const stub = window.fetch;

    const pending = withVariantTimeout(() => new Promise((resolve) => {
      release = resolve;
    }), { ms: 1000 });
    expect(window.fetch).not.to.equal(stub);
    await clock.tickAsync(1000);

    await fetch('/v/late').then(
      () => expect.fail('Expected late fetch to reject'),
      (ex) => expect(ex.name).to.equal('AbortError'),
    );
    expect(window.fetch).not.to.equal(stub);
    release();
    await pending;
    expect(window.fetch).to.equal(stub);
  });

  it('does not clobber a fetch patch installed by another script mid-run', async () => {
    let release;
    window.fetch = async () => new Response('');
    const otherFetch = async () => new Response('other');

    const pending = withVariantTimeout(() => new Promise((resolve) => {
      release = resolve;
    }));
    window.fetch = otherFetch;
    release();
    await pending;

    expect(window.fetch).to.equal(otherFetch);
  });

  it('keeps the wrapper installed until overlapping runs all settle', async () => {
    const calls = [];
    let finishA;
    let finishB;
    window.fetch = async (url, init = {}) => {
      calls.push(Boolean(init.signal));
      return new Response('');
    };

    const a = withVariantTimeout(() => new Promise((resolve) => {
      finishA = resolve;
    }));
    const wrapper = window.fetch;
    const b = withVariantTimeout(() => new Promise((resolve) => {
      finishB = resolve;
    }));

    finishA();
    await a;
    expect(window.fetch).to.equal(wrapper);
    await fetch('/v/still-guarded');
    finishB();
    await b;

    expect(calls).to.deep.equal([true]);
    expect(window.fetch).not.to.equal(wrapper);
  });

  it('restores fetch after the wrapped callback throws', async () => {
    window.fetch = async () => new Response('');
    const stub = window.fetch;

    try {
      await withVariantTimeout(() => { throw new Error('boom'); });
      expect.fail('Expected withVariantTimeout to throw');
    } catch (ex) {
      expect(ex.message).to.equal('boom');
    }

    expect(window.fetch).to.equal(stub);
  });

  it('does not double-wrap nested calls', async () => {
    window.fetch = async () => new Response('');
    const seen = [];

    await withVariantTimeout(async () => {
      seen.push(window.fetch);
      await withVariantTimeout(async () => {
        seen.push(window.fetch);
      });
    });

    expect(seen[0]).to.equal(seen[1]);
    expect(window.fetch).not.to.equal(seen[0]);
  });

  it('carries Style and Anchor metadata over when a swap drops section metadata', () => {
    document.body.innerHTML = `<main><div><p>Control</p><div class="section-metadata">
      <div><div>Style</div><div>dark</div></div>
      <div><div>Anchor</div><div>hero</div></div>
      <div><div>Experiment</div><div>Hero</div></div>
    </div></div></main>`;
    const section = document.querySelector('main > div');
    const restore = carryOverSectionMeta(document.querySelector('main'));

    section.innerHTML = '<p>Variant</p>';
    restore();

    expect([...section.querySelectorAll('.section-metadata > div')]
      .map((row) => row.children[0].textContent.trim())).to.deep.equal(['Style', 'Anchor']);
  });

  it('does not duplicate carried metadata when the variant has its own metadata', () => {
    document.body.innerHTML = `<main><div><p>Control</p><div class="section-metadata">
      <div><div>Style</div><div>dark</div></div>
      <div><div>Anchor</div><div>hero</div></div>
    </div></div></main>`;
    const section = document.querySelector('main > div');
    const restore = carryOverSectionMeta(document.querySelector('main'));

    section.innerHTML = `<p>Variant</p><div class="section-metadata">
      <div><div>Style</div><div>light</div></div>
      <div><div>Anchor</div><div>variant</div></div>
    </div>`;
    restore();

    expect(section.querySelectorAll('.section-metadata')).to.have.length(1);
    expect(section.textContent).to.contain('light');
    expect(section.textContent).not.to.contain('dark');
  });

  it('removes leftover config blocks and any section they leave empty', () => {
    document.body.innerHTML = `<main>
      <div><div class="experiment"><div>bad</div></div></div>
      <div><p>Keep</p><div class="personalize"><div>bad</div></div></div>
      <div><div class="columns experiment"><div>authored option</div></div></div>
    </main>`;

    removeLeftoverConfigBlocks(document.querySelector('main'));

    expect(document.querySelector('main > div > .experiment:not(.columns)')).to.equal(null);
    expect(document.querySelector('.personalize')).to.equal(null);
    expect(document.querySelector('.columns.experiment')).to.not.equal(null);
    expect([...document.querySelectorAll('main > div')].map((section) => section.textContent.trim()))
      .to.deep.equal(['Keep', 'authored option']);
  });

  it('removes a section left with only metadata after removing a config block', () => {
    document.body.innerHTML = `<main>
      <div>
        <div class="personalize"><div>bad</div></div>
        <div class="section-metadata"><div><div>Style</div><div>dark</div></div></div>
      </div>
    </main>`;

    removeLeftoverConfigBlocks(document.querySelector('main'));

    expect(document.querySelector('main > div')).to.equal(null);
  });
});
