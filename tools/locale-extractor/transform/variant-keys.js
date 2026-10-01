// Implements D2 from locale-personalization-codesign-2026-09-25.md: the
// extractor carries BASE content only. A module's `variantKeys` (e.g.
// `largeEnterprise`, `largeEnterpriseReturningVisitor`, confirmed real on the
// ja-jp enterprise page's heroScreen module) are audience tags with no
// alternate payload, they never become locale-baked segment content.
//
// Default behavior: drop them silently (ratified default, Decision 2 in the
// co-design doc). Pass `emitPznHooks: true` to instead emit an empty
// `pzn: <placement>` Section Metadata marker, creating a future personalization
// slot with no content, never both, and never fabricated variant content
// either way.
//
// The exact Section Metadata table shape below is a best-effort rendering of
// the documented `pzn: <placement>` convention, not copied from a confirmed
// real authored example, no real page using it exists yet. Verify against a
// real Section Metadata table before relying on this in production.
export const buildPznSectionMetadata = (variantKeys, moduleKey) => {
  if (!variantKeys?.length) return '';
  const placement = moduleKey ?? 'unlabeled';
  return `<div><h3>Section Metadata</h3><table><tr><td>pzn</td><td>${placement}</td></tr></table></div>`;
};

// Returns `{ dropped: string[], metadataHtml: string }`, `dropped` lists the
// variantKey types that were present, purely for the extractor's own run log
// (so a human can see what got dropped without re-reading Sanity), never
// written into the output page.
export const resolveVariantKeys = (module, { emitPznHooks = false } = {}) => {
  const types = (module.variantKeys ?? []).map((v) => v.type).filter(Boolean);
  if (!types.length) return { dropped: [], metadataHtml: '' };
  const metadataHtml = emitPznHooks ? buildPznSectionMetadata(module.variantKeys, module._key) : '';
  return { dropped: types, metadataHtml };
};
