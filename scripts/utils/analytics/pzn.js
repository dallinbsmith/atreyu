// P0-44 personalization runtime. Real mechanism, verified end-to-end
// (headless-browser checks across cold/warm/preview paths, weighted splits,
// fail-open cases) — graduated out of a spike on 2026-08-28. The decision
// endpoint it calls is still pending/undeployed (workers/decision-endpoint/,
// blocked on Cloudflare account provisioning); wiring below is gated to
// non-production environments until that's real. See implementation-plan.md
// P0-44 and master-migration-plan.md §11.6/11.7 for the full decision record.
//
// Mechanism under test (decided, not being redesigned here):
//   - COLD visit (no segment cookie yet): default content paints immediately, never
//     blocked. The decision call fires async; if it resolves before timeout, the
//     slot cross-fades (opacity, reserved space) to the personalized variant.
//   - WARM visit (segment cookie already set): the personalized variant is applied
//     synchronously, straight from the cookie — no network wait, no fade.
//   - Fail-open: timeout/error on the decision call, the variants-sheet fetch, or
//     an individual malformed row all leave the baseline standing, never break
//     the page.
//   - Never a reveal-gate in either case (see the comment on decoratePznSlots below
//     for the specific failure mode this file is built to avoid).
//   - The decision call itself is consent-gated on `personalization` — not just an
//     analytics wrapper around it (P0-44's Intuit-asymmetry finding).
//
// Real slot-marker mechanism (verified against scripts/ak.js's decorateSection(),
// not assumed): a `pzn: <placement>` Section Metadata row becomes
// `section.dataset.pzn` on the SECTION, not on the element you actually want to
// swap. `selector` (P0-45's mapping-sheet column, added 2026-08-27) narrows that
// down to the actual swappable element within the section.
//
// 2026-08-27 update: the hardcoded PLACEMENTS stand-in is replaced with a real
// fetch/parse of the real DA-authored sheet (created at /system/personalization/
// variants.json — see DA-CONTENT-STRUCTURE.md). This introduces a nuance
// P0-44's original "no network wait on warm visits" wording didn't anticipate:
// the MAPPING is now fetched content, not in-bundle data, so a same-tab-session's
// first page still pays one same-origin JSON fetch to learn what the cookie's
// segment actually maps to. That fetch is cached in sessionStorage so every
// subsequent page in the same tab session is truly zero-network, and it is
// same-origin/post-reveal (not the gated third-party Clearbit decision call
// CLAUDE.md's "no secondary origin before LCP" rule is about) — but it is a
// real, if small, divergence from the literal original wording worth reflecting
// back into P0-44's docs, not something to paper over.

import { hasConsent, onConsentChange } from './consent.js';
import { shouldAnimate } from '../motion/motion.js';
import { getVisitorId, isSameOriginPath } from './experimentation.js';
import { sanitizeMarkup } from '../security/sanitize.js';
import { track, EVENTS } from './analytics.js';
import ENV from '../env.js';

// Bug-squash fix, 2026-08-28: was 'pzn-spike-segment', independently named
// from workers/decision-endpoint/handlers/cookie.js's 'frameio-pzn-segment' —
// two forks landed on different names for what's supposed to be one shared
// cookie. Can't share this via import (this file ships as static client JS;
// the decision endpoint is a separately-deployed Cloudflare Worker, not part
// of the same bundle) — aligned by value instead. Keep these two literals in
// sync by hand; that file cross-references this one in its own comment.
const COOKIE_NAME = 'frameio-pzn-segment';
// 24 hours, matching P0-44's actual documented cookie-lifetime decision
// (implementation-plan.md) — was 1800s (30 min) here, an inconsistency
// nobody had caught until this fix.
const COOKIE_MAX_AGE_S = 24 * 60 * 60;
const DEFAULT_TIMEOUT_MS = 1500;
const FADE_MS = 200;
const VARIANTS_CACHE_KEY = 'pzn-variants-cache-v1';
const DEFAULT_ENDPOINT = '/api/decision';
const DEFAULT_VARIANTS_ENDPOINT = '/system/personalization/variants.json';

const params = new URLSearchParams(window.location.search);

// Bug-squash fix, 2026-08-28: these overrides came straight from a query
// param into `new URL(param, origin)` with no validation — if `param` is
// itself an absolute URL, `new URL()` ignores the origin base entirely, so a
// crafted `?pznEndpoint=https://evil.example` would have been used as-is.
// `experimentation.js` already solved this (`isSameOriginPath`); reusing it
// here instead of letting a second, unvalidated copy of this trust boundary
// exist. Falls back to the safe default on an invalid override rather than
// silently using the attacker-supplied value.
const sameOriginOverride = (value, fallback) => (
  value && isSameOriginPath(value) ? value : fallback
);

