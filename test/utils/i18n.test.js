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

  it("falls back to 'en', not the browser locale or <html lang>, when the entry has no lang", () => {
    // A stale <html lang> must not leak in: the locale comes from config only.
    // getLocale only writes <html lang> when the entry has a lang, so 'fr' stays.
    document.documentElement.lang = 'fr';
    // No locales -> getLocale's default `{ '': {} }`, so config.locale.lang is undefined.
    setConfig({});
    expect(document.documentElement.lang).to.equal('fr');
    const spy = sinon.spy(Intl, 'DateTimeFormat');
    expect(formatDate('2026-09-24')).to.equal('September 24, 2026');
    expect(spy.firstCall.args[0]).to.equal('en');
    document.documentElement.lang = initialLang;
  });

  it("treats an empty lang as missing, like ak.js getLocale (Intl throws on '')", () => {
    setConfig({ locales: { '': { lang: '' } } });
    expect(formatDate('2026-09-24')).to.equal('September 24, 2026');
  });

  it('keeps a YYYY-MM-DD date on the same calendar day', () => {
    useLocale('');
    expect(formatDate('2026-09-24')).to.equal('September 24, 2026');
    expect(formatDate('2024-01-01')).to.equal('January 1, 2024');
  });

  it('trims whitespace before recognising a YYYY-MM-DD date', () => {
    useLocale('');
    // UTC-11: any reading other than the pinned calendar day lands on the 23rd.
    expect(formatDate(' 2026-09-24 ', { timeZone: 'Pacific/Pago_Pago' })).to.equal('September 24, 2026');
  });

  it('pins only the full YYYY-MM-DD form; YYYY-MM is a UTC instant', () => {
    useLocale('');
    expect(formatDate('2026-09', { timeZone: 'UTC' })).to.equal('September 1, 2026');
    expect(formatDate('2026-09', { timeZone: 'America/Los_Angeles' })).to.equal('August 31, 2026');
  });

  it('does not let a caller timeZone shift a date-only value (any runner zone)', () => {
    useLocale('');
    expect(formatDate('2026-09-24', { timeZone: 'America/Los_Angeles' })).to.equal('September 24, 2026');
    expect(formatDate('2026-09-24', { timeZone: 'Pacific/Kiritimati' })).to.equal('September 24, 2026');
  });

  // Checks the rule itself, not its output, so it holds in any process TZ.
  // `format` is a spec getter returning a bound function, so sinon.spy can't
  // wrap it directly; replace the getter and record each call's Date + instance.
  // afterEach's sinon.restore() puts the real getter back.
  it('pins a date-only value to UTC midnight and formats it in UTC', () => {
    const { prototype } = Intl.DateTimeFormat;
    const realGet = Object.getOwnPropertyDescriptor(prototype, 'format').get;
    const calls = [];
    sinon.replaceGetter(prototype, 'format', {
      get() {
        const bound = realGet.call(this);
        return (date) => calls.push({ date, dtf: this }) && bound(date);
      },
    }.get);
    formatDate('2026-09-24', { timeZone: 'Asia/Tokyo' });
    expect(calls[0].date.getTime()).to.equal(Date.UTC(2026, 8, 24));
    expect(calls[0].dtf.resolvedOptions().timeZone).to.equal('UTC');
  });

  it('passes opts through to Intl.DateTimeFormat, including timeZone for instants', () => {
    useLocale('');
    const instant = Date.UTC(2026, 8, 24, 3, 0); // 03:00 UTC = 20:00 on the 23rd in LA
    expect(formatDate(instant, { timeZone: 'UTC' })).to.equal('September 24, 2026');
    expect(formatDate(instant, { timeZone: 'America/Los_Angeles' })).to.equal('September 23, 2026');
    expect(formatDate('2026-09-24', { month: 'short' })).to.equal('Sep 24, 2026');
    expect(formatDate('2026-09-24', { dateStyle: 'short' })).to.equal('9/24/26');
    expect(formatDate('2026-09-24', { day: undefined })).to.equal('September 2026');
  });

  it('drops the date defaults for timeStyle, so an instant can show only its time', () => {
    useLocale('');
    const instant = Date.UTC(2026, 8, 24, 15, 5);
    // Chrome puts U+202F (narrow no-break space) before AM/PM; \s matches it.
    expect(formatDate(instant, { timeStyle: 'short', timeZone: 'UTC' }).replace(/\s/g, ' ')).to.equal('3:05 PM');
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
