/**
 * Locale-prefix utilities for Cloudflare Workers.
 *
 * Single source of truth for the real locale prefixes this site serves, so path
 * matching (index.js's isEdsPath) and redirect matching (handlers/redirects.js)
 * never drift into two independently-wrong lists.
 *
 * AUTHORITATIVE for the Worker runtime. Real prefixes are full BCP47 codes,
 * e.g. /pt-br not /pt.
 *
 * This cannot literally share a module with scripts/locales.js — this one runs
 * in the Cloudflare Worker isolate, while locales.js ships to the browser with
 * no build step — but the two lists must stay content-identical.
 */
export const LOCALE_PREFIXES = ['/de-de', '/es-es', '/fr-fr', '/it-it', '/ja-jp', '/ko-kr', '/pt-br', '/ru-ru', '/zh-cn'];

/** Returns the matching locale prefix (e.g. '/de-de') for a pathname, or null. */
export const matchLocalePrefix = (pathname) => LOCALE_PREFIXES
  .find((p) => pathname === p || pathname.startsWith(`${p}/`)) ?? null;

/** Strips a leading locale prefix from a pathname, if present. '/de-de' -> '/'. */
export const stripLocale = (pathname) => {
  const prefix = matchLocalePrefix(pathname);
  return prefix ? pathname.slice(prefix.length) || '/' : pathname;
};
