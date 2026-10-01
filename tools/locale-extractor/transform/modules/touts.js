// module.touts → the `touts` block (site/blocks/touts). Real shape
// confirmed via Sanity MCP on the ja-jp enterprise page, cross-checked
// against the real Library doc and a real production page
// (features/c2c.html): one row, each cell a title6 heading + normal body,
// decorated via the same shared `decorateTout()` helper bentos/
// side-by-side already use. The simplest of the remaining module types:
// bounded 3-4 real items per module, no CTA buttons and no module-level
// title ever carrying real text in the whole ja-jp wave (confirmed:
// `module.touts.title.content` is always null/absent, same
// internal-label-only pattern as `module.bentos.name`, not independently
// rendered).
//
// Real finding: `touts[].graphicType: "icon"` flags that a tout is meant
// to carry a leading `:iconname:` icon, but Sanity never carries a
// resolvable icon name or asset alongside that flag, just the bare
// boolean-ish value. There's no honest value to fabricate an icon name
// from, so this is flagged instead of guessed.
import { renderPortableText } from '../portable-text.js';
import { row, cell, block } from '../dom-helpers.js';

const renderTout = (tout, { warnings, resolvedRefs }) => {
  if (tout.graphicType === 'icon') {
    warnings.push(`module.touts tout "${tout._key}": graphicType "icon" flags a leading icon, but no resolvable icon name/asset exists in the Sanity field data, rendered without one.`);
  }
  const content = renderPortableText(tout.content?.content, warnings, resolvedRefs);
  return cell(...content);
};

export const transformTouts = (module, { warnings = [], resolvedRefs = new Map() } = {}) => {
  const items = module.touts ?? [];
  const cells = items.map((tout) => renderTout(tout, { warnings, resolvedRefs }));
  return block('touts', row(...cells));
};
