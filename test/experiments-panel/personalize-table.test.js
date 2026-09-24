import { expect } from '@esm-bundle/chai';
import {
  check, multiSectionWarnings, normalizeAudience, readValues, toTableHtml,
} from '../../experiments-panel/personalize-table.js';

const parse = (html) => new DOMParser().parseFromString(html, 'text/html').body;
const now = new Date(2026, 0, 15, 12);
const SCRIPT_URL = ['javascript', 'alert(1)'].join(':');

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
      Status: '',
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

  it('validates audience, path, rule count, and end date limits', () => {
    expect(normalizeAudience('Campaign Spring 2026')).to.equal('campaign-spring-2026');
    const tooMany = Array.from({ length: 4 }, (_, i) => ({ audience: 'mobile', path: `/v/${i}` }));
    const messages = check({
      'End Date': '2026-08-01',
      rules: [{ audience: 'tablet', path: '/bad' }, ...tooMany],
    }, { now }).map(({ message }) => message);
    expect(messages).to.include.members([
      'Unknown audience "(blank)".',
      'Variant path must be under /v/: /bad',
      'Use no more than 3 audience rules.',
      'End Date must be within 180 days.',
    ]);
    expect(check({ 'End Date': '2026-01-14', rules: [{ audience: 'mobile', path: '/v/a' }] }, { now })[0].message)
      .to.equal('End Date is in the past.');
    expect(check({ rules: [{ audience: 'mobile', path: '/v/a' }] }, { now })[0].message)
      .to.equal('End Date is required.');
  });

  it('warns when a variant page contains multiple sections', async () => {
    const warnings = await multiSectionWarnings(
      { rules: [{ audience: 'mobile', path: '/v/mobile' }] },
      async () => '<main><div>one</div><div>two</div></main>',
    );
    expect(warnings[0].message).to.contain('/v/mobile has more than one section');
  });
});
