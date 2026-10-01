// module.hero → the `hero` block (site/blocks/hero). Real shape confirmed
// on the ja-jp enterprise/agencies page: identical to module.heroScreen's
// `content.content` Portable Text convention, with media at the same real
// `module.media.media.image` path, resolved via renderImage() (see
// transform/media.js).
import { renderPortableText } from '../portable-text.js';
import { renderImage } from '../media.js';
import { row, cell, block } from '../dom-helpers.js';

export const transformHero = (module, { warnings = [], resolvedRefs = new Map() } = {}) => {
  const rows = [];
  const picture = renderImage(module.media?.media?.image, { warnings });
  if (picture) rows.push(row(cell(picture)));
  const content = renderPortableText(module.content?.content, warnings, resolvedRefs);
  rows.push(row(cell(...content)));
  return block('hero', ...rows);
};
