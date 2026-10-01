// G-7: finds every internal-document reference inside a fetched page,
// so fetchReferences can be called once per run instead of once per link.
// Deliberately narrow: only collects `{ reference: { _ref } }`, the exact
// shape confirmed real on `block.button` and `cardGridNavItem.link`, not a
// blanket "any _ref anywhere" scan, which would also sweep up image/video/
// logo asset refs this resolver has no business touching (those are a
// completely different reference kind, asset documents, not pages, and
// resolveReferences's own query already filters to page/pageVariant docs,
// but there's no reason to send their ids over the wire at all).
export const collectReferenceIds = (node, ids = new Set()) => {
  if (Array.isArray(node)) {
    node.forEach((item) => collectReferenceIds(item, ids));
  } else if (node && typeof node === 'object') {
    if (node.reference?._ref) ids.add(node.reference._ref);
    Object.values(node).forEach((value) => collectReferenceIds(value, ids));
  }
  return ids;
};
