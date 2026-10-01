// module.heroScreen → the `hero-screen` block (site/blocks/hero-screen).
// Real shape confirmed on the ja-jp enterprise page: content lives at
// `module.content.content` (a Portable Text array). Media lives at
// `module.media.media.image` (confirmed real, see transform/media.js's own
// header comment for the full field-path story), resolved via
// renderImage(). hero-screen.js itself only cares about cell shape (one
// cell with a <picture> becomes media, everything else becomes content),
// not row count, so emitting two single-cell rows is a safe,
// real-precedent-matching shape.
import { renderPortableText } from '../portable-text.js';
import { renderImage } from '../media.js';
import { row, cell, block } from '../dom-helpers.js';

export const transformHeroScreen = (module, { warnings = [], resolvedRefs = new Map() } = {}) => {
  const rows = [];
  const picture = renderImage(module.media?.media?.image, { warnings });
  if (picture) rows.push(row(cell(picture)));
  const content = renderPortableText(module.content?.content, warnings, resolvedRefs);
  rows.push(row(cell(...content)));
  return block('hero-screen', ...rows);
};
