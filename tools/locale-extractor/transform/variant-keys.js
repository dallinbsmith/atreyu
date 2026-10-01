// Personalization is English-only (docs/decisions/0011-english-only-personalization.md): the
// extractor carries BASE content only. A module's `variantKeys` (e.g.
// `largeEnterprise`, `largeEnterpriseReturningVisitor`, confirmed real on the
// ja-jp enterprise page's heroScreen module) are audience tags with no
// alternate payload, they never become locale-baked segment content.

// Returns `{ dropped: string[], metadataHtml: string }`, `dropped` lists the
// variantKey types that were present, purely for the extractor's own run log
// (so a human can see what got dropped without re-reading Sanity), never
// written into the output page.
export const resolveVariantKeys = (module) => {
  const types = (module.variantKeys ?? []).map((v) => v.type).filter(Boolean);
  return { dropped: types, metadataHtml: '' };
};
