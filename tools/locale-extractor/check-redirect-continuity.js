// B6b (locale-i18n-plan.md): checks whether a migrated locale page's path
// actually needs a redirect, instead of assuming it does or building a
// speculative redirect map. Reasoning behind this file, not just what it
// does: the existing Worker-side redirect system
// (workers/website/handlers/redirects.js) is already locale-generic, one
// unprefixed rule in redirects.json fires for every locale via
// strip-then-reapply. So the only locale pages that need a NEW redirect row
// are ones where the live Falkor path doesn't match the path this extractor
// will put the migrated page at. Since this extractor never renames a
// slug, that can only happen if Falkor itself already redirects that page
// somewhere else today, something no Sanity field reveals on its own. The
// only way to find that is to actually ask the live site.
//
// This does lightweight, read-only HEAD requests against public frame.io
// pages, the same as any browser visiting them, nothing destructive and no
// different from the curl checks already run elsewhere in this project
// against this same public site.
const FALKOR_ORIGIN = 'https://frame.io';

const expectedPath = (locale, slug) => {
  const trimmed = slug ? `/${slug.replace(/^\/+/, '')}` : '';
  return `/${locale}${trimmed}`;
};

// `redirect: 'manual'` so a 3xx is reported as the real finding (Falkor
// already redirects this path elsewhere) instead of silently following it
// to wherever it ends up and reporting that as a false "200, no redirect
// needed."
const checkOne = async (locale, slug) => {
  const path = expectedPath(locale, slug);
  const url = `${FALKOR_ORIGIN}${path}`;
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(10_000) });
    const isRedirect = res.status >= 300 && res.status < 400;
    return {
      path,
      status: res.status,
      needsB6bRow: isRedirect || res.status === 404,
      redirectedTo: isRedirect ? res.headers.get('location') : null,
    };
  } catch (ex) {
    return {
      path, status: null, needsB6bRow: null, error: ex.message,
    };
  }
};

// Sequential, not Promise.all: this is a one-time due-diligence pass over a
// bounded locale wave (28 pages for ja-jp), not a hot path, and a polite
// read-only crawl of a public site shouldn't fire every request at once.
export const checkRedirectContinuity = async (pages) => {
  const results = [];
  for (const page of pages) {
    const locale = page.language;
    const slug = page.slug?.current ?? null;
    // eslint-disable-next-line no-await-in-loop
    const result = await checkOne(locale, slug);
    results.push({ locale, slug, ...result });
  }
  return results;
};
