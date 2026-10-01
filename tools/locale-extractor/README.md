# Locale Extractor

Migrates Falkor's existing, already-translated locale content (Sanity,
project `s6lu43cv`, dataset `production-v4`) into DA-importable HTML, the
build step behind [ADR-0017](../../docs/decisions/0017-translation-workflow.md),
which explains why this content is migrated rather than re-translated.

## Usage

```sh
# One page, for iterating on a transformer:
npm run locale-extractor -- --locale ja-jp --slug enterprise

# A full locale wave (every page/pageVariant for that locale):
npm run locale-extractor -- --locale ja-jp

# Options:
#   --out <dir>          output directory (default: tools/locale-extractor/out)
#   --check-redirects    B6b: check each page's live Falkor path before writing it
```

Writes local `.html` files, one per page, under `<out>/<locale>/<slug>.html`.
It does **not** write to DA directly. Same pattern this project already used
for the Library bootstrap (local export, human review, then upload):
migrated content should be looked at before it goes live, not mechanically
round-tripped straight into DA. Every run also prints warnings to stderr for
anything it couldn't resolve, read them, they're not just noise.

Run `npm run test:locale-extractor` before changing anything here. It's
grounded in a real fixture (one section of the live ja-jp `/enterprise`
page), not synthetic data.

## B6b (redirect continuity): real finding, not just a check

Before building anything for B6b, the real question was answered first:
does a migrated locale page's path ever need a redirect at all? The
existing Worker-side redirect system (`workers/website/handlers/
redirects.js`) already strips and reapplies a locale prefix automatically,
so one unprefixed rule already covers all 10 locales. The only way B6b
produces a real redirect row is if a page's live Falkor path doesn't match
where this extractor puts it, which can only happen if Falkor itself
already redirects that path somewhere else today, something no Sanity
field reveals on its own.

`--check-redirects` answers that empirically: a read-only HEAD request
against the live Falkor path this extractor assumes for each page. **Run
for real against the full ja-jp canary wave (2026-10-01): all 28 pages
already resolve at their expected path. Zero B6b redirect rows needed for
this wave.** Don't assume this holds for every future locale wave without
re-running the check, but don't build a speculative redirect map either,
this is a cheap, real check, not a research project.

## Verified in a real browser (2026-10-01)

Unit tests and a clean lint pass only prove the code does what it was told
to do, not that it matches real content. This was actually checked: the real
output of `npm run locale-extractor -- --locale ja-jp --slug enterprise` was
uploaded to the sandbox DA org and previewed live on `aem.page`.

- **The server-side AEM pipeline accepted the markup cleanly.** Headings got
  real slugified `id` attributes, confirming the documented anchor-promotion
  behavior fires correctly on extracted content.
- **One real bug was found and fixed this way, not by code review alone.**
  Portable Text stores a manual line break as a literal `\n` inside a text
  span. The first version of this tool emitted that `\n` as-is, which a
  browser silently collapses, so every intentional line break would have
  been lost on migration. Real authored content on this site uses explicit
  `<br>` for this (confirmed in `features/c2c.html`'s
  `<h1>Lights.<br>Camera.<br>Cloud.</h1>`), so `transform/portable-text.js`
  now converts `\n` to `<br>`, and the test suite locks this in.
- **`hero-screen` was confirmed decorating and styling correctly**, large,
  bold, centered heading, in a real browser, not just structurally valid
  HTML. Since `spacer`, `logo-wall`, `standalone-text`, `pothole`, and
  `bookend` all go through the exact same `loadBlock()` pipeline (confirmed
  by reading `scripts/ak.js` directly: each block's decoration errors are
  caught individually and never propagate, and `loadStyle()` resolves even
  on a failed CSS load rather than rejecting), there is no code path by
  which one block succeeding and another failing would take down styling
  for the rest of the page.
- **The page initially looked completely unstyled** to a first glance. The
  real cause was not a styling failure. It was that roughly 9 of the page's
  16 block instances (every `bentos`, `side-by-side`, `text-over-image`,
  `touts`, and `standout-mosaic`) are still stubs that correctly emit
  nothing, exactly as designed, which made the page look sparse. Confirming
  this meant checking the one implemented block's own styling in isolation
  (did the heading look large, bold, and centered) rather than judging the
  whole page at once.

## The real scope is bigger than the spike estimated

The original spike sampled one page and found 12 module types, calling the
mapping "near-1:1, bounded." Querying the real data properly (2026-10-01):
**45 distinct module types exist site-wide, and 37 of those appear within
just the ja-jp canary wave** (28 pages), not 12. That's roughly 3x the
surface area the spike implied for finishing even the first locale wave.
This does not mean the approach is wrong, the name-matched-block strategy
still holds up against the bigger list (see table below), it means the
finish line is further away than originally scoped. Three of the newly
found types (`pricingOverview`, `pricingSideBySide`, `pricingTable`) are
correctly out of scope entirely: pricing content has no authorized block
pattern yet in this project (a separate, unratified architecture decision,
D4), that's not an extractor gap to close.

