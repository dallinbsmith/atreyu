// module.sideBySides → the `side-by-side` block (site/blocks/side-by-side).
// Real shape confirmed via Sanity MCP on the ja-jp enterprise page, cross-
// checked against the real Library doc (system/library/blocks/
// side-by-side.html): one `<div class="side-by-side media-right">...</div>`
// per block instance, text+media only in that example, and a header note
// flagging "the tout-list region exists in the block but no real page has
// used it yet". Real data below contradicts that note (see finding 3).
//
// Real, load-bearing finding 1: `module.sideBySides.sideBySides[]` is an
// ARRAY of independent items (1-4 confirmed real in the ja-jp wave), each
// one its own `side-by-side` block instance, stacked on the page, not one
// block sharing all the items (matching the Library's single-instance
// shape exactly, confirmed via its "one block = one SideBySideItem" note).
// When there's more than one item, every item after the first has a blank
// `title` (confirmed real: an empty eyebrow, no title2 block at all), a
// shared-section-title authoring pattern, not a bug. Rendered faithfully:
// nothing is forced in when `title` is blank.
//
// Real, load-bearing finding 2: `medias[]` sometimes carries 2 entries
// (confirmed real, both `layout` values, both "multiImage" and "card"
// `mediaLayout`), but side-by-side.js's own `mediaRow` finder only ever
// picks ONE `picture`/`img`. Only the first media entry is rendered; a
// second is flagged, not silently dropped without a trace. A media entry
// can also be video-only (no `image` field at all, `mediaType: "video"`),
// which this block has no video-rendering path for at all (`mediaRow`'s
// finder only looks for `picture, img`), flagged, same as
// `card-grid-nav`'s existing wistia-video gap.
//
// Real, load-bearing finding 3: `mediaLayout` has 3 real values
// (`multiImage`/`bleed`/`card`), but only `bleed` has a matching CSS
// variant (`&.bleed` in side-by-side.css). Real content under `card`
// turned out to structurally match this block's existing `touts` row
// feature exactly (confirmed real: title5+normal text with an embedded
// `block.button` CTA, plus a `touts.touts[]` list of title6+normal+CTA
// items), so it needed no new DOM support, just the already-shipped
// touts-row path the Library doc's own note said was unused.
import { renderImage } from '../media.js';
import { renderPortableText } from '../portable-text.js';
import { row, cell, block } from '../dom-helpers.js';

const resolveVariantClasses = (sbs, warnings, itemLabel) => {
  const classes = [];
  if (sbs.layout === 'textLeftMediaRight') {
    classes.push('media-right');
  } else if (sbs.layout && sbs.layout !== 'mediaLeftTextRight') {
    warnings.push(`module.sideBySides item "${itemLabel}": layout "${sbs.layout}" is not a recognized value, rendered without a media-left/media-right variant.`);
  }
  if (sbs.mediaLayout === 'bleed') {
    classes.push('bleed');
  } else if (sbs.mediaLayout) {
    warnings.push(`module.sideBySides item "${itemLabel}": mediaLayout "${sbs.mediaLayout}" has no matching CSS variant in side-by-side.css (only "bleed" does), rendered with the block's default media treatment.`);
  }
  return classes;
};

const renderTouts = (toutsField, warnings, resolvedRefs) => {
  if (!toutsField?.touts?.length) return '';
  const items = toutsField.touts.map((tout) => {
    const content = renderPortableText(tout.content?.content, warnings, resolvedRefs).join('');
    return `<li>${content}</li>`;
  }).join('');
  return `<ul>${items}</ul>`;
};

const renderMedia = (medias, warnings, itemLabel) => {
  if (!medias?.length) return '';
  if (medias.length > 1) {
    warnings.push(`module.sideBySides item "${itemLabel}": ${medias.length} media entries exist, this block only renders the first (side-by-side.js supports exactly one picture per instance).`);
  }
  const [first] = medias;
  if (!first.image) {
    warnings.push(`module.sideBySides item "${itemLabel}": media is video-only (mediaType "${first.mediaType}"), this block has no video-rendering path (its mediaRow finder only looks for picture/img), not rendered.`);
    return '';
  }
  return renderImage(first.image, { warnings }) ?? '';
};

const renderOne = (sbs, { warnings, resolvedRefs }) => {
  const itemLabel = sbs._key;
  const classes = ['side-by-side', ...resolveVariantClasses(sbs, warnings, itemLabel)];
  const titleHtml = renderPortableText(sbs.title?.content, warnings, resolvedRefs);
  const contentHtml = renderPortableText(sbs.content?.content, warnings, resolvedRefs);
  const toutsHtml = renderTouts(sbs.touts, warnings, resolvedRefs);
  const mediaHtml = renderMedia(sbs.medias, warnings, itemLabel);

  const rows = [row(cell(...titleHtml, ...contentHtml))];
  if (toutsHtml) rows.push(row(cell(toutsHtml)));
  if (mediaHtml) rows.push(row(cell(mediaHtml)));
  return block(classes.join(' '), ...rows);
};

// Returns N concatenated `side-by-side` block divs, not one block with N
// rows, matching real DA precedent (one instance per authored item).
export const transformSideBySides = (module, { warnings = [], resolvedRefs = new Map() } = {}) => {
  const items = module.sideBySides ?? [];
  return items.map((sbs) => renderOne(sbs, { warnings, resolvedRefs })).join('');
};
