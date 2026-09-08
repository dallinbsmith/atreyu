/**
 * Coverage for tools/stylelint-rules/z-index-requires-token.js.
 *
 * Node-only, run directly from the `site/` package root (matches how
 * config-drift.test.js is run for the ESLint side of this project's custom
 * lint rules):
 *
 *   node tools/stylelint-rules/z-index-requires-token.test.js
 *
 * A thrown assertion means a case failed; no output means everything below
 * passed. Uses stylelint's own `.lint()` API directly against inline code
 * strings rather than a separate test-framework dependency.
 */
import assert from 'node:assert/strict';
import stylelint from 'stylelint';
import plugin from './z-index-requires-token.js';

const RULE = 'atreyu/z-index-requires-token';

const lint = async (code) => stylelint.lint({
  code,
  config: {
    plugins: [plugin],
    rules: { [RULE]: true },
  },
});

const assertClean = async (code, label) => {
  const { results } = await lint(code);
  assert.equal(results[0].warnings.length, 0, `expected no warnings for: ${label}`);
};

const assertFlagged = async (code, label) => {
  const { results } = await lint(code);
  assert.equal(results[0].warnings.length, 1, `expected exactly one warning for: ${label}`);
  assert.equal(results[0].warnings[0].rule, RULE);
};

const run = async () => {
  // Local tier — raw small integers on a non-fixed, non-escaping element are
  // correct and must not be flagged.
  await assertClean('.pothole { position: relative; isolation: isolate; z-index: 1; }', 'local tier, position: relative');

  // A token reference is always fine, fixed or not.
  await assertClean('.header { position: fixed; z-index: var(--z-index-nav); }', 'position: fixed + var() token');

  // calc()-derived values (even ones that resolve from a token) are not raw
  // numbers and must not be flagged.
  await assertClean(
    '.foo { position: fixed; z-index: calc(var(--z-index-nav) + 10); }',
    'position: fixed + calc() expression',
  );

  // z-index: auto is never a raw number match.
  await assertClean('.foo { position: fixed; z-index: auto; }', 'position: fixed + z-index: auto');

  // position: absolute (not fixed) is this project's other real local shape
  // (e.g. header's own mega-menu submenu, contained by header's own stacking
  // context) — must not be flagged.
  await assertClean('.mega-menu.language { position: absolute; z-index: 1; }', 'position: absolute, no fixed ancestor');

  // The exact shape of the real header.css bug: position: fixed + a raw
  // number in the same rule.
  await assertFlagged('.header { position: fixed; z-index: 1000; }', 'position: fixed + raw number, same rule (header bug shape)');

  // The exact shape of the real quote-interactive.css .qi-hover bug: a small,
  // "local-looking" raw number that still needs a token because of fixed
  // positioning.
  await assertFlagged('.qi-hover { position: fixed; top: 0; z-index: 3; }', 'position: fixed + small raw number (qi-hover bug shape)');

  // Nesting: neither this rule nor any ancestor is position: fixed — the
  // nested rule's own raw z-index is legitimately local.
  await assertClean(
    '.foo { position: relative; .bar { z-index: 1; } }',
    'no fixed ancestor anywhere in the chain, nested rule',
  );

  // Regression (found by review, 2026-09-08): a position: fixed ancestor
  // whose OWN z-index is already a token properly contains its nested
  // children — this is exactly header.css's real `.language` mega-menu
  // submenu shape and must NOT be flagged. The first version of this rule
  // flagged it, and only escaped detection in the real codebase by accident
  // of header.css's `.language` rule living in a separate @media occurrence
  // rather than nested via `&`.
  await assertClean(
    '.foo { position: fixed; z-index: var(--z-index-nav); .bar { z-index: 5; } }',
    'position: fixed ancestor already using a token — nested raw z-index is safely contained',
  );
  await assertClean(
    'header { position: fixed; z-index: var(--z-index-nav); .menu { .language { z-index: 1; } } }',
    'real header.css shape: token-ed fixed ancestor, two levels of nesting down to the submenu',
  );

  // But a position: fixed ancestor with NO z-index at all still hasn't
  // established any containment — still flag the nested raw number.
  await assertFlagged(
    '.foo { position: fixed; .bar { z-index: 5; } }',
    'position: fixed ancestor with no z-index of its own — nested raw z-index still unsafe',
  );

  // eslint-disable-next-line no-console
  console.log('All z-index-requires-token cases passed.');
};

await run();
