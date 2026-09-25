import { expect } from '@esm-bundle/chai';
import {
  readPage, readSheet, sourceOf, isPagePath, pathFromDaContext, waitForDaContext,
  sectionKeyIssues,
} from '../../experiments-panel/sources.js';

// Served (server-rendered) HTML, the shape the panel fetches: authored
// Section Metadata is already flattened to data-* on the section.
const PAGE = `<html><head>
  <meta name="experiment" content="Page Test">
  <meta name="experiment-variants" content="/variants/pricing/b">
</head><body><main>
  <div><h1>Hero</h1></div>
  <div data-experiment="Hero Copy" data-experiment-variants="https://main--atreyu--dallinbsmith.aem.page/v/one"><p>Body</p></div>
</main></body></html>`;

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()].map((n) => `${n}`.padStart(2, '0')).join('-');
};

const row = (key, value) => `<div><div><p>${key}</p></div><div><p>${value}</p></div></div>`;
const personalize = (rows) => `<div class="personalize">${rows.join('')}</div>`;
const served = (sections) => `<html><head></head><body><main>${sections.map((s) => `<div>${s}</div>`).join('')}</main></body></html>`;

const SHEET = {
  data: [
    { URL: '/**', template: 'default' },
    { URL: '/pricing', Experiment: 'Page Test', 'Experiment Variants': '/variants/pricing/b' },
    { URL: '/features/**', Experiment: 'Features Test', 'Experiment Variants': '/variants/f' },
  ],
};

describe('experiments-panel/sources.js', () => {
  it('reads the page-level test from head meta and ignores flattened section keys (tables only)', () => {
    const tests = readPage(PAGE, '/pricing');
    expect(tests.map((t) => t.kind)).to.deep.equal(['page']);
    expect(tests[0].scope).to.equal('Whole page');
    expect(tests[0].cfg.id).to.equal('page-test');
    const issues = sectionKeyIssues(PAGE);
    expect(issues).to.have.length(2);
    expect(issues[0]).to.contain('Section 2').and.to.contain('"experiment"').and.to.contain('Personalize table for a section');
  });

  it('reads the Experiment table as the whole-page test and flags what it replaces', () => {
    const table = '<div class="experiment"><div><div>Test Name</div><div>Table Test</div></div><div><div>Variants</div><div><a href="/v/t">t</a></div></div></div>';
    const html = PAGE.replace('<div><h1>Hero</h1></div>', `<div><h1>Hero</h1></div><div>${table}${table}</div>`);
    const [page, ...rest] = readPage(html, '/pricing');
    expect(rest).to.deep.equal([]);
    expect(page.cfg.id).to.equal('table-test');
    expect(page.cfg.variants.map((v) => v.path)).to.deep.equal(['/pricing', '/v/t']);
    expect(sourceOf(page, [], '/pricing').label).to.equal('Experiment table (page doc)');
    expect(page.notes[0]).to.contain('Replaces test "page-test"');
    expect(page.notes[1]).to.contain('2 Experiment tables');
  });

  describe('Personalize tables (the only section-level source)', () => {
    it('reports what the compiler serves, in catalog order, with the section number', () => {
      const html = served([
        '<h1>Hero</h1>',
        `<p>Body</p>${personalize([
          row('Name', 'Hero by device'),
          row('Audience: desktop', '<a href="/v/desktop">/v/desktop</a>'),
          row('Audience: mobile', '<a href="/v/mobile">/v/mobile</a>'),
          row('End Date', day(30)),
          row('Owner', 'Web team'),
        ])}`,
      ]);
      const [test, ...rest] = readPage(html, '/');
      expect(rest).to.deep.equal([]);
      expect(test.kind).to.equal('personalize');
      expect(test.scope).to.equal('Section 2');
      expect(test.values.Name).to.equal('Hero by device');
      expect(test.values.Owner).to.equal('Web team');
      expect(test.served).to.deep.equal([
        { id: 'mobile', path: '/v/mobile' },
        { id: 'desktop', path: '/v/desktop' },
      ]);
      expect(test.notes).to.deep.equal([]);
    });

    it('serves nothing for an inactive table or a past End Date (production rules)', () => {
      const html = served([
        `<p>A</p>${personalize([row('Audience: mobile', '/v/a'), row('Status', 'inactive'), row('End Date', day(30))])}`,
        `<p>B</p>${personalize([row('Audience: mobile', '/v/b'), row('End Date', day(-1))])}`,
      ]);
      const tests = readPage(html, '/');
      expect(tests.map((t) => t.scope)).to.deep.equal(['Section 1', 'Section 2']);
      expect(tests.map((t) => t.served)).to.deep.equal([[], []]);
      expect(tests[0].notes).to.deep.equal(['Status is inactive: served only in `?audience=` previews.']);
      expect(tests[1].notes).to.deep.equal([]);
    });

    it('notes a second table in the same section, which the compiler ignores', () => {
      const html = served([`<p>A</p>${personalize([row('Audience: mobile', '/v/first'), row('End Date', day(30))])}${personalize([row('Audience: mobile', '/v/second'), row('End Date', day(30))])}`]);
      const [test] = readPage(html, '/');
      expect(test.served).to.deep.equal([{ id: 'mobile', path: '/v/first' }]);
      expect(test.notes[0]).to.contain('2 Personalize tables');
    });

    it('numbers sections as authored even when the compiler removes a table-only section', () => {
      const html = served([
        personalize([row('Audience: mobile', '/v/x'), row('End Date', day(30))]),
        `<p>Two</p>${personalize([row('Audience: desktop', '/v/y'), row('End Date', day(30))])}`,
      ]);
      const [removed, kept] = readPage(html, '/');
      expect([removed.scope, kept.scope]).to.deep.equal(['Section 1', 'Section 2']);
      expect(removed.served).to.deep.equal([]);
      expect(removed.notes).to.deep.equal(['This section holds only the Personalize table, so the compiler removes it and serves nothing.']);
      expect(kept.served).to.deep.equal([{ id: 'desktop', path: '/v/y' }]);
      expect(kept.notes).to.deep.equal([]);
    });
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
