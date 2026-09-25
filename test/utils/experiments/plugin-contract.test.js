import { expect } from '@esm-bundle/chai';
import sinon from 'sinon';
// Contract tests must import the vendored plugin directly.
// eslint-disable-next-line import/no-relative-packages
import { loadEager } from '../../../plugins/experimentation/src/index.js';
import { controlSection, responseMap, variantHtml } from './fixtures/plugin-contract.js';

const ASSIGNMENT_KEY = 'unified-decisioning-experiments';
const realFetch = window.fetch;
const realRandom = Math.random;
const realSetTimeout = window.setTimeout.bind(window);
const originalSearch = window.location.search;
let clock;

const clearMeta = () => {
  document.head.querySelectorAll([
    'meta[name^="audience"]',
    'meta[name^="experiment"]',
    'meta[property^="audience"]',
    'meta[property^="experiment"]',
  ].join(', ')).forEach((meta) => meta.remove());
};

const setSearch = (search = '') => {
  window.history.replaceState({}, '', `${window.location.pathname}${search}`);
};

const sectionMetaRow = (key, value) => `<div><div>${key}</div><div>${value}</div></div>`;

const linkRow = (key, path) => `<div><div>${key}</div><div><a href="${path}">${path}</a></div></div>`;

const setMain = (sections) => {
  document.body.innerHTML = `<main>${sections.join('')}</main>`;
};

const section = (content, rows) => `<div>${content}<div class="section-metadata">${rows.join('')}</div></div>`;

const addPageExperimentMeta = ({ name = 'Page Test', variants = '/v/page', split = '100' } = {}) => {
  document.head.insertAdjacentHTML('beforeend', `
    <meta name="experiment" content="${name}">
    <meta name="experiment-variants" content="${variants}">
    <meta name="experiment-split" content="${split}">
  `);
};

const run = async (options = {}) => {
  const rum = [];
  const events = [];
  const listener = (event) => events.push(event.detail);
  document.addEventListener('aem:experimentation', listener);
  window.hlx = { rum: { sampleRUM: (type, detail) => rum.push({ type, detail }) } };
  try {
    await loadEager(document, options);
  } finally {
    document.removeEventListener('aem:experimentation', listener);
  }
  return { events, rum, hlx: window.hlx };
};

const audiences = (matches) => Object.fromEntries(
  Object.entries(matches).map(([key, value]) => [key, () => value]),
);

const clearStorage = () => {
  localStorage.clear();
  sessionStorage.clear();
};

