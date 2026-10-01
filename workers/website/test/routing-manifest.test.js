// Cohort × locale cell manifest (routing-manifest.js; docs/decisions/0015-locale-cutover-cells.md
// D-L5/L-2, fh-arch6 B-2). Injected manifests go through createIsEdsPath, so
// nothing here mutates the Worker's real routing state.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createIsEdsPath } from '../index.js';
import {
  ROUTING_MANIFEST, COHORTS, CELLS, validateManifest, assertValidManifest,
} from '../routing-manifest.js';

const PHASE1 = ['/blog/', '/glossary/', '/integrations/'];
const PHASE3 = ['/enterprise/', '/demo/'];

// English Phase 1 and Phase 3 live; ja-jp only for Phase 3.
const SPLIT = {
  cohorts: { phase1: PHASE1, phase3: PHASE3 },
  cells: [
    { cohort: 'phase1', locale: '' },
    { cohort: 'phase3', locale: '' },
    { cohort: 'phase3', locale: '/ja-jp' },
  ],
};

test('today\'s manifest: English × phase1 live, no locale cells', () => {
  assert.deepEqual(COHORTS, { phase1: PHASE1 });
  assert.deepEqual(CELLS, [{ cohort: 'phase1', locale: '' }]);
  assert.deepEqual(validateManifest(ROUTING_MANIFEST), []);
  assert.ok(Object.isFrozen(CELLS) && CELLS.every(Object.isFrozen));
  assert.ok(Object.isFrozen(COHORTS) && Object.values(COHORTS).every(Object.isFrozen));
});

test('a locale cell turns on only its own cohort for that locale', () => {
  const isEds = createIsEdsPath(SPLIT);
  for (const p of ['/ja-jp/enterprise', '/ja-jp/enterprise/', '/ja-jp/demo/x']) assert.equal(isEds(p), true, p);
  // ja-jp blog stays on Falkor even though English blog is live.
  for (const p of ['/ja-jp/blog/x', '/ja-jp/glossary', '/ja-jp', '/ja-jp/pricing']) assert.equal(isEds(p), false, p);
  // Another locale gets nothing.
  for (const p of ['/ko-kr/enterprise', '/ko-kr/blog/x']) assert.equal(isEds(p), false, p);
});

test('English routing does not change when a locale cell is added', () => {
  const englishOnly = createIsEdsPath({ ...SPLIT, cells: SPLIT.cells.slice(0, 2) });
  const withJa = createIsEdsPath(SPLIT);
  for (const p of ['/blog/x', '/glossary', '/enterprise', '/demo/x', '/pricing', '/', '/scripts/a.js', '/blogger']) {
    assert.equal(withJa(p), englishOnly(p), p);
  }
  // A cohort is only live for English if it has an English cell.
  const noEnglishPhase3 = createIsEdsPath({ ...SPLIT, cells: [SPLIT.cells[0], SPLIT.cells[2]] });
  assert.equal(noEnglishPhase3('/enterprise'), false);
  assert.equal(noEnglishPhase3('/ja-jp/enterprise'), true);
});

test('locale assets follow the locale: on with any live cell, off with none', () => {
  const isEds = createIsEdsPath(SPLIT);
  assert.equal(isEds('/ja-jp/system/placeholders.json'), true);
  assert.equal(isEds('/ko-kr/system/placeholders.json'), false);
  assert.equal(isEds('/scripts/scripts.js'), true);
});

test('isCellLive seam: can remove a locale\'s cells (pages and assets), never add one', () => {
  const env = { KILL: '/ja-jp' };
  const isEds = createIsEdsPath(SPLIT, (cell, e) => cell.locale !== e.KILL);
  assert.equal(isEds('/ja-jp/enterprise', env), false);
  assert.equal(isEds('/ja-jp/system/placeholders.json', env), false);
  assert.equal(isEds('/enterprise', env), true, 'English unaffected');
  assert.equal(isEds('/ja-jp/enterprise', {}), true, 'filter off, cell back');
  // A predicate that says yes to everything still can't exceed the manifest.
  const permissive = createIsEdsPath(SPLIT, () => true);
  assert.equal(permissive('/ko-kr/enterprise', { EDS_LOCALES: 'ko-kr' }), false);
  assert.equal(permissive('/ja-jp/blog/x', { EDS_LOCALES: 'ja-jp' }), false);
});

test('validator rejects unknown locales', () => {
  const unknownLocale = (locale) => validateManifest({ cohorts: { phase1: PHASE1 }, cells: [{ cohort: 'phase1', locale }] });
  // Prefixes must match LOCALE_PREFIXES exactly: slash, lowercase.
  for (const locale of ['/xx-yy', 'ja-jp', '/JA-JP', undefined]) {
    const errors = unknownLocale(locale);
    assert.equal(errors.length, 1, String(locale));
    assert.match(errors[0], /unknown locale/);
  }
  // en-us is the unprefixed default; its cells use locale ''.
  assert.match(unknownLocale('/en-us')[0], /unknown locale/);
});

