// module.bentos → the `bentos` block (site/blocks/bentos). Real shape
// confirmed via Sanity MCP against the real features/c2c page (en-us,
// module keys c08f818acca8 / e7071f8d04b581dd0a02373da5045d4f), cross-
// checked against every real module.bentos instance in the ja-jp wave:
// `bentosLayout.name` (variant), `cards[]`, each `{ content, background,
// foreground, textPlacement, textAlignment, bentoMediaLayout }`.
//
// Real finding: `cards[]` mixes two distinct Sanity card types at runtime,
// confirmed on the real ja-jp enterprise page. A plain `card` (handled
// above) has media + a title6/normal pair. A `bento.statsCard` (no DA page
// in this org authors one yet, only confirmed via the Library's own
// variant-e example, `<h3>50%</h3><p>faster time to market</p>`) has no
// media at all, just a stat-number heading and a caption. bentos.js itself
// never distinguishes these by Sanity type, it decorates any card div
// identically (heading → title, body paragraphs → body), so one `renderCard`
// below genuinely covers both shapes without a type branch, matching the
// block's own DOM-only (not Sanity-type-aware) decoration contract.
//
// `module.bentos.name` is a duplicate of the heading text in the
// `module.standaloneText` that precedes it in real content (confirmed on
// features/c2c.html: name "Fast, reliable, and secure from the start."
// matches that page's own rich-text heading, not independently rendered
// inside the bentos block itself), so it's intentionally not emitted here.
import { renderImage } from '../media.js';
import { renderPortableText } from '../portable-text.js';
import { row, cell, block } from '../dom-helpers.js';

// Real, load-bearing finding: 13 distinct `bentosLayout.name` values exist
// in real content (variantA..variantL plus variantM/variantE, confirmed via
// Sanity MCP), but bentos.css only implements a dedicated CSS grid for
// variant-m and variant-e. Every other name falls back to the block's own
// generic ":not(.variant-m, .variant-e)" mosaic grid. Within just the
// ja-jp wave, roughly a third of real module.bentos instances use one of
// these CSS-unimplemented variants. Emitting a made-up class name
// (`variant-a`) would silently do nothing (no matching CSS rule exists),
// so this only emits a class for the two real, CSS-backed names and flags
// everything else instead of guessing.
const VARIANT_CLASSES = { variantM: 'variant-m', variantE: 'variant-e' };

// Real content's card heading is always style "title6" but renders as
// `<h3>` in real production DA content, not `<h6>` per renderPortableText's
// generic STYLE_TO_TAG mapping (see that function's own comment).
const CARD_HEADING_TAG = 'h3';

// Each resolver below mirrors bentos.js's own `OPT`/`SHORT` config-line
// parsing exactly (confirmed real on features/c2c.html: "bg: full",
// "decoration: glassborder"), and only emits a line for a state this
// project's bentos.css actually has a CSS rule for. Real content also
// carries enum values with no matching CSS at all (e.g. background
// .mediaDisplayMode "fullWidth" without "Shadows", .size "tall",
// foreground.mediaSize "large"/"bleed", all confirmed present in the real
// ja-jp wave). Those are flagged, not forced into a line that would
// render with no visual effect.
const resolveBgConfig = (background, warnings, cardLabel) => {
  if (background?.mediaDisplayMode === 'fullWidthWithShadows') return 'bg: full';
  if (background?.size === 'short') return 'bg: short';
  if (background?.mediaDisplayMode && !['', 'cover'].includes(background.mediaDisplayMode)) {
    warnings.push(`module.bentos card "${cardLabel}": background.mediaDisplayMode "${background.mediaDisplayMode}" has no matching CSS state in bentos.css, rendered without a bg: config line.`);
  }
  if (background?.size && !['default', 'short'].includes(background.size)) {
    warnings.push(`module.bentos card "${cardLabel}": background.size "${background.size}" has no matching CSS state in bentos.css, rendered without a bg: config line.`);
  }
  return null;
};

const resolveDecorationConfig = (foreground, warnings, cardLabel) => {
  if (foreground?.decoration === 'glassborder') return 'decoration: glassborder';
  if (foreground?.decoration && foreground.decoration !== 'none') {
    warnings.push(`module.bentos card "${cardLabel}": foreground.decoration "${foreground.decoration}" has no matching CSS state in bentos.css, rendered without a decoration: config line.`);
  }
  return null;
};

