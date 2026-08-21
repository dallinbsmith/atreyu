/**
 * RuleTester coverage for tools/eslint-rules/config-drift.js (P0-48).
 *
 * Node-only. RuleTester and this rule's own import/path resolution rely on
 * Node APIs the browser test runner (web-test-runner, `npm test`) doesn't
 * have, so this file is not wired into that suite. Run it directly from the
 * `site/` package root, so relative path resolution inside the rule matches
 * how `npm run lint` actually invokes it:
 *
 *   node tools/eslint-rules/config-drift.test.js
 *
 * A thrown assertion means a case failed; no output means everything below
 * passed.
 *
 * One deliberate deviation from a literal reading of a review finding is
 * called out inline below (search "DEVIATION"): the review asked for
 * `currentEnv.includes('prod')` to be exempt the same way `ENV === 'prod'`
 * is, on the theory that a bare identifier is a bare identifier either way.
 * Implemented literally, that would also exempt `host.includes('stage')`
 * when `host` is a plain variable — which is the *exact* shape of
 * scripts/utils/env.js's own real internal logic, i.e. exactly the bug this
 * rule exists to catch. Instead, both branches now trace whether the
 * identifier is actually bound to an import of the designated classifier
 * file; that closes the asymmetry (both branches use the same check) without
 * gutting detection of the core case.
 *
 * "Round 2" cases (search "Round 2") cover a second review pass on the
 * same-file spread tracking: reassignment after declaration, cross-scope
 * name collision (shadowing), object-literal spread (previously untracked
 * entirely), and no-substitution template literals used in place of plain
 * string literals.
 *
 * "Round 3" cases (search "Round 3") cover a third review pass: an env-word
 * array iterated via `.some()`/`.every()`/`.find()` (the exact shape of
 * scripts/utils/env.js's own logic, and CLAUDE.md's preferred house style
 * over manual loops), and compound/logical assignment (`||=`, `??=`, etc. —
 * also named CLAUDE.md house style) in the locale-list spread tracker.
 */

import { RuleTester } from 'eslint';
import plugin from './config-drift.js';

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2025, sourceType: 'module' },
});

