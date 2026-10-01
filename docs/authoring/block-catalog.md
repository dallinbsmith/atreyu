# Block catalog

All 53 blocks in `blocks/`, their canonical names and the variant tokens authors may use. Code conventions for blocks: [conventions/blocks.md](../conventions/blocks.md). Section-level options: [section-metadata.md](section-metadata.md).

## Names are a contract

A block's name and its authored variant tokens are written into DA documents, the DA Library, `data-testid` values (`ak.js` builds `${blockName}-cta-${role}`) and `data-variant` (mirrored from the authored tokens). So ([ADR-0016](../decisions/0016-block-names-are-a-contract.md)):

1. Renaming or removing a **stable** block or one of its authored tokens needs a decision record and a content migration that rewrites every DA document and the Library sheet. Keep a back-compat shim until a crawl shows zero uses. No shims exist today.
2. **Provisional** names may change freely until real content uses them; then they become stable.
3. New content uses stable names only.

## How to read the table

- **Authored tokens** are what an author types in the block header: `Hero (large, center)` → `class="hero large center"`.
- **Runtime classes** are added by the block's JavaScript. Authors must not type them.
- **Frame.io module** is the matching component on the current frame.io site (Sanity `module.*` name), useful when migrating a page.

| Block | Authored tokens | Runtime classes (not authorable) | Purpose | Frame.io module | Status |
|---|---|---|---|---|---|
| advanced-tabs | none | none | Tabbed panels built from sections | none | stable |
| bentos | `variant-m`, `variant-e` (CSS only). Per-card config line: `media:`, `bg:`, `decoration:` | none | Bento card grid | `module.bentos` | stable |
| bookend | none | none | Closing CTA panel | `module.bookEnd` | stable |
| card | `center`, `quiet`, `hash-aware` | none | Single content card | none | stable |
| card-grid-editorial | none | `cge-in`, `cge-hidden` | Grid of linked image cards | `module.cardGridEditorial` | stable |
| card-grid-landscape | `square` | `is-active` | Slider below 768px, grid above | `module.cardGridLandscapeSquare` | stable |
| card-grid-nav | none | none | Cross-link grid of feature pages | `module.cardGridNav` | stable |
| carousel | none | none (`carousel-nav-*` are child classes) | One slide per row | `module.carousel` | stable |
| carousel-media | none | `is-active`, `is-inactive` (on slides) | Media-only carousel | `module.carouselMedia` | stable |
| carousel-with-touts | `blurred-background` | `is-active` | Device-frame carousel with touts | `module.carouselWithTouts` | stable |
| case-study | none | none | Customer story with stats rail | `module.caseStudy` | stable |
| chiclet-constellation | none | `is-animating` | Animated icon constellation | `module.chicletConstellation` | stable |
| columns | `image-cover`, `gap-xs`/`s`/`m`/`l`/`xl`/`xxl`, `align-top`, `z-pattern`, `cards` | none | Generic row/column grid | none | stable |
| faq | none | none | Question/answer accordion | `module.faq` | stable |
| floating-action-button | none | `fab-animate` | Fixed pill that opens a video modal | `module.floatingActionButton` | stable |
| footer | none | none | Site footer, loaded from a fragment | none (site chrome) | stable |
| footer-glow | none | none | Decorative glow video/poster band | none | **provisional** (may become a section style) |
| form | `inline`, `compact` | `form-invalid` | External form embed/renderer | `module.form` | stable |
| fragment | none | none | Include another document by path | none (framework) | stable |
| glow-reveal | `no-glow` | `is-in` | Mid-page glowing image reveal | `module.heroTransitionV4` | stable |
| header | none | `is-open`, `is-mobile-open` (children) | Site navigation | none (site chrome) | stable |
| hero | `small`, `large`, `full`, `light`, `stack`, `center`, `quiet-background` | `hero-text-start`, `hero-text-end` | Full-bleed banner | `module.hero` | stable |
| hero-calendly | `light` (default is dark) | none | Hero with inline Calendly widget | `module.heroCalendlyForm` | stable |
| hero-cards-transition | none | `hc-scrub`, `hc-in` | Pinned card wall behind a title | `module.heroCardsTransition` | stable |
| hero-image-wall | `small`, `large`, `full`, `light` | none | Hero over a tiled image wall | `module.heroImageWall` | stable |
| hero-screen | `no-glow` | none | Centered hero above a glowing product screen | `module.heroScreen` | stable |
| hero-side-by-side | `media-right` | `no-media`, `no-text` | Two-column hero | `module.heroSideBySide` | stable |
| image-cloud | none | `is-scrubbing` | Floating images around a lockup | `module.imageCloud` | stable |
| image-sequence | none | `prompter`, `prompter-scrub` | Scroll-scrubbed word-by-word prompter | `module.imageSequence` | stable |
| logo-tile-wall | none | `is-animating`, `is-paused` | Rows of logo tiles | `module.logoTileWall` | stable |
| logo-wall | none | `is-animating`, `is-paused` | Scrolling logo marquee | `module.logoWall` | stable |
| manifesto | none | `is-animating` | Big statement, image and video CTA | `module.manifesto` | stable |
| media-with-text | `left`, `right`, `glassborder` | none | Media stacked above text | `module.mediaWithText` | stable |
| organic-mosaic | none | `is-scrubbing` | Media-only parallax mosaic | `module.organicMosaic` | stable |
| pothole | `top`, `bottom` (default), `overflow`, `right-aligned`, `glow-purple`/`blue`/`pink`/`green`. Optional last row `scale: n` | none | Parallax background behind a CTA | `module.pothole`, `module.potholeV4` | stable |
| pricing | none (`highlighted` is set by JS on a child `.pricing-plan`) | none | Plan cards (name, price, features, CTA) | unclear (frame.io has three pricing modules) | **provisional** (name will collide with future pricing blocks) |
| quote-interactive | none | none | Testimonial slides with modal | `module.quoteInteractive` | stable |
| rich-text | `center` | none | Rich-text document body | `module.richTextDocument` | stable |
| schedule | none | none | Show a fragment between start and end dates | none | stable |
| section-metadata | see [section-metadata.md](section-metadata.md) | `has-background`, `light-scheme`/`dark-scheme` | Section configuration | none (framework) | stable |
| side-by-side | `media-right`, `touts-grid`, `bleed` | `no-media`, `no-text` | One side-by-side item | `module.sideBySides` | stable |
| spacer | `s`, `m`, `l`, `xl`, `xxl` | none | Decorative vertical space | `module.spacer` | stable |
| speedbump | none | none | Rounded full-bleed media card with text | `module.speedbump` | stable |
| standalone-media | `left`, `right`, `center`, `glassborder` | none | Full-width image, loop or video poster | `module.standaloneMedia` | stable |
| standalone-text | none | `standalone-text-single`, `standalone-text-columns` | Intro text in one or two columns. Prefer default content for one column | `module.standaloneText` | stable |
| standout-mosaic | none | none | Device mockup over a parallax mosaic | `module.standoutMosaic` | stable |
| sticky-background | none | none | Pinned media behind scrolling rows | `module.stickyBackground` | stable |
| table | none | none | Data table (first row becomes the header) | none | stable |
| text-over-image | none | none | Eyebrow and title over media | `module.textOverImage` | stable |
| tile-table | none | none | Tile grid with detail modal | `module.tileTable` | stable |
| touts | none | none | Icon-led value-proposition row | `module.touts` | stable |
| video-playlist | none | none (`video-playlist-featured`/`-thumb` are child classes) | Featured video plus a list | `module.videoPlaylist` | stable |
| youtube | none | none | Privacy-mode YouTube embed plus VideoObject structured data | none | stable |

Not blocks, but authored as tables: **Experiment** and **Personalize** are configuration tables compiled and removed before the page renders. See [personalization.md](personalization.md).

## Blocks that overlap

These are deliberate: each pair maps 1:1 to a distinct frame.io module.

| Blocks | Rule |
|---|---|
| `side-by-side` / `hero-side-by-side` | Keep both. `media-right`, `no-media`, `no-text` mean the same in each |
| `standalone-media` / `media-with-text` | Keep both. `left`, `right`, `glassborder` mean the same in each |
| `hero` / `hero-image-wall` | Keep both. `small`, `large`, `full`, `light` mean the same in each |
| `standalone-text` / `rich-text` / default content | When migrating, map single-column text to default content; use `standalone-text` only for two columns |
| `footer-glow` / `bookend` / section `style: glow` | Decorative glow done three ways. `footer-glow` is provisional and may be replaced by the section style |
| `pricing` vs future pricing overview/table/compare blocks | `pricing` stays provisional until those are designed |

## Library

Each block should have an example in the DA Library (`/system/library/blocks`). When a block's rows, columns or tokens change, update its Library example in the same change ([conventions/blocks.md](../conventions/blocks.md#library-sync)).