const resolveSizeConfig = (foreground, warnings, cardLabel) => {
  if (foreground?.mediaSize === 'small') return 'size: small';
  if (foreground?.mediaSize && !['icon', 'small'].includes(foreground.mediaSize)) {
    warnings.push(`module.bentos card "${cardLabel}": foreground.mediaSize "${foreground.mediaSize}" has no matching CSS state in bentos.css, rendered without a size: config line.`);
  }
  return null;
};

// bentos.js's own default comment ("Defaults mirror Falkor: text at bottom,
// centre-aligned"), so only a non-default value needs an explicit line.
const resolvePlacementConfig = (textPlacement) => (
  textPlacement && textPlacement !== 'bottom' ? `placement: ${textPlacement}` : null
);

const resolveAlignConfig = (textAlignment) => (
  textAlignment && textAlignment !== 'center' ? `align: ${textAlignment}` : null
);

const resolveVariantClass = (bentosLayout, warnings, moduleKey) => {
  const name = bentosLayout?.name;
  if (VARIANT_CLASSES[name]) return VARIANT_CLASSES[name];
  if (name) {
    warnings.push(`module.bentos "${moduleKey}": bentosLayout.name "${name}" has no matching CSS grid in this project's bentos block (only variantM/variantE are implemented), falls back to the default mosaic grid.`);
  }
  return null;
};

// Real finding: `bento.statsCard` (a stat-number + caption card, no media,
// no foreground/background at all, confirmed real on the ja-jp enterprise
// page, cross-checked against the Library's own variant-e stats example:
// `<h3>50%</h3><p>faster time to market</p>`, a heading + body, nothing
// else) carries its alignment at `content.alignment`, not `textAlignment`
// like a real `card`-type card. It also carries a `content.columns` grid-
// span field ("12"/"8" both confirmed real) with no matching CSS anywhere
// in bentos.css, flagged rather than silently dropped.
const resolveStatsColumnsWarning = (card, warnings, cardLabel) => {
  const columns = card.content?.columns;
  if (columns && columns !== '12') {
    warnings.push(`module.bentos card "${cardLabel}": content.columns "${columns}" (a bento.statsCard grid-span field) has no matching CSS in this project's bentos block, rendered without any column-span styling.`);
  }
};

const renderCard = (card, { warnings, resolvedRefs, moduleKey }) => {
  const cardLabel = card._key ?? moduleKey;
  resolveStatsColumnsWarning(card, warnings, cardLabel);
  const alignment = card.textAlignment ?? card.content?.alignment;
  const configLines = [
    resolveBgConfig(card.background, warnings, cardLabel),
    resolveDecorationConfig(card.foreground, warnings, cardLabel),
    resolveSizeConfig(card.foreground, warnings, cardLabel),
    resolvePlacementConfig(card.textPlacement),
    resolveAlignConfig(alignment),
  ].filter(Boolean).map((line) => `<p>${line}</p>`);

  const opts = { warnings };
  const bgImage = renderImage(card.background?.media?.media?.image, opts);
  const fgImage = renderImage(card.foreground?.media?.media?.image, opts);
  const cardText = card.content?.content;
  const content = renderPortableText(cardText, warnings, resolvedRefs, CARD_HEADING_TAG);

  return cell(...configLines, bgImage ?? '', fgImage ?? '', ...content);
};

// Real content always authors every card inside one row (confirmed on both
// features/c2c.html variants and every real ja-jp instance, 2-4 cards),
// matching bentos.js's own per-row `--card-count` + the block's non-M/E
// default grid, which already reflows any card count across the row.
export const transformBentos = (module, { warnings = [], resolvedRefs = new Map() } = {}) => {
  const variantClass = resolveVariantClass(module.bentosLayout, warnings, module._key);
  const cards = (module.cards ?? []).map((card) => renderCard(card, {
    warnings, resolvedRefs, moduleKey: module._key,
  }));
  const className = ['bentos', variantClass].filter(Boolean).join(' ');
  return block(className, row(...cards));
};
