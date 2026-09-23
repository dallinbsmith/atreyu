import { expect } from '@esm-bundle/chai';
import {
  FIELDS, isSafeHref, toDateInput, readValues, toMeta, check, toTableHtml,
  normalizeChoice,
} from '../../experiments-panel/table.js';

const parse = (html) => new DOMParser().parseFromString(html, 'text/html').body;
const OPTS = { pagePath: '/features/c2c', audiences: ['mobile', 'desktop'] };

// Built at runtime so no-script-url does not flag the test's own fixture.
const SCRIPT_URL = ['javascript', 'alert(1)'].join(':');

describe('experiments panel table helpers', () => {
  it('reads the rendered block, including aliases and link cells', () => {
    const body = parse(`<main><div><div class="experiment">
      <div><div>Experiment</div><div>c2c-headline</div></div>
      <div><div>Variants</div><div><p><a href="/x/a">a</a></p><p><a href="/x/b">b</a></p></div></div>
      <div><div>Start Date</div><div>October 1, 2026</div></div>
      <div><div>Unknown Row</div><div>ignored</div></div>
    </div></div></main>`);
    expect(readValues(body)).to.deep.equal({
      'Test Name': 'c2c-headline', Variants: '/x/a\n/x/b', 'Start Date': '2026-10-01',
    });
  });

  it('reads the first Experiment table from DA editor HTML and skips other tables', () => {
    const body = parse(`<table><tr><td>Cards</td></tr><tr><td>Split</td><td>99</td></tr></table>
      <table><tr><td colspan="2">experiment</td></tr><tr><td>Split</td><td>33, 33</td></tr></table>`);
    expect(readValues(body)).to.deep.equal({ Split: '33, 33' });
    expect(readValues(parse('<table><tr><td>Split</td><td>50</td></tr></table>'))).to.equal(null);
    expect(readValues(parse('<p>nothing</p>'))).to.equal(null);
  });

  it('writes a DA block table that round-trips, with every row present', () => {
    const values = { 'Test Name': 'c2c-headline', Variants: '/x/a\nhttps://example.com/b', Split: '50', Status: 'active' };
    const html = toTableHtml(values);
    const table = parse(html).querySelector('table');
    expect(table.querySelector('td').colSpan).to.equal(2);
    expect(table.querySelectorAll('tr').length).to.equal(FIELDS.length + 1);
    expect([...table.querySelectorAll('a')].map((a) => a.getAttribute('href'))).to.deep.equal(['/x/a', 'https://example.com/b']);
    expect(readValues(parse(html))).to.deep.include(values);
  });

  it('escapes values and never links unsafe hrefs', () => {
    const html = toTableHtml({ 'Test Name': '<img src=x onerror=alert(1)>', Variants: `${SCRIPT_URL}\n//evil.example` });
    const body = parse(html);
    expect(body.querySelector('img')).to.equal(null);
    expect(body.querySelector('a')).to.equal(null);
    expect(body.textContent).to.include(SCRIPT_URL);
    expect([isSafeHref('/a'), isSafeHref('https://a.b'), isSafeHref('//a'), isSafeHref('/\\a'), isSafeHref('http://a')])
      .to.deep.equal([true, true, false, false, false]);
  });

  it('normalizes dates for date inputs', () => {
    expect(toDateInput('2026-10-01')).to.equal('2026-10-01');
    expect(toDateInput('not a date')).to.equal('');
    expect(toDateInput('')).to.equal('');
  });

  it('maps values to plugin metadata and validates like the panel', () => {
    expect(toMeta({ 'Test Name': 'T', Variants: '/a\n/b', Audience: '' }))
      .to.deep.equal({ experiment: 'T', 'experiment-variants': '/a, /b' });
    expect(check({}, OPTS)[0].message).to.equal('Test Name is required.');
    const ok = check({ 'Test Name': 'T', Variants: '/a', Split: '50', Status: 'active' }, OPTS);
    expect(ok.filter((i) => i.level === 'error')).to.deep.equal([]);
    const bad = check({ 'Test Name': 'T', Variants: '/a', 'Start Date': '2026-10-02', 'End Date': '2026-10-01', Audience: 'tablet' }, OPTS);
    expect(bad.map((i) => i.message)).to.include.members(['Start Date is not before End Date.', 'Unknown audience(s) tablet: the experiment never runs.']);
  });

  it('normalizes loaded select values and metadata round-trips status synonyms and multi-audience values', () => {
    expect(['Inactive', 'Off', 'Paused'].map((value) => normalizeChoice('Status', value).value))
      .to.deep.equal(['inactive', 'inactive', 'inactive']);
    expect(['on', 'true', 'yes'].map((value) => normalizeChoice('Status', value).value))
      .to.deep.equal(['active', 'active', 'active']);
    expect(normalizeChoice('Audience', 'Mobile, Desktop').value).to.equal('mobile, desktop');
    expect(toMeta({
      'Test Name': 'T', Variants: '/v/a', Status: 'Off', Audience: 'Mobile, Desktop',
    })).to.deep.equal({
      experiment: 'T', 'experiment-variants': '/v/a', 'experiment-audience': 'mobile, desktop', 'experiment-status': 'inactive',
    });
  });

  it('does not read block variants such as Cards (Experiment)', () => {
    const body = parse('<main><div><div class="cards experiment"><div><div>Experiment</div><div>Wrong</div></div></div></div></main>');
    expect(readValues(body)).to.equal(null);
  });
});
