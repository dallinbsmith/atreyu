// Shared text -> slug conversion. partner-logo.js (matching a brand name to
// its /img/partners/{slug}.svg file) and form-fields.js (deriving a stable
// field id from its authored label) each had their own slightly different
// implementation before this — verified this produces identical output to
// every real file in img/partners/ before unifying on it.
export const slugify = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
