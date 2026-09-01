import { getMetadata } from '../ak.js';
import { emit } from './event-bus.js';
import { track, EVENTS } from './analytics.js';
import { sanitizeMarkup } from './sanitize.js';
import { hasConsent } from './consent.js';

const VISITOR_KEY = 'atreyu-visitor-id';

export const getVisitorId = () => {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
};

// Deterministic numeric hash — djb2-style using only arithmetic (no bitwise ops)
const hash = (str) => {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h, 33) + str.charCodeAt(i);
  }
  return Math.abs(h);
};

const getBucket = (experiment, visitorId, count) => hash(`${experiment}:${visitorId}`) % count;

// Only same-origin relative paths are allowed — authors set this via page
// metadata, but the fetch target must never be able to resolve to a
// third-party origin (e.g. "//evil.example" or "https://evil.example").
// Exported (bug-squash fix, 2026-08-28): scripts/utils/pzn.js builds URLs from
// user-controlled query params with no equivalent guard — reuse this rather
// than letting a second, possibly-inconsistent copy exist.
export const isSameOriginPath = (path) => path.startsWith('/') && !path.startsWith('//');

// Bug-squash fix, 2026-08-28: this fetch had no timeout at all. runExperiment()
// is awaited before loadArea() in scripts.js — a deliberate, pre-existing
// design choice this fix does not change (the full-page swap must land before
// anything decorates, or decorated blocks get clobbered by raw variant HTML
// with no re-decoration pass) — but that means an unbounded fetch was an
// unbounded reveal-gate: a hung network request blocked page reveal
// indefinitely. A tight timeout, matching the same AbortController pattern
// scripts/utils/pzn.js already uses for its own decision fetch, bounds the
// worst case to a small, known delay and fails open to the baseline/control
// content already in the DOM, rather than leaving this open-ended.
const VARIANT_FETCH_TIMEOUT_MS = 1500;

const fetchVariantContent = async (path) => {
  if (!isSameOriginPath(path)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VARIANT_FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(`${path}.plain.html`, { signal: controller.signal });
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null; // fail-open — control/baseline content stays
  } finally {
    clearTimeout(timer);
  }
};

const applyVariant = (html) => {
  const main = document.querySelector('main');
  if (!main) return;
  main.replaceChildren(...sanitizeMarkup(html).childNodes);
};

export const runExperiment = async () => {
  const experiment = getMetadata('experiment');
  if (!experiment) return null;

  const variantsMeta = getMetadata('experiment-variants');
  if (!variantsMeta) return null;

  const variantPaths = variantsMeta.split(',').map((p) => p.trim()).filter(Boolean);
  if (!variantPaths.length) return null;

  // Bug-squash fix, 2026-08-28: this call used to write a persistent
  // cross-session visitor id (getVisitorId(), below) and bucket/track the
  // visitor unconditionally, with no consent check anywhere in this file —
  // a real asymmetry against pzn.js's own hasConsent('personalization') gate
  // on its decision call. Unlike pzn.js's per-slot cross-fade, this mechanism
  // does a one-time full-page swap early in page load; re-running it if
  // consent is granted later in the session would cause a jarring visible
  // content swap after the visitor has already started reading the page, so
  // — deliberately, unlike pzn.js — this does not retry on a later consent
  // grant. Consent denied simply means this visitor sees the control/baseline
  // page for the rest of this load, same as any other fail-open path here.
  if (!hasConsent('personalization')) return null;

  const allVariants = ['control', ...variantPaths];
  const visitorId = getVisitorId();
  const bucket = getBucket(experiment, visitorId, allVariants.length);
  const variant = allVariants[bucket];
  const isControl = bucket === 0;

  if (!isControl) {
    try {
      const html = await fetchVariantContent(variant);
      if (html) applyVariant(html);
    } catch { /* control fallback — original content stays */ }
  }

  // Schema reconciled 2026-08-28 to match pzn.js/P0-46's convention: always
  // 'a-b-split-test' here since this mechanism has no audience/segment
  // concept, just a random weighted hash split — unlike pzn.js, where
  // variantType can also resolve to a segment name. `renderType` distinguishes
  // this full-page-swap mechanism from pzn.js's per-slot cta/fragment swaps.
  const detail = {
    anonId: visitorId,
    experiment,
    variantName: variant,
    variantType: 'a-b-split-test',
    variantId: `${experiment}:${variant}`,
    renderType: 'full-page-swap',
    bucket,
  };
  emit('experiment', detail);
  track(EVENTS.EXPERIMENT, detail);
  return { experiment, variant };
};
