# Local development

## Prerequisites

| Need | Why |
|---|---|
| Node.js 22 or later | CI runs 22; `workers/website` requires `>=22` |
| Git access to `github.com/dallinbsmith/atreyu` | The code |
| [AEM CLI](https://github.com/adobe/helix-cli) (`npm install -g @adobe/aem-cli`) | `aem up` local server |
| A DA account with access to `dallinbsmith/atreyu` | Editing content; not needed to run the site locally |

## Set up

```sh
git clone https://github.com/dallinbsmith/atreyu.git
cd atreyu
npm install                              # also installs the pre-commit hook (core.hooksPath = .githooks)
npm ci --prefix workers/website          # only if you work on the Worker
```

The repository root is the site root; there is no `site/` subfolder in the clone.

## Run the site

```sh
aem up
```

Opens `http://localhost:3000`. Code is served from your working tree; content comes from the project's preview environment (DA content previewed on `aem.page`). Edits to JS and CSS reload in the browser.

- `env.js` classifies `localhost` as `dev`, so non-production tooling loads (Sidekick integration, content scheduler, `data-testid` audit).
- There is no Worker in front of `aem up`: no CSP, no redirects from `/redirects.json`, no `/v/` gating, no routing to the existing site. Test those with `wrangler dev` ([worker runbook](worker.md#local-development)).
- To see a page with new content, preview it in DA first.

Useful URL parameters on any non-production host:

| Parameter | Effect |
|---|---|
| `?experiment=<id>/<variant>` | Force a test variant |
| `?audience=<id>` | Simulate an audience (`mobile`, `desktop`, `campaign-<name>`) |
| `?dapreview` | DA live preview mode (authoring hosts only) |
| `?quick-edit` | DA Quick Edit (authoring hosts only) |

## Branch previews

Every pushed branch is live on EDS at `https://{branch}--atreyu--dallinbsmith.aem.page`, with the branch name lowercased and non-alphanumerics replaced by `-` (for example `feat/new-hero` → `feat-new-hero--atreyu--dallinbsmith.aem.page`). Use it to review a PR in a real browser, and share it with reviewers.

## Lint and test

```sh
npm run lint                                   # must pass before every commit
npm test                                       # full browser suite with coverage
npm run test:file -- test/blocks/hero.test.js  # one file
WTR_PORT=2002 npm test                         # if port 2000 is taken
node --test workers/website/test/*.test.js     # Worker tests
```

All commands and what CI runs: [conventions/testing.md](../conventions/testing.md).

## Before opening a PR

1. `npm run lint` and `npm test` pass.
2. Visual changes checked in a browser (local or the branch preview).
3. `scripts/AK-PATCHES.md` updated if you touched `scripts/ak.js`, `lazy.js` or `postlcp.js`.
4. DA Library example updated if you changed a block's authored shape.

Then follow [CONTRIBUTING.md](../../CONTRIBUTING.md).
