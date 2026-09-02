import { hasConsent } from './consent.js';

// Fixed event-name registry — every track() call must use a value from here,
// never a raw string. A prior ad-hoc, free-text event naming pattern (the
// pre-migration Falkor site) caused a real, hard-to-diagnose bug: an event
// fired correctly but was never wired to its Google Ads destination mapping,
// because nothing enforced that a new event name was reviewed or connected
// anywhere. Frame.io's own v4 app team already solved this properly (a
// reviewed Tracking Plan in git, Segment Protocols blocking unplanned
// events) — if/when that governance is extended to this site, these names
// need to stay in sync with that Tracking Plan. See ref_event_tracking_governance
// memory for the full history.
export const EVENTS = Object.freeze({
  DOWNLOAD: 'download',
  CALENDLY_OPEN: 'calendly_open',
  CONSENT_OPEN: 'consent_open',
  OUTLOOK_COMPOSE: 'outlook_compose',
  EXPERIMENT: 'experiment',
  PERSONALIZATION_APPLIED: 'personalization_applied',
});

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
// Every ad platform auto-appends its own click ID, not just Google's gclid —
// capturing all of them symmetrically avoids the "only Google shows up in
// attribution" bias a click-ID-only-for-Google approach produces.
const CLICK_ID_KEYS = ['gclid', 'fbclid', 'msclkid', 'li_fat_id'];
const CLICK_ID_STORAGE_KEY = 'atreyu-click-ids';
const CLICK_ID_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // matches Google Ads' own attribution window

const getUtmParams = (params) => Object.fromEntries(
  UTM_KEYS.map((key) => [key, params.get(key)]).filter(([, v]) => v),
);

// Click IDs must survive to a later page/event (e.g. a click today, a
// download days later) — persisted only once analytics consent is granted,
// never written to storage before that.
const persistClickIds = (params) => {
  const found = Object.fromEntries(
    CLICK_ID_KEYS.map((key) => [key, params.get(key)]).filter(([, v]) => v),
  );
  if (!Object.keys(found).length) return;
  if (!hasConsent('analytics')) return;
  try {
    const value = JSON.stringify({ ...found, capturedAt: Date.now() });
    localStorage.setItem(CLICK_ID_STORAGE_KEY, value);
  } catch { /* quota */ }
};

const getStoredClickIds = () => {
  try {
    const raw = localStorage.getItem(CLICK_ID_STORAGE_KEY);
    if (!raw) return {};
    const { capturedAt, ...ids } = JSON.parse(raw);
    if (!capturedAt || Date.now() - capturedAt > CLICK_ID_MAX_AGE_MS) return {};
    return ids;
  } catch {
    return {};
  }
};

const params = new URLSearchParams(window.location.search);
persistClickIds(params);

const queue = [];
let provider;

const enrich = (properties) => ({
  timestamp: new Date().toISOString(),
  url: window.location.href,
  locale: document.documentElement.lang || 'en',
  ...getUtmParams(params),
  ...getStoredClickIds(),
  ...properties,
});

// Bug-squash fix, 2026-08-28: track() used to forward/queue unconditionally,
// relying only on `provider` being unset as a proxy for "not ready yet" —
// not "consent currently denied." Two real bugs followed from that: (1)
// revoking analytics consent after granting it did nothing, since the
// already-set provider closure was never re-checked on later calls; (2) an
// event queued while consent was already granted, then later flushed by
// setAnalyticsProvider, was forwarded unconditionally even if consent had
// since been revoked in the window before the provider was set. Checking
// live consent on every send (not just once at setup) closes both: nothing
// is ever queued or forwarded except in the moment analytics consent is
// actually true, and revocation takes effect on the very next call.
export const track = (event, properties = {}) => {
  if (!Object.values(EVENTS).includes(event)) {
    import('../error.js').then(({ default: log }) => log(new Error(`Unregistered analytics event: "${event}" — add it to EVENTS in analytics.js first.`)));
  }
  if (!hasConsent('analytics')) return;
  const enriched = enrich(properties);
  if (provider) provider(event, enriched);
  else queue.push([event, enriched]);
};

export const setAnalyticsProvider = (fn) => {
  provider = fn;
  while (queue.length) {
    const next = queue.shift();
    if (hasConsent('analytics')) provider(...next);
  }
};
