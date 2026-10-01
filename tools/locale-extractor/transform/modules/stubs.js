// Stubbed module transformers, real target DA block shape is known (see
// each comment, sourced from Library docs / blocks.md), but this pass did not
// pull live Sanity field data for these module types, unlike heroScreen/
// spacer/logoWall above. Writing a detailed transform against a guessed
// field shape would be worse than an honest stub: a wrong-but-confident
// mapping silently ships bad content, while a stub fails loudly (a visible
// warning + an empty block) until someone does the same real-data pull these
// other modules got.
//
// To finish one: query a real document for that module type (same pattern as
// fetch.js's `fetchPageShape`), confirm its field names, then move it out of
// this file into its own module file following hero-screen.js/spacer.js as
// the worked examples.
import { block } from '../dom-helpers.js';

const stub = (sanityType, daBlock, note) => (module, { warnings = [] } = {}) => {
  warnings.push(`${sanityType} "${module._key}" → "${daBlock}" is not yet implemented against real field data. ${note}`);
  return block(daBlock);
};

// Real shape (text-over-image.html Library doc): one media cell (decorative
// background image, alt cleared) + one text cell (eyebrow + heading).
export const transformTextOverImage = stub('module.textOverImage', 'text-over-image', 'Needs real field names (media ref, eyebrow/heading content) pulled from a live module.textOverImage document.');

// Real shape (standout-mosaic.js authoring contract): a title cell, a
// lone device-media row, and a multi-picture mosaic-card row.
export const transformStandoutMosaic = stub('module.standoutMosaic', 'standout-mosaic', 'Needs real field names (title, device media, card image list) pulled from a live module.standoutMosaic document.');
