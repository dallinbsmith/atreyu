import { expect } from '@esm-bundle/chai';
import sinon from 'sinon';
import { setConfig } from '../../scripts/ak.js';
import { loadExperimentation, loadPage } from '../../scripts/scripts.js';

describe('scripts.js', () => {
  beforeEach(() => {
    setConfig({ locales: { '': {} }, linkBlocks: [], components: [], decorateArea: () => {} });
    document.head.querySelectorAll('meta[name^="experiment"],meta[name^="audience"],meta[name^="campaign"],meta[property^="experiment:"],meta[property^="audience:"],meta[property^="campaign:"]').forEach((m) => m.remove());
    document.body.innerHTML = '';
  });

  it('skips loader and plugin imports on a plain page', async () => {
    document.body.innerHTML = '<main><div><p>plain</p></div></main>';
    const loadLoader = sinon.spy();
    const loadPlugin = sinon.spy();

    expect(await loadExperimentation(document, { loadLoader, loadPlugin })).to.equal(null);
    expect(loadLoader.called).to.equal(false);
    expect(loadPlugin.called).to.equal(false);
  });

  it('starts the plugin import with the loader and reuses the plugin promise', async () => {
    document.head.insertAdjacentHTML('beforeend', '<meta name="experiment" content="Hero Test">');
    document.body.innerHTML = '<main><div><h1>Control</h1></div></main>';
    const plugin = { marker: true };
    const pluginPromise = Promise.resolve(plugin);
    const loadPlugin = sinon.stub().returns(pluginPromise);
    const runExperimentation = sinon.stub().callsFake((doc, options) => options.pluginPromise);
    const loadLoader = sinon.stub().returns(Promise.resolve({ runExperimentation }));

    const result = await loadExperimentation(document, { loadLoader, loadPlugin });

    expect(result).to.equal(plugin);
    expect(loadLoader.calledBefore(loadPlugin)).to.equal(true);
    expect(runExperimentation.firstCall.args[1].pluginPromise).to.equal(pluginPromise);
  });

  it('handles plugin import rejection while the loader import is still pending', async () => {
    document.head.insertAdjacentHTML('beforeend', '<meta name="experiment" content="Hero Test">');
    document.body.innerHTML = '<main><div><h1>Control</h1></div></main>';
    const unhandled = [];
    const onUnhandled = (event) => unhandled.push(event.reason);
    window.addEventListener('unhandledrejection', onUnhandled);
    const loader = Promise.withResolvers();
    const failure = new Error('plugin failed');

    try {
      const pending = loadExperimentation(document, {
        loadLoader: () => loader.promise,
        loadPlugin: () => Promise.reject(failure),
      });
      await Promise.resolve();
      await new Promise((resolve) => { setTimeout(resolve, 0); });
      loader.resolve({
        runExperimentation: async (doc, { pluginPromise }) => {
          try {
            await pluginPromise;
          } catch {
            return null;
          }
          return doc;
        },
      });

      expect(await pending).to.equal(null);
      expect(unhandled).to.deep.equal([]);
    } finally {
      window.removeEventListener('unhandledrejection', onUnhandled);
    }
  });

  it('removes config tables when the loader import fails', async () => {
    const errors = [];
    setConfig({
      locales: { '': {} },
      linkBlocks: [],
      components: [],
      decorateArea: () => {},
      log: (ex) => errors.push(ex),
    });
    document.body.innerHTML = `<main>
      <div><h1>Control</h1></div>
      <div><div class="experiment"><div><div>Name</div><div>Hero</div></div></div></div>
    </main>`;
    const failure = new Error('loader failed');

    expect(await loadExperimentation(document, {
      loadLoader: () => Promise.reject(failure),
      loadPlugin: () => Promise.resolve({}),
    })).to.equal(null);

    expect(document.querySelector('.experiment')).to.equal(null);
    expect(errors).to.deep.equal([failure]);
  });

  it('decorates eager images in loadPage', async () => {
    document.body.innerHTML = '<img src="test.jpg" loading="lazy">';
    await loadPage();

    const img = document.querySelector('img');
    expect(img.hasAttribute('loading')).to.be.false;
    expect(img.fetchPriority).to.equal('high');
  });
});
