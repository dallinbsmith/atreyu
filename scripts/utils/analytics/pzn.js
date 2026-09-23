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
//   - WARM visit (segment cookie already set): no network wait either way — that
//     part of "synchronous, no fade" stands. CORRECTED 2026-09-22: it is NOT a
//     zero-transition swap, and was never actually safe as one — nothing hid the
//     resize when a variant's size differs from baseline. Warm visits now go
//     through the same brief hide→measure→swap→reveal cycle as cold (see
//     crossFadeApply), just with no decision call to wait on. Near-instant under
//     `prefers-reduced-motion` (transition duration zeroed in CSS), never a
//     network-wait-shaped delay either way.
//   - Fail-open: timeout/error on the decision call, the variants-sheet fetch, an
//     individual malformed row, or a failed fragment fetch all leave the baseline
//     standing, never break the page.
//   - Never a reveal-gate in any case (see the comment on decoratePznSlots below
//     for the specific failure mode this file is built to avoid) — the brief
//     hide-while-swapping above is a POST-render micro-transition on already-
//     painted content, categorically different from blocking the initial render.
//   - The decision call itself is consent-gated on `personalization` — not just an
//     analytics wrapper around it (P0-44's Intuit-asymmetry finding).
//   - Reserved space is measured, not guessed (2026-09-22 CLS fix — see
//     reserveSpace below): a real probe node, not a fixed CSS number eyeballed
//     against one label at one moment in time.
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
  // 2026-09-22 CLS-fix measurement affordance: reproduces the pre-fix
  // behavior (swap with no space reservation at all) on demand, so the fix
  // can be verified by comparing real CLS with and without this flag on the
  // exact same code, instead of checking out a prior revision.
  skipReserve: DEBUG_PARAMS_ALLOWED && params.has('pznSkipReserve'),
  previewSegment: params.get('segment'), // P0-45 `?segment=` preview override — a real feature, not debug-only
  variantsEndpoint: DEBUG_PARAMS_ALLOWED
    ? sameOriginOverride(params.get('pznVariantsEndpoint'), DEFAULT_VARIANTS_ENDPOINT) : DEFAULT_VARIANTS_ENDPOINT,
  variantsLatencyMs: DEBUG_PARAMS_ALLOWED ? params.get('variantsLatency') : null,
  variantsForceFail: DEBUG_PARAMS_ALLOWED && params.has('variantsFail'),
  variantsMalformed: DEBUG_PARAMS_ALLOWED && params.has('variantsMalformed'),
};

// Message-match (client-side targeting axis — ADR-004/ADR-005, CRO first
// slice). Derives an effective segment from the inbound campaign in the
// visitor's own URL: no network round-trip, no vendor. Ships against the
// existing flat placement/segment sheet via a namespaced `campaign:<value>`
// segment token (cro-first-slice-spec.md B2), so it never collides with
// firmographic segment values and needs no `conditions` column and no audit
// change.
const MSGMATCH_CACHE_KEY = 'pzn-msgmatch-segment-v1';

