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
import { loadVariants } from './pzn.js';

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