ruleTester.run('no-duplicate-locale-list', plugin.rules['no-duplicate-locale-list'], {
  valid: [
    // The two designated runtime sources are exempt, however many real
    // codes they hold.
    {
      filename: 'workers/website/utils/locale.js',
      code: "export const LOCALE_PREFIXES = ['/de-de', '/es-es', '/fr-fr', '/it-it', '/ja-jp', '/ko-kr', '/pt-br', '/ru-ru', '/zh-cn'];",
    },
    {
      filename: 'scripts/scripts.js',
      code: "const locales = { '': { lang: 'en' }, '/de-de': { lang: 'de' }, '/es-es': { lang: 'es' }, '/fr-fr': { lang: 'fr' } };",
    },
    // This rule's own hardcoded allowlist is the one sanctioned third copy
    // (see the comment on ALLOWED_LOCALE_CODES in config-drift.js).
    {
      filename: 'tools/eslint-rules/config-drift.js',
      code: "const ALLOWED_LOCALE_CODES = new Set(['de-de', 'en-us', 'es-es', 'fr-fr', 'it-it', 'ja-jp', 'ko-kr', 'pt-br', 'ru-ru', 'zh-cn']);",
    },
    // Below the 3-match threshold.
    {
      filename: 'blocks/foo/foo.js',
      code: "const pair = ['/de-de', '/es-es'];",
    },
    // Regression for item 7: the old shape-only regex (`[a-z]{2}-[a-z]{2}`)
    // coincidentally matched these real, unrelated CSS state class names.
    // The explicit allowlist of real locale codes must not flag them.
    {
      filename: 'blocks/hero-cards-transition/hero-cards-transition.js',
      code: "const classNames = ['qi-bg', 'hc-bg', 'hc-in'];",
    },
    // Robustness for the round-2 template-literal fix: an INTERPOLATED
    // template literal (still a documented, known-uncovered gap — see the
    // top-of-file comment in config-drift.js) must not throw and must not
    // be misread as a match; only one real code is present here anyway, so
    // this stays below threshold regardless.
    {
      filename: 'blocks/foo/foo.js',
      // This string IS the fixture source code under test, not a forgotten template literal.
      // eslint-disable-next-line no-template-curly-in-string
      code: 'const dynamic = [`/${lang}-de`, \'/es-es\'];',
    },
  ],
  invalid: [
    // Baseline case: a flat array of 3+ real codes outside the designated
    // files, unchanged by any of the fixes below.
    {
      filename: 'blocks/foo/foo.js',
      code: "const BAD = ['/de-de', '/es-es', '/fr-fr'];",
      errors: 1,
    },
    // Item 2: object literal with locale-shaped VALUES (keys are plain
    // identifiers, not locale strings) — previously zero errors.
    {
      filename: 'blocks/foo/foo.js',
      code: "const BAD = { de: '/de-de', es: '/es-es', fr: '/fr-fr' };",
      errors: 1,
    },
    // Item 4: array-of-pairs shape — previously zero errors because nested
    // arrays weren't inspected.
    {
      filename: 'blocks/foo/foo.js',
      code: "const BAD = [['/de-de', 'German'], ['/es-es', 'Spanish'], ['/fr-fr', 'French']];",
      errors: 1,
    },
    // Item 3: locale list split across declarations then combined via
    // spread — previously zero errors on all three statements. Only
    // `combined` should error (`a` and `b` are 2 matches each, below
    // threshold on their own).
    {
      filename: 'blocks/foo/foo.js',
      code: "const a = ['/de-de', '/es-es']; const b = ['/fr-fr', '/it-it']; const combined = [...a, ...b];",
      errors: 1,
    },
    // Round 2, item 1a: reassignment after declaration. The tracker must
    // update on the AssignmentExpression, not just the initial
    // VariableDeclarator, or `combined` would use a stale count of 1
    // ('/de-de') instead of the real 2 ('/es-es', '/fr-fr').
    {
      filename: 'blocks/foo/foo.js',
      code: "let a = ['/de-de']; a = ['/es-es', '/fr-fr']; const combined = [...a, '/it-it'];",
      errors: 1,
    },
    // Round 2, item 1b: cross-scope name collision. The outer `a` (2 real
    // codes) and the unrelated inner `a` inside reset() (0 real codes) must
    // be tracked as distinct bindings — keyed by the resolved Variable
    // object, not the bare name "a" — so the inner declaration doesn't
    // clobber the outer one's tracked count before `combined` reads it.
    {
      filename: 'blocks/foo/foo.js',
      code: "const a = ['/de-de', '/es-es']; function reset() { const a = ['/x']; } const combined = [...a, '/fr-fr'];",
      errors: 1,
    },
    // Round 2, item 2: object literals split then combined via object
    // spread — the identical bug to the array-spread case above, previously
    // untracked because the ObjectExpression handler only ever looked at
    // `Property` nodes and silently dropped `SpreadElement` properties.
    {
      filename: 'blocks/foo/foo.js',
      code: "const a = { de: '/de-de', es: '/es-es' }; const b = { fr: '/fr-fr', it: '/it-it' }; const combined = { ...a, ...b };",
      errors: 1,
    },
    // Round 2, item 3: no-substitution template literals. This project's
    // own CLAUDE.md recommends template literals as house style for string
    // building, so an author following that convention for a locale array
    // must not silently defeat the rule.
    {
      filename: 'blocks/foo/foo.js',
      code: 'const BAD = [`/de-de`, `/es-es`, `/fr-fr`];',
      errors: 1,
    },
    // Round 3, item 2: compound/logical assignment. The tracker must update
    // on `||=` (and `??=`/`&&=`/`+=`) the same way it does on plain `=`, or
    // `combined` would use the stale count of 1 ('/de-de') instead of the
    // real 2 ('/es-es', '/fr-fr') assigned via `||=`.
    {
      filename: 'blocks/foo/foo.js',
      code: "let a = ['/de-de']; a ||= ['/es-es', '/fr-fr']; const combined = [...a, '/it-it'];",
      errors: 1,
    },
    // Acceptance criterion: demonstrate against the real bug class this
    // project already found and fixed once (see ref_real_locale_list.md /
    // ref_eds_iteration_lessons.md) — a second, independently-maintained
    // locale-prefix list existing outside the two designated files. This
    // models that bug's shape (a second full list in a real, non-designated
    // file in this repo) rather than reproducing its exact historical
    // content byte-for-byte, since the rule's job is to catch the existence
    // of a duplicate list, not to validate locale-code correctness.
    {
      filename: 'workers/website/index.js',
      code: "const EDS_LOCALES = ['/de-de', '/es-es', '/fr-fr', '/ja-jp', '/zh-cn'];",
      errors: 1,
    },
  ],
});

