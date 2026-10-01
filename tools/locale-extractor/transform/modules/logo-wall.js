// module.logoWall → the `logo-wall` block (site/blocks/logo-wall), one
// partner name per row (must match a real icons/partners/ file per
// docs/conventions/blocks.md's Library Sync notes). Real shape confirmed on the ja-jp
// enterprise page: `useGlobalConfig: true`, with NO page-local logo list at
// all, the page's logos come from a separate global/site-wide config this
// extractor doesn't query. Fabricating partner names here would be worse
// than leaving the block empty, so this always flags for manual curation
// when useGlobalConfig is set, and only renders page-local logos (a `logos`
// array) when they're actually present.
import { row, cell, block } from '../dom-helpers.js';

export const transformLogoWall = (module, { warnings = [] } = {}) => {
  if (module.useGlobalConfig) {
    warnings.push(`module.logoWall "${module._key}" uses useGlobalConfig=true, this extractor has no resolver for the global logo list yet. Emitted empty; populate partner rows manually.`);
    return block('logo-wall');
  }
  const names = module.logos ?? [];
  if (!names.length) {
    warnings.push(`module.logoWall "${module._key}" has neither useGlobalConfig nor a logos list, emitted empty.`);
  }
  return block('logo-wall', ...names.map((name) => row(cell(name))));
};
