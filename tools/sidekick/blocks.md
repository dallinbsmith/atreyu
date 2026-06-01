# Block Catalog

Reference for all blocks available in the Atreyu EDS project. Each block is auto-loaded by `ak.js` when it appears on a page. Block init contract: `export default (el) => {}` where `el` is the block's root `<div>`.

---

## Layout

### Hero

**Purpose**: Full-width banner with background media (image or video) and foreground text content.

**Variants**:

| Variant | Effect |
|---------|--------|
| `small` | Minimum height 180px |
| `large` | Minimum height 720px |
| `full` | Minimum height fills viewport minus header |
| `light` | Light gradient overlay, dark text |
| `dark` | Dark text scheme (light text) |
| `stack` | Stacks background above foreground instead of overlaying |
| `center` | Centers foreground text horizontally |
| `quiet-background` | Applies a heavy blur filter over the background image |

**Content structure**:

| Row | Purpose |
|-----|---------|
| 1 (optional) | Background -- a picture element, optionally wrapped in a link to an `.mp4` file for video background. Supports focal point via image `data-title` attribute in the format `data-focal:x,y`. |
| 2 (last row) | Foreground -- one or two columns of text content. The block detects headings and adds `hero-heading` / `hero-detail` classes. A paragraph before the heading becomes the detail line. Multiple columns create a split layout at desktop widths. |

If only one row is present, it is treated as the foreground (no background).

**Dependencies**: `scripts/utils/motion.js` (`shouldAnimate`) -- video autoplay is gated on reduced-motion and connection quality checks.

**Example**:

```
+---------------------------------------+
| Hero (large, dark)                    |
+=======================================+
| background-image.jpg                  |
+---------------------------------------+
| Eyebrow text                          |
| # Main Heading                        |
| Supporting paragraph text.            |
| [Call to Action](https://example.com) |
+---------------------------------------+
```

---

### Columns

**Purpose**: Multi-column layout grid. Each row of the authoring table becomes a row in the grid, and each cell within that row becomes a column.

**Variants**:

| Variant | Effect |
|---------|--------|
| `image-cover` | When a column contains only a `<picture>`, it becomes a full-bleed cover image with `object-fit: cover`. Adjacent columns get extra padding. |
| `gap-xs` through `gap-xxl` | Sets the gap between columns using spacing tokens (`xs`, `s`, `m`, `l`, `xl`, `xxl`) |
| `align-top` | Aligns row items to the start (top) instead of center |
| `z-pattern` | On desktop (1240px+), reverses column order on odd rows to create a zig-zag reading pattern |

**Content structure**:

Each row in the document table becomes a `.row` element. Each cell within a row becomes a `.col` element. The number of columns per row is set as the CSS custom property `--child-count` on the row, and the grid auto-sizes at desktop breakpoints using `repeat(var(--child-count), 1fr)`.

**Dependencies**: None (no imports).

**Example**:

```
+-----------------------------------------------+
| Columns (image-cover, gap-l)                  |
+=======================+=======================+
| cover-photo.jpg       | ## Feature Title       |
|                       | Description text here. |
+-----------------------+-----------------------+
| ## Another Feature    | another-photo.jpg      |
| More description.     |                        |
+-----------------------+-----------------------+
```

---

### Section Metadata

**Purpose**: Applies layout, spacing, background, and grid configuration to the parent `<section>` element. This is not a visible block -- it controls section-level presentation.

**Variants**: None. Section Metadata uses key-value data attributes, not class-based variants.

**Content structure**:

The block reads `data-*` attributes from the section element (set by the EDS framework from the Section Metadata table). Supported keys:

| Key | Values | Effect |
|-----|--------|--------|
| `grid` | `2`, `3`, `4`, `5`, `6` | Adds a CSS grid with the specified column count to `.block-content` children |
| `gap` | `xs`, `s`, `m`, `l`, `xl`, `xxl` | Sets grid gap spacing |
| `spacing` | `xs`, `s`, `m`, `l`, `xl`, `xxl` | Sets top/bottom padding on the section |
| `container` | `2`, `4`, `6` | Constrains section content width (2 = narrow, 6 = full grid width) |
| `background` | URL or CSS color or `color-token-*` | Sets a background image, color, or design token. URLs ending in `.mp4` are ignored. Token format: `color-token-accent` maps to `var(--color-accent)`. |
| `layout` | `bento` | Applies a predefined asymmetric bento grid layout (3-column at 900px+ with named grid areas) |
| `style` | CSS class names | Applied directly as classes on the section by the framework (not handled by this JS) |

