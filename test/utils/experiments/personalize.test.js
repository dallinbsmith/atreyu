import { expect } from '@esm-bundle/chai';
import sinon from 'sinon';
// The parity test runs the vendored plugin directly.
// eslint-disable-next-line import/no-relative-packages
import { loadEager } from '../../../plugins/experimentation/src/index.js';
import {
  applyPersonalizeTables,
  planAudiences,
  readPersonalizeTable,
} from '../../../scripts/utils/experiments/personalize.js';
import { loadArea, setConfig } from '../../../scripts/ak.js';
import { responseMap } from './fixtures/plugin-contract.js';

// CI re-runs this file with TZ=America/Los_Angeles (End Date is local-time
// logic); logged first so the job log shows which zone the browser used.
console.log(`End Date tests time zone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);

const NOW = Date.parse('2026-09-24T12:00:00Z');
const FUTURE = '2026-12-31';
const PAST = '2026-09-01';
const realMatchMedia = window.matchMedia;
const realRandom = Math.random;
const realFetch = window.fetch;
const originalSearch = window.location.search;

const row = (key, value) => `<div><div>${key}</div><div>${value}</div></div>`;
const link = (path) => `<a href="${path}">${path}</a>`;
const table = (rows) => `<div class="personalize">${rows.join('')}</div>`;
const meta = (rows) => `<div class="section-metadata">${rows.join('')}</div>`;
const setMain = (...sections) => { document.body.innerHTML = `<main>${sections.join('')}</main>`; };
const section = (...children) => `<div>${children.join('')}</div>`;
const content = '<p id="control">Control</p>';

const baseRows = ({ status = 'active', endDate = FUTURE, audiences = [['mobile', '/v/p/home/mobile']] } = {}) => [
  row('Name', 'Home hero'),
  ...audiences.map(([id, path]) => row(`Audience: ${id}`, link(path))),
  row('Status', status),
  row('End Date', endDate),
  row('Owner', 'dallin'),
];

const compile = (opts = {}) => applyPersonalizeTables(document, { prod: false, now: NOW, search: '', ...opts });

const audienceRows = (el = document.querySelector('main > div')) => [
  ...(el?.querySelectorAll(':scope > .section-metadata > div') ?? []),
].map((r) => [r.children[0].textContent, r.children[1].querySelector('a')?.getAttribute('href') ?? r.children[1].textContent]);

const setSearch = (search = '') => window.history.replaceState({}, '', `${window.location.pathname}${search}`);

describe('scripts/utils/experiments/personalize.js', () => {
  let warn;

  beforeEach(() => {
    warn = sinon.stub(console, 'warn');
    window.matchMedia = (query) => ({ matches: query.includes('< 768px') });
  });

  afterEach(() => {
    warn.restore();
    window.matchMedia = realMatchMedia;
    window.fetch = realFetch;
    Math.random = realRandom;
    setSearch(originalSearch);
    document.body.innerHTML = '';
    [...document.body.getAttributeNames()].forEach((attr) => document.body.removeAttribute(attr));
    window.hlx = undefined;
    delete window.aem;
  });

  it('reads every field and the first link of each audience row', () => {
    document.body.innerHTML = table([
      ...baseRows(),
      row('Audience: Desktop', `${link('/v/p/home/desktop')}${link('/v/other')}`),
    ]);
    expect(readPersonalizeTable(document.querySelector('.personalize'))).to.deep.equal({
      name: 'Home hero',
      owner: 'dallin',
      status: 'active',
      endDate: FUTURE,
      rows: [{ id: 'mobile', path: '/v/p/home/mobile' }, { id: 'desktop', path: '/v/p/home/desktop' }],
    });
  });

  it('treats an empty cell like a missing row (empty Status means active)', () => {
    document.body.innerHTML = table([row('Status', ''), row('Name', '<p></p>'), row('End Date', FUTURE)]);
    const parsed = readPersonalizeTable(document.querySelector('.personalize'));
    expect(parsed.status).to.equal('active');
    expect(parsed.name).to.equal('');
  });

  it('takes the first paragraph of a path cell without a link, not all paragraphs joined', () => {
    document.body.innerHTML = table([row('Audience: mobile', '<p>/v/p/home/mobile</p><p>see brief</p>')]);
    expect(readPersonalizeTable(document.querySelector('.personalize')).rows)
      .to.deep.equal([{ id: 'mobile', path: '/v/p/home/mobile' }]);
  });

  it('skips blank paragraphs (whitespace, &nbsp;) in a path cell without a link', () => {
    document.body.innerHTML = table([row('Audience: mobile', '<p> </p><p>&nbsp;</p><p> /v/p/home/mobile </p><p>brief</p>')]);
    expect(readPersonalizeTable(document.querySelector('.personalize')).rows)
      .to.deep.equal([{ id: 'mobile', path: '/v/p/home/mobile' }]);
  });

  it('uses a link\'s href, not its text, inside a paragraph', () => {
    document.body.innerHTML = table([row('Audience: mobile', '<p><a href="/v/x">Mobile hero</a></p>')]);
    expect(readPersonalizeTable(document.querySelector('.personalize')).rows)
      .to.deep.equal([{ id: 'mobile', path: '/v/x' }]);
  });

  it('compiles to Audience rows, removes the table and returns the plan', () => {
    setMain(section(content, table(baseRows())));
    const plan = compile();
    const target = document.querySelector('main > div');
    expect(Boolean(document.querySelector('.personalize'))).to.equal(false);
    expect(audienceRows()).to.deep.equal([['Audience: mobile', '/v/p/home/mobile']]);
    expect(plan).to.deep.equal([{
      section: target, name: 'Home hero', owner: 'dallin', rules: [{ id: 'mobile', path: '/v/p/home/mobile' }],
    }]);
  });

  it('writes rows in catalog order, not authored order (catalog precedence)', () => {
    setMain(section(content, table(baseRows({
      audiences: [['desktop', '/v/p/home/desktop'], ['mobile', '/v/p/home/mobile']],
    }))));
    compile();
    expect(audienceRows().map(([key]) => key)).to.deep.equal(['Audience: mobile', 'Audience: desktop']);
  });

  it('keeps only pathnames, so an absolute aem.page link becomes a same-origin /v/ path', () => {
    setMain(section(content, table(baseRows({
      audiences: [['mobile', 'https://main--atreyu--dallinbsmith.aem.page/v/p/home/mobile?x=1#y']],
    }))));
    compile();
    expect(audienceRows()).to.deep.equal([['Audience: mobile', '/v/p/home/mobile']]);
  });

  it('replaces raw audience rows in the section metadata and keeps the others', () => {
    setMain(section(content, table(baseRows()), meta([
      row('Style', 'dark'),
      row('Audience: desktop', link('/v/hand-written')),
      row('Audience', 'mobile'),
    ])));
    compile();
    expect(audienceRows()).to.deep.equal([['Style', 'dark'], ['Audience: mobile', '/v/p/home/mobile']]);
    expect(document.querySelectorAll('.section-metadata')).to.have.length(1);
  });

  describe('drop rules', () => {
    const rulesFor = (rows, opts) => {
      setMain(section(content, table(rows), meta([row('Audience: desktop', link('/v/raw'))])));
      const plan = compile(opts);
      return { plan, rows: audienceRows() };
    };

    it('drops an inactive table, and its section loses raw audience rows too', () => {
      expect(rulesFor(baseRows({ status: 'inactive' }))).to.deep.equal({ plan: [], rows: [] });
      expect(warn.calledWithMatch(/Status "inactive" is not active/)).to.equal(true);
    });

    it('keeps an inactive table for a non-prod ?audience= preview only', () => {
      expect(rulesFor(baseRows({ status: 'inactive' }), { search: '?audience=mobile' }).rows)
        .to.deep.equal([['Audience: mobile', '/v/p/home/mobile']]);
      expect(rulesFor(baseRows({ status: 'inactive' }), { search: '?audience=mobile', prod: true }).rows)
        .to.deep.equal([]);
      expect(rulesFor(baseRows({ status: 'inactive' }), { search: '?experiment=x' }).rows).to.deep.equal([]);
    });

    it('drops an ended table even in preview', () => {
      expect(rulesFor(baseRows({ endDate: PAST }), { search: '?audience=mobile' }).rows).to.deep.equal([]);
    });

    it('drops a table whose End Date is missing or invalid', () => {
      const noEnd = baseRows().filter((r) => !r.includes('End Date'));
      expect(rulesFor(noEnd).rows).to.deep.equal([]);
      expect(rulesFor(baseRows({ endDate: 'soon' })).rows).to.deep.equal([]);
    });

    it('defaults a missing Status to active, like the Experiment table', () => {
      const noStatus = baseRows().filter((r) => !r.includes('Status'));
      expect(rulesFor(noStatus).rows).to.deep.equal([['Audience: mobile', '/v/p/home/mobile']]);
    });

    it('drops rows with ids outside the catalog, paths outside /v/, and duplicates', () => {
      const { rows } = rulesFor(baseRows({
        audiences: [
          ['tablet', '/v/p/home/tablet'],
          ['desktop', '/blog/desktop'],
          ['desktop', '/v/'],
          ['mobile', '/v/p/home/mobile'],
          ['mobile', '/v/p/home/mobile-again'],
        ],
      }));
      expect(rows).to.deep.equal([['Audience: mobile', '/v/p/home/mobile']]);
      expect(warn.callCount).to.equal(4);
    });

    it('drops a bare /v/ first row for an id', () => {
      expect(rulesFor(baseRows({ audiences: [['mobile', '/v/']] }))).to.deep.equal({ plan: [], rows: [] });
    });

    it('keeps a corrected row after a broken row for the same id', () => {
      const { rows } = rulesFor(baseRows({
        audiences: [['mobile', '/v/'], ['mobile', '/v/p/home/mobile-fixed']],
      }));
      expect(rows).to.deep.equal([['Audience: mobile', '/v/p/home/mobile-fixed']]);
      expect(warn.callCount).to.equal(1);
    });

    it('keeps at most three rules, the first three in catalog order', () => {
      const { rows } = rulesFor(baseRows({
        audiences: [
          ['campaign-b', '/v/b'], ['campaign-a', '/v/a'], ['desktop', '/v/d'], ['mobile', '/v/m'],
        ],
      }));
      expect(rows.map(([key]) => key)).to.deep.equal(['Audience: mobile', 'Audience: desktop', 'Audience: campaign-b']);
    });
  });

  describe('End Date', () => {
    const local = (y, m, d, h = 0, min = 0, s = 0) => new Date(y, m - 1, d, h, min, s).getTime();
    const ymd = (ms) => {
      const d = new Date(ms);
      return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
    };
    const live = (endDate, now) => {
      setMain(section(content, table(baseRows({ endDate }))));
      return compile({ now }).length === 1;
    };

    it('a date-only value runs through the end of that day in local time', () => {
      expect(live('2026-09-24', local(2026, 9, 24, 23, 59, 59))).to.equal(true);
      expect(live('2026-09-24', local(2026, 9, 25))).to.equal(false);
    });

    it('rejects impossible YYYY-MM-DD dates instead of rolling over', () => {
      const now = local(2026, 9, 24, 12);
      for (const endDate of ['2027-02-30', '2026-13-01', '2026-00-10', '2026-12-32']) {
        expect(live(endDate, now), endDate).to.equal(false);
      }
      expect(live('2027-02-28', now)).to.equal(true);
    });

    // Across the US DST change (Nov 1 2026 is 25 hours long in US zones), the
    // end is local midnight Nov 2, not End Date + 24h (Nov 1 23:00 local).
    it('ends at local midnight after the End Date across a DST change', () => {
      const now = local(2026, 10, 30, 12);
      expect(live('2026-11-01', now)).to.equal(true);
      expect(live('2026-11-01', local(2026, 11, 1, 23, 30))).to.equal(true);
      expect(live('2026-11-01', local(2026, 11, 2) - 1000)).to.equal(true);
      expect(live('2026-11-01', local(2026, 11, 2))).to.equal(false);
    });

    // ISO-only: each of these would otherwise be a live, in-range date (or,
    // for 46022, never end), so the format rule alone must reject it.
    it('rejects anything that is not YYYY-MM-DD, naming the expected format', () => {
      const now = local(2026, 9, 24, 12);
      for (const endDate of [
        '12/31/2026', 'Dec 31, 2026', '2026-12-31T23:59', '46022', '2027', 'December 31', '2026-1-5', '',
      ]) {
        warn.resetHistory();
        expect(live(endDate, now), endDate).to.equal(false);
        expect(warn.calledWithMatch(`End Date "${endDate}" must be YYYY-MM-DD`), endDate).to.equal(true);
      }
    });

    // cellValue (block.js) trims the cell; toEnd relies on that.
    it('trims the cell before matching', () => {
      expect(live(' 2026-12-31 ', local(2026, 9, 24, 12))).to.equal(true);
    });

    it('caps the End Date at 180 days after today', () => {
      const now = local(2026, 9, 24, 12);
      expect(live(ymd(local(2026, 9, 24 + 180)), now)).to.equal(true);
      expect(live(ymd(local(2026, 9, 24 + 181)), now)).to.equal(false);
      expect(warn.calledWithMatch(/more than 180 days away/)).to.equal(true);

      warn.resetHistory();
      setMain(section(content, table(baseRows({ endDate: ymd(local(2026, 9, 24 + 181)) }))));
      expect(compile({ now, prod: true })).to.deep.equal([]);
      expect(warn.called).to.equal(false);
    });
  });

  it('compiles each section\'s own table (first table wins per section, not per page)', () => {
    setMain(
      section('<p>One</p>', table(baseRows())),
      section('<p>Two</p>', table(baseRows({ audiences: [['desktop', '/v/p/home/desktop']] }))),
    );
    const plan = compile();
    const [one, two] = document.querySelectorAll('main > div');
    expect(plan.map(({ rules }) => rules[0].id)).to.deep.equal(['mobile', 'desktop']);
    expect(plan[0].section === one && plan[1].section === two).to.equal(true);
    expect(audienceRows(one)).to.deep.equal([['Audience: mobile', '/v/p/home/mobile']]);
    expect(audienceRows(two)).to.deep.equal([['Audience: desktop', '/v/p/home/desktop']]);
  });

  it('first table in a section wins; later tables are removed and warned about off prod only', () => {
    const second = table(baseRows({ audiences: [['desktop', '/v/p/home/desktop']] }));
    setMain(section(content, table(baseRows()), second));
    compile();
    expect(document.querySelectorAll('.personalize')).to.have.length(0);
    expect(audienceRows()).to.deep.equal([['Audience: mobile', '/v/p/home/mobile']]);
    expect(warn.calledWithMatch(/a later table in this section is ignored/)).to.equal(true);

    warn.resetHistory();
    setMain(section(content, table(baseRows()), second));
    compile({ prod: true });
    expect(audienceRows()).to.deep.equal([['Audience: mobile', '/v/p/home/mobile']]);
    expect(warn.called).to.equal(false);
  });

  it('removes a section that held only the table (and metadata), compiling nothing', () => {
    setMain(
      section(table(baseRows()), meta([row('Style', 'dark')])),
      section(content),
    );
    expect(compile()).to.deep.equal([]);
    expect([...document.querySelectorAll('main > div')].map((s) => s.textContent)).to.deep.equal(['Control']);
  });

  it('is idempotent: a second run over the compiled DOM changes nothing', () => {
    setMain(section(content, table(baseRows()), meta([row('Style', 'dark')])));
    compile();
    const once = document.querySelector('main').innerHTML;
    expect(compile()).to.deep.equal([]);
    expect(document.querySelector('main').innerHTML).to.equal(once);
  });

  it('never parses author text as HTML', () => {
    // Escaped in the fixture, so the cell's text (what an author typed) is markup.
    setMain(section(content, table([
      row('Audience: mobile', '/v/x&lt;img src=x onerror=alert(1)&gt;'),
      row('End Date', FUTURE),
    ])));
    compile();
    expect(Boolean(document.querySelector('main img'))).to.equal(false);
    expect(audienceRows()).to.deep.equal([['Audience: mobile', '/v/x%3Cimg%20src=x%20onerror=alert(1)%3E']]);
  });

  it('planAudiences returns a fresh map with the plan campaign audiences at the catalog slot', () => {
    const plan = [{ rules: [{ id: 'campaign-launch' }, { id: 'mobile' }] }];
    const first = planAudiences(plan);
    expect(Object.keys(first)).to.deep.equal(['mobile', 'desktop', 'campaign-launch']);
    expect(planAudiences(plan) === first).to.equal(false);
    expect(Object.keys(planAudiences([]))).to.deep.equal(['mobile', 'desktop']);
  });

  describe('parity through the vendored plugin', () => {
    const variants = {
      '/v/p/home/mobile': '<p id="served">Mobile</p>',
      '/v/p/home/desktop': '<p id="served">Desktop</p>',
    };

    const serve = async (html, audiences) => {
      document.body.innerHTML = html;
      [...document.body.getAttributeNames()].forEach((attr) => document.body.removeAttribute(attr));
      const plan = compile();
      window.fetch = responseMap(variants);
      window.hlx = { rum: { sampleRUM: () => {} } };
      await loadEager(document, { audiences: audiences ?? planAudiences(plan) });
      return {
        main: document.querySelector('main').outerHTML,
        calls: window.fetch.calls,
        selected: window.hlx.audiences.map(({ config }) => config.selectedAudience),
      };
    };

    beforeEach(() => {
      Math.random = () => 0.5;
      setConfig({ locales: { '': {} }, linkBlocks: [], components: [], decorateArea: () => {} });
    });

    it('a compiled table swaps exactly like hand-written Audience metadata', async () => {
      const compiled = await serve(`<main><div>${content}${table(baseRows())}</div></main>`);
      const handWritten = await serve(`<main><div>${content}${meta([row('Audience: mobile', link('/v/p/home/mobile'))])}</div></main>`);
      expect(compiled.calls).to.deep.equal(['/v/p/home/mobile']);
      expect(compiled.selected).to.deep.equal(['mobile']);
      expect(document.querySelector('#served').textContent).to.equal('Mobile');
      expect(compiled).to.deep.equal(handWritten);
    });

    it('when several audiences match, catalog order wins regardless of table row order', async () => {
      const both = { mobile: () => true, desktop: () => true };
      const compiled = await serve(`<main><div>${content}${table(baseRows({
        audiences: [['desktop', '/v/p/home/desktop'], ['mobile', '/v/p/home/mobile']],
      }))}</div></main>`, both);
      const handWritten = await serve(`<main><div>${content}${meta([
        row('Audience: mobile', link('/v/p/home/mobile')),
        row('Audience: desktop', link('/v/p/home/desktop')),
      ])}</div></main>`, both);
      expect(compiled.selected).to.deep.equal(['mobile']);
      expect(compiled).to.deep.equal(handWritten);
    });

    it('a ?audience= preview forces the compiled audience like hand-written metadata', async () => {
      setSearch('?audience=desktop');
      const compiled = await serve(`<main><div>${content}${table(baseRows({
        audiences: [['mobile', '/v/p/home/mobile'], ['desktop', '/v/p/home/desktop']],
      }))}</div></main>`);
      const handWritten = await serve(`<main><div>${content}${meta([
        row('Audience: mobile', link('/v/p/home/mobile')),
        row('Audience: desktop', link('/v/p/home/desktop')),
      ])}</div></main>`);
      expect(compiled.calls).to.deep.equal(['/v/p/home/desktop']);
      expect(compiled.selected).to.deep.equal(['desktop']);
      expect(compiled).to.deep.equal(handWritten);
    });

    it('no match: the compiled metadata stays put and decorates exactly like hand-written', async () => {
      window.matchMedia = (query) => ({ matches: query.includes('>= 768px') });
      const decorated = async (html) => {
        const result = await serve(html);
        await loadArea();
        return { ...result, decorated: document.querySelector('main').outerHTML };
      };
      const compiled = await decorated(`<main><div>${content}${table(baseRows())}</div></main>`);
      const compiledSection = document.querySelector('main > div');
      const data = { ...compiledSection.dataset };
      const handWritten = await decorated(`<main><div>${content}${meta([row('Audience: mobile', link('/v/p/home/mobile'))])}</div></main>`);
      expect(compiled.calls).to.deep.equal([]);
      expect(data.audienceMobile).to.equal('/v/p/home/mobile');
      expect(document.querySelector('#control').textContent).to.equal('Control');
      expect(compiled).to.deep.equal(handWritten);
    });

    it('DA-shaped content (absolute aem.page links, <p> cells, "Audience: Mobile") matches hand-written', async () => {
      const href = 'https://main--atreyu--dallinbsmith.aem.page/v/p/home/mobile';
      const pRow = (key, value) => `<div><div><p>${key}</p></div><div><p>${value}</p></div></div>`;
      const compiled = await serve(`<main><div>${content}<div class="personalize">${[
        pRow('Name', 'Home hero'),
        pRow('Audience: Mobile', `<a href="${href}">${href}</a>`),
        pRow('Status', 'Active'),
        pRow('End Date', FUTURE),
      ].join('')}</div></div></main>`);
      const handWritten = await serve(`<main><div>${content}<div class="section-metadata">${
        pRow('Audience: Mobile', `<a href="${href}">${href}</a>`)
      }</div></div></main>`);
      expect(compiled.calls).to.deep.equal(['/v/p/home/mobile']);
      expect(compiled.selected).to.deep.equal(['mobile']);
      expect(compiled).to.deep.equal(handWritten);
    });
  });
});
