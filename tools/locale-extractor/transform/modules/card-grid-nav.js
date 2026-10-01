// module.cardGridNav → the `card-grid-nav` block (site/blocks/card-grid-nav).
// Real shape confirmed on the ja-jp features/workflow-management page:
// `cardGridNavItems[]`, each `{ link: { label, reference }, media }`. Real
// content here never uses a static image (always `wistia.video`, matching
// this project's own Library-doc finding that "card-grid-nav never uses
// images in real content"), there's no real video-asset URL pattern
// confirmed anywhere in this extractor's research, so that part stays
// flagged. `link.reference` (G-7) is now resolved via the same
// `resolvedRefs` map every other reference-carrying field uses.
import { row, cell, block } from '../dom-helpers.js';

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const transformCardGridNav = (module, { warnings = [], resolvedRefs = new Map() } = {}) => {
  const items = module.cardGridNavItems ?? [];
  const rows = items.map((item) => {
    const label = escapeHtml(item.link?.label ?? '');
    const resolved = item.link?.reference?._ref && resolvedRefs.get(item.link.reference._ref);
    if (item.link?.reference && !resolved) {
      warnings.push(`module.cardGridNav "${module._key}" item "${item.link.label}" links to an unresolved internal Sanity document (${item.link.reference._ref}). Emitted as plain text, not a link.`);
    }
    if (resolved?.crossLocale) {
      warnings.push(`module.cardGridNav "${module._key}" item "${item.link.label}" links to ${resolved.path}, no localized sibling was found for this reference, this sends the visitor out of their locale.`);
    }
    if (item.media) {
      warnings.push(`module.cardGridNav "${module._key}" item "${item.link?.label}" has media this extractor doesn't resolve yet (G-4, real content here is always wistia video, no real video-asset URL pattern confirmed yet).`);
    }
    const content = resolved ? `<a href="${escapeHtml(resolved.path)}">${label}</a>` : label;
    return row(cell(`<p>${content}</p>`));
  });
  return block('card-grid-nav', ...rows);
};
