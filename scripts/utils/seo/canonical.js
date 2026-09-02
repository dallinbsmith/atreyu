// Self-referencing canonical link — every locale page canonicalizes to
// itself, not the default-locale page, since hreflang.js already declares
// the cross-locale relationship; canonicalizing a translated page to English
// would tell Google to ignore it as a duplicate instead of indexing it.
// origin + pathname naturally excludes query params (UTMs, click IDs) and
// the hash, which must never end up in a canonical URL.
export default () => {
  const link = document.createElement('link');
  link.rel = 'canonical';
  link.href = `${window.location.origin}${window.location.pathname}`;
  document.head.append(link);
};
