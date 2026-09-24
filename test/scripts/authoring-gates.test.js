import { expect } from '@esm-bundle/chai';

const originalUrl = window.location.href;
const branchHost = 'main--atreyu--dallinbsmith.aem.live';

const setSearch = (search = '') => {
  window.history.replaceState({}, '', `${window.location.pathname}${search}`);
};

describe('authoring import gates', () => {
  let daPreview;
  let quickEdit;
  let loadAuthoringPreviews;

  before(async () => {
    setSearch();
    ({ default: daPreview } = await import('../../scripts/da/da.js'));
    ({ default: quickEdit } = await import('../../scripts/quick-edit/quick-edit.js'));
    ({ loadAuthoringPreviews } = await import('../../scripts/scripts.js'));
  });

  afterEach(() => {
    setSearch();
    document.head.querySelectorAll('script[type="importmap"]').forEach((script) => script.remove());
  });

  after(() => {
    window.history.replaceState({}, '', originalUrl);
  });

  it('does not import DA preview on production hosts', async () => {
    setSearch('?dapreview=on');
    const calls = [];
    const beforeScripts = document.scripts.length;
    const beforeLinks = document.querySelectorAll('link').length;

    await daPreview(() => {}, {
      host: 'frame.io',
      importer: (url) => {
        calls.push(url);
        throw new Error(`unexpected import: ${url}`);
      },
    });

    expect(calls).to.deep.equal([]);
    expect(document.scripts.length).to.equal(beforeScripts);
    expect(document.querySelectorAll('link').length).to.equal(beforeLinks);
  });

  it('attempts DA preview imports on AEM branch hosts', async () => {
    setSearch('?dapreview=on');
    const calls = [];
    let loaded = false;

    await daPreview(() => { loaded = true; }, {
      host: branchHost,
      importer: async (url) => {
        calls.push(url);
        return { default: (loadPage) => loadPage() };
      },
    });

    expect(calls).to.deep.equal(['https://da.live/scripts/dapreview.js']);
    expect(loaded).to.equal(true);
  });

  it('does not import or inject Quick Edit on production hosts', async () => {
    setSearch('?quick-edit=on');
    const calls = [];
    const beforeScripts = document.scripts.length;
    const beforeLinks = document.querySelectorAll('link').length;

    await quickEdit({ detail: {} }, {
      host: 'frame.io',
      importer: (url) => {
        calls.push(url);
        throw new Error(`unexpected import: ${url}`);
      },
    });

    expect(calls).to.deep.equal([]);
    expect(document.scripts.length).to.equal(beforeScripts);
    expect(document.querySelectorAll('link').length).to.equal(beforeLinks);
  });

  it('attempts Quick Edit imports and injects its import map on AEM branch hosts', async () => {
    setSearch('?quick-edit=on');
    const calls = [];
    let loaded = false;

    await quickEdit({ detail: {} }, {
      host: branchHost,
      importer: async (url) => {
        calls.push(url);
        return { default: () => { loaded = true; } };
      },
    });

    expect(calls).to.deep.equal(['https://da.live/nx/public/plugins/quick-edit/quick-edit.js']);
    expect(Boolean(document.head.querySelector('script[type="importmap"]'))).to.equal(true);
    expect(loaded).to.equal(true);
  });

  it('does not import authoring modules from scripts.js on production hosts', () => {
    const calls = [];

    loadAuthoringPreviews({
      href: 'https://frame.io/?dapreview=on&quick-edit=on',
      host: 'frame.io',
      importer: (url) => {
        calls.push(url);
        return Promise.resolve({});
      },
    });

    expect(calls).to.deep.equal([]);
  });

  it('attempts authoring module imports from scripts.js on AEM branch hosts', async () => {
    const calls = [];

    loadAuthoringPreviews({
      href: `https://${branchHost}/?dapreview=on&quick-edit=on`,
      host: branchHost,
      importer: (url) => {
        calls.push(url);
        return Promise.resolve({ default: () => {} });
      },
    });
    await Promise.resolve();

    expect(calls).to.deep.equal(['./da/da.js', './quick-edit/quick-edit.js']);
  });
});