// Lowercase, collapse anything outside [a-z0-9-] to a single dash, trim dashes,
// cap length. The token is only ever string-compared against authored segment
// cells and used as an analytics value and cache payload, never injected into
// the DOM, but normalizing keeps matching predictable and the cache key safe.
const normalizeToken = (raw) => {
  const value = (raw ?? '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
  return value || null;
};

// A live `utm_campaign` on the current page wins and (re)seeds the session; an
// internal navigation that drops the param reuses the stored token so the axis
// survives the rest of the session. The caller gates this on consent, so the
// sessionStorage write never happens pre-consent (cro-first-slice-spec.md B6).
const storeCampaign = (value) => {
  try {
    sessionStorage.setItem(MSGMATCH_CACHE_KEY, value);
  } catch {
    // storage blocked/full — non-fatal, the token still applies on this page
  }
};

const readStoredCampaign = () => {
  try {
    return sessionStorage.getItem(MSGMATCH_CACHE_KEY);
  } catch {
    return null;
  }
};

const messageMatchSegment = () => {
  const live = normalizeToken(params.get('utm_campaign'));
  if (live) {
    storeCampaign(live);
    return `campaign:${live}`;
  }
  const stored = readStoredCampaign();
  return stored ? `campaign:${stored}` : null;
};

// Which targeting axis produced a segment, for clean measurement splits in the
// Segment -> Redshift -> Looker pipeline without parsing the segment string
// downstream. Null for the pre-segment fallbacks (no variant authored, consent
// denied) that never resolve one.
const axisOf = (segment) => {
  if (!segment) return null;
  return segment.startsWith('campaign:') ? 'message-match' : 'firmographic';
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
// Exported so the dev-mode-only pzn-audit.js can reuse this exact memoized,
// isValidRow-filtered promise and issue zero extra network fetch (the audit
// and decoratePznSlots share one in-flight load per tab session).
export const loadVariants = () => {
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
};

const applyFragment = (target, nodes) => {
  target.replaceChildren(...nodes);
};

const fetchFragmentNodes = async (row) => {
  try {
    const res = await fetch(`${row.fragment}.plain.html`);
    if (!res.ok) return null;
    const html = await res.text();
    return [...sanitizeMarkup(html).childNodes];
  } catch {
    return null; // fail-open — target keeps its baseline content
  }
};

// CLS fix, 2026-09-22: the reserved-space strategy this file's cross-fade
// relied on was never actually shipped (zero CSS for `.pzn-slot` in
// styles.css/lazy-styles.css) and the one number that existed anywhere
// (test/manual/personalization/test-hero.css's `min-width: 23rem`) was
// eyeballed against one label at one moment in time, not measured — a real
// gap surfaced by adversarial review, not a style nit. This replaces the
// guess with a real measurement, taken via a briefly-appended, invisible
// probe node, at the one moment it's safe to resize without it being seen:
// while the slot is already hidden (`pzn-transitioning`, opacity 0) mid
// cross-fade — see crossFadeApply below, which now runs this for every
// path (cold, warm, preview), not just cold. `visibility: hidden` +
// `position: absolute` means the probe produces no paint and is therefore
// invisible to the Layout Instability API — this measures real rendered
// size, not a guess, and never itself contributes a shift.
const reserveSpace = (slot, target, row, preparedNodes) => {
  const isFragment = row.type === 'fragment';
  slot.style.display = isFragment ? 'block' : 'inline-flex';
  const probe = isFragment ? document.createElement('div') : target.cloneNode(true);
  Object.assign(probe.style, isFragment
    ? { visibility: 'hidden', position: 'absolute', width: `${slot.getBoundingClientRect().width}px` }
    : { visibility: 'hidden', position: 'absolute', whiteSpace: 'nowrap' });
  if (isFragment) probe.append(...preparedNodes.map((node) => node.cloneNode(true)));
  else probe.textContent = row.label;
  document.body.append(probe);
  const slotRect = slot.getBoundingClientRect();
  const before = isFragment ? slotRect.height : slotRect.width;
  const after = isFragment ? probe.scrollHeight : probe.getBoundingClientRect().width;
  probe.remove();
  slot.style[isFragment ? 'minHeight' : 'minWidth'] = `${Math.max(before, after)}px`;
};

const applyVariant = (slot, target, row, preparedNodes) => {
  if (row.type === 'fragment') applyFragment(target, preparedNodes);
  else applyCta(target, row);
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
    decisionAxis: axisOf(row.segment),
    variantName: row.label || row.fragment,
    variantType: row.variantType,
    variantId: `${row.placement}:${row.segment}:${row.label || row.fragment}`,
    renderType: row.type,
  });
};

// EXP-014's other half — segment is null for the two earliest-possible
// fallbacks (no variants authored at all, consent denied) since neither
// reaches the point where a segment is known. Tracked on the preview path
// too, for symmetry with applyVariant()'s own existing (pre-this-fix)
// behavior of tracking a successful preview apply — this fix doesn't
// introduce a new preview-vs-real asymmetry, just closes the fallback half.
const trackFallback = (placement, segment, reason) => {
  track(EVENTS.PERSONALIZATION_FALLBACK, {
    anonId: getVisitorId(),
    placement,
    segment,
    decisionAxis: axisOf(segment),
    reason,
  });
};

// Unified for every path (cold, warm, preview) — not just cold. "WARM:
// synchronous, no fade" in this file's header comment was true for the
// network-wait half of the original design (no decision-endpoint round trip
// on warm visits, still true), but was never actually safe against a
// visible layout shift when the variant's content differs in size from the
// baseline — nothing hid the resize. This still adds no network wait on any
// path; it adds one hide→measure→swap→reveal cycle (near-instant under
// `prefers-reduced-motion`, since the CSS transition duration is zeroed
// there — see lazy-styles.css), which is what actually makes the "reserved
// space" claim true rather than assumed.
//
// Real gap found and closed the same day, empirically, not by inspection:
// under `prefers-reduced-motion` (or low-`hardwareConcurrency`/save-data —
// see shouldAnimate()), skipping the FADE_MS wait entirely means there is no
// `await` between adding `pzn-transitioning` and resizing/swapping — the
// whole hide→resize→reveal sequence runs in one synchronous burst with zero
// yield to the browser's paint cycle. A synchronous class toggle never gets
// painted as its own frame; the "hidden" state exists only as a JS-visible
// intermediate, never a real one, so the resize would still be visible.
// `requestAnimationFrame` forces one real paint (the box, already hidden)
// before resizing, at effectively zero added delay for this population.
const crossFadeApply = async (slot, target, row) => {
  const preparedNodes = row.type === 'fragment' ? await fetchFragmentNodes(row) : null;
  if (row.type === 'fragment' && !preparedNodes) return false; // fail-open — fragment fetch failed, baseline stands

  slot.classList.add('pzn-transitioning');
  await (shouldAnimate()
    ? new Promise((resolve) => { setTimeout(resolve, FADE_MS); })
    : new Promise((resolve) => { requestAnimationFrame(resolve); }));
  if (!config.skipReserve) reserveSpace(slot, target, row, preparedNodes);
  applyVariant(slot, target, row, preparedNodes);
  slot.classList.remove('pzn-transitioning');
  return true;
};

