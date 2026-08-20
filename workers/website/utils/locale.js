/**
 * Locale-prefix utilities for Cloudflare Workers.
 *
 * Single source of truth for the real locale prefixes this site serves, so path
 * matching (index.js's isEdsPath) and redirect matching (handlers/redirects.js)
 * never drift into two independently-wrong lists — the exact bug class already
 * found and fixed multiple times in this Worker.
 *
 * Verified 2026-08-20 against the real source of truth (Falkor's tokens/languages.js
 * + web/src/utils/middleware/i18n.ts, DEFAULT_LOCALE 'en-us') and live HTTP checks
 * against frame.io — NOT scripts/scripts.js's locale config in this repo, which is
 * itself stale (wrong short-code format, wrong language set: has a nonexistent
 * '/hi', missing it/ko/pt/ru). Real prefixes are full BCP47 codes, e.g. /pt-br not
 * /pt.
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