The block also exports `setColorScheme(section)` and `getColorScheme(section)`, which calculate whether a section background is light or dark (using relative luminance) and apply `light-scheme` or `dark-scheme` classes to child elements.

**Dependencies**: `scripts/utils/picture.js` (`createPicture`) -- dynamically imported only when the background is an image URL.

**Example**:

```
+---------------------------------------+
| Section Metadata                      |
+====================+==================+
| style              | dark             |
+--------------------+------------------+
| background         | color-token-accent|
+--------------------+------------------+
| grid               | 3                |
+--------------------+------------------+
| gap                | l                |
+--------------------+------------------+
| spacing            | xl               |
+--------------------+------------------+
```

---

## Navigation

### Header

**Purpose**: Global site header with brand logo, main navigation with mega-menu support, and action buttons (color scheme toggle, language selector, mobile nav toggle).

**Variants**: None. The header loads its content from a fragment path and decorates it structurally.

**Content structure**:

The header does not read rows from the block element directly. Instead, it loads a fragment from `/fragments/nav/header` (or a path specified in the `header` page metadata). The fragment is expected to contain three sections:

| Section | Purpose |
|---------|---------|
| 1 -- Brand | Logo and site name link. Decorated with `.brand-section`. |
| 2 -- Navigation | Unordered list of nav items. Each `<li>` becomes a `.main-nav-item`. Nested fragment content inside a nav item becomes a `.mega-menu`. |
| 3 -- Actions | Links matching specific widget paths are replaced with buttons: `/tools/widgets/scheme` (color scheme toggle), `/tools/widgets/language` (language selector), `/tools/widgets/toggle` (mobile hamburger menu). |

The language selector lazy-loads a sub-fragment from `/fragments/nav/header/languages` when clicked.

**Dependencies**:
- `scripts/ak.js` (`getConfig`, `getMetadata`)
- `blocks/fragment/fragment.js` (`loadFragment`)
- `blocks/section-metadata/section-metadata.js` (`setColorScheme`)

**Example**:

Authors do not create the header in page content. It is loaded automatically as a global fragment. The fragment document at `/fragments/nav/header` contains the brand, nav list, and action links.

---

### Footer

**Purpose**: Global site footer with content sections, legal links, and copyright notice.

**Variants**: None.

**Content structure**:

Like the header, the footer loads its content from a fragment at `/fragments/nav/footer` (or a path specified in the `footer` page metadata). The fragment is expected to contain multiple sections:

| Section | Purpose |
|---------|---------|
| All except last two | General footer content (e.g., link columns, social links) |
| Second-to-last | Legal links -- decorated with `.section-legal` |
| Last | Copyright notice -- decorated with `.section-copyright` |

If fewer than two sections exist, the fragment is appended without legal/copyright decoration.

**Dependencies**:
- `scripts/ak.js` (`getConfig`, `getMetadata`)
- `scripts/utils/fragment.js` (`loadFragment`)

**Example**:

Authors do not create the footer in page content. It is loaded automatically as a global fragment. The fragment document at `/fragments/nav/footer` contains footer content sections, legal links, and copyright text.

---

## Content

### FAQ

**Purpose**: Accordion-style FAQ list using native `<details>/<summary>` elements. Automatically injects FAQPage JSON-LD structured data for SEO.

**Variants**: None.

**Content structure**:

| Column 1 | Column 2 |
|-----------|----------|
| Question text | Answer content (supports rich HTML -- paragraphs, links, lists) |

Each row becomes one FAQ item. The original rows are removed and replaced with `<details>` elements.

**Dependencies**: `scripts/utils/jsonld.js` (`inject`) -- injects `FAQPage` schema.org structured data.

**Example**:

```
+-----------------------------------------------+
| FAQ                                           |
+=======================+=======================+
| What is Frame.io?     | Frame.io is a video   |
|                       | review platform.      |
+-----------------------+-----------------------+
| How do I get started? | Sign up at            |
|                       | [frame.io](/signup).   |
+-----------------------+-----------------------+
```

---

### Card

**Purpose**: Content card with optional image, text content, and a call-to-action link. The last link in the card is promoted to a CTA position at the bottom.

**Variants**:

