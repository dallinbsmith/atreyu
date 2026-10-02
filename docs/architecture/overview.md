# Architecture overview

The Frame.io marketing site is being migrated from Next.js + Sanity + Vercel to **Adobe Edge Delivery Services (EDS)** with **Document Authoring (DA, da.live)** as the content source. A **Cloudflare Worker** in front of the domain decides, per path, whether EDS or the existing site answers, so the migration can proceed section by section.

```
visitor ──► Cloudflare Worker (workers/website)
              │  path in a live routing cell? ──yes──► EDS origin  main--atreyu--dallinbsmith.aem.live
              │                                         (code: this repo, content: DA)
              └─ otherwise ───────────────────────────► existing site (LEGACY_ORIGIN)
```

The Worker is not yet in front of frame.io; see [status.md](../status.md).

## Pieces

| Piece | Where | Notes |
|---|---|---|
| Site code | This repository (git root). Pushing to a branch makes it live at `{branch}--atreyu--dallinbsmith.aem.page` | No build step: files ship as written |
| Content | DA: `content.da.live/dallinbsmith/atreyu/` (`fstab.yaml`) | Authored in da.live, previewed and published from there. See [authoring/](../authoring/da-content-structure.md) |
| Page engine | `scripts/ak.js` | Adobe's [author-kit](https://github.com/aemsites/author-kit) with recorded patches (`scripts/AK-PATCHES.md`) |
| Project hooks | `scripts/scripts.js` | Hostnames, locales, auto-blocks, `decorateArea`, experimentation |
| Blocks | `blocks/{name}/` | 53 blocks; see [block catalog](../authoring/block-catalog.md) |
| Edge Worker | `workers/website/` | Routing, redirects, CSP. See [worker.md](worker.md) |
| Personalization and A/B | `plugins/experimentation/` (vendored) + `scripts/experiment-loader.js` | See [personalization.md](personalization.md) |
| Experiments panel | `experiments-panel/` | Sidekick panel for creating tests and Personalize tables |
| Widgets | `widgets/` | Stateful mini-apps that don't fit a block (see `widgets/README.md`) |
| Tools | `tools/` | Lint rules, config-sync tests, locale extractor, Sidekick config. Not served |

`.hlxignore` keeps dotfiles, `*.md` (including all of `docs/`), `test/`, `tools/`, `workers/` and package files from being served by EDS. Anything else you commit is publicly fetchable from the EDS hosts.

## Hosts and environments

| Host | What it is | `env.js` value |
|---|---|---|
| `localhost:3000` | `aem up` local dev server | `dev` (host contains `local`) |
| `{branch}--atreyu--dallinbsmith.aem.page` | Preview: the branch's code with previewed content | `stage` (host contains `--`) |
| `main--atreyu--dallinbsmith.aem.live` | Live: `main` code with published content. The Worker's EDS origin | `stage` |
| `frame.io` | Production. Canonical host ([ADR-0005](../decisions/0005-canonical-host.md)); currently still served by the existing site | `prod` |

Code checks the environment only through `scripts/utils/env.js` (a lint rule blocks inline host checks). In `dev`/`stage`, `lazy.js` also loads the Sidekick integration, the content scheduler and the `data-testid` audit.

## Loading phases (E-L-D)

`head.html` loads `styles/styles.css`, `scripts/vendor/rum.js`, `scripts/ak.js` and `scripts/scripts.js`. From there:

1. **Eager** (`scripts.js` `loadPage()`):
   1. `setConfig()` with hostnames, locales, `linkBlocks`, `components` and the `decorateArea` hook.
   2. Start loading fonts.
   3. Probe for experiment signals; if present, import the loader/plugin and run experimentation before anything is decorated (see [personalization.md](personalization.md)).
   4. `await loadArea()`: decorate the document (header element, skip link, template), then load sections in order. Each section loads its blocks (its CSS loads in parallel with importing `blocks/{name}/{name}.js` and calling its default export) and its Section Metadata.
2. **Lazy**: after the first section, `ak.js` imports `postlcp.js` (loads the header block and lazy-phase behaviours). After all sections, it imports `lazy.js`: footer, `lazy-styles.css`, favicon, JSON-LD, hreflang, delegated click tracking.
3. **Delayed**: `lazy.js` imports `delayed.js` 3 seconds later: analytics (`segment.js`, only with analytics consent) and delayed behaviours.

Performance rules for each phase are in [conventions/javascript.md](../conventions/javascript.md#loading-phases-e-l-d).

## Authoring previews

`?dapreview` and `?quick-edit` load DA's live preview and Quick Edit. Both re-run `loadPage()`, which is why blocks must tolerate re-decoration ([block lifecycle](../conventions/javascript.md#block-lifecycle)). They are only honoured on authoring hosts (`isAuthoringPreviewAllowed` in `scripts/utils/security/preview-origin.js`), never on `frame.io`.

## Auto-blocks

`linkBlocks` in `scripts/scripts.js` turns plain links into blocks without author involvement:

| Link starts with / contains | Becomes |
|---|---|
| `/system/fragments/` | `fragment` block (inline fragment) |
| `/schedules/` | `schedule` block |
| `https://www.youtube` | `youtube` block |

## Further reading

- [worker.md](worker.md): routing, cohorts and cells, redirects, CSP.
- [locale.md](locale.md): locale prefixes, fragment fallback, placeholders, hreflang.
- [personalization.md](personalization.md): the one personalization engine as built.
- [decisions/](../decisions/README.md): why it is built this way.
