import { getMetadata } from '../ak.js';

// Lets a block delegate its rendering to one of several JS modules, chosen by
// a page-level metadata value, instead of growing internal branches for
// meaningfully different behavior per page (see Stericycle's header pattern:
// a nav-variant metadata field picks which module to import). Reach for this
// when the variants are different BEHAVIOR, not just different CSS classes —
// plain CSS variants (`Hero (large, dark)` -> `.hero.large.dark`) don't need
// this at all.
//
// No caller uses this today — this is deliberate forward scaffolding for the
// documented pattern above and in .claude/rules/blocks.md, the same way
// widgets/README.md documents Vitamix's widget-tier precedent before any
// widget exists. It is not evidence a variant-driven block is needed right
// now. Next time this file is touched: if it's still unused, reconsider
// whether it should be removed rather than carried forward again.
export const loadVariant = async (el, metadataKey, variants, fallback) => {
  const key = getMetadata(metadataKey) ?? fallback;
  const path = variants[key] ?? variants[fallback];
  if (!path) return;
  const mod = await import(path);
  await mod.default(el);
};
