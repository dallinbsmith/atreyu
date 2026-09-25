import { expect } from '@esm-bundle/chai';
import sinon from 'sinon';
import { getConfig, loadArea, setConfig } from '../../scripts/ak.js';
import { config as pluginConfig } from '../../scripts/experiment-loader.js';
import { loadFragment } from '../../scripts/utils/fragment.js';

// B1: ak.js passes each block `default(el, { signal })` and aborts the signal
// only once the block's element has left the document; every loadArea call
// sweeps first. The fixture blocks under ./fixtures/blocks record what they
// were called with; codeBase is pointed there so loadExperience imports them
// like real blocks.
const FIXTURES = new URL('./fixtures', import.meta.url).href.replace(/\/$/, '');
const PROBE = '<div class="teardown-probe"><div><div>probe</div></div></div>';
const LEGACY = '<div class="teardown-legacy"><div><div>legacy</div></div></div>';

const probeBlocks = (root = document) => [...root.querySelectorAll('.teardown-probe')];
const signalOf = (el) => window.teardownProbe.get(el)?.signal;

const stubFetch = (html) => {
  const original = window.fetch;
  window.fetch = async () => new Response(html, { status: 200 });
  return () => { window.fetch = original; };
};

describe('ak.js block teardown signal (B1)', () => {
  let log;

  beforeEach(() => {
    log = sinon.spy();
    setConfig({
      components: ['teardown-probe', 'teardown-legacy', 'teardown-slow'], hostnames: [], linkBlocks: [], log,
    });
    getConfig().codeBase = FIXTURES;
    window.teardownProbe = new Map();
  });

  afterEach(async () => {
    document.body.innerHTML = '';
    await loadArea({ area: document.createElement('div') });
    delete window.teardownProbe;
  });

  it('passes a live AbortSignal as the second argument', async () => {
    document.body.innerHTML = `<main><div>${PROBE}</div></main>`;
    await loadArea();
    const [el] = probeBlocks();
    expect(signalOf(el)).to.be.instanceOf(AbortSignal);
    expect(signalOf(el).aborted).to.be.false;
  });

  it('aborts the old blocks after a Quick Edit body.innerHTML swap plus loadArea', async () => {
    const markup = `<main><div>${PROBE}</div><div>${PROBE}</div></main>`;
    document.body.innerHTML = markup;
    await loadArea();
    const old = probeBlocks();
    expect(old).to.have.length(2);

    document.body.innerHTML = markup;
    await loadArea();

    expect(old.map((el) => signalOf(el).aborted)).to.deep.equal([true, true]);
    const fresh = probeBlocks();
    expect(fresh.map((el) => signalOf(el).aborted)).to.deep.equal([false, false]);
  });

  it('does not abort connected, unchanged blocks on a rerun', async () => {
    document.body.innerHTML = `<main><div>${PROBE}</div><div>${PROBE}</div></main>`;
    await loadArea();
    const [kept, replaced] = probeBlocks();

    // A rerun with nothing removed: every block stays live.
    await loadArea();
    expect(signalOf(kept).aborted).to.be.false;
    expect(signalOf(replaced).aborted).to.be.false;

    // Replace only the second section: only its block is torn down.
    const section = document.createElement('div');
    section.innerHTML = PROBE;
    replaced.closest('.section').replaceWith(section);
    await loadArea();

    expect(signalOf(kept).aborted).to.be.false;
    expect(signalOf(replaced).aborted).to.be.true;
    expect(signalOf(probeBlocks().at(-1)).aborted).to.be.false;
  });

  it('does not abort a detached .fragment-content before it is inserted, but does once discarded', async () => {
    const restore = stubFetch(`<html><body><main><div>${PROBE}</div></main></body></html>`);
    document.body.innerHTML = '<header></header><main><div><p>page</p></div></main>';
    let fragment;
    try {
      fragment = await loadFragment('/system/fragments/nav/header');
    } finally {
      restore();
    }
    const [el] = probeBlocks(fragment);
    expect(fragment.isConnected).to.be.false;
    expect(el.isConnected).to.be.false;

    // A document-level sweep in the window before header inserts it.
    await loadArea();
    expect(signalOf(el).aborted).to.be.false;

    document.querySelector('header').append(fragment);
    await loadArea({ area: document.createElement('div') });
    expect(signalOf(el).aborted).to.be.false;

    // Quick Edit discards the old <header>: its root is now the old header,
    // not the fragment, so the block is collected.
    document.body.innerHTML = '<header></header><main><div><p>page</p></div></main>';
    await loadArea();
    expect(signalOf(el).aborted).to.be.true;
  });

  it('aborts the old blocks after a plugin-style innerHTML swap through decorateFunction', async () => {
    document.body.innerHTML = `<main><div>${PROBE}</div></main><aside><div>${PROBE}</div></aside>`;
    await loadArea();
    const [main] = probeBlocks(document.querySelector('main'));
    const aside = document.querySelector('aside');
    await pluginConfig.decorateFunction(aside);
    const [asideOld] = probeBlocks(aside);

    // replaceInner() in the plugin: el.innerHTML = newEl.innerHTML.
    aside.innerHTML = `<div>${PROBE}</div>`;
    await pluginConfig.decorateFunction(aside);

    expect(signalOf(asideOld).aborted).to.be.true;
    expect(signalOf(probeBlocks(aside)[0]).aborted).to.be.false;
    expect(signalOf(main).aborted).to.be.false;
  });

  it('aborts the old blocks after a replaceChildren swap plus an area-scoped loadArea({ area })', async () => {
    document.body.innerHTML = `<footer><div class="fragment-content footer-content"><div>${PROBE}</div></div></footer>`;
    const target = document.querySelector('.footer-content');
    await loadArea({ area: target });
    const [old] = probeBlocks(target);

    // Swap target's children, then loadArea({ area: target }). Neither
    // document-level nor decorateFunction.
    const section = document.createElement('div');
    section.innerHTML = PROBE;
    target.replaceChildren(section);
    await loadArea({ area: target });

    expect(signalOf(old).aborted).to.be.true;
    expect(signalOf(probeBlocks(target)[0]).aborted).to.be.false;
  });

  it('aborts a block swapped out while its module import is still in flight', async () => {
    document.body.innerHTML = '<main><div><div class="teardown-slow"><div><div>slow</div></div></div></div></main>';
    const el = document.querySelector('.teardown-slow');
    const first = loadArea();
    while (el.dataset.blockStatus !== 'loading') {
      // eslint-disable-next-line no-await-in-loop -- polling for the import to start
      await new Promise((resolve) => { setTimeout(resolve, 5); });
    }

    // Quick Edit swap while teardown-slow.js is still importing (~60 ms).
    document.body.innerHTML = '<main><div><p>swapped</p></div></main>';
    await loadArea();
    await first;

    expect(window.teardownProbe.has(el)).to.be.true;
    expect(signalOf(el).aborted).to.be.true;
  });

  it('still decorates blocks whose default takes only one parameter', async () => {
    document.body.innerHTML = `<main><div>${LEGACY}</div></main>`;
    await loadArea();
    const el = document.querySelector('.teardown-legacy');
    expect(el.dataset.legacyProbe).to.equal('decorated');
    expect(el.dataset.blockStatus).to.equal('loaded');
    expect(log.calledWith(sinon.match.any, el)).to.be.false;
  });
});
