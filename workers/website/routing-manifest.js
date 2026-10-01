/**
 * Cohort × locale routing manifest (locale-i18n-plan.md D-L5 / L-2,
 * fh-arch6-review-2026-10-01.md B-2). The one place that decides which
 * (cohort, locale) cells the strangler serves from EDS.
 *
 * Spec:
 * - A cohort is a named list of folder prefixes. '/blog/' matches '/blog' and
 *   '/blog/…' (the old EDS_PATHS semantics); no prefix may overlap another.
 * - A cell { cohort, locale } is live: locale '' is English (unprefixed),
 *   otherwise a LOCALE_PREFIXES entry ('/ja-jp'). No cell = existing origin.
 * - A locale's shared assets (/de-de/system/…) reach EDS once it has any live
 *   cell; until then they stay on the existing origin with its pages.
 * - CELLS is the governed ceiling. A runtime switch (R-L1) may only remove
 *   cells, never add one (r-l1-gov-gate-review-2026-10-01.md fix 1).
 * - An invalid manifest throws at module load, so tests and the upload fail
 *   instead of routing on a typo.
 */
import { LOCALE_PREFIXES } from './utils/locale.js';

// Migration cohort phases (master-plan/implementation-plan.md): Phase 2 adds
// /customers/ + /resources/, Phase 3 / + /enterprise + /demo, Phase 4 /pricing.
// Add a phase's cohort and its English cell when it ships, not before. Phase
// 3's home page '/' needs an exact-match rule first: as a prefix it matches
// everything, so the validator rejects it.
export const COHORTS = Object.freeze({
  phase1: Object.freeze(['/blog/', '/glossary/', '/integrations/']),
});

// Live cells. Today: English Phase 1 only, no locale cells. A locale cell goes
// in only after the D-L5 activation gate (coverage, hreflang, sign-off).
export const CELLS = Object.freeze([
  Object.freeze({ cohort: 'phase1', locale: '' }),
]);

export const ROUTING_MANIFEST = Object.freeze({ cohorts: COHORTS, cells: CELLS });

const isFolderPrefix = (p) => typeof p === 'string' && p.length > 1 && p.startsWith('/') && p.endsWith('/');

const cohortErrors = (cohorts, localePrefixes, reservedPrefixes) => {
  const entries = Object.entries(cohorts);
  const shapeErrors = entries
    .filter(([, prefixes]) => !Array.isArray(prefixes) || !prefixes.length)
    .map(([name]) => `cohort "${name}" has no prefixes`);
  const all = entries
    .filter(([, prefixes]) => Array.isArray(prefixes))
    .flatMap(([name, prefixes]) => prefixes.map((prefix) => ({ name, prefix })));
  const badPrefixes = all
    .filter(({ prefix }) => !isFolderPrefix(prefix))
    .map(({ name, prefix }) => `cohort "${name}" prefix ${JSON.stringify(prefix)} must look like "/folder/"`);
  // Prefixes that could never match: matching is case-sensitive, the locale is
  // stripped first, and reserved (asset) prefixes are checked before cohorts.
  const unreachable = all
    .filter(({ prefix }) => isFolderPrefix(prefix))
    .flatMap(({ name, prefix }) => [
      prefix !== prefix.toLowerCase() && `cohort "${name}" prefix "${prefix}" must be lowercase`,
      localePrefixes.some((l) => prefix.startsWith(`${l}/`)) && `cohort "${name}" prefix "${prefix}" must not include a locale`,
      reservedPrefixes.some((r) => prefix.startsWith(r) || r.startsWith(prefix)) && `cohort "${name}" prefix "${prefix}" overlaps a reserved asset prefix`,
    ].filter(Boolean));
  const overlaps = all
    .filter(({ prefix }) => isFolderPrefix(prefix))
    .flatMap((a, i, list) => list.slice(i + 1)
      .filter((b) => a.prefix.startsWith(b.prefix) || b.prefix.startsWith(a.prefix))
      .map((b) => `prefix "${a.prefix}" (${a.name}) overlaps "${b.prefix}" (${b.name})`));
  return [...shapeErrors, ...badPrefixes, ...unreachable, ...overlaps];
};

const cellErrors = (cohorts, cells, localePrefixes) => cells.flatMap((cell, i) => {
  const { cohort, locale } = cell ?? {};
  const errors = [];
  const extra = Object.keys(cell ?? {}).filter((k) => k !== 'cohort' && k !== 'locale');
  // A cell is live by existing; `live: false` must not look like an off switch.
  if (extra.length) errors.push(`cell ${i}: unknown keys ${extra.join(', ')}`);
  if (!Object.hasOwn(cohorts, cohort)) errors.push(`cell ${i}: unknown cohort ${JSON.stringify(cohort)}`);
  if (locale !== '' && !localePrefixes.includes(locale)) errors.push(`cell ${i}: unknown locale ${JSON.stringify(locale)}`);
  const firstIndex = cells.findIndex((c) => c?.cohort === cohort && c?.locale === locale);
  if (firstIndex !== i) errors.push(`cell ${i}: duplicates cell ${firstIndex} (${cohort} × ${JSON.stringify(locale)})`);
  return errors;
});

/** Pure: returns a list of problems with a manifest (empty when valid). */
export const validateManifest = (
  { cohorts, cells } = {},
  localePrefixes = LOCALE_PREFIXES,
  reservedPrefixes = [],
) => {
  if (!cohorts || typeof cohorts !== 'object') return ['manifest.cohorts must be an object'];
  if (!Array.isArray(cells)) return ['manifest.cells must be an array'];
  return [
    ...cohortErrors(cohorts, localePrefixes, reservedPrefixes),
    ...cellErrors(cohorts, cells, localePrefixes),
  ];
};

// Returns a deep-frozen copy, so mutating the caller's object later can't
// bypass validation.
export const assertValidManifest = (
  manifest,
  localePrefixes = LOCALE_PREFIXES,
  reservedPrefixes = [],
) => {
  const errors = validateManifest(manifest, localePrefixes, reservedPrefixes);
  if (errors.length) throw new Error(`Invalid routing manifest:\n- ${errors.join('\n- ')}`);
  return Object.freeze({
    cohorts: Object.freeze(Object.fromEntries(Object.entries(manifest.cohorts)
      .map(([name, prefixes]) => [name, Object.freeze([...prefixes])]))),
    cells: Object.freeze(manifest.cells
      .map(({ cohort, locale }) => Object.freeze({ cohort, locale }))),
  });
};

/** Name of the cohort whose prefix matches a locale-stripped path, or undefined. */
export const matchCohort = (cohorts, path) => Object.keys(cohorts)
  .find((name) => cohorts[name].some((p) => path.startsWith(p) || path === p.slice(0, -1)));
