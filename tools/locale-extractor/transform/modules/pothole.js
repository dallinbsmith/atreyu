// module.pothole AND module.potholeV4 → the `pothole` block (site/blocks/
// pothole). Both Sanity module types share one transformer because they use
// the same `content.content` Portable Text convention. One field difference:
// module.pothole's media lives at
// `module.image.image`, while module.potholeV4 (like hero/heroScreen) uses
// `module.media.media.image`. Different field names, same extendedImage
// shape underneath, resolved via the same renderImage() either way.
//
// Still unverified: which pothole CSS variant (top/bottom/overflow/
// right-aligned/glow-*) a given document should map to, emits the bare
// default (no variant class) and flags it so a human picks the variant.
import { renderPortableText } from '../portable-text.js';
import { renderImage } from '../media.js';
import { row, cell, block } from '../dom-helpers.js';

export const transformPothole = (module, { warnings = [], resolvedRefs = new Map() } = {}) => {
  warnings.push(`${module._type} "${module._key}": no CSS variant (top/bottom/overflow/right-aligned/glow-*) was chosen, defaulting to no variant class.`);
  const rows = [];
  const imageField = module.media?.media?.image ?? module.image?.image;
  const picture = renderImage(imageField, { warnings });
  if (picture) rows.push(row(cell(picture)));
  const content = renderPortableText(module.content?.content, warnings, resolvedRefs);
  rows.push(row(cell(...content)));
  return block('pothole', ...rows);
};