// Bug-squash fix, 2026-08-28 (graduation checklist item): every override
// below except `segment` is a measurement/QA affordance (latency injection,
// forced failure, malformed-row injection, redirecting which endpoint gets
// called) — real, legitimate needs for the P0-44 manual test harness's own
// round-trip testing, but none of them belong reachable by a real visitor on
// production. `segment` is different: it's P0-45's own documented preview
// feature for authors ("`?segment=enterprise` previews it" — implementation-
// plan.md's acceptance criteria), not a debug affordance, so it stays live
// in every environment. Reuses the same ENV classifier already gating this
// module's only call site in lazy.js, rather than inventing a second one.
const DEBUG_PARAMS_ALLOWED = ENV !== 'prod';

const config = {
  endpoint: DEBUG_PARAMS_ALLOWED
    ? sameOriginOverride(params.get('pznEndpoint'), DEFAULT_ENDPOINT) : DEFAULT_ENDPOINT,
  latencyMs: DEBUG_PARAMS_ALLOWED ? params.get('pznLatency') : null,
  timeoutMs: DEBUG_PARAMS_ALLOWED ? Number(params.get('pznTimeout') ?? DEFAULT_TIMEOUT_MS) : DEFAULT_TIMEOUT_MS,
  forceFail: DEBUG_PARAMS_ALLOWED && params.has('pznFail'),
  previewSegment: params.get('segment'), // P0-45 `?segment=` preview override — a real feature, not debug-only
  variantsEndpoint: DEBUG_PARAMS_ALLOWED
    ? sameOriginOverride(params.get('pznVariantsEndpoint'), DEFAULT_VARIANTS_ENDPOINT) : DEFAULT_VARIANTS_ENDPOINT,
  variantsLatencyMs: DEBUG_PARAMS_ALLOWED ? params.get('variantsLatency') : null,
  variantsForceFail: DEBUG_PARAMS_ALLOWED && params.has('variantsFail'),
  variantsMalformed: DEBUG_PARAMS_ALLOWED && params.has('variantsMalformed'),
};

export const readCookie = (name) => document.cookie
  .split('; ')
  .find((row) => row.startsWith(`${name}=`))
  ?.split('=')[1];

const writeCookie = (name, value) => {
  // Secure conditional on protocol, matching the decision-endpoint handler's
  // own pattern (bug-squash fix, 2026-08-28 — this cookie never set Secure
  // before, an inconsistency with its server-side sibling).
  const secure = window.location.protocol === 'https:' ? '; secure' : '';
  document.cookie = `${name}=${value}; path=/; max-age=${COOKIE_MAX_AGE_S}; samesite=lax${secure}`;
};

const buildDecisionUrl = () => {
  const url = new URL(config.endpoint, window.location.origin);
  if (config.latencyMs) url.searchParams.set('latencyMs', config.latencyMs);
  if (config.forceFail) url.searchParams.set('fail', 'true');
  return url;
};

// Bug-squash fix, 2026-08-28: memoized the same way loadVariants() already
// is. decoratePznSlots fires decorateSection() per section without awaiting
// (by design — see the comment on decoratePznSlots), so a cold visit with
// 2+ personalization placements used to issue 2+ concurrent decision calls,
// each unconditionally overwriting the same cookie — the last one to resolve
// won, even if an earlier section had already rendered under a different
// segment. One in-flight request now serves every section on the page.
let decisionPromise;
const fetchDecision = () => {
  decisionPromise ??= (async () => {
    try {
      const signal = AbortSignal.timeout(config.timeoutMs);
      const res = await fetch(buildDecisionUrl(), { signal });
      if (!res.ok) return null;
      const { segment } = await res.json();
      return segment ?? null;
    } catch {
      return null; // fail-open — baseline stands (timeout or any other fetch failure)
    }
  })();
  return decisionPromise;
};

// A row is only usable if it has everything its own `type` needs — one bad
// row (a typo'd weight, an empty selector) must never take down its siblings.
const isValidRow = (row) => {
  if (!row.placement || !row.segment || !row.selector) return false;
  if (!Number.isFinite(Number(row.weight)) || Number(row.weight) <= 0) return false;
  // Bug-squash fix, 2026-08-28: `commit_until` (P0-46's peeking-problem
  // guardrail — the one protection this bridge design has, since real
  // significance testing is deferred to CJA) was authored on real sheet
  // rows but never enforced anywhere — a variant past its committed date
  // would have kept serving indefinitely with no signal. Blank means no
  // expiry (a permanent segment override, like the real enterprise row);
  // a past date now invalidates the row, same fail-open path as any other
  // malformed row (resolveTarget already treats zero valid rows as baseline).
  if (row.commit_until && new Date(row.commit_until) < new Date()) return false;
  if (row.type === 'fragment') return Boolean(row.fragment);
  return Boolean(row.label) && Boolean(row.href); // type === 'cta'
};

