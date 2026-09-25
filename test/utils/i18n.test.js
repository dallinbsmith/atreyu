import { expect } from '@esm-bundle/chai';
import sinon from 'sinon';
import { setConfig } from '../../scripts/ak.js';
import locales from '../../scripts/locales.js';
import { formatDate } from '../../scripts/utils/i18n.js';

// CI re-runs this file with TZ=America/Los_Angeles (the date-only cases only
// bite west of UTC); logged first so the job log shows which zone was used.
console.log(`i18n tests time zone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);

const initialLang = document.documentElement.lang;

// getLocale() prefers <meta name="locale"> over the path, so this selects a real
// locales.js entry without navigating. setConfig also writes <html lang>.
const useLocale = (prefix, conf = { locales }) => {
  const meta = document.createElement('meta');
  meta.name = 'locale';
  meta.content = prefix;
  document.head.append(meta);
  setConfig(conf);
  meta.remove();
};

describe('utils/i18n formatDate', () => {
  afterEach(() => {
    sinon.restore();
    document.documentElement.lang = initialLang;
    useLocale('');
  });

  it('formats in the page locale from locales.js (en, de-de, ja-jp)', () => {
    const d = new Date(2026, 8, 24, 12);
    useLocale('');
    expect(formatDate(d)).to.equal('September 24, 2026');
    useLocale('/de-de');
    expect(formatDate(d)).to.equal('24. September 2026');
    useLocale('/ja-jp');
    expect(formatDate(d)).to.equal('2026年9月24日');
  });

  it('reads the locale per call, not once at import', () => {
    useLocale('/de-de');
    expect(formatDate('2026-09-24')).to.equal('24. September 2026');
    useLocale('');
    expect(formatDate('2026-09-24')).to.equal('September 24, 2026');
  });

  it("falls back to 'en', not the browser locale, when the entry has no lang", () => {
    // No locales -> getLocale's default `{ '': {} }`, so config.locale.lang is undefined.
    setConfig({});
    const spy = sinon.spy(Intl, 'DateTimeFormat');
    formatDate('2026-09-24');
    expect(spy.firstCall.args[0]).to.equal('en');
  });

  it('keeps a YYYY-MM-DD date on the same calendar day', () => {
    useLocale('');
    expect(formatDate('2026-09-24')).to.equal('September 24, 2026');
    expect(formatDate('2024-01-01')).to.equal('January 1, 2024');
  });

  it('does not let a caller timeZone shift a date-only value (any runner zone)', () => {
    useLocale('');
    expect(formatDate('2026-09-24', { timeZone: 'America/Los_Angeles' })).to.equal('September 24, 2026');
    expect(formatDate('2026-09-24', { timeZone: 'Pacific/Kiritimati' })).to.equal('September 24, 2026');
  });

  it('passes opts through to Intl.DateTimeFormat, including timeZone for instants', () => {
    useLocale('');
    const instant = Date.UTC(2026, 8, 24, 3, 0); // 03:00 UTC = 20:00 on the 23rd in LA
    expect(formatDate(instant, { timeZone: 'UTC' })).to.equal('September 24, 2026');
    expect(formatDate(instant, { timeZone: 'America/Los_Angeles' })).to.equal('September 23, 2026');
    expect(formatDate('2026-09-24', { month: 'short' })).to.equal('Sep 24, 2026');
    expect(formatDate('2026-09-24', { dateStyle: 'short' })).to.equal('9/24/26');
  });

  it('returns invalid or empty input unchanged, like the old fmtDate', () => {
    useLocale('');
    expect(formatDate('not a date')).to.equal('not a date');
    expect(formatDate('2026-13-45')).to.equal('2026-13-45');
    expect(formatDate('')).to.equal('');
    expect(formatDate(undefined)).to.equal('');
    expect(formatDate(null)).to.equal('');
  });
});