// EXP-014 ("default and fallback") acceptance criteria: "the approved default
// renders in every failure scenario and the fallback reason is logged." The
// render half was already correct everywhere in this file; returning a
// `reason` alongside a missing `target` (instead of a bare `null`) is what
// lets decorateSection() log WHY, not just that nothing was applied — see
// trackFallback() below.
const resolveTarget = (section, variants, placementKey, segment) => {
  const rows = rowsFor(variants, placementKey, segment);
  if (!rows.length) return { reason: 'no_variant_for_segment' };
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
    return { reason: 'invalid_selector' };
  }
  if (!target) return { reason: 'selector_not_found' };
  // A real weighted split across sibling rows is an 'a-b-split-test';
  // a single deterministic segment match is typed by its own segment name —
  // same shape as the current production site's variantType values.
  const variantType = rows.length > 1 ? 'a-b-split-test' : segment;
  return { target, row: { ...row, variantType } };
};

// Shared by all three paths below: resolve, apply (always via crossFadeApply
// now — see its own comment for why warm/preview need this too, not just
// cold), and track whichever fallback reason applies. `fragment_fetch_failed`
// is new: previously a failed fragment fetch made applyVariant's caller
// silently drop the failure with no tracked reason at all (its return value
// was discarded) — a real EXP-014 gap this same refactor closes, not a
// separate change.
const applyResolved = async (placementKey, resolved, segment) => {
  if (!resolved.target) {
    trackFallback(placementKey, segment, resolved.reason);
    return;
  }
  const slot = getOrCreateSlot(resolved.target);
  const applied = await crossFadeApply(slot, resolved.target, resolved.row);
  if (!applied) trackFallback(placementKey, segment, 'fragment_fetch_failed');
};

const decorateSection = async (section) => {
  const placementKey = section.dataset.pzn;
  const variants = await loadVariants();
  // nothing authored for this slot
  if (!variants.some((row) => row.placement === placementKey)) {
    trackFallback(placementKey, null, 'no_variant_authored');
    return;
  }

  if (config.previewSegment) {
    const resolved = resolveTarget(section, variants, placementKey, config.previewSegment);
    await applyResolved(placementKey, resolved, config.previewSegment);
    return;
  }

  // Message-match tier (ADR-003 first-match order: preview > message-match >
  // cookie > edge). Consent-gated and purely additive: when consent is absent
  // or there is no campaign signal, this engages nothing and the existing
  // cookie/edge tiers below run exactly as before. Not the rejected 7-tier
  // ladder — one documented client-side axis insertion. See
  // cro-first-slice-spec.md B3.
  if (hasConsent('personalization')) {
    const msgSegment = messageMatchSegment();
    if (msgSegment) {
      const resolved = resolveTarget(section, variants, placementKey, msgSegment);
      await applyResolved(placementKey, resolved, msgSegment);
      return;
    }
  }

  const cachedSegment = readCookie(COOKIE_NAME);
  if (cachedSegment) {
    const resolved = resolveTarget(section, variants, placementKey, cachedSegment);
    await applyResolved(placementKey, resolved, cachedSegment);
    return;
  }

  // COLD: default content is already live in the DOM — nothing to do yet.
  // The decision call itself must be consent-gated, not just its analytics
  // wrapper (P0-44's Intuit-asymmetry note) — check before firing.
  if (!hasConsent('personalization')) {
    trackFallback(placementKey, null, 'consent_denied');
    return;
  }

  const segment = await fetchDecision();
  if (!segment) {
    trackFallback(placementKey, null, 'decision_failed');
    return; // fail-open on timeout/error — baseline stands
  }
  writeCookie(COOKIE_NAME, segment);

  const resolved = resolveTarget(section, variants, placementKey, segment);
  await applyResolved(placementKey, resolved, segment);
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
  // Returned so a caller that re-runs this per test/session (e.g. this
  // module's own test suite, which reimports pzn.js fresh per test but
  // shares one `document`) can remove the listener explicitly instead of
  // leaving it attached indefinitely — a real page only calls this once per
  // load, so a real caller has no reason to use the return value.
  return stopListening;
};
