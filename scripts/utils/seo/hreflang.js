import { getConfig, getMetadata } from '../../ak.js';

// STOPGAP, not the long-term mechanism — fine at today's scale (a handful of
// translated pages) but grows at O(pages x locales), not O(locales). Real
// target scale (hundreds of pages x up to 30 locales) needs helix-sitemap.yaml
// instead: a native EDS feature that computes hreflang alternates from each
// locale's own query-index, config that scales at O(locales). Blocked on the
// same broken /query-index.json (content-bus error) — once that's fixed and
// helix-query.yaml has one index per locale, retire this file and the
// per-page "Translations" metadata field entirely. See
// artifacts/master-plan/DA-CONTENT-STRUCTURE.md's "Hreflang gate" section for
// the full research trail.
//
// Gated on a real, author-maintained per-page "translations" metadata field —
// a comma-separated list of locale prefixes with a confirmed, published
// translation of THIS page (e.g. "ja-jp, fr-fr"). getConfig().locales lists
// every locale the site *could* serve, not which ones actually have a
// translated page yet — emitting hreflang for an unconfirmed locale is a real
// SEO error (P0-23: Google expects a confirmed translation at the alternate
// URL, not a 404).
const injectHreflang = () => {
  const { locales, locale } = getConfig();
  const { origin, pathname } = window.location;
  const basePath = locale.prefix ? pathname.replace(locale.prefix, '') : pathname;

  const append = (hreflang, href) => {
    const link = document.createElement('link');
    link.rel = 'alternate';
    link.hreflang = hreflang;
    link.href = href;
    document.head.append(link);
  };

  // Authors type real BCP47 codes (e.g. "en-us, ja-jp") — the default locale
  // has no URL prefix at all, so "en-us" specifically maps back to '', not '/en-us'.
  const translatedPrefixes = (getMetadata('translations') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s === 'en-us' ? '' : `/${s}`));

  // Always include the current page itself — hreflang requires a self-referencing
  // entry — plus only the locales an author has confirmed are actually translated.
  const prefixes = [...new Set([locale.prefix, ...translatedPrefixes])];

  // hreflang must be the full region-qualified tag (e.g. "de-DE", from the "/de-de"
  // prefix), not the short `lang` field on each locale entry — that field is for
  // the <html lang> attribute, a different consumer with a different correctness
  // requirement (language-only is fine there; hreflang needs the region too).
  prefixes.forEach((prefix) => {
    if (prefix !== '' && !(prefix in locales)) return; // guards a typo'd metadata value
    append(prefix ? prefix.slice(1) : 'en', `${origin}${prefix}${basePath}`);
  });

  append('x-default', `${origin}${basePath}`);
};

export default injectHreflang;