## What's actually implemented vs. stubbed

Prioritized by real page count within the ja-jp wave (highest first),
confirmed against real live Sanity data pulled during this build:

| Module type | Pages | Target block | Status |
|---|---|---|---|
| `module.spacer` | 29 | `spacer` | Done (nearest-keyword size mapping) |
| `module.standaloneText` | 28 | `standalone-text` | Unverified field-shape assumption, flagged |
| `module.bookEnd` | 27 | `bookend` | Unverified field-shape assumption, flagged |
| `module.bentos` | 18 | `bentos` | Done (both real card shapes: `card` and `bento.statsCard`); only 2 of 13 real `bentosLayout.name` values have matching CSS, rest flagged |
| `module.sideBySides` | 17 | `side-by-side` | Done; each array item becomes its own stacked block instance; video media and the "card"/"multiImage" layouts are flagged (see findings) |
| `module.touts` | 16 | `touts` | Done; simplest remaining type, no CTA buttons or module-level title in any real ja-jp content |
| `module.hero` | 15 | `hero` | Done, including media (G-4 resolved) |
| `module.logoWall` | 11 | `logo-wall` | Done (flags `useGlobalConfig`, never fabricates names) |
| `module.cardGridNav` | 9 | `card-grid-nav` | Labels and link-reference done (G-7 resolved); video media still flagged, no real video-asset URL pattern confirmed yet |
| `module.heroTransitionV4` | 9 | `glow-reveal` | Done, including media (G-4 resolved) |
| `module.potholeV4` | 8 | `pothole` | Unverified field-shape and variant choice, flagged; media done (G-4 resolved) |
| `module.carousel` | 8 | `carousel` | Content done (slide heading + CTA) and media (G-4 resolved); logo graphic still flagged |
| `module.heroScreen` | 6 | `hero-screen` | Done, including media (G-4 resolved) |
| `module.pothole` | 6 | `pothole` | Same transformer as potholeV4, confirmed identical shape on real data |
| `module.faq` | 5 | `faq` | Done, including the module's own heading as a sibling element |
| `module.textOverImage` | 3 | `text-over-image` | **Stubbed**, no real data pulled |
| `module.heroSideBySide` | 3 | `hero-side-by-side` | **Stubbed**, no real data pulled |
| `module.tileTable` | 3 | `tile-table` | **Stubbed**, no real data pulled |
| `module.caseStudy` | 3 | `case-study` | **Stubbed**, no real data pulled |
| `module.standoutMosaic` | 2 | `standout-mosaic` | **Stubbed**, no real data pulled |
| `module.pricingSideBySide` | 2 | n/a | **Out of scope** (D4 not ratified) |
| `module.speedbump` | 2 | `speedbump` | **Stubbed**, no real data pulled |
| `module.form` | 2 | `form` | **Stubbed**, no real data pulled |
| `module.pricingOverview` | 2 | n/a | **Out of scope** (D4 not ratified) |
| `module.cardGridEditorial` | 2 | `card-grid-editorial` | **Stubbed**, no real data pulled |
| 11 more types | 1 each | various | **Stubbed or unhandled**, lowest priority by page count |

"Unverified assumption" means the DA-side output shape is real (copied from
a real Library doc or real block JS), but the Sanity-side input field names
are inferred from `module.heroScreen`'s shape, not individually confirmed.
"Stubbed" means it emits an empty block and a loud warning. Nothing is
fabricated either way; see `transform/modules/stubs.js`'s own header comment
for exactly what's needed to finish each one.

**G-4 (media resolution) is done (2026-10-01).** `transform/media.js`
resolves `image.asset._ref` (the real `image-{hash}-{w}x{h}-{ext}` shape) to
a `cdn.sanity.io` URL against the `production-i18n` asset dataset, confirmed
real via grep against published pages. Wired into every module transformer
that carries real static image content (hero, heroScreen, heroTransitionV4,
pothole/potholeV4, carousel). The media field path is NOT uniform across
module types, confirmed real: `module.hero`/`heroScreen`/
`heroTransitionV4`/`cardGridNav` use `module.media.media.image.asset._ref`;
`module.pothole`/`potholeV4` use `module.image.image.asset._ref` or
`module.media.media.image.asset._ref` depending on which of the two real
Sanity module types it is. Crop/hotspot (Cloudflare trim and gravity, D10)
is deliberately NOT wired up, no real published page in the DA org routes
through Cloudflare today, so this stays a flagged warning rather than a
silent, unverifiable transform. `cardGridNav`'s media is real `wistia.video`
content, not a static image, still correctly flagged, not a G-4 gap.

