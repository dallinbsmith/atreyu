# Patches to the author-kit engine

`scripts/ak.js` is Adobe's author-kit engine with project changes mixed in. This file lists every
change we have made to the four author-kit engine files: `scripts/ak.js`, `scripts/lazy.js`,
`scripts/postlcp.js` and `scripts/scripts.js`. Other files that came from author-kit (blocks,
tools, utilities) are out of scope. It was built from a real `git diff`, not from memory.

Rows are keyed by function name, not line number, so they survive edits to `ak.js`.

## Base

| Item | Value |
| --- | --- |
| Upstream repo | `https://github.com/aemsites/author-kit` |
| Base commit | `a861e993cec63776d0a1fec1e8cd4442866bd53d` (2026-05-22, "Merge pull request #10 from aemsites/server-sm") |
| Our initial commit | `e0fc98d` (2026-05-29, "Initial commit") |
| Upstream HEAD compared | `625e178332cca5e5e7d7108ffeb5a93d65b20b39` (2026-09-25) |

**How the base was established.** The whole tree of `e0fc98d` (`37fd0093…`) is byte-identical to
the tree of upstream `a861e99` and of its second parent `8c34bd3` ("feat: support HLX rendering
V2"). `a861e99` is the merge commit on upstream `main`, so it is the base. The blobs match too:
`ak.js` `07774fc`, `lazy.js` `8493711`, `scripts.js` `c53e76d`, `postlcp.js` `bece210`. There is
no diff between the base and our initial commit.

To regenerate the diffs:

```sh
git diff e0fc98d HEAD -- scripts/ak.js scripts/lazy.js scripts/postlcp.js scripts/scripts.js
```

## Compared at 7cf3a9b

Line numbers appear only in this section and are valid only at `7cf3a9b`. The line references in
the foundation hardening plan (B7) were checked against the diff: `:55`, `:107-110`, `:118`,
`:142-157`, `:186-213`, `:354`, `:396` and `:428` match. Dataset key normalization is at
`:406-407` (`:405` is its comment). The `lazy.js` `mod.default()` call is at `:523-535`.

## Classification

- **Upstream**: a generic bug fix or hardening that any author-kit site would want.
- **Convention**: specific to this project (Frame.io design, test IDs, repo layout, lint rules,
  experimentation, analytics).
- **Style**: no change in behavior. Listed so a reader of the raw diff knows it is safe to ignore.

"PR" means it is worth opening an upstream pull request.

## scripts/ak.js

| # | Function | Change | Class | Why | PR |
| --- | --- | --- | --- | --- | --- |
| 1 | module imports | `ENV` import from `utils/env.js` | Convention | Needed only by change 2. Upstream already ships `utils/env.js`. | No (goes with 2) |
| 2 | `getConfig` | Warns (outside prod) when read before `setConfig()` | Upstream | The lazy fallback returns a config with no `hostnames`, `locales`, `linkBlocks` or `components`, so an early reader throws. Load order makes this safe today; the warning makes a future regression loud. | Yes |
| 3 | `resolveModulePath` (new), `loadExperience` | Helper builds the block or section import path | Convention | Named so `eslint.config.js` can register it as a trusted `no-unsanitized` escape method. | No |
| 4 | `loadExperience` | Rewritten as a promise chain calling `mod.default(el)` | Style | Same behavior: errors still go to `log(ex, el)`. B1 (row 25) now passes a second argument here. | No |
| 5 | `loadBlock` | `data-block-status` re-run guard (`loading`, then `loaded`) | Upstream | DA Quick Edit reruns `loadPage()` then `loadArea()` on the live DOM, so every block's `default(el)` ran a second time. Quick Edit is an upstream tool, so upstream has the same bug. The code comment says the guard was "dropped in this fork"; that's wrong, because author-kit never had it (it comes from aem-boilerplate). | Yes |
| 6 | `loadBlock` | `data-variant` mirror of the variant classes | Convention | A stable selector for tests and analytics, so a CSS class rename can't break it. | No |
| 7 | `decoratePictures` | `data-grid-source` re-run guard, and a null check on `<source>` | Upstream | On a re-run, the prepended `<source>` was cloned again, adding one duplicate per run. The base also threw a `TypeError` on a `<picture>` with no `<source>`, which rejected `loadArea`; our `querySelector('source')` check skips those pictures instead. Upstream's `picture:has([loading])` filter (`16f193e`) has a different purpose ("do not add a new breakpoint if already loading") and does not stop re-run duplicates, because the `<img>` keeps its `loading` attribute. | Yes |
| 8 | `decoratePictures`, module imports | `MQ_GRID_CAP` import used as the grid `<source>` media query | Convention | Project breakpoint token, `(width >= 1440px)`, from `utils/breakpoints.js`. It matches the base value; upstream has since moved to `1400px` (`16f193e`). | No |
| 9 | `decorateButton` | Button roles, with `***bold italic***` renamed from `btn-accent` to `btn-glass` | Convention | Frame.io's button schemes; the role name drives both the class and the test ID. This is a class rename: `styles/styles.css` still styles `.btn-accent`, and a few block tests build `btn-accent` by hand, but `ak.js` no longer emits it. | No |
| 10 | `decorateButton` | `data-testid` (`{block}-cta-{role}[-outline]`) | Convention | Primary test and analytics selector. Only set inside a real block. | No |
| 11 | `decorateButton` | Underline button: `link.innerHTML = isUnder.innerHTML` becomes `link.append(...isUnder.childNodes)` | Upstream | Removes an `innerHTML` sink and keeps the original nodes. **Known issue, fix before any upstream PR:** it reorders content. `<a><u>Buy</u> now</a>` becomes " nowBuy", because the `<u>` children are appended after the text that follows it. `isUnder.replaceWith(...isUnder.childNodes)` preserves the order. Not changed in the PR that added this file. | Yes (after the fix) |
| 12 | `decorateButton` | `replaceChild` becomes `replaceWith` | Style | Same effect; the parent is already checked. | No |
| 13 | `decorateLink` | External links get `rel="noopener noreferrer"` | Upstream | Generic hardening. It overwrites any `rel` already set. | Yes |
| 14 | `decorateLink`, module imports | `tagBehavior(a)` from `scripts/behaviors.js` | Convention | Stamps `data-behavior` and `data-phase` from the project's behavior registry. | No |
| 15 | `loadTemplate`, `loadIcons`, `loadArea` | `.catch(log)` on the template CSS, icons and `postlcp.js` imports | Upstream | Stops unhandled rejections and routes them to `config.log`. | Yes |
| 16 | `loadIcons` | Import path `utils/icons.js` becomes `utils/media/icons.js` | Convention | Repo layout. Upstream renamed its file to `utils/svg.js` in `a8031ed`. | No |
| 17 | `slugifyUnique` (new export) | `slugifyUnique(text, root = document)` | Convention | Section anchors (row 18 and `scripts.js` S7) and `header-subcategories.js`. `root` lets detached fragment subtrees de-dupe ids against each other. | No |
| 18 | `decorateSection` | Section-metadata `anchor` key becomes a de-duplicated `section.id`, unless the section already has an `id` (B2) | Convention | Deep links and jump nav, for client-built and raw DA tables. Server-flattened pages arrive with `data-anchor` instead and are handled by `scripts.js` S7: both de-duplicate against the section's root node (`section.getRootNode()`) and let an existing `id` win. One value-source difference remains: the server gives a linked cell's `href` as the value, while this parser reads the cell's `textContent`. C4 moves this out of `ak.js`. | No |
| 19 | `decorateSection` | Key normalization. Was `toClassName` then camelCase into `dataset`; since B2 it is the server's `toMetaName`, written with `setAttribute` (row 26) | Upstream | A multi-word key such as "Experiment Variants" threw `InvalidCharacterError` and stopped decoration of every later section. `toMetaName` output is always a valid attribute name after `data-`. | No (upstream deleted this code in `345f6ea`) |
| 20 | `decorateSections` | `data-section-status` re-run guard | Upstream | Without it, `groupChildren()` wraps an already-wrapped section again on every re-run. | Yes (with 5) |
| 21 | `decorateSections` | `decorateLinks()` and the block list re-run on every pass, including guarded sections | Upstream | Picks up content added to an already-decorated section during Quick Edit. Relies on `decorateLink()` being idempotent. | Yes (with 5 and 20) |
| 22 | `decorateSkipToContent` (new), `decorateDoc` | Skip link, with a re-run guard | Convention | Accessibility. The whole function is ours, not just the guard. Upstream's `ak.js` has none; upstream's header block has `decorateSkipLink` with an authorable label (`fc08e37`). Reconcile if we ever sync the header, or we'll ship two skip links. Ours hardcodes the English label. | No |
| 23 | `loadArea` | `import('./lazy.js')` now calls `mod.default()` | Upstream | A repeat `import()` resolves from cache without re-running top-level code, so footer and pzn never re-decorated on a second `loadArea()`. Goes with the `lazy.js` default export below. Upstream has the same bug for its footer. | Yes (with lazy.js L3) |
| 24 | throughout | Arrow functions, `?.`, `.at(0)`, `getMetadata` returning `undefined` instead of `null` for a missing tag, `loadStyle` via `Promise.withResolvers()`, `map`/`filter` in `decorateLinks`, early returns in `decorateSection`, upstream comments deleted | Style | House lint style (`prefer-arrow-functions`). `loadStyle` still resolves immediately when the link already exists, as the base did (`null` now, `undefined` before; no caller reads the value). No caller compares `getMetadata` to `null`. | No |
| 25 | `teardownDetached` (new), `signalFor` (new), `loadExperience`, `loadArea` | Block teardown signal (plan B1). A module-scope `Map<Element, AbortController>`; `loadExperience` registers the controller *before* the block's `import()`, then calls `mod.default(el, { signal })`, reusing the element's controller if it has one. Registering first closes a race: registering inside the import's `.then` gave a block swapped out mid-import a fresh live signal that no sweep had seen. The flip side is that a block can now receive an already-aborted signal. `teardownDetached()` aborts and deletes every entry whose element is disconnected, except when the element's root node is a `.fragment-content` (a fragment `loadFragment()` has returned but its caller has not inserted yet). Every `loadArea` call sweeps first, document-level or not, so Quick Edit, dapreview, plugin swaps (`decorateFunction`), `experimentation.js`'s `replaceChildren` swap and `loadFragment` are all covered without a list of call sites. Sweeping inside `loadFragment`'s own `loadArea` is safe because uninserted fragments are skipped. Connected blocks are never aborted. The abort happens at the next `loadArea()` sweep, not when the element is removed; if no later `loadArea` runs, it never happens. Not exported. | Convention | EDS gives blocks no teardown hook. Quick Edit, dapreview, plugin and experimentation swaps replace nodes, so the only reliable trigger is the element leaving the document. A WeakMap can't be swept. Backward compatible: every block default takes one parameter. Known gap, two shapes, both skipped by the sweep forever: (1) a `.fragment-content` that was inserted and later becomes the top of a discarded subtree (a plugin swap of `header`, `footer`, or the parent of a multi-section fragment); (2) a fragment that `loadFragment` returned but that was never inserted because its caller threw (for example `header.js` `decorateHeaderContent` rejecting). Accepted: that leak is exactly the behavior before B1, not a regression. `experimentation.js` is unaffected for the current `.main-nav-section` / `.footer-content` targets; a selector of `header`/`footer` hits the known gap. | Later, if upstream wants a teardown contract |
| 26 | `decorateSection`, `toMetaName` (new), `toSectionId` (new), `textParts` (new), `metaTokens` (new), `toClassName` (now exported) | Client section-metadata parser follows the server's rules (plan B2), copied from helix-html-pipeline `48f4301` (`steps/extract-section-metadata.js`, `utils/modifiers.js` `toMetaName`, `steps/utils.js` `toSectionId`). Keys: `toMetaName` (each character outside `[0-9a-zA-Z:_-]` becomes `-`, then lowercase, with the `hreflang` prefix rule), so `Campaign: Launch` becomes `data-campaign:-launch`. Values: kept as authored: image `src` and link `href` (absolute) and comma-split, trimmed text, in document order, joined with `,`. `style`: every text node split on `,`, then `toClassName`, empty names dropped (a trailing comma used to throw). `id`: `toSectionId`, not de-duplicated. `anchor`: row 18. Differences kept on purpose: the key cell is trimmed; `style` doesn't apply `toBlockCSSClassNames`' parenthesis split; relative URLs resolve against the document, not `prodHost`; `id` and `anchor` read the cell's `textContent`, where the server would use a linked cell's `href`. `toClassName` is exported so `blocks/section-metadata` classifies values with the same function. | Convention | Scope: section-metadata tables our own code builds in the browser (`personalize.js` Audience rows, `guard.js` `carryOverSectionMeta`) and raw DA markup (Quick Edit, dapreview). Authored pages are flattened on the server and never reach this parser. One rule set means both paths give the same DOM, apart from the differences listed above. Values that were compared lowercase (layout values, colour tokens, pzn placement) are now normalised where they're read; those consumers are fixed here. **No plugin-owned key guard here:** the server writes `data-variant`/`data-audience` before any JS runs, so an `ak.js` guard can't protect them. It is an authoring rule (`tools/sidekick/blocks.md`, Section Metadata) plus an Experiments panel warning (`experiments-panel/sources.js` `sectionKeyIssues`). | No (upstream has no client parser) |

## scripts/lazy.js

| # | Function | Change | Class | Why | PR |
| --- | --- | --- | --- | --- | --- |
| L1 | module imports | Imports `getConfig`, `loadStyle` and `runExperimentationLazy` | Convention | Supports L3 and L4. | No |
| L2 | `loadSidekick` | Path `../tools/sidekick/` becomes `./sidekick/`, plus `.catch` | Convention | Repo layout. | No |
| L3 | default export (new) | Re-runnable: footer, experimentation panel and pzn (not prod) | Mixed | Re-running the footer is an upstream fix (goes with ak.js 23). Experimentation and pzn are project code; pzn is removed in C1. The pzn-audit experiment-collision check was removed in B4 (A2 = iii): with no chrome-scoped experiment left, nothing can collide. | Footer part only |
| L4 | bootstrap IIFE | Adds `lazy-styles.css`, JSON-LD, hreflang, canonical, delegated click, `delayed.js` after 3 s, and `testid-audit` and `pzn-audit` (not prod) | Convention | SEO, analytics and dev audits. SEO stays one-shot because `jsonld.js` only appends. | No |
| L5 | bootstrap IIFE | Utility paths move to `utils/page/` and `utils/seo/`; scheduler moves to `./scheduler/` | Convention | Repo layout. | No |
| L6 | `loadSidekick`, bootstrap IIFE | `async function` and the named `(function loadLazy() {…}())` IIFE become arrow functions | Style | House lint style. | No |

## scripts/postlcp.js

| # | Function | Change | Class | Why | PR |
| --- | --- | --- | --- | --- | --- |
| P1 | default export | `runBehaviors('lazy')` before the header loads | Convention | Runs the behavior registry's lazy phase. | No |
| P2 | default export | Arrow function | Style | House lint style. | No |

## scripts/scripts.js

This is author-kit's intended project configuration file, so most changes are expected.

| # | Function | Change | Class | Why | PR |
| --- | --- | --- | --- | --- | --- |
| S1 | `hostnames`, `locales` | `hostnames` set to `frame.io`; `locales` from `scripts/locales.js` | Convention | Site configuration; one source for the locale list. | No |
| S2 | `linkBlocks` | Fragment path `/fragments/` becomes `/system/fragments/` | Convention | Content structure. | No |
| S3 | `loadFonts` (new), `loadPage` | Font CSS with a `fonts-loaded` session flag and `prefers-reduced-data` | Convention | Font loading strategy. | No |
| S4 | `loadPage` | `await runExperimentation()` before `loadArea()` | Convention | Experimentation plugin. | No |
| S5 | `loadAuthoringPreviews` (was the `da` IIFE) | Gated by `isAuthoringPreviewAllowed(host)`, has an injectable importer, and moves paths from `../tools/` to `./` | Mixed | The host gate is generic hardening (don't load `dapreview` or Quick Edit on arbitrary hosts). The importer and paths are project-specific. | Host gate only |
| S6 | `loadPage`, top level | `async function loadPage` becomes an arrow export; upstream's comments ("Blocks with self-managed styles", "How to decorate an area before loading it") deleted | Style | House lint style. | No |
| S7 | `promoteAnchors` (new), `decorateArea` | Server-flattened `data-anchor` becomes a de-duplicated slug `id` (via `slugifyUnique`, rooted at the section's root node) unless the section already has an `id`; `data-anchor` is removed. Runs in `decorateArea`, before `ak.js` decorates sections. Same selector as `decorateSections` (`main > div` or `:scope > div`). | Convention | Plan B2: keeps the authored `Anchor` key working now that EDS flattens section metadata on the server. Rule 1 below: a project convention in a `scripts.js` hook, not in `ak.js`. | No |

## Upstream fixes we don't have

These are from `a861e99..625e178` on upstream `main`.

| Upstream commit | Function | Change | Status here | Action |
| --- | --- | --- | --- | --- |
| `9fe4d70` | `getLocale` | Falls back to root for an unknown prefix instead of throwing | Missing. We still read `locales[prefix].lang`, so unknown `locale` metadata throws inside `setConfig()` and blanks the page. | Sanctioned patch; take upstream's code verbatim. |
| `16f193e` (reworked in `9fe4d70`) | `getLocale` | Sets `document.documentElement.dir` from the locale | Missing. No locale here sets `dir` yet. | Comes with the `9fe4d70` code above. |
| `9fe4d70` | `decorateLink` | The catch calls `config.log(ex, a)`. (`a7a0455` had only changed it to `config.log(ex)`.) | Missing. We still call `config.log('Could not decorate link', ex)`, which passes a string as `ex` and the exception as `el`, so `error.js` masks the real failure. | Sanctioned patch; take upstream's code verbatim. |
| `16f193e` | `decoratePictures` | Only handles `picture:has([loading])` ("do not add a new breakpoint if already loading"); grid source at `1400px` | Not taken. Our breakpoint is the `MQ_GRID_CAP` token. | Optional. Our `<source>` null check already covers the crash case; the filter doesn't replace our guard. |
| `345f6ea` | `decorateSection`, `toClassName` | Deletes the client-side `.section-metadata` parsing and `toClassName`. Edge Delivery now flattens section metadata on the server (helix-html-pipeline `extract-section-metadata.js`, for rendering version 2 or later, or sites created on or after 2026-05-01): keys go through `toMetaName` into `data-*`, values are not lowercased, `style` becomes classes, an `id` key sets `section.id`, and the metadata div is removed. | **Do not take.** Our own code builds `.section-metadata` divs in the browser, after the server has run: `utils/experiments/personalize.js` (Audience rows) and `carryOverSectionMeta` in `utils/experiments/guard.js`, which re-adds style and anchor rows after swaps. `decorateSection` in `ak.js` is the only thing that parses and removes those. | Keep our parser. B2 matched it to the server's rules (row 26). |
| `b673ff3` | `loadArea` | `import('../deps/rum.js')` after the first section | Not needed. `head.html` loads `scripts/vendor/rum.js`. | None. |
| `a8031ed` | `loadIcons` | `utils/icons.js` becomes `utils/svg.js` (`<use href="#icon">` contract) | Not taken. We have `utils/media/icons.js`. | Review separately; not an `ak.js` concern. |
| `2fa4b67` (PR #11) | `tools/quick-edit` | Origin allowlist before importing the Quick Edit module (a DOM-XSS fix) | Covered by our `resolvePreviewOrigin` / `isAuthoringPreviewAllowed` (`scripts/quick-edit/quick-edit.js`, `init`). | None, but compare it on any Quick Edit sync. |
| `9c10caa` | `scripts.js` top level | Trusted Types default policy | Not taken. No CSP here sets `require-trusted-types-for`. | Only needed if the CSP adds that directive. |

## Sanctioned future patches

These patches to `ak.js` are approved in the foundation hardening plan. Each one must add a row to
the `ak.js` table above in the same PR.

| Plan step | Function | Patch | Class |
| --- | --- | --- | --- |
| (from upstream) | `getLocale`, `decorateLink` | Unknown-prefix fallback with `dir`, and the `config.log(ex, a)` argument order. **Take upstream's code verbatim from `9fe4d70`; don't write our own.** | Upstream (already fixed there) |

## Rule going forward

1. **New project conventions go in `scripts.js` hooks, not in `ak.js`.** Use `decorateArea`, or add
   a new hook that `ak.js` calls through `getConfig()`. `ak.js` should only change for generic bug
   fixes, or for a patch listed under "Sanctioned future patches".
2. **Anyone editing `scripts/ak.js`, `scripts/lazy.js` or `scripts/postlcp.js` must update this
   file in the same PR:** add or change the row and set the classification. CI fails a pull request
   that changes any of those three files without changing this one. `scripts/scripts.js` is project
   configuration, so CI doesn't check it; still add a row for any change to its author-kit code.
3. **Upstream-class rows are candidates to send upstream.** Once upstream merges one, remove our
   copy on the next sync and delete the row. A **sync** means rerunning the diff against upstream
   HEAD, updating the rows, and updating "Upstream HEAD compared" in the Base table.
4. C4 moves the existing conventions (button roles, test IDs, section `anchor`) out of `ak.js` into
   hooks.
