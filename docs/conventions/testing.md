# Testing and lint

CI runs everything below on every pull request in one job, **Lint and Test** (`.github/workflows/ci.yml`, Node 22). It is the required status check for merging to `main`. A PR that changes none of the code paths (for example a docs-only PR) still reports the check but skips the steps.

## Commands

| Command | What it runs | When to run it locally |
|---|---|---|
| `npm run lint` | `eslint .`, Stylelint on `blocks/**/*.css styles/*.css experiments-panel/*.css`, then `tools/lint-css-layers.mjs` | Before every commit |
| `npm test` | Web Test Runner over `test/**/*.test.(js\|html)` in headless Chromium, with coverage | Before every push |
| `npm run test:file -- <path-or-glob>` | Web Test Runner on one file or glob | While iterating on one test |
| `npm run test:watch` | `npm test` in watch mode | |
| `npm run test:eslint-rules` | Tests for the custom `config-drift` ESLint rules (`tools/eslint-rules/`) | When touching `tools/eslint-rules/` |
| `npm run test:stylelint-rules` | Tests for `atreyu/z-index-requires-token` (`tools/stylelint-rules/`) | When touching `tools/stylelint-rules/` |
| `npm run test:config-sync` | Node tests that browser and Worker copies of shared constants agree, and that `experiments-panel/` never imports `ak.js` | When touching `scripts/locales.js`, `workers/website/utils/locale.js` or `experiments-panel/` |
| `npm run test:locale-extractor` | Tests for `tools/locale-extractor/` | When touching the extractor |
| `node --test workers/website/test/*.test.js` | Worker unit tests (Node test runner, some through miniflare) | When touching `workers/website/` (run `npm ci --prefix workers/website` first) |

CI also re-runs the date-sensitive suites (`test/utils/experiments/`, `test/experiments-panel/`, `test/utils/i18n.test.js`, `test/blocks/hero-cards-transition.test.js`) with `TZ=America/Los_Angeles` to catch UTC-only date assumptions. To reproduce locally: `TZ=America/Los_Angeles npm run test:file -- "test/utils/i18n.test.js"`.

## Web Test Runner port

Web Test Runner binds port 2000. If a second worktree or another run already holds it, set `WTR_PORT`:

```sh
WTR_PORT=2002 npm test
```

`WTR_PORT` is read by `web-test-runner.config.mjs`. Any value that isn't an integer from 1 to 65535 throws at startup.

## Writing tests

- Browser tests live in `test/` mirroring the source path (`blocks/hero/hero.js` → `test/blocks/hero.test.js`, `scripts/utils/a11y.js` → `test/utils/a11y.test.js`).
- Use Mocha globals with `expect` from `@esm-bundle/chai` and `sinon` for stubs.
- Call a block's default export directly: `await decorate(el)`. That path passes no `{ signal }`, which is the case blocks must handle.
- Select by `data-testid` or semantic class, never by position.
- Any change to a sanitizer, allowlist, URL check or the Worker's routing ships with tests.
- Tests don't prove rendering. Blocks with animation or non-trivial layout also need a real-browser check (`aem up`); see [blocks.md](blocks.md#verification).

## Pre-commit hook

`npm install` runs the `prepare` script, which points `core.hooksPath` at `.githooks/`. The `pre-commit` hook runs ESLint on staged `.js` files only. CSS is not checked there; CI checks it. Bypass in an emergency with `git commit --no-verify`; CI still runs the full suite.

## Performance check

AEM Code Sync runs its built-in PSI check on pull requests when the PR description includes a Test URL for the branch preview (`https://{branch}--atreyu--dallinbsmith.aem.page/{path}`). Add the URL when a PR changes visible pages so Code Sync has a page to measure. Dependabot PRs have no Test URL; CI is the gate. The repository does not run a separate Lighthouse workflow or keep local configuration for one.