| Variant | Effect |
|---------|--------|
| `center` | Centers card text |
| `quiet` | Removes box shadow, background color, and hover scale effect. Zero internal padding. |
| `hash-aware` | Appends the current page's URL hash to the CTA link href |

**Content structure**:

The card reads a single row with a single column (the inner `<div>`):

| Element | Treatment |
|---------|-----------|
| First `<picture>` | Moved to the top as `.card-picture-container` with a 60% aspect ratio (unless `quiet` variant) |
| Remaining content | Wrapped in `.card-content-container` |
| Last `<a>` in the last `<p>` | Promoted to `.card-cta-container` at the bottom of the card |

The card uses a `grid-template-rows: auto 1fr auto` layout to pin the image at top, content in the middle, and CTA at the bottom.

**Dependencies**: None (no imports).

**Example**:

```
+---------------------------------------+
| Card (quiet)                          |
+=======================================+
| card-thumbnail.jpg                    |
| ## Card Title                         |
| Short description of the card.        |
| [Learn More](/page)                   |
+---------------------------------------+
```

---

### Bentos

**Purpose**: Bento grid layout of cards. Each row in the authoring table becomes a grid row, and each cell becomes a card within that grid.

**Variants**: None.

**Content structure**:

| Row | Purpose |
|-----|---------|
| Each row | Becomes a `.bento-grid`. Each cell in the row becomes a `.bento-card`. The number of cards per row is set as `--card-count` on the grid element for responsive column sizing. |

Within each card:
- Headings get `.bento-card-title`
- Non-link paragraphs get `.bento-card-body`
- Paragraphs containing links are collected into a `.bento-card-cta` wrapper. The first link gets `btn btn-primary`, subsequent links get `btn btn-secondary`.

At 1240px+, the grid switches to `repeat(var(--card-count), 1fr)` columns.

**Dependencies**: None (no imports).

**Example**:

```
+---------------------------------------------------------------+
| Bentos                                                        |
+====================+====================+======================+
| ## Feature One     | ## Feature Two     | ## Feature Three     |
| Description text.  | Description text.  | Description text.    |
| [Try It](/try)     | [Learn](/learn)    | [Explore](/explore)  |
+--------------------+--------------------+----------------------+
```

---

### Bookend

**Purpose**: Centered call-to-action section, typically used as a closing block on a page. Features a heading, body text, and primary/secondary CTA buttons.

**Variants**: None.

**Content structure**:

The block reads the inner content from the first row's first cell (`el > div > div`):

| Element | Treatment |
|---------|-----------|
| Heading (any level) | Gets `.bookend-heading` |
| Paragraphs without links | Get `.bookend-body` |
| Last paragraph containing links | Gets `.bookend-cta`. First link gets `btn btn-primary`, subsequent links get `btn btn-secondary`. |

All content is centered. The block has generous vertical padding (160px top, scaling at breakpoints).

**Dependencies**: None (no imports).

**Example**:

```
+---------------------------------------+
| Bookend                               |
+=======================================+
| ## Ready to get started?              |
| Start your free trial today.          |
| [Sign Up Free](/signup)               |
| [Contact Sales](/contact)             |
+---------------------------------------+
```

---

### Table

**Purpose**: Enhances native HTML tables with proper semantic markup. Promotes the first row to a `<thead>` with `<th>` elements if one does not already exist.

**Variants**: None.

**Content structure**:

The block expects the section to contain one or more `<table>` elements (rendered by the EDS framework from markdown pipe tables or pasted tables). For each table:

- If no `<thead>` exists, the first `<tr>` is moved into a new `<thead>` and its `<td>` elements are replaced with `<th scope="col">` elements.
- All remaining rows get `.table-content-row`.

**Dependencies**: None (no imports).

**Example**:

Authors create a standard markdown table in their document:

```
+---------------------------------------+
| Table                                 |
+=======================================+
| | Plan   | Price   | Storage |        |
| |--------|---------|---------|        |
| | Free   | $0/mo   | 2 GB    |        |
| | Pro    | $15/mo  | 250 GB  |        |
+---------------------------------------+
```

---

### Advanced Tabs

**Purpose**: Converts sibling sections into a tabbed interface. One section contains the tab labels (as an unordered list), and subsequent sibling sections become tab panels.

**Variants**: None.

**Content structure**:

The block expects:

| Element | Purpose |
|---------|---------|
| Unordered list (`<ul>`) inside the block | Tab labels. Each `<li>` becomes a tab button. |
| Sibling `<section>` elements in the parent (after the block's own section) | Tab panels. Each section (excluding the block's own section) becomes a panel with `role="tabpanel"`. |

