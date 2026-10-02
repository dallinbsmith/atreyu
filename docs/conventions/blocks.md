# Block conventions

Applies to `blocks/**`. JavaScript language rules are in [javascript.md](javascript.md), CSS in [css.md](css.md). The block list is in [authoring/block-catalog.md](../authoring/block-catalog.md).

## Init Contract

- The default export is `(el) => {}` or `async (el) => {}`. `el` is the block's root `div`; its children are the rows of the authored table, and their children are the cells.
- A block that holds listeners, observers or timers outside its own subtree, or appends nodes to `document.body`, takes `(el, { signal } = {})`. Always keep the `= {}` default: tests call `default(el)` with no second argument. Full rules and failure modes: [javascript.md → Block lifecycle](javascript.md#block-lifecycle).
- Pass that `signal` through to shared teardown-aware utilities such as `trackScrollProgress(el, cb, { signal })`, `onReveal(el, cb, { signal })`, `wireVideoModalLinks(el, { signal })` or modal open helpers instead of hand-rolling per-block abort listeners.
- `ak.js` calls the export as `mod.default(el, { signal })`. It loads the block's JS and `blocks/{name}/{name}.css` in parallel (`Promise.all` in `loadExperience`), so don't assume the CSS is applied when your code runs.
- Decorate the DOM in place. No virtual DOM, reactivity or state library.
- Handle missing content: authors leave cells empty and add extra rows.

## Row Classification

- **Classify a row by its content shape, never by position, count or `rows.shift()`/`rows.pop()`.** Find the background row with `rows.find((r) => r.querySelector('picture'))`, not `rows.at(-1)`. Reference: `side-by-side.js` (`mediaRow`/`toutsRow`/`textRows`). Why: a positional read misattributes an extra authored row and silently drops real content; `hero.js` and `pothole.js` had exactly that bug.
- An optional configuration row uses an explicit `key: value` prefix (`scale: 1.2`, `submit: Send it`), never a bare value match (`1.2`, `Submit`). A bare match can misclassify real copy that happens to look like the value. Treat a row as configuration only if enough rows remain for the block's required content.
- If a block can receive more than one content row, merge every non-background row's children into one container (`rows.filter(...).forEach((row) => content.append(...row.children))`). An empty block is then a no-op instead of a crash.
- Build new wrapper elements with `createElement(tag, attrs, ...children)` from `scripts/utils/dom.js`. It sets attributes, not properties: pass ARIA state as `'true'`/`'false'` strings, and set media properties like `muted`/`playsInline` directly on the element.
- Prefer `.children`/`.firstElementChild` over `:scope > div` selector strings for one or two levels; a typo in a selector silently returns nothing. `getCells(el)` returns every cell across every row.

| Looks right but isn't | Do this instead |
|---|---|
| `const bg = rows.pop();` | `const bg = rows.find((r) => r.querySelector('picture'));` |
| `if (cell.textContent === 'Submit')` | `if (/^submit:/i.test(cell.textContent))` |
| `content.querySelectorAll('p')[2]` styled as the eyebrow | Classify on first read and add `${prefix}-eyebrow` |

## Changing an existing block's authoring convention

Before changing what an author types for an existing block (a configuration row, a row/column shape, a variant name), check real DA pages that use the block. Passing tests only prove the shapes you thought of. If pages use the old form, accept both forms or migrate the content in the same change. A block's name, variant names and row shape are a contract with authored content ([ADR-0016](../decisions/0016-block-names-are-a-contract.md)).

## Structure

- One directory per block: `blocks/{name}/{name}.js` and `blocks/{name}/{name}.css`. The CSS is auto-loaded when the block is present.
- The default export is the block's only public surface. A block never imports from another block's directory (enforced by `import/no-restricted-paths`); shared code goes in `scripts/utils/`.
- Split by concern, not line count. Once a file mixes concerns, move helpers to sibling files in the block's folder. Reuse `scripts/utils/` first. A block-specific helper another block needs usually means the two are one block with a variant.
- ESLint `max-lines` (200 counted lines on `blocks/**/*.js`) is a backstop, not a target. Don't disable it; split the file.
- Scope CSS by the block class with native nesting, 2–3 levels max. Never style the framework's `-container`/`-wrapper` elements.

## No nesting

- Blocks are never nested inside blocks.
- Complex components are sections combined through auto-blocking (`linkBlocks` in `scripts/scripts.js` turns `/system/fragments/`, `/schedules/` and `https://www.youtube` links into blocks).
- A component that needs real client-side state, or doesn't map onto a document table (a multi-step flow, a filterable dataset), belongs in `widgets/{name}/` (see `widgets/README.md`), not in a block stretched past its shape.
- No Lit or other web-component runtime. A data-driven rendering block for pricing is an open question, not an approved pattern.

## Design principles

- Minimize block usage. Default content (headings, text, images, lists, links) beats a custom block.
- Check the existing catalog and the standard Block Collection (hero, columns, cards, embed, fragment, table, accordion, tabs, carousel, modal, quote) before building.
- Author-first: shape the table for the author, not for the code.
- Progressive enhancement: start from the semantic HTML EDS delivers.

## Variants

- Authors write `Columns (wide)` → `<div class="columns wide">`. `super wide` → `super-wide`. `(large, dark)` → two classes.
- Style variants with `&.wide { }` inside the block scope.
- If a variant needs different behaviour, not just CSS, dynamically import a dedicated module from the block rather than branching everywhere on a class.
- `ak.js` mirrors variant classes into `data-variant`; blocks never set it.

## Animation and motion

- Gate all animation through `shouldAnimate()` in `scripts/utils/motion/motion.js`.
- Animations live in block CSS or `lazy-styles.css` behind a `prefers-reduced-motion` guard.
- Continuous motion (marquees, carousels, auto-advance) needs a pause control (WCAG 2.2.2). Use `addPauseToggle()`.

## Accessibility and embeds

- Toggles carry `aria-expanded`; icon-only buttons carry `aria-label`. See [accessibility.md](accessibility.md).
- Decorative logo plus an accessible name: `buildAccessibleLogo()` from `scripts/utils/media/partner-logo.js` and the global `.visually-hidden` class.
- A block that turns an author URL into an `<iframe>` must check it with `isAllowedEmbedHost()` first.

## Content and copy

- Never hardcode a user-facing English string (labels, ARIA text, announcements, validation messages) in block JS. Why: blocks must have no hard-coded content for localization to work.
- Use `await getPlaceholder('namespace.key', 'English fallback')` from `scripts/utils/placeholders.js`.
  - The namespace is required and selects the sheet: `<locale prefix>/system/placeholders/<namespace>.json`. A key without a namespace returns the fallback and fetches nothing.
  - The fallback is the current English string, so the block works before the sheet row exists. There is no fallback to the English sheet; a missing row in a locale sheet shows the code fallback.
  - Name namespaces by concern (`nav`, `controls`, `media`, `forms`), keys by role (`controls.pause`), never by English wording. Never rename a translated key; add a new one.
  - Add every new key to the Placeholders table in [authoring/da-content-structure.md](../authoring/da-content-structure.md#placeholders).
  - The calling function must be `async`.
- Format every visible date with `formatDate(value, opts)` from `scripts/utils/i18n.js`, never `toLocaleDateString`/`Intl.DateTimeFormat` directly.
  - Formats in the page locale (`getConfig().locale.lang`, falling back to `en`), never the browser locale.
  - Default is a long date ("September 24, 2026"); `opts` merge over it, `dateStyle`/`timeStyle` replace it.
  - A full `YYYY-MM-DD` string is a calendar day and never shifts across time zones. Anything else is an instant in the visitor's time zone unless `opts.timeZone` is set.
  - Invalid input is returned unchanged; `null`, `undefined` and `''` return `''`.

## Structured data

Blocks that produce schema-eligible content (FAQ, video, pricing) call `inject()` from `scripts/utils/seo/jsonld.js`. Never write a second `<script type="application/ld+json">`.

## Verification

Any block with animation, scroll-linked behaviour or non-trivial layout must be rendered in a real browser (`aem up`) and checked visually before it is done. Lint and unit tests don't verify rendering.

## Library Sync

The DA Library is the author's insert menu. It is the sheet `/system/library/blocks` (one row per block, pointing at an example doc) plus example docs at `/system/library/blocks/{name}`. Coverage isn't tracked in this repo; check the sheet in DA before assuming a block has an entry.

- A change to a block's rows, columns or variant names updates its Library example in the same change. A stale example is worse than none.
- A new block adds its example doc and sheet row; a removed block deletes both.
- Library sheets are edited in place. Moving, copying or renaming a DA sheet breaks it.
- Library rows point at `https://content.da.live/dallinbsmith/atreyu/...` URLs; DA's canvas editor can't fetch `aem.page`/`aem.live` URLs (no CORS headers).