const buildVariantsUrl = () => {
  const url = new URL(config.variantsEndpoint, window.location.origin);
  if (config.variantsLatencyMs) url.searchParams.set('variantsLatency', config.variantsLatencyMs);
  if (config.variantsForceFail) url.searchParams.set('variantsFail', 'true');
  if (config.variantsMalformed) url.searchParams.set('variantsMalformed', 'true');
  return url;
};

// Fetched once per tab session (sessionStorage-cached) so repeat page loads in
// the same session read the mapping synchronously, same spirit as the cookie
// making the DECISION synchronous on warm visits — see file header note.
let variantsPromise;
const loadVariants = () => {
  variantsPromise ??= (async () => {
    // Bug-squash fix, 2026-08-28: the cache-read branch used to sit outside
    // this try/catch, so a corrupted or shape-incompatible cached value (a
    // manual edit, or a schema change making old cached rows incompatible)
    // threw here — an unhandled rejection from a `.forEach()` caller with no
    // catch — directly contradicting this file's own fail-open guarantee.
    // Re-filtering through `isValidRow` also means a stale cache from before
    // a column was added gets re-validated, not trusted blindly.
    try {
      const cached = sessionStorage.getItem(VARIANTS_CACHE_KEY);
      if (cached) return JSON.parse(cached).filter(isValidRow);
      const res = await fetch(buildVariantsUrl());
      if (!res.ok) return [];
      const { data } = await res.json();
      const rows = (data ?? []).filter(isValidRow);
      sessionStorage.setItem(VARIANTS_CACHE_KEY, JSON.stringify(rows));
      return rows;
    } catch {
      return []; // fail-open — no variants sheet, baseline stands everywhere
    }
  })();
  return variantsPromise;
};

// Deterministic djb2-style hash, same approach scripts/utils/analytics/experimentation.js
// uses for its own sticky bucketing (that file doesn't export its private
// `hash`/`getBucket`, so this is a same-shape reuse, not a shared import).
const hash = (str) => {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h, 33) + str.charCodeAt(i);
  }
  return Math.abs(h);
};

// Weighted, sticky pick across rows for one placement+segment: sticky because
// it's a pure function of the visitor's stable id, not because a choice is
// cached anywhere — the same visitor always lands in the same weight bucket.
const weightedPick = (rows, seedKey) => {
  if (rows.length === 1) return rows[0];
  const totalWeight = rows.reduce((sum, row) => sum + Number(row.weight), 0);
  const point = hash(`${seedKey}:${getVisitorId()}`) % totalWeight;
  let cursor = 0;
  return rows.find((row) => {
    cursor += Number(row.weight);
    return point < cursor;
  }) ?? rows.at(-1);
};

const rowsFor = (variants, placementKey, segment) => variants
  .filter((row) => row.placement === placementKey && row.segment === segment);

// Wrap the resolved target in a reserved-space box once, on first use, so the
// element the CLS measurement cares about is stable across repeated calls.
const getOrCreateSlot = (target) => {
  const existing = target.closest('.pzn-slot');
  if (existing) return existing;
  const slot = document.createElement('span');
  slot.className = 'pzn-slot';
  target.replaceWith(slot);
  slot.append(target);
  return slot;
};

const applyCta = (target, row) => {
  target.textContent = row.label;
  target.href = row.href;
  return true;
};

const applyFragment = async (target, row) => {
  try {
    const res = await fetch(`${row.fragment}.plain.html`);
    if (!res.ok) return false;
    const html = await res.text();
    target.replaceChildren(...sanitizeMarkup(html).childNodes);
    return true;
  } catch {
    return false; // fail-open — target keeps its baseline content
  }
};

const applyVariant = async (slot, target, row) => {
  const applied = row.type === 'fragment' ? await applyFragment(target, row) : applyCta(target, row);
  if (applied) {
    slot.dataset.pznApplied = row.segment;
    // P0-46 schema reconciliation: `variantType` here mirrors the current
    // production site's schema (a-b-split-test vs. a named segment rule) —
    // it is NOT this sheet's own `type` column (cta/fragment, a rendering
    // mechanism), which is reported separately as `renderType` to avoid
    // conflating the two concepts under one name.
    track(EVENTS.PERSONALIZATION_APPLIED, {
      anonId: getVisitorId(),
      placement: row.placement,
      segment: row.segment,
      variantName: row.label || row.fragment,
      variantType: row.variantType,
      variantId: `${row.placement}:${row.segment}:${row.label || row.fragment}`,
      renderType: row.type,
    });
  }
  return applied;
};

