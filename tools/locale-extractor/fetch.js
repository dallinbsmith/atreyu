// Read-only Sanity fetch, via plain `fetch()` against Sanity's public GROQ
// HTTP API, not the `@sanity/client` SDK, matching this project's no-build/
// minimal-dependency conventions (docs/conventions/javascript.md). Targets the real production
// source confirmed in locale-extraction-spike-2026-09-25.md: project
// `s6lu43cv`, dataset `production-v4`, `published` perspective.
//
// `SANITY_TOKEN` env var is optional, the spike's queries all worked
// unauthenticated against this dataset via the Sanity MCP, but a token is
// supported in case the dataset's read visibility ever tightens.
const PROJECT_ID = 's6lu43cv';
const DATASET = 'production-v4';
const API_VERSION = 'v2024-01-01';

const queryUrl = (groq, params = {}) => {
  const url = new URL(`https://${PROJECT_ID}.api.sanity.io/${API_VERSION}/data/query/${DATASET}`);
  url.searchParams.set('query', groq);
  url.searchParams.set('perspective', 'published');
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(`$${key}`, JSON.stringify(value));
  });
  return url;
};

const runQuery = async (groq, params) => {
  const url = queryUrl(groq, params);
  const headers = process.env.SANITY_TOKEN ? { Authorization: `Bearer ${process.env.SANITY_TOKEN}` } : {};
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Sanity query failed (${res.status}): ${await res.text()}`);
  const { result } = await res.json();
  return result;
};

// Per-locale wave pull (spike step 1), full page shape: slug/title/language
// plus every section's modules, nested as deep as the transform layer needs.
const PAGE_SHAPE_PROJECTION = `{
  _id, _type, slug, title, language,
  sections[]{
    _type,
    modules[]{
      ...,
      content { ..., content[]{ ..., markDefs[], children[] } },
    },
  },
}`;

export const fetchLocalePages = (locale) => runQuery(
  `*[_type in ['page','pageVariant'] && language == $locale]${PAGE_SHAPE_PROJECTION}`,
  { locale },
);

export const fetchPageBySlug = (locale, slug) => runQuery(
  `*[_type == 'page' && language == $locale && slug.current == $slug][0]${PAGE_SHAPE_PROJECTION}`,
  { locale, slug },
);

// A document's own `language` is sometimes a literal `null`, not just a
// locale other than the target one, confirmed real on case-studies/
// north-face (production-v4, no en-us sibling at all). A live HEAD check
// confirms that content lives at the bare path with no locale segment at
// all (https://frame.io/case-studies/north-face -> 200, the /en-us/
// equivalent -> 308 redirect), not under /null/.
const pagePath = (slug, locale) => `${locale ? `/${locale}` : ''}${slug ? `/${slug}` : ''}`;

// G-7: resolves internal Sanity document references (block.button's
// `reference`, cardGridNavItem.link's `reference`) to the real page path
// this extractor would put them at, one batch query instead of one per
// link.
//
// Real, load-bearing finding: a reference almost always points at the
// EN-US canonical document, confirmed on the real ja-jp features/
// workflow-management page (every cardGridNav reference resolved to an
// en-us `_id`, even though the page itself is ja-jp). Resolving that
// naively would send a Japanese visitor to an English page. The actual
// right target is the SAME SLUG's document in the page's OWN locale, if one
// exists, falling back to the referenced document's own locale only when no
// localized sibling exists yet. This needs a second query (match the
// resolved slugs against `locale`) rather than a single id lookup.
//
// Returns a Map `_id -> { path, crossLocale }`. `crossLocale: true` means no
// same-locale sibling was found and this falls back to the referenced
// document's own (usually en-us) path, callers should flag that rather than
// silently sending a visitor out of their locale. An id with no matching
// page/pageVariant document at all (the reference points at something else,
// or the target hasn't been migrated) simply has no entry.
export const resolveReferences = async (ids, locale) => {
  if (!ids.length) return new Map();
  const docs = await runQuery(
    '*[_id in $ids && _type in [\'page\',\'pageVariant\']]{_id, "slug": slug.current, language}',
    { ids },
  );

  const otherLocaleSlugs = [...new Set(
    docs.filter((d) => d.language !== locale).map((d) => d.slug).filter(Boolean),
  )];
  const localized = otherLocaleSlugs.length
    ? await runQuery(
      '*[_type in [\'page\',\'pageVariant\'] && language == $locale '
        + '&& slug.current in $slugs]{"slug": slug.current}',
      { locale, slugs: otherLocaleSlugs },
    )
    : [];
  const localizedSlugs = new Set(localized.map((d) => d.slug));

  return new Map(docs.map((doc) => {
    if (doc.language === locale || !localizedSlugs.has(doc.slug)) {
      return [doc._id, {
        path: pagePath(doc.slug, doc.language),
        crossLocale: doc.language !== locale,
      }];
    }
    return [doc._id, { path: pagePath(doc.slug, locale), crossLocale: false }];
  }));
};
