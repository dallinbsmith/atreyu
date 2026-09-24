import { expect } from '@esm-bundle/chai';
import {
  check, multiSectionWarnings, normalizeAudience, readValues, toTableHtml,
} from '../../experiments-panel/personalize-table.js';
import { applyPersonalizeTables } from '../../scripts/utils/experiments/personalize.js';

const parse = (html) => new DOMParser().parseFromString(html, 'text/html').body;
const now = new Date(2026, 0, 15, 12);
const SCRIPT_URL = ['javascript', 'alert(1)'].join(':');

const daTableToBlock = (html) => {
  const table = parse(html).querySelector('table');
  const block = document.createElement('div');
  block.className = table.querySelector('td').textContent.trim().toLowerCase();
  for (const row of [...table.querySelectorAll('tr')].slice(1)) {
    const blockRow = document.createElement('div');
    for (const tableCell of row.children) {
      const cell = document.createElement('div');
      cell.append(...[...tableCell.childNodes].map((child) => child.cloneNode(true)));
      blockRow.append(cell);
    }
    block.append(blockRow);
  }
  return block.outerHTML;
};

const tablePlan = (values, options = {}) => {
  const doc = new DOMParser().parseFromString(
    `<main><div><p>Control</p>${daTableToBlock(toTableHtml(values))}</div></main>`,
    'text/html',
  );
  return applyPersonalizeTables(doc, { prod: true, now, search: '', ...options });
};