const crossFadeApply = async (slot, target, row) => {
  if (!shouldAnimate()) {
    await applyVariant(slot, target, row);
    return;
  }
  slot.classList.add('pzn-transitioning');
  await new Promise((resolve) => { setTimeout(resolve, FADE_MS); });
  await applyVariant(slot, target, row);
  slot.classList.remove('pzn-transitioning');
};

const resolveTarget = (section, variants, placementKey, segment) => {
  const rows = rowsFor(variants, placementKey, segment);
  if (!rows.length) return null;
  const row = weightedPick(rows, `${placementKey}:${segment}`);
  // Bug-squash fix: a malformed authored `selector` (unbalanced bracket, typo)
  // throws synchronously from querySelector — since decorateSection() is
  // deliberately never awaited by its caller, an uncaught throw here becomes
  // an unhandled rejection instead of the fail-open every other malformed-row
  // case in this file already gets. isValidRow only checks selector truthiness,
  // not CSS syntax, so this has to be caught here instead.
  let target;
  try {
    target = section.querySelector(row.selector);
  } catch {
    return null;
  }
  if (!target) return null;
  // A real weighted split across sibling rows is an 'a-b-split-test';
  // a single deterministic segment match is typed by its own segment name —
  // same shape as the current production site's variantType values.
  const variantType = rows.length > 1 ? 'a-b-split-test' : segment;
  return { target, row: { ...row, variantType } };
};

const decorateSection = async (section) => {
  const placementKey = section.dataset.pzn;
  const variants = await loadVariants();
  // nothing authored for this slot
  if (!variants.some((row) => row.placement === placementKey)) return;

  if (config.previewSegment) {
    const resolved = resolveTarget(section, variants, placementKey, config.previewSegment);
    if (!resolved) return;
    // preview: no cookie, no fade
    await applyVariant(getOrCreateSlot(resolved.target), resolved.target, resolved.row);
    return;
  }

  const cachedSegment = readCookie(COOKIE_NAME);
  if (cachedSegment) {
    const resolved = resolveTarget(section, variants, placementKey, cachedSegment);
    if (!resolved) return;
    // WARM: synchronous, no fade
    await applyVariant(getOrCreateSlot(resolved.target), resolved.target, resolved.row);
    return;
  }

  // COLD: default content is already live in the DOM — nothing to do yet.
  // The decision call itself must be consent-gated, not just its analytics
  // wrapper (P0-44's Intuit-asymmetry note) — check before firing.
  if (!hasConsent('personalization')) return;

  const segment = await fetchDecision();
  if (!segment) return; // fail-open on timeout/error — baseline stands
  writeCookie(COOKIE_NAME, segment);

  const resolved = resolveTarget(section, variants, placementKey, segment);
  if (!resolved) return;
  await crossFadeApply(getOrCreateSlot(resolved.target), resolved.target, resolved.row);
};

// CRITICAL: this must never be awaited by whatever decorates the section it's
// called from. ak.js's decorateSections()/loadArea() keeps a section
// `display: none` (styles.css: `div[data-status] { display: none }`, which
// out-specifies `.section { display: block }` only while `data-status` is
// present) until `Promise.all(section.blocks.map(loadBlock))` resolves and
// `data-status` is deleted. If a caller awaited decorateSection()'s cold-path
// fetch as part of that same block-loading step, personalization would
// silently become a reveal-gate — the one thing P0-44 explicitly forbids.
// Callers must fire this after the reveal, not fold it into it. Confirmed
// 2026-08-28: lazy.js is the correct call site — ak.js's loadArea() only
// imports lazy.js AFTER its for...of loop over every section has completed
// (all sections decorated and revealed, not just the first), unlike
// postlcp.js, which fires mid-loop after section 0 alone.
export const decoratePznSlots = (root = document) => {
  const sections = [...root.querySelectorAll('[data-pzn]')];
  sections.forEach((section) => { decorateSection(section); });

  // If a cold visitor grants personalization consent later in the same
  // session, retry once — otherwise anyone who accepts consent after the
  // initial (denied) check never gets personalized this session at all.
  const stopListening = onConsentChange((e) => {
    if (!e.detail.personalization) return;
    stopListening();
    if (readCookie(COOKIE_NAME)) return; // another slot already resolved a segment
    sections.forEach((section) => { decorateSection(section); });
  });
};
