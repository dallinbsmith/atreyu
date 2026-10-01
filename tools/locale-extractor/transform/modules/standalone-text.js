// module.standaloneText → the `standalone-text` block (site/blocks/
// standalone-text), real shape per its Library doc: exactly one row, two
// cells, first cell is the heading column, second is body copy beside it.
//
// UNVERIFIED ASSUMPTION: this module's own Sanity field shape hasn't been
// pulled from live data the way heroScreen/spacer/logoWall were, this
// assumes the same `content.content` Portable Text array convention as
// heroScreen, splitting the first heading-styled block into cell 1 and
// everything else into cell 2. Confirm against a real module.standaloneText
// document before trusting this on real content.
import { renderPortableText } from '../portable-text.js';
import { row, cell, block } from '../dom-helpers.js';

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

export const transformStandaloneText = (
  module,
  { warnings = [], resolvedRefs = new Map() } = {},
) => {
  warnings.push(`module.standaloneText "${module._key}": field shape is an unverified assumption (see comment in standalone-text.js), not confirmed against live Sanity data.`);
  const rendered = renderPortableText(module.content?.content, warnings, resolvedRefs);
  const headingIndex = rendered.findIndex((html) => HEADING_TAGS.has(html.match(/^<(\w+)/)?.[1]));
  const heading = headingIndex >= 0 ? rendered[headingIndex] : '';
  const body = rendered.filter((_, i) => i !== headingIndex);
  return block('standalone-text', row(cell(heading), cell(...body)));
};
