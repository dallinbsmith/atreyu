import { expect } from '@esm-bundle/chai';
import {
  readPage, readSheet, sourceOf, isPagePath, pathFromDaContext, waitForDaContext,
} from '../../experiments-panel/sources.js';

const PAGE = `<html><head>
  <meta name="experiment" content="Page Test">
  <meta name="experiment-variants" content="/variants/pricing/b">
</head><body><main>
  <div><h1>Hero</h1></div>
  <div><p>Body</p><div class="section-metadata">
    <div><div>Experiment</div><div>Hero Copy</div></div>
    <div><div>Experiment Variants</div><div><p><a href="https://main--atreyu--dallinbsmith.aem.page/v/one">x</a></p><p><a href="/v/two">y</a></p></div></div>
    <div><div>Experiment Split</div><div>25, 25</div></div>
  </div></div>
</main></body></html>`;

const SHEET = {
  data: [
    { URL: '/**', template: 'default' },
    { URL: '/pricing', Experiment: 'Page Test', 'Experiment Variants': '/variants/pricing/b' },
    { URL: '/features/**', Experiment: 'Features Test', 'Experiment Variants': '/variants/f' },
  ],
};

describe('experiments-panel/sources.js', () => {
  it('reads the page-level test from head meta and section tests from section metadata', () => {
    const [page, section] = readPage(PAGE, '/pricing');
    expect(page.scope).to.equal('Whole page');
    expect(page.cfg.id).to.equal('page-test');
    expect(section.scope).to.equal('Section 2');
    expect(section.cfg.id).to.equal('hero-copy');
    expect(section.cfg.variants.map((v) => v.path)).to.deep.equal(['/pricing', '/v/one', '/v/two']);
    expect(section.cfg.variants.map((v) => v.split)).to.deep.equal([50, 25, 25]);
  });

  it('returns no tests for a page without experiment metadata', () => {
    expect(readPage('<html><head></head><body><main><div></div></main></body></html>', '/')).to.deep.equal([]);
  });

  it('reads sheet rows that define a test and ignores other bulk metadata rows', () => {
    const rows = readSheet(SHEET, '/metadata-experiments.json');
    expect(rows.map((r) => r.pattern)).to.deep.equal(['/pricing', '/features/**']);
    expect(readSheet(null, '/metadata.json')).to.deep.equal([]);
  });

  it('attributes a whole-page test to the matching sheet row', () => {
    const rows = readSheet(SHEET, '/metadata-experiments.json');
    const [page] = readPage(PAGE, '/pricing');
    expect(sourceOf(page, rows, '/pricing').label).to.contain('Sheet /metadata-experiments.json (/pricing)');
  });

  it('warns when page metadata overrides a sheet row (page doc wins in EDS)', () => {
    const rows = readSheet(SHEET, '/metadata-experiments.json');
    const [page] = readPage(PAGE, '/features/x');
    const source = sourceOf(page, rows, '/features/x');
    expect(source.label).to.equal('Page metadata (page doc)');
    expect(source.issue).to.contain('Overrides sheet row "features-test"');
  });

  it('only treats plain same-origin paths from sheet cells as links', () => {
    expect(isPagePath('/pricing')).to.equal(true);
    expect(isPagePath('/features/teams')).to.equal(true);
    // eslint-disable-next-line no-script-url -- asserting the guard rejects it
    for (const bad of ['javascript:alert(1)', '//evil.example', '/\\evil.example', '\\evil', '/features/**', 'https://x.y/', '/a:b']) {
      expect(isPagePath(bad), bad).to.equal(false);
    }
  });

  it('maps a DA editor context path to the served page path', () => {
    expect(pathFromDaContext({ path: '/pricing' })).to.equal('/pricing');
    expect(pathFromDaContext({ path: '/index' })).to.equal('/');
    expect(pathFromDaContext({ path: '/features/index' })).to.equal('/features/');
    for (const bad of [undefined, {}, { path: 'pricing' }, { path: '//evil.example' }]) {
      expect(pathFromDaContext(bad)).to.equal(null);
    }
  });

  it('accepts the DA handshake only from da.live, and times out to null', async () => {
    const pending = waitForDaContext(200);
    window.dispatchEvent(new MessageEvent('message', { origin: 'https://evil.example', data: { ready: true, context: { path: '/evil' } } }));
    window.dispatchEvent(new MessageEvent('message', { origin: 'https://da.live', data: { ready: true, context: { path: '/pricing' } } }));
    expect(await pending).to.equal('/pricing');
    expect(await waitForDaContext(50)).to.equal(null);
  });
});
