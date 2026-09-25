import { getMetadata } from '../../ak.js';
import { track, EVENTS } from './analytics.js';
import { sanitizeMarkup } from '../security/sanitize.js';
import { hasConsent } from './consent.js';
import { getVisitorId } from './visitor-id.js';

export { getVisitorId };

// EXP-001 acceptance criteria ("preview... using only the CMS") needs a way
// to force a specific treatment without waiting on a hash bucket — same
// posture as pzn.js's own `?segment=` preview: a real authoring feature, not
// a debug-only affordance, so it isn't gated behind ENV like a QA-only param
// would be.
const params = new URLSearchParams(window.location.search);
const previewVariant = params.get('experimentPreview');

// Deterministic numeric hash — djb2-style using only arithmetic (no bitwise ops)
const hash = (str) => {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h, 33) + str.charCodeAt(i);
  }
  return Math.abs(h);
};

const HASH_PRECISION = 1_000_000;
const pointFor = (experiment, visitorId) => (hash(`${experiment}:${visitorId}`) % HASH_PRECISION) / HASH_PRECISION;

// Closes a real gap the OOTB `adobe/aem-experimentation` plugin has and this
// file didn't (see ref_uc01_aem_experimentation_plugin memory): uneven
// per-variant traffic splits. `splitMeta` holds comma-separated percentages
// for the CHALLENGER variants only, same order as `experiment-variants`;
// control gets whatever's left. Falls back to an even split across all
// variants when absent or malformed — same fail-open posture as every other
// malformed-input path in this file.
const parseWeights = (splitMeta, variantCount) => {
  if (!splitMeta) return null;
  const percentages = splitMeta.split(',').map((p) => Number.parseFloat(p.trim()));
  const valid = percentages.length === variantCount
    && percentages.every((p) => Number.isFinite(p) && p >= 0);
  if (!valid) return null;
  const challengerTotal = percentages.reduce((sum, p) => sum + p, 0);
  if (challengerTotal >= 100) return null;
  return [(100 - challengerTotal) / 100, ...percentages.map((p) => p / 100)];
};

const pickWeightedIndex = (weights, point) => {
  let cumulative = 0;
  const idx = weights.findIndex((weight) => {
    cumulative += weight;
    return point < cumulative;
  });
  return idx === -1 ? weights.length - 1 : idx; // floating-point safety net
};

// Only same-origin relative paths are allowed — authors set this via page
// metadata, but the fetch target must never be able to resolve to a
// third-party origin (e.g. "//evil.example" or "https://evil.example").
// Exported (bug-squash fix, 2026-08-28): scripts/utils/analytics/pzn.js builds URLs from
// user-controlled query params with no equivalent guard — reuse this rather
// than letting a second, possibly-inconsistent copy exist.
export const isSameOriginPath = (path) => path.startsWith('/') && !path.startsWith('//');

// Bug-squash fix, 2026-08-28: this fetch had no timeout at all. runExperiment()
// must run before loadArea() — a deliberate, pre-existing design choice this
// fix does not change (the full-page swap must land before anything
// decorates, or decorated blocks get clobbered by raw variant HTML with no
// re-decoration pass) — but that means an unbounded fetch was an
// unbounded reveal-gate: a hung network request blocked page reveal
// indefinitely. A tight timeout, matching the same AbortSignal.timeout()
// pattern scripts/utils/analytics/pzn.js already uses for its own decision fetch,
// bounds the worst case to a small, known delay and fails open to the
// baseline/control content already in the DOM, rather than leaving this
// open-ended.
const VARIANT_FETCH_TIMEOUT_MS = 1500;

const fetchVariantContent = async (path) => {
  if (!isSameOriginPath(path)) return null;
  try {
    const resp = await fetch(`${path}.plain.html`, { signal: AbortSignal.timeout(VARIANT_FETCH_TIMEOUT_MS) });
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null; // fail-open — control/baseline content stays (timeout or any other fetch failure)
  }
};

const applyVariant = (html, target) => {
  target.replaceChildren(...sanitizeMarkup(html).childNodes);
};