describe('vendored aem-experimentation plugin contract', () => {
  beforeEach(() => {
    clearMeta();
    clearStorage();
    setSearch();
    document.body.innerHTML = '';
    delete window.aem;
    window.fetch = responseMap({});
    Math.random = () => 0.5;
  });

  afterEach(() => {
    clock?.restore();
    clock = undefined;
    window.fetch = realFetch;
    Math.random = realRandom;
    clearMeta();
    clearStorage();
    setSearch(originalSearch);
    [...document.body.getAttributeNames()]
      .forEach((attr) => document.body.removeAttribute(attr));
    document.body.innerHTML = '';
    window.hlx = undefined;
    delete window.aem;
  });

  it('pins: audience rank follows section metadata object key order', async () => {
    // getAllSectionMeta() builds section metadata in row order;
    // getAudienceConfig() picks resolvedAudiences[0].
    setMain([section(controlSection, [
      linkRow('Audience: desktop', '/v/desktop'),
      linkRow('Audience: mobile', '/v/mobile'),
    ])]);
    window.fetch = responseMap({
      '/v/desktop': '<p id="served">Desktop</p>',
      '/v/mobile': '<p id="served">Mobile</p>',
    });

    await run({ audiences: audiences({ mobile: true, desktop: true }) });

    expect(document.querySelector('#served').textContent).to.equal('Desktop');
    expect(window.hlx.audiences[0].config.selectedAudience).to.equal('desktop');
    expect(window.fetch.calls).to.deep.equal(['/v/desktop']);
  });

  it('pins: a matched section audience wins over a same-section experiment', async () => {
    // loadEager() runs audiences before experiments;
    // replaceInner() replaces section metadata before experiments scan it.
    setMain([section(controlSection, [
      linkRow('Audience: mobile', '/v/audience'),
      sectionMetaRow('Experiment', 'Same Section'),
      linkRow('Experiment Variants', '/v/experiment'),
      sectionMetaRow('Experiment Split', '100'),
    ])]);
    window.fetch = responseMap({
      '/v/audience': '<p id="served">Audience</p>',
      '/v/experiment': '<p id="served">Experiment</p>',
    });

    const { events, hlx } = await run({ audiences: audiences({ mobile: true }) });

    expect(document.querySelector('#served').textContent).to.equal('Audience');
    expect(events.map(({ type }) => type)).to.deep.equal(['audience']);
    expect(hlx.experiments).to.deep.equal([]);
    expect(window.fetch.calls).to.deep.equal(['/v/audience']);
  });

  it('pins: an experiment inside a variant section runs after the audience swap', async () => {
    // loadEager() serves audiences first; applyAllModifications()
    // then sees the swapped metadata while scanning section metadata.
    setMain([section(controlSection, [linkRow('Audience: mobile', '/v/audience')])]);
    window.fetch = responseMap({
      '/v/audience': variantHtml(section('<p>Audience shell</p>', [
        sectionMetaRow('Experiment', 'Nested Test'),
        linkRow('Experiment Variants', '/v/nested'),
        sectionMetaRow('Experiment Split', '100'),
      ])),
      '/v/nested': variantHtml('<p id="served">Nested experiment</p>'),
    }, { raw: true });

    const { events, hlx } = await run({ audiences: audiences({ mobile: true }) });

    expect(document.querySelector('#served').textContent).to.equal('Nested experiment');
    expect(events.map(({ type }) => type)).to.deep.equal(['audience', 'experiment']);
    expect(hlx.experiments[0].config.id).to.equal('nested-test');
    expect(window.fetch.calls).to.deep.equal(['/v/audience', '/v/nested']);
  });

  it('pins: whole-page experiments can overwrite section audience swaps', async () => {
    // applyAllModifications() applies page experiments to <main>
    // after section audiences have already swapped.
    addPageExperimentMeta();
    setMain([section(controlSection, [linkRow('Audience: mobile', '/v/audience')])]);
    window.fetch = responseMap({
      '/v/audience': '<p id="audience">Audience</p>',
      '/v/page': '<p id="served">Page experiment</p>',
    });

    const { events, hlx } = await run({ audiences: audiences({ mobile: true }) });

    expect(document.querySelector('#served').textContent).to.equal('Page experiment');
    expect(document.querySelector('#audience')).to.equal(null);
    expect(events.map(({ type }) => type)).to.deep.equal(['audience', 'experiment']);
    expect(hlx.experiment.type).to.equal('page');
    expect(window.fetch.calls).to.deep.equal(['/v/audience', '/v/page']);
  });

  it('pins: ?audience forces configured audiences only and experiment gating separately', async () => {
    // getResolvedAudiences() forces configured audiences only.
    // getAllQueryParameters() reads experiment overrides from a separate namespace.
    setSearch('?audience=mobile');
    setMain([
      section('<p id="first">Configured</p>', [
        linkRow('Audience: desktop', '/v/desktop'),
        linkRow('Audience: mobile', '/v/mobile'),
      ]),
      section(
        '<p id="second">Unconfigured</p>',
        [linkRow('Audience: desktop', '/v/desktop-only')],
      ),
      section('<p id="third">Experiment control</p>', [
        sectionMetaRow('Experiment', 'Unrestricted Test'),
        linkRow('Experiment Variants', '/v/experiment'),
        sectionMetaRow('Experiment Split', '100'),
      ]),
      section('<p id="fourth">Restricted experiment control</p>', [
        sectionMetaRow('Experiment', 'Restricted Test'),
        linkRow('Experiment Variants', '/v/restricted'),
        sectionMetaRow('Experiment Split', '100'),
        sectionMetaRow('Experiment Audience', 'desktop'),
      ]),
    ]);
    window.fetch = responseMap({
      '/v/mobile': '<p id="served">Forced mobile</p>',
      '/v/experiment': '<p id="experiment-served">Experiment still ran</p>',
    });

    const { events, hlx } = await run({
      audiences: audiences({ desktop: true, mobile: false }),
    });

    expect(document.querySelector('#served').textContent).to.equal('Forced mobile');
    expect(document.querySelector('#second').textContent).to.equal('Unconfigured');
    expect(document.querySelector('#experiment-served').textContent)
      .to.equal('Experiment still ran');
    expect(events.map(({ type }) => type))
      .to.deep.equal(['audience', 'experiment', 'experiment']);
    const unrestricted = hlx.experiments
      .find(({ config }) => config.id === 'unrestricted-test');
    const restricted = hlx.experiments
      .find(({ config }) => config.id === 'restricted-test');
    expect(unrestricted.config.run).to.equal(true);
    expect(Boolean(restricted.config.run)).to.equal(false);
    expect(window.fetch.calls).to.deep.equal(['/v/mobile', '/v/experiment']);
  });

  it('pins: audience-only pages write no plugin storage', async () => {
    // getAudienceConfig() and serveAudience() serve audiences without
    // importing UED or writing consent/assignment storage.
    setMain([section(controlSection, [linkRow('Audience: mobile', '/v/mobile')])]);
    window.fetch = responseMap({ '/v/mobile': '<p id="served">Mobile</p>' });

    await run({ audiences: audiences({ mobile: true }) });

    expect(document.querySelector('#served').textContent).to.equal('Mobile');
    expect(Object.keys(localStorage)).to.deep.equal([]);
    expect(Object.keys(sessionStorage)).to.deep.equal([]);
    expect(window.fetch.calls).to.deep.equal(['/v/mobile']);
  });

  it('pins: no audience match leaves control content and emits no event', async () => {
    // getAudienceConfig() returns false when configured audiences do not resolve;
    // createModificationsHandler() exits before fetching.
    setMain([section(controlSection, [linkRow('Audience: mobile', '/v/mobile')])]);
    window.fetch = responseMap({ '/v/mobile': '<p id="served">Mobile</p>' });

    const { events, rum, hlx } = await run({ audiences: audiences({ mobile: false }) });

    expect(document.querySelector('#control').textContent).to.equal('Control');
    expect(document.querySelector('#served')).to.equal(null);
    expect(events).to.deep.equal([]);
    expect(rum).to.deep.equal([]);
    expect(hlx.audiences).to.deep.equal([]);
    expect(window.fetch.calls).to.deep.equal([]);
  });

  it('documents: section-scope Experiment End Date and Requires Consent are ignored', async () => {
    // getAllSectionMeta() keeps section keys kebab-case;
    // getExperimentConfig() reads endDate/requiresConsent camelCase.
    setMain([section(controlSection, [
      sectionMetaRow('Experiment', 'Expired Consent Test'),
      linkRow('Experiment Variants', '/v/experiment'),
      sectionMetaRow('Experiment Split', '100'),
      sectionMetaRow('Experiment End Date', '2000-01-01'),
      sectionMetaRow('Experiment Requires Consent', 'true'),
    ])]);
    window.fetch = responseMap({ '/v/experiment': '<p id="served">Ignored guards</p>' });

    const { hlx } = await run({ audiences: {} });

    expect(document.querySelector('#served').textContent).to.equal('Ignored guards');
    expect(hlx.experiments[0].config.endDate).to.equal(null);
    expect(hlx.experiments[0].config.requiresConsent).to.equal(false);
    expect(window.fetch.calls).to.deep.equal(['/v/experiment']);
  });

  it('documents: section swaps drop Style and Anchor metadata', async () => {
    // replaceInner() replaces section innerHTML, dropping original Style/Anchor rows.
    // Loader coverage asserts P1.2 carries these rows before loadArea decoration.
    setMain([section(controlSection, [
      linkRow('Audience: mobile', '/v/mobile'),
      sectionMetaRow('Style', 'dark'),
      sectionMetaRow('Anchor', 'hero'),
    ])]);
    window.fetch = responseMap({ '/v/mobile': '<p id="served">Mobile</p>' });

    await run({ audiences: audiences({ mobile: true }) });

    expect(document.querySelector('#served').textContent).to.equal('Mobile');
    expect(document.querySelector('.section-metadata')).to.equal(null);
    expect(document.body.textContent).not.to.contain('dark');
    expect(document.body.textContent).not.to.contain('hero');
    expect(window.fetch.calls).to.deep.equal(['/v/mobile']);
  });

  it('documents: hanging variant fetch keeps loadEager pending', async () => {
    // replaceInner() awaits fetch(path) without passing an AbortSignal;
    // loadEager() therefore never resolves while the fetch remains pending.
    // Loader coverage asserts P1.2 aborts this fetch and keeps original content.
    clock = sinon.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    setMain([section(controlSection, [linkRow('Audience: mobile', '/v/mobile')])]);
    const calls = [];
    const fetched = Promise.withResolvers();
    window.fetch = (url, init = {}) => {
      const path = new URL(`${url}`, window.location.origin).pathname;
      calls.push({ path, hasSignal: Boolean(init.signal) });
      fetched.resolve();
      return new Promise((resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    };
    window.hlx = {};
    const pending = loadEager(document, { audiences: audiences({ mobile: true }) });
    let settled = false;
    pending
      .then(() => {
        settled = true;
        return null;
      })
      .catch(() => {
        settled = true;
        return null;
      });

    await Promise.race([
      fetched.promise,
      new Promise((resolve) => { realSetTimeout(resolve, 50); }),
    ]);

    expect(calls.map(({ path }) => path)).to.deep.equal(['/v/mobile']);
    expect(calls[0].hasSignal).to.equal(false);
    await clock.tickAsync(60_000);
    await new Promise((resolve) => { realSetTimeout(resolve, 0); });
    const completed = await Promise.race([
      pending.then(() => true, () => true),
      new Promise((resolve) => { realSetTimeout(() => resolve(false), 0); }),
    ]);

    expect(completed).to.equal(false);
    expect(settled).to.equal(false);
    expect(document.querySelector('[data-audience="default"]')).to.equal(null);
    expect(document.querySelector('#control').textContent).to.equal('Control');
  });

  it('pins: experimentsMetaTagPrefix override disables experiments', async () => {
    // runExperiment() passes experimentsMetaTagPrefix to applyAllModifications(),
    // which reads only that prefix. The fetched=false assertion stands in
    // for no UED import because ES modules are cached across tests.
    addPageExperimentMeta();
    setMain([`<div>${controlSection}</div>`]);
    const fetch = responseMap({});
    let fetched = false;
    window.fetch = async (...args) => {
      fetched = true;
      return fetch(...args);
    };

    const { events, hlx } = await run({
      audiences: {},
      experimentsMetaTagPrefix: 'disabled-experiment',
    });

    expect(fetched).to.equal(false);
    expect(events).to.deep.equal([]);
    expect(hlx.experiments).to.deep.equal([]);
    expect(sessionStorage.getItem(ASSIGNMENT_KEY)).to.equal(null);
    expect(fetch.calls).to.deep.equal([]);
  });

  it('pins: loadEager reads the global document, not its doc argument', async () => {
    // applyAllModifications() reads metadata through getMetadata()/getAllMetadata()
    // (global document.head) and scans the global document's <main> and
    // .section-metadata; loadEager() then overwrites window.hlx.experiments.
    // The doc argument only reaches serveAudience()'s body.dataset.audiences and
    // the aem:experimentation event target. Fragment personalization (A2) must
    // not rely on passing a fragment as `doc`: if this fails, re-read A2.
    const meta = `
      <meta name="experiment" content="Doc Arg Test">
      <meta name="experiment-variants" content="/v/doc-page">
      <meta name="experiment-split" content="100">`;
    const docSection = section('<p id="doc-control">Doc control</p>', [
      linkRow('Audience: mobile', '/v/doc-section'),
    ]);
    const detached = document.implementation.createHTMLDocument('');
    detached.head.innerHTML = meta;
    detached.body.innerHTML = `<main>${docSection}</main>`;
    setMain([`<div>${controlSection}</div>`]);
    window.fetch = responseMap({
      '/v/doc-page': '<p id="served">Page variant</p>',
      '/v/doc-section': '<p id="served">Section variant</p>',
    });
    const options = { audiences: audiences({ mobile: true }) };
    const stale = [{ type: 'page', config: { id: 'stale' } }];
    window.hlx = { experiments: stale };

    await loadEager(detached, options);

    // The doc's own metadata and sections were ignored, and the stale global
    // result was still overwritten (a fragment run clobbers the page's)...
    expect(window.fetch.calls).to.deep.equal([]);
    expect(window.hlx.experiments).to.deep.equal([]);
    expect(window.hlx.audiences).to.deep.equal([]);
    expect(detached.querySelector('#doc-control').textContent).to.equal('Doc control');
    expect(detached.querySelector('main [data-experiment], main [data-audience]')).to.equal(null);
    expect(detached.body.dataset.experiment).to.equal(undefined);
    // ...and the argument really was delivered.
    expect(detached.body.dataset.audiences).to.equal('mobile');

    // Positive control: the same metadata on the global document is applied to
    // the global <main>, even though `detached` is still what's passed in.
    document.head.insertAdjacentHTML('beforeend', meta);
    setMain([docSection]);
    window.fetch = responseMap({
      '/v/doc-page': '<p id="served">Page variant</p>',
      '/v/doc-section': '<p id="served">Section variant</p>',
    });
    window.hlx = {};

    await loadEager(detached, options);

    expect(window.fetch.calls).to.have.members(['/v/doc-section', '/v/doc-page']);
    expect(window.hlx.experiments[0].config.id).to.equal('doc-arg-test');
    // Page experiments stamp the global <body> (the modifications handler's `cb`).
    expect(document.body.dataset.experiment).to.equal('doc-arg-test');
    expect(detached.body.dataset.experiment).to.equal(undefined);
    expect(document.querySelector('main #served')).to.exist;
    expect(detached.querySelector('#doc-control').textContent).to.equal('Doc control');
    expect(detached.querySelector('#served')).to.equal(null);
  });
});