ruleTester.run('no-inline-env-check', plugin.rules['no-inline-env-check'], {
  valid: [
    // The designated classifier file is exempt from its own rule.
    {
      filename: 'scripts/utils/env.js',
      code: "const classify = (host) => { if (host.includes('stage')) return 'stage'; return 'prod'; };",
    },
    // The correct, expected way to consume the classifier: import it, then
    // compare the imported binding. Must not be flagged (this is real,
    // shipped code in blocks/schedule/schedule.js, scripts/lazy.js, etc).
    {
      filename: 'blocks/schedule/schedule.js',
      code: "import ENV from '../../scripts/utils/env.js';\nconst isProd = ENV === 'prod';",
    },
    // Item 6: the same import, consumed via .includes() instead of ===,
    // must be equally exempt — this is what actually closes the asymmetry
    // (both branches trace the same import), not a blanket identifier
    // exemption. See the DEVIATION note at the top of this file.
    {
      filename: 'blocks/schedule/schedule.js',
      code: "import ENV from '../../scripts/utils/env.js';\nconst maybe = ENV.includes('prod');",
    },
    // Not an environment-name literal at all.
    {
      filename: 'blocks/foo/foo.js',
      code: "const ok = x.includes('foo');",
    },
    // Round 3, item 1 exemption path: the same .some() shape, but checking
    // the imported classifier binding rather than a raw hostname — must
    // stay exempt, same as the direct .includes()/=== cases above.
    {
      filename: 'blocks/schedule/schedule.js',
      code: "import ENV from '../../scripts/utils/env.js';\nconst maybe = ['prod', 'stage'].some((w) => ENV.includes(w));",
    },
    // .some()/.every()/.find() over an array that isn't env-word-shaped at
    // all must not false-positive.
    {
      filename: 'blocks/foo/foo.js',
      code: "const ok = ['a', 'b'].some((w) => host.includes(w));",
    },
  ],
  invalid: [
    // Core motivating case, unchanged by any of the fixes below: re-deriving
    // an environment from a raw hostname via .includes() with no import of
    // the designated classifier in scope.
    {
      filename: 'blocks/foo/foo.js',
      code: "const classify = (host) => host.includes('stage');",
      errors: 1,
    },
    // Item 5: .startsWith() / .endsWith() coverage.
    {
      filename: 'blocks/foo/foo.js',
      code: "const isProd = (host) => host.startsWith('prod');",
      errors: 1,
    },
    {
      filename: 'blocks/foo/foo.js',
      code: "const isDev = (host) => host.endsWith('dev');",
      errors: 1,
    },
    // Item 5: inline regex .test() coverage.
    {
      filename: 'blocks/foo/foo.js',
      code: 'const isProd = (host) => /^prod$/.test(host);',
      errors: 1,
    },
    // Item 5: switch-statement coverage.
    {
      filename: 'blocks/foo/foo.js',
      code: "const classify = (host) => { switch (host) { case 'prod': return 'prod'; case 'stage': return 'stage'; default: return 'dev'; } };",
      errors: 1,
    },
    // Regression: a derived (member expression) comparison via === was
    // already caught before this fix pass and must still be.
    {
      filename: 'blocks/foo/foo.js',
      code: "const isStage = location.host === 'stage';",
      errors: 1,
    },
    // Round 3, item 1: env-word array iterated via .some(), the exact shape
    // of scripts/utils/env.js's own real internal logic
    // (`['--', 'local'].some((check) => host.includes(check))`) and the
    // natural way CLAUDE.md's preferred .some()/.every() house style would
    // reproduce it outside the designated file.
    {
      filename: 'blocks/foo/foo.js',
      code: "const isStage = (host) => ['stage', 'staging'].some((marker) => host.includes(marker));",
      errors: 1,
    },
    // Round 3, item 1: .every() / .find() variants, plus a `return`-bodied
    // (not implicit-return) callback.
    {
      filename: 'blocks/foo/foo.js',
      code: "const isProd = (host) => ['prod', 'production'].every((marker) => { return host.startsWith(marker); });",
      errors: 1,
    },
    // DEVIATION regression guard: a bare identifier that is NOT traced to an
    // import of the designated classifier must still be flagged when used
    // with .includes() — proving the item 6 fix is import-provenance-based,
    // not a blanket "any identifier is exempt" rule that would silently
    // stop catching the core bug shape.
    {
      filename: 'blocks/foo/foo.js',
      code: "const currentEnv = window.location.host; const maybe = currentEnv.includes('prod');",
      errors: 1,
    },
  ],
});

// eslint-disable-next-line no-console
console.log('config-drift RuleTester suite passed.');