const isPreviewing = (allVariants) => Boolean(previewVariant)
  && allVariants.includes(previewVariant);

// Preview forces a specific index directly; otherwise a visitor's sticky
// hash point picks one via the (possibly uneven) weights. Extracted purely to
// keep runExperiment()'s own branching within this project's cognitive-
// complexity budget — see linting.md's "prefer extracting named helpers"
// guidance — not because this logic is reused elsewhere.
const resolveVariantIndex = (allVariants, experiment, visitorId, weights) => {
  const previewIndex = previewVariant ? allVariants.indexOf(previewVariant) : -1;
  if (previewIndex >= 0) return previewIndex;
  return pickWeightedIndex(weights, pointFor(experiment, visitorId));
};

// Same extraction rationale as resolveVariantIndex above. Always swaps
// <main> with raw variant HTML; the caller must run loadArea() afterwards.
const applyChallenger = async (isControl, variant, target) => {
  if (isControl) return;
  try {
    const html = await fetchVariantContent(variant);
    if (html) applyVariant(html, target);
  } catch { /* fail-open — control/baseline content stays */ }
};

// Main-scoped (UC-01) full-page swap only, meant to run before loadArea()
// decorates anything. Dormant: no runtime code calls it. The late
// chrome-scoped phase (UC-02, `experiment-selector`) was removed with the
// redecorator registry (foundation hardening A2 = iii). A page that still
// carries `experiment-selector` no-ops rather than swapping <main> with
// content authored for a nav or footer.
export const runExperiment = async () => {
  const experiment = getMetadata('experiment');
  if (!experiment) return null;

  const variantsMeta = getMetadata('experiment-variants');
  if (!variantsMeta) return null;

  const variantPaths = variantsMeta.split(',').map((p) => p.trim()).filter(Boolean);
  if (!variantPaths.length) return null;

  if (getMetadata('experiment-selector')) return null;

  const target = document.querySelector('main');
  // Fail-open for the swap itself, but also skip tracking (not just skip the
  // swap and still report an exposure): without a target we can't confirm
  // this visitor's page actually rendered what the experiment is about —
  // counting an unconfirmed render as a real exposure would corrupt the
  // denominator the D18 stats layer's significance math depends on.
  if (!target) return null;

  const allVariants = ['control', ...variantPaths];
  const isPreview = isPreviewing(allVariants);

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
  //
  // Preview is an author explicitly forcing a treatment via a typed query
  // param on their own browsing session, not a real visitor being bucketed —
  // it bypasses the consent gate the same way pzn.js's own `?segment=`
  // preview does.
  if (!isPreview && !hasConsent('personalization')) return null;

  const visitorId = getVisitorId();
  const weights = parseWeights(getMetadata('experiment-split'), variantPaths.length)
    ?? allVariants.map(() => 1 / allVariants.length);
  const bucket = resolveVariantIndex(allVariants, experiment, visitorId, weights);
  const variant = allVariants[bucket];
  const isControl = bucket === 0;

  await applyChallenger(isControl, variant, target);

  // Schema reconciled 2026-08-28 to match pzn.js/P0-46's convention: always
  // 'a-b-split-test' here since this mechanism has no audience/segment
  // concept, just a random weighted hash split (uneven per-variant weights
  // are supported via `experiment-split` metadata, but the shape is still a
  // split test, not a segment match) — unlike pzn.js, where variantType can
  // also resolve to a segment name. `renderType` distinguishes this UC-01
  // full-page swap from pzn.js's per-slot cta/fragment swaps. Preview runs
  // are never tracked — an author repeatedly forcing a treatment would
  // otherwise inflate that variant's sample size against the D18 stats
  // layer's significance math with visits that were never really bucketed.
  if (!isPreview) {
    track(EVENTS.EXPERIMENT, {
      anonId: visitorId,
      experiment,
      variantName: variant,
      variantType: 'a-b-split-test',
      variantId: `${experiment}:${variant}`,
      renderType: 'full-page-swap',
      bucket,
    });
  }
  return { experiment, variant };
};
