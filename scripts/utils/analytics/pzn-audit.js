// Dev-mode-only diagnostic (see scripts.md's Selectors & Data Attributes
// section, and the sibling testid-audit.js it mirrors). Personalization
// variants are authored as a flat DA sheet where two valid rows sharing the
// same placement + segment but pointing at DIFFERENT selectors is a silent,
// damaging bug: resolveTarget → weightedPick picks exactly ONE row per visitor
// and queries only that row's selector, so each visitor only ever gets one of
// the targeted elements swapped and the others stay baseline for them — a
// fractured, per-visitor experience the author never intended, with nothing
// surfaced. Rows sharing placement + segment with an IDENTICAL selector are
// the opposite: a legitimate, intentional weighted A/B split of one element —
// those must NOT warn. Reuses pzn.js's already-memoized, isValidRow-filtered
// loadVariants() so it shares the pzn runtime's one in-flight fetch when that
// runs (a page with no [data-pzn] sections pays at most one dev-only,
// sessionStorage-cached fetch). Runs from lazy.js once every section has
// decorated (same call site as testid-audit).
import { getMetadata } from '../../ak.js';
import { loadVariants, toPlacement } from './pzn.js';

// `load` defaults to pzn.js's memoized loadVariants so lazy.js's zero-arg
// `auditPzn()` shares that one in-flight fetch (zero extra network cost). It's
// a parameter only so a test can inject a fresh module instance's loader:
// pzn.js memoizes `variantsPromise` at module scope, and that promise is a
// singleton shared across every importer (a statically-imported dep is not
// freshened by cache-busting the importer — verified experimentally), so
// there is no other way to give each test an isolated variants dataset.
export default async (load = loadVariants) => {
  const variants = await load();
  // Group on a NUL-delimited key so grouping matches the runtime's exact
  // per-field equality (rowsFor filters on placement === / segment ===). A
  // printable delimiter like ':' could merge two genuinely-distinct groups if
  // an authored placement/segment value contained it; NUL cannot appear in a
  // DA sheet cell, so the audit can never disagree with the runtime it audits.
  const groups = Map.groupBy(variants, (row) => `${row.placement}\u0000${row.segment}`);
  groups.forEach((rows) => {
    const selectors = [...new Set(rows.map((row) => row.selector))];
    if (selectors.length < 2) return; // one selector = intentional A/B split, not a collision
    const { placement, segment } = rows[0];
    const detail = rows.map((row) => `"${row.selector}" → ${row.label || row.fragment}`).join(', ');
    // eslint-disable-next-line no-console -- this warning IS the diagnostic
    console.warn(`Personalization collision: placement "${placement}" + segment "${segment}" has ${rows.length} rows targeting ${selectors.length} different selectors — only one selector is swapped per visitor, the rest stay baseline for that visitor. If this is an intentional split, all rows must share one selector. Rows: ${detail}`);
  });
};

// ADR-003 enforcement (dev-only): experiments and personalization are separate
// mechanisms with separate precedence — a deterministic segment (pzn.js) must
// never be overridden by a random sticky A/B assignment (experimentation.js),
// and the two MUST NOT target the same element. They don't collide by design
// (pzn always applies last in lazy.js, so the segment already wins the pixels),
// but if an author points a page's late-phase `experiment-selector` (UC-02
// chrome swap) at an element a `pzn` slot also owns, experimentation.js still
// fires a phantom A/B exposure for a variant the visitor never saw before pzn.js
// overwrites it — corrupting the exposure denominator §11.8's stats depend on.
// This is an authoring mistake, so it's caught at authoring/dev time (the
// ecosystem "registry/log" pattern — see ADR-003's evidence) rather than
// reconciled at runtime. Only the late (selector-scoped) phase can collide; the
// early full-page swap nests pzn slots compositionally, so a page with no
// `experiment-selector` short-circuits immediately.
//
// Resolves selectors against the live dev DOM (`root`), the same DOM-truth basis
// pzn.js's own resolveTarget and experimentation.js use — so it only fires on a
// page where both targets actually exist at audit time. `experimentSelector`,
// `root`, and `load` are parameters purely so a test can inject a fixture DOM
// and dataset; production passes none and reads real page metadata + document.
export const auditExperimentCollision = async ({
  experimentSelector = getMetadata('experiment-selector'),
  root = document,
  load = loadVariants,
} = {}) => {
  if (!experimentSelector) return; // no late-phase chrome experiment on this page
  let expTarget;
  try {
    expTarget = root.querySelector(experimentSelector);
  } catch {
    return; // malformed experiment-selector — experimentation.js already fails open on it
  }
  if (!expTarget) return; // experiment target not on this page — no collision possible

  const variants = await load();
  [...root.querySelectorAll('[data-pzn]')].forEach((section) => {
    const placement = toPlacement(section.dataset.pzn);
    const collidingRow = variants
      .filter((row) => toPlacement(row.placement) === placement)
      .find((row) => {
        let pznTarget;
        try {
          pznTarget = section.querySelector(row.selector);
        } catch {
          return false; // malformed pzn selector — pzn.js's resolveTarget already fails open on it
        }
        return Boolean(pznTarget)
          && (pznTarget === expTarget
            || expTarget.contains(pznTarget)
            || pznTarget.contains(expTarget));
      });
    if (!collidingRow) return;
    // eslint-disable-next-line no-console -- this warning IS the diagnostic
    console.warn(`Experiment/personalization collision (ADR-003): the page's experiment-selector "${experimentSelector}" overlaps personalization placement "${placement}" (selector "${collidingRow.selector}"). A random A/B test and a deterministic segment must not target the same element — the segment wins the pixels, but the A/B still logs a phantom exposure that corrupts the experiment. Scope them to different elements, or fold the A/B into the variants sheet.`);
  });
};
