# Patches to the author-kit engine

`scripts/ak.js` is Adobe's author-kit engine with project changes mixed in. This file lists every
change we have made to it, and to the other author-kit files in `scripts/`. It was built from a
real `git diff`, not from memory.

## Base

| Item | Value |
| --- | --- |
| Upstream repo | `https://github.com/aemsites/author-kit` |
| Base commit | `a861e993cec63776d0a1fec1e8cd4442866bd53d` (2026-05-22, "Merge pull request #10 from aemsites/server-sm") |
| Our initial commit | `e0fc98d` (2026-05-29, "Initial commit") |
| Upstream HEAD compared | `625e178332cca5e5e7d7108ffeb5a93d65b20b39` (2026-09-25) |
| Line numbers | current `main` at `7cf3a9b` |

**How the base was established.** The whole tree of `e0fc98d` (`37fd0093…`) is byte-identical to
the tree of upstream `a861e99` and of its second parent `8c34bd3` ("feat: support HLX rendering
V2"). `a861e99` is the merge commit on upstream `main`, so it is the base. The blobs match too:
`ak.js` `07774fc`, `lazy.js` `8493711`, `scripts.js` `c53e76d`, `postlcp.js` `bece210`. There is
no diff between the base and our initial commit.

To regenerate the diffs:

```sh
git diff e0fc98d HEAD -- scripts/ak.js scripts/lazy.js scripts/postlcp.js scripts/scripts.js
```

## Classification

- **Upstream**: a generic bug fix or hardening that any author-kit site would want.
- **Convention**: specific to this project (Frame.io design, test IDs, repo layout, lint rules,
  experimentation, analytics).
- **Style**: no change in behavior. Listed so a reader of the raw diff knows it is safe to ignore.

"PR" means it is worth opening an upstream pull request.

## scripts/ak.js

| # | Change | Lines | Class | Why | PR |
| --- | --- | --- | --- | --- | --- |
| 1 | `ENV` import from `utils/env.js` | 15 | Convention | Needed only by change 2. Upstream already ships `utils/env.js`. | No (goes with 2) |
| 2 | `getConfig()` warns (outside prod) when read before `setConfig()` | 45-57 | Upstream | The lazy fallback returns a config with no `hostnames`, `locales`, `linkBlocks` or `components`, so an early reader throws. Load order makes this safe today; the warning makes a future regression loud. | Yes |
| 3 | `resolveModulePath()` helper for the block and section import path | 72-79, 86 | Convention | Named so `eslint.config.js:167` can register it as a trusted `no-unsanitized` escape method. | No |
| 4 | `loadExperience()` rewritten as a promise chain, `mod.default(el)` | 81-94 | Style | Same behavior: errors still go to `log(ex, el)`. This is the call site B1 changes. | No |
| 5 | `blockStatus` re-run guard in `loadBlock()` (`loading`, then `loaded`) | 107-109, 124 | Upstream | DA Quick Edit reruns `loadPage()` then `loadArea()` on the live DOM, so every block's `default(el)` ran a second time. Quick Edit is an upstream tool, so upstream has the same bug. The code comment says the guard was "dropped in this fork"; that's wrong, because author-kit never had it (it comes from aem-boilerplate). | Yes |
| 6 | `data-variant` mirror of the variant classes | 118 | Convention | A stable selector for tests and analytics, so a CSS class rename can't break it. | No |
| 7 | `decoratePictures()` `data-grid-source` guard | 149-151 | Upstream | On a re-run, the prepended `<source>` was cloned again, adding one duplicate per run. Upstream fixed a similar problem another way in `16f193e` (`picture:has([loading])`); reconcile the two before opening a PR. | Yes (after reconciling) |
| 8 | `MQ_GRID_CAP` import used as the grid `<source>` media query | 14, 157 | Convention | Project breakpoint token, `(width >= 1440px)`, from `utils/breakpoints.js`. It matches the base value; upstream has since moved to `1400px` (`a7a0455`). | No |
| 9 | Button roles, with `***bold italic***` renamed from `btn-accent` to `btn-glass` | 185-197 | Convention | Frame.io's button schemes; the role name drives both the class and the test ID. **Not in the plan:** this is a class rename. `styles/styles.css:420` still styles `.btn-accent`, and a few block tests build `btn-accent` by hand, but `ak.js` no longer emits it. | No |
| 10 | Button `data-testid` (`{block}-cta-{role}[-outline]`) | 206-214 | Convention | Primary test and analytics selector. Only set inside a real block. | No |
| 11 | Underline button: `link.innerHTML = isUnder.innerHTML` becomes `link.append(...isUnder.childNodes)` | 200 | Upstream | Removes an `innerHTML` sink and keeps the original nodes. **Not in the plan.** | Yes |
| 12 | `replaceChild` becomes `replaceWith` | 204 | Style | Same effect; the parent is already checked. | No |
| 13 | External links get `rel="noopener noreferrer"` | 259 | Upstream | Generic hardening. It overwrites any `rel` already set. **Not in the plan.** | Yes |
| 14 | `tagBehavior(a)` in `decorateLink()` | 13, 266 | Convention | Stamps `data-behavior` and `data-phase` from the project's behavior registry (`scripts/behaviors.js`). | No |
| 15 | `.catch(log)` on dynamic imports: template CSS, icons, `postlcp.js` | 139, 295, 520 | Upstream | Stops unhandled rejections and routes them to `config.log`. **Not in the plan.** | Yes |
| 16 | Icons import path `utils/icons.js` becomes `utils/media/icons.js` | 293 | Convention | Repo layout. Upstream renamed its file to `utils/svg.js` in `a8031ed`. | No |
| 17 | `slugifyUnique(text, root = document)` exported | 354-366 | Convention | Section anchors and `header-subcategories.js`. `root` lets detached fragment subtrees de-dupe ids against each other. | No |
| 18 | Section-metadata `anchor` key becomes `section.id` | 396-400 | Convention | Deep links and jump nav. C4 moves this out of `ak.js`. | No |
| 19 | Dataset key normalization (`toClassName` then camelCase) | 401-407 | Upstream | A multi-word key such as "Experiment Variants" threw `InvalidCharacterError` and stopped decoration of every later section. | No (upstream deleted this code in `345f6ea`) |
| 20 | `sectionStatus` re-run guard in `decorateSections()` | 419-434 | Upstream | Without it, `groupChildren()` wraps an already-wrapped section again on every re-run. | Yes (with 5) |
| 21 | `decorateLinks()` and the block list re-run on every pass, including guarded sections | 435-441 | Upstream | Picks up content added to an already-decorated section during Quick Edit. Relies on `decorateLink()` being idempotent. | Yes (with 5 and 20) |
| 22 | `decorateSkipToContent()`, with a re-run guard, called from `decorateDoc()` | 468-480, 484 | Convention | Accessibility. **The whole function is ours**, not just the guard: upstream has no skip link. It uses a hard-coded English label. | No |
| 23 | `import('./lazy.js')` now calls `mod.default()` | 521-535 | Upstream | A repeat `import()` resolves from cache without re-running top-level code, so footer and pzn never re-decorated on a second `loadArea()`. Goes with the `lazy.js` default export below. Upstream has the same bug for its footer. | Yes (with lazy.js L3) |
| 24 | Arrow functions, `?.`, `.at(0)`, `loadStyle()` via `Promise.withResolvers()`, `map/filter` in `decorateLinks()`, early returns in `decorateSection()`, upstream comments deleted | throughout | Style | House lint style (`prefer-arrow-functions`). `loadStyle()` now resolves `null` right away when the link already exists; callers still get a promise. | No |

Plan line references checked against the diff: `:55`, `:107-110`, `:118`, `:142-157`, `:186-213`,
`:354`, `:396`, `:428` and `:527-535` all match. `:405` is the comment; the code is at `:406-407`.

## scripts/lazy.js

| # | Change | Lines | Class | Why | PR |
| --- | --- | --- | --- | --- | --- |
| L1 | Imports `getConfig`, `loadStyle` and `runExperimentationLazy` | 3-4 | Convention | Supports L3 and L4. | No |
| L2 | Sidekick path `../tools/sidekick/` becomes `./sidekick/`, plus `.catch` | 12-16 | Convention | Repo layout. | No |
| L3 | New re-runnable default export: footer, experimentation panel, pzn and pzn-audit (not prod) | 35-63 | Mixed | Re-running the footer is an upstream fix (goes with ak.js 23). Experimentation and pzn are project code; pzn is removed in C1. | Footer part only |
| L4 | One-shot IIFE adds `lazy-styles.css`, JSON-LD, hreflang, canonical, delegated click, `delayed.js` after 3 s, and `testid-audit` and `pzn-audit` (not prod) | 65-94 | Convention | SEO, analytics and dev audits. SEO stays one-shot because `jsonld.js` only appends. | No |
| L5 | Utility paths move to `utils/page/` and `utils/seo/`; scheduler moves to `./scheduler/` | 69-73, 79 | Convention | Repo layout. | No |

## scripts/postlcp.js

| # | Change | Lines | Class | Why | PR |
| --- | --- | --- | --- | --- | --- |
| P1 | `runBehaviors('lazy')` before the header loads | 2, 5 | Convention | Runs the behavior registry's lazy phase. | No |
| P2 | Arrow default export | 4-8 | Style | House lint style. | No |

## scripts/scripts.js

This is author-kit's intended project configuration file, so most changes are expected.

| # | Change | Lines | Class | Why | PR |
| --- | --- | --- | --- | --- | --- |
| S1 | `hostnames` set to `frame.io`; `locales` from `scripts/locales.js` | 5, 12 | Convention | Site configuration; one source for the locale list. | No |
| S2 | Fragment `linkBlocks` path `/fragments/` becomes `/system/fragments/` | 14-18 | Convention | Content structure. | No |
| S3 | `loadFonts()` with a `fonts-loaded` session flag and `prefers-reduced-data` | 33-41, 45 | Convention | Font loading strategy. | No |
| S4 | `await runExperimentation()` before `loadArea()` | 4, 46 | Convention | Experimentation plugin. | No |
| S5 | `loadAuthoringPreviews()`: gated by `isAuthoringPreviewAllowed(host)`, has an injectable importer, and moves paths from `../tools/` to `./` | 51-72 | Mixed | The host gate is generic hardening (don't load `dapreview` or Quick Edit on arbitrary hosts). The importer and paths are project-specific. | Host gate only |

## Counts

Counts are rows in the tables above.

| Class | ak.js | lazy.js | postlcp.js | scripts.js | Total |
| --- | --- | --- | --- | --- | --- |
| Upstream | 10 | 0 | 0 | 0 | 10 |
| Convention | 11 | 4 | 1 | 4 | 20 |
| Mixed | 0 | 1 | 0 | 1 | 2 |
| Style | 3 | 0 | 1 | 0 | 4 |

## Upstream fixes we don't have

These are from `a861e99..625e178` on upstream `main`.

| Upstream commit | Change | Status here | Action |
| --- | --- | --- | --- |
| `9fe4d70`, `a7a0455` | `getLocale()` falls back to root for an unknown prefix instead of throwing; sets `dir` from the locale | Missing. `ak.js:29` still reads `locales[prefix].lang`, so unknown `locale` metadata throws inside `setConfig()` and blanks the page. | Take it (a sanctioned `ak.js` patch). Add `dir` when an RTL locale arrives. |
| `a7a0455` | `decorateLink()` catch calls `config.log(ex, a)` instead of `config.log('Could not decorate link', ex)` | Missing. `ak.js:278` passes a string as `ex` and the exception as `el`, so `error.js` masks the real failure. | Take it. |
| `16f193e`, `a7a0455` | `decoratePictures()` only handles `picture:has([loading])`; grid source at `1400px` | Partly covered. Our guard (ak.js 7) handles re-runs; our breakpoint is the `MQ_GRID_CAP` token. | Consider the `:has([loading])` filter. Keep our breakpoint. |
| `345f6ea` | Deletes the legacy section-metadata table parsing from `decorateSection()` (and `toClassName`), because Edge Delivery now flattens section metadata server-side | Not taken. Changes 18, 19 and B2 all live in that code. | Before B2, check the rendered HTML of a page with authored Section Metadata. If it arrives flattened, B2's `ak.js` part and the `anchor` key need a new home. |
| `b673ff3` | `import('../deps/rum.js')` after the first section | Not needed. `head.html:6` loads `scripts/vendor/rum.js`. | None. |
| `a8031ed` | `utils/icons.js` becomes `utils/svg.js` (`<use href="#icon">` contract) | Not taken. We have `utils/media/icons.js`. | Review separately; not an `ak.js` concern. |
| `9c10caa` | Trusted Types default policy at the top of `scripts.js` | Not taken. No CSP here sets `require-trusted-types-for`. | Only needed if the CSP adds that directive. |

## Sanctioned future patches

These patches to `ak.js` are approved in the foundation hardening plan. Each one must add a row to
the `ak.js` table above in the same PR.

| Plan step | Patch | Where | Class |
| --- | --- | --- | --- |
| B1 | Block teardown signal: an iterable `Map<Element, AbortController>`. `loadExperience()` passes `mod.default(el, { signal })`. `teardownDetached()` sweeps disconnected entries (skipping detached `.fragment-content` roots) at the start of each document-level `loadArea()`. | `loadExperience()` at 81-94, `loadArea()` at 494 | Convention (could go upstream later) |
| B2 | Stop lowercasing section-metadata values. `style` still uses `toClassName`, `anchor` is still slugified, and consumers normalize. Also skip plugin-owned keys (`experiment`, `variant`, `audience`) when writing the dataset. | `decorateSection()` at 377 and 407 | Upstream-type fix, but see `345f6ea` above |
| (from upstream) | `getLocale()` fallback and the `decorateLink()` log argument order | 25-31, 278 | Upstream (already fixed there) |

## Rule going forward

1. **New project conventions go in `scripts.js` hooks, not in `ak.js`.** Use `decorateArea`, or add
   a new hook that `ak.js` calls through `getConfig()`. `ak.js` should only change for generic bug
   fixes, or for a patch listed under "Sanctioned future patches".
2. **Anyone editing `ak.js` must update this file in the same PR:** add or change the row, fix the
   line references, and set the classification.
3. **Upstream-class rows are candidates to send upstream.** Once upstream merges one, remove our
   copy on the next sync and delete the row.
4. C4 moves the existing conventions (button roles, test IDs, section `anchor`) out of `ak.js` into
   hooks.
