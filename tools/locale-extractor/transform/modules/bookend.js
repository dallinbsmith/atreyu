// module.bookEnd → the `bookend` block (site/blocks/bookend). Real Library
// shape: one row, one cell, a heading, then one or two CTA links in a
// single paragraph. Uses the same Portable Text + CTA-grouping renderer as
// hero-screen since the content shape (heading + grouped buttons) matches.
//
// UNVERIFIED ASSUMPTION: module.bookEnd's own field shape wasn't pulled from
// live data in this pass, assumes the same `content.content` convention as
// module.heroScreen. Confirm against a real document before trusting fully.
import { renderPortableText } from '../portable-text.js';
import { row, cell, block } from '../dom-helpers.js';

export const transformBookend = (module, { warnings = [], resolvedRefs = new Map() } = {}) => {
  warnings.push(`module.bookEnd "${module._key}": field shape is an unverified assumption, not confirmed against live Sanity data.`);
  const content = renderPortableText(module.content?.content, warnings, resolvedRefs);
  return block('bookend', row(cell(...content)));
};
