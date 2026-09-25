// Locale-aware formatting for user-visible values. Dates only for now;
// formatNumber/formatCurrency and the locales.js `intl` field are deferred (L7).
import { getConfig } from '../ak.js';

// Shared with experiments/personalize.js (Personalize End Date).
export const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DEFAULTS = { year: 'numeric', month: 'long', day: 'numeric' };

// Read per call, never at module scope: a module-scope read would run before
// scripts.js's setConfig() and freeze an incomplete config (see ak.js getConfig).
// 'en', not undefined: undefined would mean the visitor's browser locale.
// `||`, like ak.js getLocale: an empty lang makes Intl throw a RangeError.
// L7 swaps this to `intl || lang` without changing formatDate's signature.
const getLang = () => getConfig().locale?.lang || 'en';

// A full `YYYY-MM-DD` string (surrounding whitespace trimmed) is a calendar
// day with no zone. `new Date('2026-09-24')` is UTC midnight, which renders as
// the 23rd west of UTC, so pin the day to UTC midnight and format it in UTC.
// A caller's `timeZone` is ignored for it. Only the full form is pinned: a
// partial `YYYY` or `YYYY-MM` goes through `new Date`, which parses it as a
// UTC instant, so like any instant it can show the previous day west of UTC.
// Date.UTC rolls 2026-13-45 over into 2027; the round-trip check keeps it
// invalid, as `new Date('2026-13-45')` is.
const toDate = (value) => {
  const [iso, y, m, d] = (typeof value === 'string' && DATE_ONLY.exec(value.trim())) || [];
  if (!iso) return { date: value instanceof Date ? value : new Date(value), zone: {} };
  const date = new Date(Date.UTC(y, m - 1, d));
  return { date: date.toISOString().startsWith(iso) ? date : new Date(NaN), zone: { timeZone: 'UTC' } };
};

// `opts` pass through to Intl.DateTimeFormat, merged over a long-date default
// ("September 24, 2026"); a key set to undefined removes that default, and
// dateStyle/timeStyle drop the default entirely (Intl can't mix them).
// Any value other than a full YYYY-MM-DD string (a Date, a timestamp, an ISO
// date-time) is an instant, formatted in the visitor's time zone unless
// opts.timeZone is set. Invalid input is returned unchanged; null, undefined
// and '' return '' (as the old hero-cards-transition fmtDate did).
export const formatDate = (value, opts = {}) => {
  if (!value) return value ?? '';
  const { date, zone } = toDate(value);
  if (Number.isNaN(date.getTime())) return value;
  const base = opts.dateStyle || opts.timeStyle ? opts : { ...DEFAULTS, ...opts };
  return new Intl.DateTimeFormat(getLang(), { ...base, ...zone }).format(date);
};
