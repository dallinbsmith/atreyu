import { getMetadata } from '../ak.js';

// Lets a block delegate its rendering to one of several JS modules, chosen by
// a page-level metadata value, instead of growing internal branches for
// meaningfully different behavior per page (see Stericycle's header pattern:
// a nav-variant metadata field picks which module to import). Reach for this
// when the variants are different BEHAVIOR, not just different CSS classes —
// plain CSS variants (`Hero (large, dark)` -> `.hero.large.dark`) don't need
// this at all.
export const loadVariant = async (el, metadataKey, variants, fallback) => {
  const key = getMetadata(metadataKey) ?? fallback;
  const path = variants[key] ?? variants[fallback];
  if (!path) return;
  const mod = await import(path);
  await mod.default(el);
};
