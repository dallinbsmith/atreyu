# Atreyu: Frame.io marketing site on AEM Edge Delivery Services

Atreyu is the migration of frame.io's marketing site from Next.js + Sanity + Vercel (the "existing site") to Adobe Edge Delivery Services (EDS). Content is authored in DA (da.live). A Cloudflare Worker in front of frame.io will move traffic to EDS one group of URLs at a time, so the two sites run side by side until the migration is done.

**Status: pre-production.** Nothing here serves frame.io traffic yet. Code and content run on `main--atreyu--dallinbsmith.aem.page` (preview) and `main--atreyu--dallinbsmith.aem.live` (published); content lives in a sandbox DA org (`dallinbsmith/atreyu`).

| Area | State |
|---|---|
| Foundation (code base, conventions, CI) | Built; a short hardening list remains |
| Locale | Code built and paused; no locale is live |
| Personalization and experimentation | Built; zero production reach until consent and the Worker are in place |
| Worker and routing | Built and tested; deployed to `workers.dev` only |
| Content migration | A handful of real pages; most landing pages are placeholders |

Details and what's next: [docs/status.md](docs/status.md).

## How it works

```
visitor ──► Cloudflare Worker (workers/website)
              │  path in a live routing cell? ──yes──► EDS  main--atreyu--dallinbsmith.aem.live
              │                                         (code: this repo, content: DA)
              └─ otherwise ───────────────────────────► existing site (LEGACY_ORIGIN)
```

- **No build step.** Vanilla ES modules and native CSS ship exactly as committed. Pushing a branch makes it live at `{branch}--atreyu--dallinbsmith.aem.page`.
- **Page engine:** Adobe's [author-kit](https://github.com/aemsites/author-kit) (`scripts/ak.js`), with every local change recorded in `scripts/AK-PATCHES.md`. Project hooks live in `scripts/scripts.js`.
- **Blocks:** authors build pages from tables in DA; each table maps to `blocks/{name}/{name}.js` + `.css`, loaded only when the page uses it.
- **Loading phases:** Eager (first section, LCP), Lazy (rest of page, header, footer), Delayed (analytics, 3 s later).

Full picture: [docs/architecture/overview.md](docs/architecture/overview.md).

## Quick start

```sh
git clone https://github.com/dallinbsmith/atreyu.git
cd atreyu
npm install                       # Node 22+; also installs the pre-commit hook
npm install -g @adobe/aem-cli     # once
aem up                            # http://localhost:3000, content from preview
```

Local development details: [docs/runbooks/local-development.md](docs/runbooks/local-development.md).

## Commands

| Command | What it does |
|---|---|
| `npm run lint` | ESLint, Stylelint, CSS-layer and comment checks. Must pass before every commit |
| `npm test` | Browser unit tests (Web Test Runner) with coverage |
| `npm run test:file -- <path>` | Run one test file or glob |
| `npm run test:eslint-rules` | Tests for the custom lint rules |
| `npm run test:config-sync` | Checks that browser and Worker config stay in sync |
| `node --test workers/website/test/*.test.js` | Worker tests (after `npm ci --prefix workers/website`) |

CI runs all of these on every PR as the required **Lint and Test** check. The full list is in [docs/conventions/testing.md](docs/conventions/testing.md).

## Repository layout

| Path | What's in it |
|---|---|
| `blocks/` | One folder per block (JS + CSS) |
| `scripts/` | Page engine (`ak.js`), project hooks, loading phases, shared `utils/`, vendored libraries |
| `styles/` | `styles.css` (critical tokens and base), `lazy-styles.css`, `fonts.css` |
| `plugins/experimentation/` | Vendored A/B and personalization plugin |
| `experiments-panel/` | Sidekick panel for creating tests and Personalize tables |
| `widgets/` | Stateful mini-apps that don't fit a block |
| `workers/website/` | Cloudflare Worker: routing, redirects, CSP |
| `tools/` | Lint rules, config-sync tests, locale extractor, Sidekick config (not served) |
| `test/` | Browser unit tests |
| `docs/` | All project documentation (not served) |

`.hlxignore` keeps `docs/`, `test/`, `tools/`, `workers/`, dotfiles and Markdown off the EDS hosts. Anything else you commit is publicly fetchable.

## Working on this repo

1. Branch from `main`; open a PR and fill in the PR template.
2. `npm run lint` and `npm test` pass locally; check visual changes in a browser on the branch preview URL.
3. Follow the [conventions](docs/conventions/README.md): arrow functions, `const` by default, design tokens instead of hard-coded values, blocks that tolerate re-decoration and clean up on their teardown signal.
4. If the change alters behaviour described in `docs/`, update the doc in the same PR.

Rules for branches, review and required checks: [CONTRIBUTING.md](CONTRIBUTING.md).

## Documentation

| | |
|---|---|
| [docs/README.md](docs/README.md) | Start here: access checklist, map of the docs, terms |
| [docs/status.md](docs/status.md) | What's built, in progress, blocked and planned |
| [docs/architecture/](docs/architecture/overview.md) | How the site, Worker, locales and personalization work |
| [docs/authoring/](docs/authoring/block-catalog.md) | DA content structure, block catalog, Section Metadata |
| [docs/conventions/](docs/conventions/README.md) | Coding rules for JS, CSS, blocks, the Worker, tests, accessibility |
| [docs/runbooks/](docs/runbooks/local-development.md) | Local dev, Worker deploy and rollback, releasing |
| [docs/decisions/](docs/decisions/README.md) | Decision records |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Branches, PRs, required checks, review |
| [AGENTS.md](AGENTS.md) | Instructions for AI coding agents |

Owner: Dallin Smith ([CODEOWNERS](.github/CODEOWNERS)).
