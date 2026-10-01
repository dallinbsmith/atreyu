# CSS conventions

Applies to `styles/**`, `blocks/**/*.css` and `experiments-panel/*.css`. Run `npm run lint` (Stylelint plus the layer check) before committing.

Comment convention follows [JavaScript comments](javascript.md#comments): explain current constraints/why, not history; no dates, bug-squash narratives or review/plan IDs.

## File architecture

| File | Phase | Holds |
|---|---|---|
| `styles/styles.css` | Eager | Layer order, tokens, reset, above-the-fold typography, section structure |
| `styles/lazy-styles.css` | Lazy | Animations, transitions, below-the-fold treatments |
| `styles/fonts.css` | Lazy | `@font-face` with `font-display: swap` and metric-matched fallbacks (`size-adjust`) |
| `blocks/{name}/{name}.css` | When the block is on the page | The block's styles only |

Don't split a stylesheet with `@import`: imports load sequentially, separate `<link>` tags load in parallel.

## Cascade layers

- `styles.css` line 1 declares the order: `@layer reset, base, tokens, sections, blocks, utilities;`. Layer names are global across every stylesheet.
- `blocks` comes after `sections` on purpose: a block's own layout rule must beat the generic `main .section` default on a specificity tie.
- **Every block CSS file wraps its entire contents in `@layer blocks { }`.** `npm run lint:css-layers` (`tools/lint-css-layers.mjs`) fails CI otherwise.
- In `styles.css`: `:root` and `.light-scheme`/`.dark-scheme` go in `tokens`; element and component defaults (`body`, headings, `a`, `.btn`) in `base`; `.section` structure in `sections`; helper classes such as `.visually-hidden` in `utilities`.
- Keep every `:root` declaration, including its responsive `@media` overrides, in one layer. Split across layers, an override can lose to the base declaration.
- Layers replace `!important`.

## Tokens and custom properties

- Use tokens from `:root` in `styles/styles.css`. Never hardcode colors, spacing or font sizes.
- Pattern: primitive (`--color-blue-600`) → semantic (`--color-accent`) → component (`--button-bg`). Block-private properties carry the block prefix (`--hero-overlay-opacity`).
- Theme overrides re-declare semantic tokens under section or page classes.

Enforced by Stylelint (`.stylelintrc.json`):

| Rule | Effect |
|---|---|
| `color-no-hex` | No hex colors anywhere |
| `scale-unlimited/declaration-strict-value` on `/color$/` | Color properties need a `var(--*)` or one of `currentColor`, `inherit`, `transparent`, `unset`, `initial`, `none` |
| `csstools/value-no-unknown-custom-properties` (`importFrom: styles/styles.css`) | A `var(--x)` must be declared somewhere |
| `atreyu/z-index-requires-token` | A `position: fixed` element must use a `var(--z-index-*)` token |

A block-private property set from JS (`el.style.setProperty('--count', n)`) is unknown to the custom-property rule. Declare it with `@property --count { syntax: ...; inherits: ...; initial-value: ...; }` in the block CSS instead of disabling the rule.

## Z-Index and Stacking Contexts

Local layering and global layering are different problems.

1. **Step zero:** the block root establishes its own stacking context (`isolation: isolate`, or a positioned element with a non-`auto` z-index). Without it, a descendant's z-index leaks into the parent context.
2. **Layering inside your block** (background behind text, decorative pseudo-elements, a sticky inner element): use small raw integers (`-1` to `3`). Blocks are never nested and each is isolated, so these can't collide. Examples: `pothole.css`, `hero-screen.css`.
3. **Anything `position: fixed`, or appended outside the block's subtree** (for example to `document.body`): use a global token. The Stylelint rule enforces this for `position: fixed`.

| Token | Value | Use |
|---|---|---|
| `--z-index-body-overlay` | 20 | Non-modal fixed or body-appended UI (hover cards, tooltips). Consumer: `quote-interactive.css` `.qi-hover` |
| `--z-index-toast` | 40 | Reserved for a future toast/notification system. No consumer; don't use it for anything else |
| `--z-index-nav` | 100 | The fixed header only. Its own submenu uses small local values |
| `--z-index-modal` | `calc(var(--z-index-nav) + 10)` | Anything above page chrome: modals and the focused skip link. Derived so it can't fall below the header |

- Two sections overlapping by negative margin is a DOM-order problem, not a z-index one. Document the dependency in both files' comments.
- Authoring-tool overlays (`scripts/sidekick/validation.css`) use their own literal and never render in production.
- Layers and z-index are unrelated: a later `@layer` decides which rule wins on the same element, not paint order between elements.

## Nesting and selectors

- Native nesting, 2–3 levels max, scoped under the block class: `.hero { .hero-title { } }`.
- `@scope (.block) to (.boundary)` for blocks that need subtree isolation.
- Never style the framework's `-container` or `-wrapper` elements.
- Media queries use range syntax: `@media (width >= 768px)`.
- Breakpoints are 768px (md), 1240px (lg), 1440px (grid cap). CSS can't import `scripts/utils/breakpoints.js`, so check hardcoded pixels against it when you touch one.
- Use `:has()` instead of JS class toggling for parent-conditional style, and `@container` for component-level responsiveness. `color-mix()`, `oklch()`, `:is()`, `:where()` are available.

## Performance and motion

- `content-visibility: auto` on below-the-fold sections.
- Keyframes and transitions go in `lazy-styles.css` or block CSS, never `styles.css`, each with a `prefers-reduced-motion: reduce` fallback.

## Variants

- `Hero (large, dark)` → `<div class="hero large dark">`. Style with `&.large { }` inside the block scope.
- Prefer variants that override custom properties: `&.dark { --hero-text: var(--color-light); }`.

## Section Metadata

The EDS server turns a Section Metadata table into attributes on the section:

- `style` → classes on the section (`style: dark` → `class="dark"`).
- Every other key → a `data-*` attribute. `blocks/section-metadata/section-metadata.js` consumes `grid`, `gap`, `spacing`, `container`, `background` and `layout`.
- `anchor` → `data-anchor`, which `promoteAnchors` in `scripts/scripts.js` turns into a slugified, de-duplicated `id` during eager decoration.

Author-facing reference: [authoring/section-metadata.md](../authoring/section-metadata.md).
