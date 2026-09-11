// Dev-only schedule simulation state, shared by blocks/schedule/schedule.js
// (reader) and scripts/scheduler/scheduler.js (writer + UI). Two storage
// locations, one authoritative priority:
//   - URL `?schedule=<seconds>`: for share-via-link and fresh-session entry.
//   - localStorage `aem-schedule`: for stickiness across in-site navigation
//     (internal `<a href>` clicks drop query strings, so URL alone loses
//     the sim on every link click).
// URL always wins on conflict. The scheduler UI keeps both in sync.

import ENV from './env.js';

const STORAGE_KEY = 'aem-schedule';
const URL_KEY = 'schedule';

// Current sim time in ms since epoch — URL param wins, then localStorage.
// Returns null in prod or when nothing valid is set.
export const getScheduleSim = () => {
  if (ENV === 'prod') return null;
  const raw = new URL(window.location.href).searchParams.get(URL_KEY)
    || localStorage.getItem(STORAGE_KEY);
  const ms = Number(raw) * 1000;
  return Number.isFinite(ms) && ms > 0 ? ms : null;
};

// Sets the sim (seconds since epoch) in both URL and localStorage, then
// reloads. Pass null to clear both.
export const setScheduleSim = (secondsOrNull) => {
  if (ENV === 'prod') return;
  const url = new URL(window.location.href);
  if (secondsOrNull == null) {
    url.searchParams.delete(URL_KEY);
    localStorage.removeItem(STORAGE_KEY);
  } else {
    url.searchParams.set(URL_KEY, secondsOrNull);
    localStorage.setItem(STORAGE_KEY, secondsOrNull);
  }
  window.location = url.href;
};

// Boot-time entry handler for the scheduler UI. Normalizes URL-only
// shortcuts and mirrors them to localStorage:
//   ?schedule=reset  → clear localStorage
//   ?schedule=now    → seed localStorage with current timestamp
//   ?schedule=<int>  → seed localStorage with that timestamp
// Returns the resulting active sim value (seconds as string) or null.
export const consumeUrlSim = () => {
  if (ENV === 'prod') return null;
  const raw = new URL(window.location.href).searchParams.get(URL_KEY);
  if (raw === 'reset') {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
  const value = raw === 'now' ? String(Math.floor(Date.now() / 1000)) : raw;
  if (value) localStorage.setItem(STORAGE_KEY, value);
  return value || localStorage.getItem(STORAGE_KEY);
};
