import { expect } from '@esm-bundle/chai';
import {
  readPage, readSheet, sourceOf, isPagePath, pathFromDaContext, waitForDaContext,
  sectionKeyIssues,
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
    <div><div>Experiment End Date</div><div>2026-12-01</div></div>
    <div><div>Experiment Start Date</div><div>2026-01-01</div></div>
    <div><div>Experiment Requires Consent</div><div>true</div></div>
    <div><div>Experiment Variant Names</div><div>Bold, Clear</div></div>
    <div><div>Experiment Optimizing Target</div><div>signup</div></div>
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
    expect(page.kind).to.equal('page');
    expect(page.scope).to.equal('Whole page');
    expect(page.cfg.id).to.equal('page-test');
    expect(section.kind).to.equal('section');
    expect(section.scope).to.equal('Section 2');
    expect(section.cfg.id).to.equal('hero-copy');
    expect(section.cfg.variants.map((v) => v.path)).to.deep.equal(['/pricing', '/v/one', '/v/two']);
    expect(section.cfg.variants.map((v) => v.split)).to.deep.equal([50, 25, 25]);
    expect(section.cfg.variants.map((v) => v.label)).to.deep.equal(['Control', 'Challenger 1', 'Challenger 2']);
    expect(section.cfg.startDate).to.equal(null);
    expect(section.cfg.endDate).to.equal(null);
    expect(section.cfg.ignoredAtSection).to.deep.equal([
      'End Date',
      'Start Date',
      'Requires Consent',
      'Variant Names',
      'Optimizing Target',
    ]);
  });

  it('reads the Experiment table as the whole-page test and flags what it replaces', () => {
    const table = '<div class="experiment"><div><div>Test Name</div><div>Table Test</div></div><div><div>Variants</div><div><a href="/v/t">t</a></div></div></div>';
    const html = PAGE.replace('<div><h1>Hero</h1></div>', `<div><h1>Hero</h1></div><div>${table}${table}</div>`);
    const [page, section] = readPage(html, '/pricing');
    expect(page.cfg.id).to.equal('table-test');
    expect(page.cfg.variants.map((v) => v.path)).to.deep.equal(['/pricing', '/v/t']);
    expect(sourceOf(page, [], '/pricing').label).to.equal('Experiment table (page doc)');
    expect(page.notes[0]).to.contain('Replaces test "page-test"');
    expect(page.notes[1]).to.contain('2 Experiment tables');
    expect(section.cfg.id).to.equal('hero-copy');
  });

  it('returns no tests for a page without experiment metadata', () => {
    expect(readPage('<html><head></head><body><main><div></div></main></body></html>', '/')).to.deep.equal([]);
  });

  it('reads sheet rows that define a test and ignores other bulk metadata rows', () => {
    const rows = readSheet(SHEET, '/metadata-experiments.json');
    expect(rows.map((r) => r.kind)).to.deep.equal(['sheet', 'sheet']);
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
    for (const bad of [undefined, {}, { path: 'pricing' }, { path: '//evil.example' }, { path: '/\\evil.example' }]) {
      expect(pathFromDaContext(bad)).to.equal(null);
    }
  });

  it('accepts the DA handshake only from da.live, and times out to null', async () => {
    const pending = waitForDaContext(200);
    window.dispatchEvent(new MessageEvent('message', { origin: 'https://evil.example', data: { ready: true, context: { path: '/evil' } } }));
    window.dispatchEvent(new MessageEvent('message', { origin: 'https://da.live', data: { ready: true, context: { path: '/other-frame' } } }));
    window.dispatchEvent(new MessageEvent('message', { origin: 'https://da.live', source: window.parent, data: { ready: true, context: { path: '/pricing' } } }));
    expect(await pending).to.deep.equal({ path: '/pricing', port: null });
    expect(await waitForDaContext(50)).to.equal(null);
  });
});

// PLUGIN_ATTR, through its only caller. Keep in step with the reserved-keys
// rule in tools/sidekick/blocks.md.
describe('sectionKeyIssues reserved keys (B2)', () => {
  const flagged = (attr) => sectionKeyIssues(`<main><div ${attr}="x"><p>a</p></div></main>`).length > 0;
  const cases = [
    ['data-experiment', true],
    ['data-experiment-variants', true],
    ['data-campaign:-launch', true],
    ['data-audiences', true],
    ['data-audience', true],
    ['data-audience:-mobile', true],
    ['data-variant', true],
    ['data-variants', false],
    ['data-experiments', false],
    ['data-grid', false],
    ['data-campaigns', false],
  ];
  cases.forEach(([attr, expected]) => {
    it(`${attr} is ${expected ? '' : 'not '}reserved`, () => {
      expect(flagged(attr)).to.equal(expected);
    });
  });
});