test('validator rejects unknown cohorts, including inherited object keys', () => {
  for (const cohort of ['phase2', 'toString', undefined]) {
    const errors = validateManifest({ cohorts: { phase1: PHASE1 }, cells: [{ cohort, locale: '' }] });
    assert.equal(errors.length, 1, String(cohort));
    assert.match(errors[0], /unknown cohort/);
  }
});

test('validator rejects duplicate cells', () => {
  const cells = [{ cohort: 'phase1', locale: '/ja-jp' }, { cohort: 'phase1', locale: '' }, { cohort: 'phase1', locale: '/ja-jp' }];
  const errors = validateManifest({ cohorts: { phase1: PHASE1 }, cells });
  assert.deepEqual(errors, ['cell 2: duplicates cell 0 (phase1 × "/ja-jp")']);
});

test('validator rejects overlapping, malformed and empty cohort prefixes', () => {
  const overlaps = [
    { a: ['/blog/'], b: ['/blog/archive/'] },
    { a: ['/blog/'], b: ['/blog/'] },
    { a: ['/blog/', '/blog/x/'], b: ['/demo/'] },
  ];
  for (const { a, b } of overlaps) {
    const errors = validateManifest({ cohorts: { a, b }, cells: [] });
    assert.equal(errors.length, 1, JSON.stringify({ a, b }));
    assert.match(errors[0], /overlaps/);
  }
  // Look-alikes are not overlaps (the old EDS_PATHS semantics keep them apart).
  assert.deepEqual(validateManifest({ cohorts: { a: ['/blog/'], b: ['/blogs/'] }, cells: [] }), []);
  for (const bad of ['/blog', 'blog/', '/', '']) {
    assert.match(validateManifest({ cohorts: { a: [bad] }, cells: [] })[0], /must look like/, bad);
  }
  assert.match(validateManifest({ cohorts: { a: [] }, cells: [] })[0], /no prefixes/);
  assert.deepEqual(validateManifest({}), ['manifest.cohorts must be an object']);
});

test('an invalid manifest throws when isEdsPath is built, so it fails at load', () => {
  const bad = { cohorts: { phase1: PHASE1 }, cells: [{ cohort: 'phase1', locale: '/xx-yy' }] };
  assert.throws(() => createIsEdsPath(bad), /Invalid routing manifest:\n- cell 0: unknown locale/);
  assert.throws(() => assertValidManifest(bad), /unknown locale/);
});

// ru-ru (242-FZ review) and zh-cn (GFW reachability review) are hard gates
// (docs/architecture/locale.md, "Before a locale goes live"). Remove a locale
// here only with the recorded sign-off.
test('no live cell for a legally gated locale', () => {
  const gated = ['/ru-ru', '/zh-cn'];
  assert.deepEqual(CELLS.filter(({ locale }) => gated.includes(locale)), []);
});

test('validator rejects prefixes that could never match', () => {
  const check = (prefix) => validateManifest(
    { cohorts: { a: [prefix] }, cells: [{ cohort: 'a', locale: '' }] },
    undefined,
    ['/system/'],
  );
  assert.match(check('/Blog/').join(), /must be lowercase/);
  assert.match(check('/de-de/blog/').join(), /must not include a locale/);
  assert.match(check('/system/x/').join(), /reserved asset prefix/);
  assert.deepEqual(check('/blog/'), []);
  assert.throws(
    () => createIsEdsPath({ cohorts: { a: ['/scripts/'] }, cells: [{ cohort: 'a', locale: '' }] }),
    /reserved asset prefix/,
  );
});

test('validator rejects unknown cell keys (e.g. live: false does not turn a cell off)', () => {
  const errors = validateManifest({ cohorts: { phase1: PHASE1 }, cells: [{ cohort: 'phase1', locale: '', live: false }] });
  assert.match(errors.join(), /cell 0: unknown keys live/);
});

test('mutating an injected manifest after build cannot add cells', () => {
  const manifest = { cohorts: { phase1: [...PHASE1] }, cells: [{ cohort: 'phase1', locale: '' }] };
  const isEds = createIsEdsPath(manifest);
  manifest.cells.push({ cohort: 'phase1', locale: '/ja-jp' });
  manifest.cohorts.phase1.push('/');
  assert.equal(isEds('/ja-jp/blog/x'), false);
  assert.equal(isEds('/anything'), false);
  assert.equal(isEds('/blog/x'), true);
});

test('a throwing isCellLive counts as not live instead of failing the request', () => {
  const isEds = createIsEdsPath(SPLIT, () => { throw new Error('bad env'); });
  assert.equal(isEds('/blog/x', {}), false);
});