**G-7 (internal reference resolution) is done (2026-10-01).**
`collect-reference-ids.js` walks a page tree for every `reference._ref`;
`fetch.js`'s `resolveReferences(ids, locale)` batch-resolves them to real
page paths. **Real, load-bearing finding from running this against live
data**: a reference almost always points at the EN-US canonical document
even from a ja-jp page (confirmed on the real ja-jp features/
workflow-management page, every `cardGridNav` reference resolved to an
en-us `_id`). Naive resolution would send a Japanese visitor to an English
page; the resolver instead looks up the referenced doc, then looks for a
same-slug sibling in the *target* locale, using it when one exists and
falling back to the referenced doc's own path (flagged `crossLocale: true`)
only when no sibling exists. **Second real finding, found by running the
full 28-page ja-jp wave, not just a single-page spot check**: a referenced
document's own `language` field is sometimes a literal `null`, not a
locale, e.g. `case-studies/north-face` (confirmed via Sanity MCP, no en-us
sibling exists at all). A live HEAD check confirms this content serves at
the bare path with no locale prefix at all
(`frame.io/case-studies/north-face` → 200; the `/en-us/...` equivalent →
308 redirect). `pagePath()` now omits the locale segment entirely when
`language` is falsy, rather than emitting `/null/case-studies/...`.

## Real findings from building this, worth knowing before extending it

- **Corrects the spike's own mapping table.** `block.calendlyButton` does
  NOT map to the standalone `hero-calendly` widget block. On real data it's
  an inline CTA button living inside another module's Portable Text content
  (alongside `block.button`), handled in `transform/portable-text.js`. See
  `transform/index.js`'s header comment.
- **`[[eyebrow|text]]` is a literal authoring convention, not a lockup or
  tag**, confirmed against two real sources (a live page, a Library doc),
  not derived from the Sanity schema's `eyebrow` style name.
- **A manual line break in Portable Text must become `<br>`, not a raw
  `\n`.** See the verification section above.
- **`module.logoWall` frequently has no page-local logo list at all**
  (`useGlobalConfig: true`). There is no Sanity-side data to extract for
  those pages; this is a real gap, not a bug in this tool.
- **A slug can itself contain a `/`** (e.g. `features/workflow-management`,
  real on the ja-jp canary wave), which needs its own output subdirectory,
  not just `<out>/<locale>/`. Found and fixed by actually running a full
  locale wave rather than a single-page `--slug` run.
- **Real, duplicate Sanity documents exist for some slugs** (confirmed on
  the ja-jp wave: `features/c2c`, `features/present`, `enterprise/brands`,
  and others each returned twice from a plain `_type == "page"` query).
  This tool doesn't currently dedupe, it writes whichever one comes last in
  the fetch order, silently overwriting the other. Worth a real dedup pass
  before trusting a full wave's output, not yet built.
- **G-4 and G-7 are both resolved (2026-10-01)**, see the dedicated
  sections above for what changed and what each real finding was.
- **A Portable Text block's `markDefs` can be a literal `null`, not just an
  omitted field.** Found by running the full 28-page ja-jp wave (not caught
  by any single-page spot check): a `module.pothole` block with no marks at
  all crashed `renderSpan`'s `.find()` call, because a `= []` default
  parameter only covers `undefined`, never `null`. Fixed in
  `transform/portable-text.js`.
- **Personalization variantKeys are always dropped (D2)**, never
  locale-baked into a segment; the extractor logs which keys it dropped.
- **`module.bentos` is done (2026-10-01), and surfaced the single biggest
  CSS-coverage gap found in this whole build.** Real `cards[]` mixes two
  distinct Sanity card shapes at runtime: a plain `card` (media + title6/
  normal text) and a `bento.statsCard` (no media, just a stat-number
  heading + caption, confirmed only via the Library's own variant-e example
  since no live DA page authors one yet). bentos.js itself never
  distinguishes these by Sanity type, it decorates any card div
  identically, so one transformer covers both. Bigger finding: **13
  distinct `bentosLayout.name` values exist in real content** (`variantA`
  through `variantL`, plus `variantM`/`variantE`), confirmed via Sanity
  MCP, but `bentos.css` only implements a dedicated CSS grid for 2 of them.
  Within just the ja-jp wave, 15 of the real `module.bentos` instances use
  one of the 11 CSS-unimplemented variants, falling back to the block's
  generic mosaic grid rather than their intended layout. Real content also
  carries `background.mediaDisplayMode`/`size` and `foreground.decoration`/
  `mediaSize` enum values (`"fullWidth"` without `"Shadows"`, `"tall"`,
  `"large"`, `"bleed"`, `"shadows"`) with no matching CSS state at all.
  None of this is guessed into a config line or class name with no CSS to
  back it, every one of these states is flagged with a warning naming the
  real value instead.
