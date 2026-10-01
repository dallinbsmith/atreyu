# Section and page metadata

## Section Metadata

A **Section Metadata** table inside a section configures that section. EDS turns its rows into attributes on the section on the server and removes the table; `blocks/section-metadata/section-metadata.js` and `scripts/scripts.js` act on those attributes. Keys are case-insensitive. Values for `grid`, `gap`, `spacing`, `container` and `layout` are normalized to class names (`Bento` = `bento`).

| Key | Values | Effect |
|---|---|---|
| `grid` | `2`, `3`, `4`, `5`, `6` | Lays out the section's blocks in N columns. `2` applies from 768px; `4` and `6` show half their columns from 768px; `3` and `5` go multi-column only at the large breakpoint. Any other value is ignored |
| `gap` | `xs`, `s`, `m`, `l`, `xl`, `xxl` | Grid gap |
| `spacing` | `xs`, `s`, `m`, `l`, `xl`, `xxl` | Top and bottom padding |
| `container` | `2`, `4`, `6` | Centered width: one third, two thirds, full content width, at every screen size. Blocks in the section are constrained too. Works without `Style: container`. Any other value is ignored |
| `layout` | `bento` | Predefined asymmetric bento grid (3 columns from 768px) |
| `background` | image URL, CSS color, or `color-token-<name>` | Background image (`.mp4` URLs are ignored), color, or design token (`color-token-accent` → `var(--color-accent)`). Then sets `light-scheme`/`dark-scheme` from the computed background |
| `style` | class names | Added to the section as classes. Styled values: `container`, `center`, `peek-background` (only with a background image), `glow` |
| `anchor` | text | Becomes a slugified, de-duplicated section `id` (`Pricing Table` → `id="pricing-table"`) for deep links and jump navigation. An explicit `id` row wins |
| `id` | text | Sets the section `id` directly (server rule: lowercase, invalid characters to hyphens). Not de-duplicated; prefer `anchor` |

Example:

| Section Metadata | |
|---|---|
| background | color-token-accent |
| grid | 3 |
| gap | l |
| spacing | xl |

`style: dark` appears in older examples but has no CSS; a background sets the color scheme automatically.

### Keys you must not use

These keys are reserved for the experimentation plugin: any key that normalizes to `experiment`, `variant`, `audience`, `audiences` or `campaign`, or starts with one of those followed by `-` or `:`. Examples: `Experiment`, `Experiment Variants`, `Variant`, `Audience`, `Audience: Mobile`, `Audiences`, `Campaign: Launch`. (`Experiments`, `Variants`, `Campaigns` are allowed.)

- Why: the server would write them as `data-experiment`, `data-variant`, `data-audience`…, the same attributes the plugin uses to report what it served.
- They do nothing on previewed and published pages. In Quick Edit and DA preview the loader strips them before the plugin runs.
- To personalize a section, put a **Personalize** table in it ([personalization.md](personalization.md)). There is no section-level A/B test; an **Experiment** table always tests the whole page.
- The experiments panel warns when a page uses a reserved key.

## Page metadata read by code

Set in the page's **Metadata** table (or the bulk `/metadata` sheet).

| Key | Read by | Effect |
|---|---|---|
| `Header` | `ak.js` | `off` removes the header; any other value replaces the `<header>` class. The header fragment path is fixed: `/system/fragments/nav/header` |
| `Footer` | `scripts/utils/page/footer.js` | `off` removes the footer; any other value replaces the `<footer>` class. Fragment path is fixed: `/system/fragments/nav/footer` |
| `Breadcrumbs` | `ak.js`, `seo/jsonld.js` | Enables breadcrumbs |
| `Template` | `ak.js`, `seo/jsonld.js` | Adds `{template}-template` to `<body>` after loading `templates/{template}/{template}.css`. No templates exist in the repo yet. `pricing` also adds SoftwareApplication structured data |
| `Locale` | `ak.js` `getLocale` | Overrides the locale derived from the path (value is a prefix such as `/ja-jp`) |
| `Translations` | `seo/hreflang.js` | Comma-separated locale codes with a translation of this page (`ja-jp, de-de`; `en-us` = the English page). Drives hreflang ([architecture/locale.md](../architecture/locale.md#hreflang)) |
| `Description`, `og:title`, `og:image` | `seo/jsonld.js` | Structured data |
| `Partner`, `Customer` | `seo/jsonld.js` | Organization name in integration / case-study structured data |
| `Favicon` | `page/favicon.js` | Favicon name under `img/favicons/` (default `favicon`) |
| `Experiment`, `Experiment Variants`, … | experimentation plugin | Whole-page tests. Prefer the Experiment table ([personalization.md](personalization.md)) |

## Header and footer fragments

The header and footer are not authored on each page; they load from fragments (with the locale copy tried first, see [architecture/locale.md](../architecture/locale.md#fragment-fallback)).

**Header** (`/system/fragments/nav/header`). Sections are classified by shape, not order:

| Section | Shape |
|---|---|
| Brand | The section with exactly one ordinary link (the logo) |
| Navigation | The section containing a list. Each item becomes a menu item; nested fragment content becomes a mega menu |
| Actions | Whatever is left. The last real link becomes the primary action |

Links to `/tools/widgets/scheme`, `/tools/widgets/language` and `/tools/widgets/toggle` become the color-scheme button, the language menu (loaded from `/system/fragments/nav/header/languages` on click) and the mobile menu toggle.

**Footer** (`/system/fragments/nav/footer`). With two or more sections, the first section containing a list is styled as legal links and the last other section as the copyright line.
