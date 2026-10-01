# AGENTS.md

Instructions for AI coding agents (and a quick reference for humans) working in this repository. Human docs: [docs/README.md](docs/README.md). Where this file and `docs/` disagree, `docs/` wins; fix this file.

Atreyu is Frame.io's marketing site on AEM Edge Delivery Services. No build step, no bundler, no framework: vanilla ES2025 modules and native CSS, served as-is.

## Behavior

- Ask before deleting files, force-pushing, or changing anything under `workers/`. Worker changes decide which origin serves real traffic and need the owner's approval.
- Read a block's JS and CSS before changing it. Make the smallest change that solves the task; report adjacent problems instead of fixing them unasked.
- Don't edit `plugins/experimentation/` (vendored from Adobe).
- Editing `scripts/ak.js`, `scripts/lazy.js` or `scripts/postlcp.js`? Add or update the row in `scripts/AK-PATCHES.md` in the same change.
- Verify before claiming: name only files, functions and config keys you have read in this repo. Run the commands below before saying something works. A CSS or animation change isn't verified until it has been rendered in a browser.
- Go through `.github/PULL_REQUEST_TEMPLATE.md` before pushing; it lists the bug classes lint can't catch.
- If you change behaviour that `docs/` describes, update the doc in the same change.

## Commands

```sh
npm run lint                     # ESLint + Stylelint + CSS layer check; must pass
npm test                         # Web Test Runner, full suite (WTR_PORT=<port> to move off 2000)
npm run test:file -- <path>      # one test file or glob
npm run test:eslint-rules        # custom ESLint rules (tools/eslint-rules/)
npm run test:stylelint-rules     # custom Stylelint rules
npm run test:config-sync         # config drift tests
node --test workers/website/test/*.test.js   # Worker tests
```

## Rules, in short

Full rules and the reasons for them: [docs/conventions/](docs/conventions/README.md).

- **JavaScript** ([javascript.md](docs/conventions/javascript.md)): arrow functions only; `const` by default; terse expressions (single-level ternaries, early returns, array methods); no `innerHTML` with authored or remote data; reuse `scripts/utils/` before writing a helper. `scripts/utils/` never imports from `blocks/`, and blocks don't import other blocks' files.
- **Loading phases** ([javascript.md#loading-phases-e-l-d](docs/conventions/javascript.md#loading-phases-e-l-d)): Eager is the path to LCP (`ak.js`, `scripts.js`, `styles.css`, first section). Lazy is everything else on the page. Delayed (`delayed.js`, 3 s+) is analytics, consent and martech. Don't add preload/preconnect for LCP.
- **Blocks** ([blocks.md](docs/conventions/blocks.md)): `export default (el) => {}` or `async`. A block that adds window/document listeners, observers, timers or body-level nodes takes `(el, { signal } = {})` and ties them to `signal`. One directory per block; split by concern, not to dodge the 200-line lint backstop. No nested blocks. Block names and variant tokens are a contract with content ([0016](docs/decisions/0016-block-names-are-a-contract.md)).
- **CSS** ([css.md](docs/conventions/css.md)): `styles.css` (eager), `lazy-styles.css` (after LCP), `fonts.css`. Layers `reset, base, tokens, sections, blocks, utilities`; block CSS is wrapped in `@layer blocks`. Use tokens from `:root`, never raw colors or z-index numbers. `@media (width >= 768px)` syntax; breakpoints 768px and 1240px.
- **Worker** ([workers.md](docs/conventions/workers.md)): no visitor data in module scope; every `fetch` has a timeout and a defined failure response.
- **Tests** ([testing.md](docs/conventions/testing.md)): new behaviour gets a test; sanitizers and allowlists always do.

## Where things are

| Path | What |
|---|---|
| `blocks/{name}/` | Blocks, auto-loaded by `ak.js` when on a page |
| `scripts/ak.js` | Author-kit core loader (patched; see `AK-PATCHES.md`) |
| `scripts/scripts.js`, `lazy.js`, `postlcp.js`, `delayed.js` | Page orchestration by phase |
| `scripts/utils/` | Shared utilities |
| `scripts/experiment-loader.js`, `scripts/utils/experiments/` | Personalization and A/B glue for the vendored plugin |
| `styles/` | Global CSS and tokens |
| `workers/website/` | Cloudflare Worker (routing, CSP, redirects) |
| `experiments-panel/`, `widgets/`, `tools/` | Sidekick panel, larger stateful UI, authoring and lint tooling |
| `docs/` | Documentation |
