# JavaScript conventions

Applies to `scripts/**`, `blocks/**`, `experiments-panel/**` and `tools/**`. Block-specific rules are in [blocks.md](blocks.md); Worker rules are in [workers.md](workers.md).

There is no build step, bundler or minifier. Every file ships to the browser as written, as native ES modules over HTTP/2. That is why the rules below favour small files, explicit `.js` import extensions and no framework.

## Language

ESLint enforces most of this (`eslint.config.js`, `ecmaVersion: 2025`, ESM only).

| Rule | Enforced by |
|---|---|
| Arrow functions only: `const fn = () => {}`, `export default (el) => {}`. No `function` keyword. | `prefer-arrow-functions`, `func-style: expression`, `prefer-arrow-callback` |
| Omit braces and `return` for single-expression arrows | `arrow-body-style: as-needed` |
| Single-level ternaries only | `no-nested-ternary` |
| No `for...in`. Use `Object.keys/values/entries` with `for...of`, or array methods | `no-restricted-syntax` |
| Prefer `.find()`, `.some()`, `.at(-1)`/`findLast()` over manual loops | `unicorn/prefer-array-find`, `prefer-array-some`, `no-for-loop`, `prefer-array-last-methods` |
| `querySelector`, `addEventListener`, `.after()`/`.replaceWith()` over older DOM APIs | `unicorn/prefer-query-selector`, `prefer-add-event-listener`, `prefer-modern-dom-apis` |
| Every promise chain has a `.catch()`; use `getConfig().log` as the handler | `eslint-plugin-promise` (recommended, minus `param-names`) |
| No `innerHTML`/`outerHTML`/`insertAdjacentHTML` with dynamic input; dynamic `import()` only through a registered resolver | `no-unsanitized` (see [Security](#security)) |
| Cyclomatic complexity ≤ 20, cognitive complexity ≤ 15 | `complexity`, `sonarjs/cognitive-complexity` |
| 2-space indent, `object-curly-newline` at 6+ properties, max 2 statements per line | `indent`, `object-curly-newline`, `max-statements-per-line` |
| `no-param-reassign` allows property mutation (`el.classList.add()`), not reassigning the parameter | `no-param-reassign` with `props: false` |

Not enforced, but expected in review:

- `const` by default, `let` only when reassigned.
- Early returns over nested `if/else`.
- ES2025 built-ins where they fit: `Promise.withResolvers()`, `Object.groupBy()`, `structuredClone()`, `?.`, `??`, `??=`, `||=`.
- `Map`/`Set`/`WeakMap` for dynamic keys or DOM-element associations.
- Don't use `using`/`Symbol.dispose`: Safari has no stable support, and without a build step it is a syntax error there.

## Loading phases (E-L-D)

Every page loads in three phases. The model is described in [architecture/overview.md](../architecture/overview.md#loading-phases-e-l-d). The rules:

- **Eager** (`ak.js`, `scripts.js`, `styles.css`, first section): keep the aggregate under 100 KB. No connections to a second origin before LCP; a new DNS/TLS handshake delays LCP.
- **Lazy** (`postlcp.js`, `lazy.js`, remaining sections, header/footer, `lazy-styles.css`, `fonts.css`): import lazily where you can so nothing lands in eager by accident.
- **Delayed** (`delayed.js`, 3 s after `lazy.js` runs): all third-party scripts go here: analytics, consent manager, chat, tag managers. Nothing here may block INP.
- Don't add `<link rel="preload">`/`preconnect` for LCP resources, inline scripts or styles in `head.html`, or bundled multi-script files.

## ak.js and AK-PATCHES

`scripts/ak.js`, `scripts/lazy.js` and `scripts/postlcp.js` are upstream [aemsites/author-kit](https://github.com/aemsites/author-kit) files with project patches. Every difference from upstream is recorded in `scripts/AK-PATCHES.md`.

- Read `AK-PATCHES.md` before editing those files. Update its row and classification in the same PR. CI fails a PR that changes one of the three files without changing `AK-PATCHES.md`.
- New project behaviour goes in `scripts.js` hooks (`decorateArea`, or a new hook), not in `ak.js`. Edit `ak.js` only for a patch you add to `AK-PATCHES.md`.
- `ak.js` exports: `getMetadata`, `getLocale`, `setConfig`, `getConfig`, `loadStyle`, `loadExperience`, `loadBlock`, `localizeUrl`, `decorateLink`, `toClassName`, `slugifyUnique`, `loadArea`.

## Block lifecycle

EDS gives a block one hook: its default export, called once when its section loads. There is no unmount. Two things make re-entrancy real anyway:

- DA Quick Edit and `?dapreview` re-run `loadPage()` → `loadArea()`. Quick Edit replaces `document.body.innerHTML` with fresh, undecorated markup, so the old block elements are discarded.
- Tests (and any direct caller) invoke `default(el)` without going through `loadBlock()`.

Use these two tools, nothing else:

1. **`guardDecorate(el, name)`** from `scripts/utils/lifecycle.js` at the top of any block that restructures its DOM once: `if (!guardDecorate(el, 'heroDecorated')) return;`. `ak.js` also skips already-loaded blocks and sections (`data-block-status`, `data-section-status`), but that doesn't cover direct calls.
2. **The teardown signal** for resources outside the block's own subtree: listeners on `window`/`document`, `IntersectionObserver`/`ResizeObserver`/`MutationObserver`, `setInterval`/`setTimeout`, `requestAnimationFrame` loops, and nodes appended to `document.body`. Anything inside the block's subtree is discarded with it and needs no cleanup.

```js
export default (el, { signal } = {}) => {
  if (signal?.aborted) return;
  window.addEventListener('resize', onResize, { signal });
  const observer = new IntersectionObserver(onIntersect);
  observer.observe(el);
  signal?.addEventListener('abort', () => observer.disconnect());
};
```

| Condition | Cause | What to do |
|---|---|---|
| `signal` is `undefined` | Direct call (tests) passes no second argument | Keep the `= {}` default and use `signal?.`. `addEventListener` accepts `signal: undefined`. |
| `signal.aborted` is already `true` when the block runs | Its element was swapped out while the module loaded | Return before starting timers, rAF or observers. An `abort` listener never fires on an already-aborted signal. |
| Cleanup never runs after the element is removed | `ak.js` aborts at the *next* `loadArea()` sweep, which may never come | Accept it; the signal covers the re-decoration case, which is the one that leaks. |
| Your block replaces `el` (e.g. `youtube.js` `a.replaceWith(container)`) | The signal belongs to `el`; the next sweep aborts it while the new content is live | Tie the signal only to content that stays in the tree. |
| Header or footer code | Fragment-rooted blocks are skipped by the sweep (`AK-PATCHES.md` #25) | Keep the existing module-scope `AbortController` abort-before-recreate pattern there. |

`trackScrollProgress()` in `scripts/utils/motion/scroll.js` returns a cleanup function. Wire it with `signal?.addEventListener('abort', cleanup)`; don't discard it.

## Shared utilities (`scripts/utils/`)

- Dependency flows one way: blocks import utils, utils never import blocks (enforced by `import/no-restricted-paths`).
- Domain folders hold related modules: `analytics/`, `experiments/`, `media/`, `modal/`, `motion/`, `page/`, `security/`, `seo/`. Cross-cutting helpers sit at the root.
- Before writing a helper, check this table. A generic helper moves here once it has a second caller.

| Module | Exports | Notes |
|---|---|---|
| `a11y.js` | `generateId`, `activateTab`, `rovingTabindex`, `trapFocus`, `announce` | Live-region announcements, roving tabindex, focus trap |
| `analytics/analytics.js` | `EVENTS`, `track`, `setAnalyticsProvider` | See [Event tracking](#event-tracking) |
| `analytics/consent.js` | `getConsent`, `hasConsent`, `setConsent`, `onConsentChange`, `resetConsent` | localStorage stub (`frameio-consent`). `personalization`, `analytics`, `marketing` default to false |
| `analytics/visitor-id.js` | `getVisitorId` | |
| `breakpoints.js` | `BP_MD`, `BP_LG`, `BP_GRID_CAP`, `MQ_MD`, `MQ_LG`, `MQ_GRID_CAP` | 768 / 1240 / 1440. Never inline a breakpoint in JS |
| `color-scheme.js` | `getColorScheme`, `setColorScheme` | Light/dark from computed background luminance |
| `date-only.js` | `DATE_ONLY` | `YYYY-MM-DD` regex; no imports, safe for the panel |
| `dom.js` | `createElement`, `parseSvg`, `getCells`, `classifyCtaParagraphs`, `HEADING_SELECTOR`, `parseGlassborderDecoration` | `createElement(tag, attrs, ...children)` sets attributes, not properties; `false`/`null` omit the attribute, so pass ARIA state as `'true'`/`'false'` strings |
| `env.js` | default (`'prod'`/`'stage'`/`'dev'`), `classifyEnv`, `isProdEnv` | `--` in host = stage, `local` = dev, anything else = prod. Don't inline host checks (lint rule `config-drift/no-inline-env-check`) |
| `error.js` | default `(ex, el)` | Logs; in non-prod wraps the failing element in `.has-error` |
| `experiments/*` | see [personalization](../architecture/personalization.md) | |
| `fetch-data.js` | `fetchData(url, { sheet, limit, offset })` | See [Shared fetches](#shared-fetches) |
| `fragment.js` | `loadFragment`, `localeCandidates`, `loadFragmentWithFallback`, `getReplaceEl`, `replaceElWithFragment` | Use `loadFragmentWithFallback(rootPath)` for any fragment; see [locale](../architecture/locale.md#fragment-fallback) |
| `glyphs.js` | `loadSvg(url)` | Code-owned SVG as a real node. Prefer a CSS mask |
| `i18n.js` | `formatDate(value, opts)` | The only way to format a visible date; see [blocks.md](blocks.md#content-and-copy) |
| `lifecycle.js` | `guardDecorate` | See [Block lifecycle](#block-lifecycle) |
| `listen.js` | `listenGroup()` | `listen(target, type, handler)` then `end()` removes the group |
| `media/icons.js` | default `(icons)` | `:iconname:` → inline SVG from `/icons/` |
| `media/partner-logo.js` | `loadPartnerLogo`, `buildAccessibleLogo` | Name-keyed lookup in `img/partners/` |
| `media/picture.js` | `createPicture({ src, alt, eager, breakpoints })` | |
| `media/video.js` | `decorateVideoMedia`, `addVideoPauseControl` | `.mp4` link → looping muted video, gated by `shouldAnimate()` |
| `modal/modal.js` | `wireModalClose`, `openModal`, `closeModal`, `clampIndex` | |
| `modal/video-modal.js` | `WISTIA_RE`, `openVideoModal`, `wireVideoModalLinks` | |
| `motion/motion.js` | `shouldAnimate`, `getTransitionDuration`, `addPauseToggle`, `onReveal` | Gate all motion here |
| `motion/scroll.js` | `trackScrollProgress(el, cb)` | Shared scroll listener; returns a cleanup function |
| `motion/gsap-loader.js` | `loadGsap`, `loadGsapPlugin` | Resolves to the library or `null`; see [Async loaders](#async-loaders) |
| `placeholders.js` | `getPlaceholders`, `getPlaceholder`, `fillPlaceholder` | See [blocks.md](blocks.md#content-and-copy) |
| `platform-host.js` | `PLATFORM_HOST_MARKERS`, `isPlatformHost` | |
| `richtext.js` | `decorateRichText` | |
| `script.js` | default `(src, attrs)` | Loads a `<script>` once per `src` |
| `security/embed-allowlist.js` | `ALLOWED_EMBED_HOSTS`, `isAllowedEmbedHost` | Required before rendering any author-supplied iframe |
| `security/preview-origin.js` | `isAuthoringPreviewAllowed`, `resolvePreviewOrigin` | |
| `security/sanitize.js` | `sanitizeMarkup` | |
| `seo/hreflang.js` | default | Gated on page `Translations` metadata; see [locale](../architecture/locale.md#hreflang) |
| `seo/jsonld.js` | `inject`, `flush`, default | One `@graph` in `<head>`; blocks call `inject()` |
| `slugify.js` | `slugify` | |
| `styles.js` | default `(href)` | Constructable stylesheet for shadow DOM (scheduler only). Not `ak.js` `loadStyle` |
| `touts.js` | `inferMediaLayout`, `detachFromRow`, `extractRowMedia`, `decorateTout` | Shared by `touts`, `bentos`, `side-by-side` |
| `page/favicon.js`, `page/lazyhash.js` | self-executing | Imported by `lazy.js` |
| `page/footer.js` | default | Loads the footer block |

## Shared fetches

- JSON sheets go through `fetchData`. It memoizes the in-flight promise per URL, keeps a definitive 404/410 as a cached `null` for the page session, and evicts any other failure so a later call retries.
- Never cache a failure the same way as a success. A transient error cached as `null` sticks for the whole page.
- Every new `fetch()` has a timeout (`AbortSignal.timeout()` in browser code) and a defined fail-open or fail-closed result.
- A block listing an index that can exceed 1,000 rows must pass `limit`/`offset` and paginate (EDS query-index default limit).

## Event tracking

- Every `track()` call uses a name from `EVENTS` in `scripts/utils/analytics/analytics.js`, never a string literal. A new interaction means a new `EVENTS` key in the same PR. Why: free-text event names on the old site produced events that fired but were never wired to their destination.
- `data-track-event`/`data-track-props` are set only by decoration code, never from an author field.
- UTM parameters and click IDs (`gclid`, `fbclid`, `msclkid`, `li_fat_id`) are captured by `analytics.js`. Don't re-parse them. Click-ID persistence is gated on `hasConsent('analytics')`.

## Selectors and data attributes

- `data-testid` is the primary selector for tests and analytics. Name it `{block-prefix}-{role}` in kebab-case (`hero-cta-primary`), reusing the block's CSS prefix.
- `ak.js` sets `data-testid` on CTA buttons in `decorateButton` (`${blockName}-cta-${role}`) and mirrors a block's variant classes into `data-variant`. Blocks never set `data-variant` themselves.
- A shared decorator mapped over a list (`decorateTout`'s `testidId`) needs a per-item id, or every item gets the same testid.

## Identifying elements

- A block's first read of authored content is by tag/shape (`'picture, img'`, `HEADING_SELECTOR`, `'a'`), because authors can't add classes. That first read is the only place a bare tag carries meaning: classify it, add a semantic class (`${prefix}-title`), and key all later JS, CSS and tests off the class.
- Don't key role-specific style or logic off position (`p:last-of-type`, `querySelectorAll('p')[2]`). An author adding a paragraph breaks it.
- IDs are for linking, classes for styling. Heading IDs come from the EDS server. Section IDs come from Section Metadata `Anchor`/`Id` (`promoteAnchors` in `scripts.js`). There are no author-set tracking names.

## Shared constants

- Breakpoints: import from `breakpoints.js`. CSS can't import them and must hardcode matching pixels; check them against `breakpoints.js` when you touch one.
- Heading selector: `HEADING_SELECTOR` from `dom.js`.
- Code-owned SVG chrome is a `.svg` file (see [assets.md](assets.md)), never a JS string.
- Before adding a literal that already exists elsewhere, extract it instead.

## Async loaders

A helper that may or may not do async work (for example, gated on `shouldAnimate()`) returns the resolved value or `null`; it never takes a callback. Example: `loadGsap()` resolves to `{ gsap, ScrollTrigger }` or `null`, and the caller branches on that. Why: a callback wrapper's own return value is always a truthy promise, so callers couldn't tell whether the work ran.

## State and data flow

There is no store or reactive-state library, and none should be added without a concrete need.

- App config is the `ak.js` `setConfig`/`getConfig` closure, written once in `scripts.js` `loadPage()` before `loadArea()`. Blocks read it; they never write it. Don't put config on `window`.
- DOM and `dataset` flags are a legitimate source of truth (`data-block-status`, `data-variant`, `guardDecorate` flags, `data-behavior`, the color-scheme body class).
- Module-scope singletons are fine for global-by-nature state (fetch caches, the video modal, the shared scroll listener). Per-instance state of a block that can appear twice on a page goes in a closure, never a module `let`.
- The one cross-module runtime signal is consent: `consent.js` dispatches `atreyu:consent`, read through `onConsentChange` (consumer: `delayed.js`). Name the consumer before adding another event.
- Constants that must match across the browser and a Worker (they deploy separately and can't share a module) are machine-checked: the `config-drift` ESLint rules flag a copy in a non-designated file, and a cross-file equality test checks the designated files agree: `tools/config-sync/locales.test.js` (`npm run test:config-sync`) compares the locale list in `scripts/locales.js` with `workers/website/utils/locale.js`. Copy that test for the next shared constant.

## Security

- No `innerHTML` with dynamic input. Parse markup with `parseSvg()` or build nodes with `createElement`. Author text is set with `textContent`.
- A dynamic `import()` path must come from a function registered in `no-unsanitized/method` `escape.methods` (`resolvePreviewOrigin`, `resolveModulePath`), called in the same function scope as the `import()`. The rule doesn't follow taint across a parameter boundary.
- An iframe built from an author URL must pass `isAllowedEmbedHost()` first.
- Any new sanitizer, allowlist or URL check ships with tests. A same-origin check normalizes backslashes before `startsWith('/') && !startsWith('//')`.

## Lint and tests

See [testing.md](testing.md).