- **`module.sideBySides` is done (2026-10-01), and corrected the stub's own
  assumed shape as much as bentos' variant finding.** The real field is an
  ARRAY of independent items (`sideBySides[]`, 1-4 confirmed real per
  module), each one its own stacked `side-by-side` block instance, not one
  block with multiple rows, confirmed by the Library doc's own single-
  instance shape. When more than one item exists, every item after the
  first has a genuinely blank title (an empty-text eyebrow block, not an
  absent field), a shared-section-title authoring pattern, rendered
  faithfully rather than guessed at. Real content also carries up to 2
  media entries per item, but the block only ever renders one picture per
  instance; a second entry is flagged, not dropped silently. A media entry
  can be video-only with no image at all, which this block has literally
  no rendering path for (confirmed on 3 real instances in the ja-jp wave),
  same unresolved video gap as `card-grid-nav`'s. Of the 3 real
  `mediaLayout` values, only `"bleed"` has a matching CSS variant; `"card"`
  and `"multiImage"` (21 of 36 real instances) have none, but `"card"`'s
  real content turned out to structurally match this block's existing
  touts-row feature exactly, which the Library doc's own note said no real
  page used yet, contradicted by this wave's real data.
- **A real bug this surfaced in shared infra, not sideBySides-specific**:
  `renderPortableText`'s eyebrow branch rendered `<p>[[eyebrow|]]</p>` for
  a block with genuinely empty text, instead of dropping it like every
  other empty block (every other style path already checked `text ? ... :
  ''`, the eyebrow branch never did). Found via sideBySides' real blank-
  title case, fixed in `transform/portable-text.js`, benefits every module
  that renders an eyebrow, not just this one.
- **`module.touts` is done (2026-10-01), the simplest of the three
  remaining stubs and the last one prioritized by page count.** One row,
  3-4 real cells, each a title6 heading + normal body, exactly matching
  both the Library doc and a real production page (features/c2c.html), no
  surprises in shape. One real, flagged gap: `touts[].graphicType: "icon"`
  marks that a tout is meant to carry a leading `:iconname:` icon, but
  Sanity never carries a resolvable icon name or asset alongside that
  flag, confirmed across all 35 real `graphicType: "icon"` instances in
  the ja-jp wave, so no icon is fabricated.

**All three page-count-prioritized stubs (bentos/sideBySides/touts) are
now done.** Remaining module types are the 8 lower-page-count ones
(textOverImage/heroSideBySide/tileTable/caseStudy/standoutMosaic/
speedbump/form/cardGridEditorial, 1-3 pages each) plus 11 more at 1 page
each, all still stubbed, see the implementation table above.

## Next steps, in order

1. Pull real Sanity data for the remaining lower-page-count stubs
   (`textOverImage` 3, `heroSideBySide` 3, `tileTable` 3, `caseStudy` 3,
   `standoutMosaic` 2, `speedbump` 2, `form` 2, `cardGridEditorial` 2),
   same pattern as every type above, lowest priority first by page count.
2. Resolve `module.cardGridNav`'s video media (real content is always
   `wistia.video`, no real video-asset URL pattern confirmed yet, a smaller
   remaining slice of G-4, not the whole gap).
3. Dedupe the real, duplicate Sanity documents found on the ja-jp wave
   (`features/c2c`, `features/present`, `enterprise/brands`, others) before
   trusting a full wave's output, see the finding above.
4. Consider whether the 11 CSS-unimplemented `bentos` variants and the
   `side-by-side` video-only media gap (see findings above) warrant real
   CSS/JS work of their own, a separate design decision outside this
   extractor's own scope, not something to silently paper over here.
5. A real-browser review of the newly implemented blocks (hero, glow-reveal,
   cardGridNav, carousel, pothole, bentos, side-by-side, touts, media)
   against a previewed DA page, same pattern as the already browser-
   verified heroScreen/spacer/logoWall (see Verification below for the
   dry-run itself, already done).

## Verification (2026-10-01)

A full `node cli.js --locale ja-jp` run (28 pages, no `--slug` filter) was
run end-to-end after the G-4/G-7 build, not just the test suite:

- Surfaced and fixed two real bugs the test suite alone didn't catch
  (`markDefs: null` crash, `/null/` path from a null-language reference
  target), both now covered by regression tests in `extractor.test.js`.
- Confirmed 28/28 pages write with no crash.
- Confirmed `features/workflow-management.html`'s `card-grid-nav` CTAs all
  resolve to `/ja-jp/...` paths, not `/en-us/...` (the G-7 cross-locale
  bug this session's work set out to fix).
- `npx eslint tools/locale-extractor` and
  `node tools/locale-extractor/extractor.test.js` both clean.
