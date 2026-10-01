// module.carousel → the `carousel` block (site/blocks/carousel). Real shape
// confirmed on the ja-jp enterprise/agencies page: `slides[]`, each
// `{ image: {enhancedMedia}, text: { content: [...] } }`. One row = one
// slide, with a media cell and a content cell (carousel.js's own
// `extractRowMedia` unwraps exactly this authoring shape). `text.content`
// is Portable Text mixing `block.graphic` (a customer logo reference, a
// different reference kind than a plain image asset, still unresolved),
// a `block` (title5-style slide heading), and `block.button` (a CTA to an
// internal reference, already handled generically by renderPortableText's
// CTA grouping, no new code needed here). `block.graphic` isn't a
// style-bearing Portable Text block, so renderPortableText's own generic
// "unhandled block type" path covers it, correctly dropping the unresolved
// logo rather than crashing on it.
//
// carousel.js needs 3+ rows to activate at all; real carousels on this
// wave have 10+ slides, so that threshold is never the limiting factor.
import { renderPortableText } from '../portable-text.js';
import { renderImage } from '../media.js';
import { row, cell, block } from '../dom-helpers.js';

export const transformCarousel = (module, { warnings = [], resolvedRefs = new Map() } = {}) => {
  const slides = module.slides ?? [];
  const rows = slides.map((slide) => {
    const picture = renderImage(slide.image?.image, { warnings });
    const content = renderPortableText(slide.text?.content, warnings, resolvedRefs);
    const cells = picture ? [cell(picture), cell(...content)] : [cell(...content)];
    return row(...cells);
  });
  return block('carousel', ...rows);
};