describe('experiments-panel/personalize-table.js', () => {
  it('reads rendered and DA Personalize tables', () => {
    const block = parse(`<main><div><div class="personalize">
      <div><div>Name</div><div>Hero Match</div></div>
      <div><div>Audience: mobile</div><div><a href="/v/mobile-hero">Mobile</a></div></div>
      <div><div>Status</div><div></div></div>
      <div><div>End Date</div><div>2026-03-01</div></div>
      <div><div>Owner</div><div>CRO</div></div>
    </div></div></main>`);
    expect(readValues(block)).to.deep.equal({
      Name: 'Hero Match',
      Status: 'active',
      'End Date': '2026-03-01',
      Owner: 'CRO',
      rules: [{ audience: 'mobile', path: '/v/mobile-hero' }],
    });
    const table = toTableHtml({ Name: 'Hero Match', 'End Date': '2026-03-01', rules: [{ audience: 'desktop', path: '/v/desktop' }] });
    expect(readValues(parse(table)).rules).to.deep.equal([{ audience: 'desktop', path: '/v/desktop' }]);
  });

  it('writes safe DA tables without linking unsafe paths', () => {
    const html = toTableHtml({
      Name: '<img src=x onerror=alert(1)>',
      'End Date': '2026-03-01',
      rules: [{ audience: 'mobile', path: '/v/mobile' }, { audience: 'desktop', path: SCRIPT_URL }],
    });
    const body = parse(html);
    expect(Boolean(body.querySelector('img'))).to.equal(false);
    expect([...body.querySelectorAll('a')].map((a) => a.getAttribute('href'))).to.deep.equal(['/v/mobile']);
    expect(body.textContent).to.include(SCRIPT_URL);
  });

  it('writes tables that compile to plugin audience metadata', () => {
    const values = {
      Name: 'Homepage Personalization',
      Status: '',
      'End Date': '2026-03-01',
      Owner: 'CRO',
      rules: [
        { audience: 'desktop', path: '/v/desktop-hero' },
        { audience: 'mobile', path: '/v/mobile-hero' },
        { audience: 'Campaign Spring Launch', path: '/v/spring-hero' },
      ],
    };
    const doc = new DOMParser().parseFromString(`<main><div><p>Control</p>${daTableToBlock(toTableHtml(values))}</div></main>`, 'text/html');
    const plan = applyPersonalizeTables(doc, { prod: true, now, search: '' });
    const rows = [...doc.querySelectorAll('.section-metadata > div')].map((row) => [
      row.children[0].textContent,
      row.children[1].querySelector('a')?.getAttribute('href'),
    ]);
    expect(plan.map(({ name, owner, rules }) => ({ name, owner, rules }))).to.deep.equal([{
      name: 'Homepage Personalization',
      owner: 'CRO',
      rules: [
        { id: 'mobile', path: '/v/mobile-hero' },
        { id: 'desktop', path: '/v/desktop-hero' },
        { id: 'campaign-spring-launch', path: '/v/spring-hero' },
      ],
    }]);
    expect(rows).to.deep.equal([
      ['Audience: mobile', '/v/mobile-hero'],
      ['Audience: desktop', '/v/desktop-hero'],
      ['Audience: campaign-spring-launch', '/v/spring-hero'],
    ]);
    expect(Boolean(doc.querySelector('.personalize'))).to.equal(false);
  });

  it('normalizes loaded status values to the compiler active set', () => {
    const active = tablePlan({ Status: '', 'End Date': '2026-03-01', rules: [{ audience: 'mobile', path: '/v/a' }] });
    expect(active[0].rules).to.deep.equal([{ id: 'mobile', path: '/v/a' }]);
    for (const Status of ['Inactive', 'Off', 'paused']) {
      const inactive = tablePlan({ Status, 'End Date': '2026-03-01', rules: [{ audience: 'mobile', path: '/v/a' }] });
      expect(inactive).to.deep.equal([]);
      expect(readValues(parse(toTableHtml({ Status, 'End Date': '2026-03-01', rules: [{ audience: 'mobile', path: '/v/a' }] }))).Status)
        .to.equal('inactive');
    }
  });

  it('writes End Date as YYYY-MM-DD and rejects other date formats', () => {
    const html = toTableHtml({
      'End Date': 'March 1, 2026',
      rules: [{ audience: 'mobile', path: '/v/mobile' }],
    });
    expect(readValues(parse(html))['End Date']).to.equal('2026-03-01');
    expect(check({
      'End Date': 'March 1, 2026',
      rules: [{ audience: 'mobile', path: '/v/mobile' }],
    }, { now })[0].message).to.equal('End Date must use YYYY-MM-DD.');
  });

  it('validates audience, path, rule count, and end date limits', () => {
    expect(normalizeAudience('Campaign Spring 2026')).to.equal('campaign-spring-2026');
    const tooMany = Array.from({ length: 4 }, (_, i) => ({ audience: 'mobile', path: `/v/${i}` }));
    const messages = check({
      'End Date': '2026-08-01',
      rules: [{ audience: 'tablet', path: '/bad' }, ...tooMany],
    }, { now }).map(({ message }) => message);
    expect(messages).to.include.members([
      'Unknown audience "tablet".',
      'Variant path must be under /v/: /bad',
      'Only the first 3 audience rules are kept.',
      'End Date must be within 180 days.',
    ]);
    const stricter = check({
      'End Date': '2026-03-01',
      rules: [{ audience: 'mobile', path: '/v/a' }, { audience: 'mobile', path: '/v/../secret' }],
    }, { now }).map(({ message }) => message);
    expect(stricter).to.include.members([
      'Duplicate audience "mobile".',
      'Variant path must be under /v/: /v/../secret',
    ]);
    expect(check({ 'End Date': '2026-01-14', rules: [{ audience: 'mobile', path: '/v/a' }] }, { now })[0].message)
      .to.equal('End Date is in the past.');
    expect(check({ 'End Date': '2026-02-30', rules: [{ audience: 'mobile', path: '/v/a' }] }, { now })[0].message)
      .to.equal('End Date is not a valid date.');
    expect(check({ rules: [{ audience: 'mobile', path: '/v/a' }] }, { now })[0].message)
      .to.equal('End Date is required.');
  });

  it('matches the compiler date boundary across the autumn clock change', () => {
    const boundaryNow = new Date(2026, 8, 1, 12);
    expect(check({ 'End Date': '2027-02-28', rules: [{ audience: 'mobile', path: '/v/a' }] }, { now: boundaryNow }))
      .to.deep.equal([]);
    expect(check({ 'End Date': '2027-03-01', rules: [{ audience: 'mobile', path: '/v/a' }] }, { now: boundaryNow })[0].message)
      .to.equal('End Date must be within 180 days.');
  });

  it('warns when a variant page contains multiple sections', async () => {
    const warnings = await multiSectionWarnings(
      { rules: [{ audience: 'mobile', path: '/v/mobile' }] },
      async () => '<main><div>one</div><div>two</div></main>',
    );
    expect(warnings[0].message).to.contain('/v/mobile has more than one section');
  });
});