The first tab is active by default. The block temporarily hides the parent container (`display: none`) while rearranging DOM, then reveals it. Tab panels are moved inside the block element.

**Dependencies**: `scripts/ak.js` (`getConfig`) -- uses `config.log` for error messages.

**Example**:

The Advanced Tabs block requires a specific document structure with section breaks (`---`):

```
+---------------------------------------+
| Advanced Tabs                         |
+=======================================+
| - Tab One                             |
| - Tab Two                             |
| - Tab Three                           |
+---------------------------------------+

---

Content for Tab One goes here.

---

Content for Tab Two goes here.

---

Content for Tab Three goes here.
```

Each `---` creates a new section. The sections following the Advanced Tabs block become the tab panels.

---

## Media

### YouTube

**Purpose**: Converts a YouTube link into a privacy-enhanced embedded iframe. Uses `youtube-nocookie.com` for the embed domain. The iframe is lazy-loaded via an intersection observer.

**Variants**: None.

**Content structure**:

The block receives a link element (`<a>`) rather than the standard block `<div>`. The link must point to a YouTube URL. The video ID is extracted from either:
- The `v` query parameter (e.g., `https://youtube.com/watch?v=abc123`)
- The last path segment (e.g., `https://youtu.be/abc123`)

Any additional query parameters (except `v`) are forwarded to the embed URL. The `rel=0` parameter is always appended (disables related videos from other channels).

**Dependencies**: `scripts/utils/observer.js` -- defers iframe creation until the element scrolls into view.

**Example**:

Authors paste a YouTube URL as a link in their document. The auto-blocking in `scripts.js` detects it and wraps it in a YouTube block:

```
https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

No block table is needed. The link is auto-detected and converted.

---

## Utility

### Fragment

**Purpose**: Loads and inlines content from another EDS page (a "fragment") into the current page. Replaces itself with the fragment's sections.

**Variants**: None.

**Content structure**:

The block receives a link element (`<a>`) rather than the standard block `<div>`. The link `href` points to a fragment path (e.g., `/fragments/promo-banner`). The block:

1. Resolves the link to a path, handling relative paths, same-origin paths, and AEM preview/live URLs.
2. Fetches and parses the fragment HTML.
3. Decorates the fragment content (loads its blocks, applies section metadata).
4. Replaces the link's ancestor element with the fragment's sections.

If the fragment contains a single section, its children are inlined individually. If multiple sections, the entire fragment wrapper is inlined.

**Dependencies**:
- `scripts/utils/fragment.js` (`loadFragment`, `getReplaceEl`)

**Example**:

Authors insert a fragment by adding a link to the fragment page path:

```
/fragments/shared/promo-banner
```

The link is auto-detected and replaced with the content of that fragment page.

---

### Schedule

**Purpose**: Time-based content switching. Fetches a JSON schedule file and displays the fragment corresponding to the current date/time window. Falls back to a default (no start/end) event if no scheduled event matches.

**Variants**: None.

**Content structure**:

The block receives a link element (`<a>`) pointing to a `.json` endpoint. The JSON must contain a `data` array of event objects:

| Field | Required | Description |
|-------|----------|-------------|
| `start` | No | ISO date string for the event start time |
| `end` | No | ISO date string for the event end time |
| `fragment` | Yes | URL path to the fragment to display |
| `name` | No | Event name (used in log messages) |

An event without `start` and `end` is treated as the default fallback. Events are evaluated in reverse order (last match wins). The matching fragment is loaded and inlined, replacing the schedule block.

In non-production environments, the schedule date can be simulated via:
- `localStorage.setItem('aem-schedule', unixTimestampInSeconds)`
- URL query parameter: `?schedule=unixTimestampInSeconds`

In production, if no matching event is found, the block is removed entirely.

**Dependencies**:
- `scripts/ak.js` (`getConfig`, `localizeUrl`)
- `scripts/utils/env.js` -- determines environment (prod/stage/dev)
- `scripts/utils/fragment.js` (`loadFragment`, `getReplaceEl`)

**Example**:

Authors create a spreadsheet (converted to JSON by EDS) with columns for `name`, `start`, `end`, and `fragment`. Then they link to it in the document:

```
/schedules/homepage-hero.json
```

The JSON at that path controls which fragment is displayed based on the current date/time.
