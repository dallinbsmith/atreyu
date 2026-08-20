import { getConfig } from '../ak.js';

// Phase 2: wire this up at the scripts/lazy.js call site (swap `default` for
// `injectHreflang` in the destructure) once translated locale pages are confirmed
// live — see artifacts/master-plan/implementation-plan.md Step 3.6c. Only emit
// hreflang for locales with confirmed content (a translations.json gate), not just
// configured ones — getConfig().locales lists every locale the site *could* serve,
// not which ones actually have translated pages yet.
export const injectHreflang = () => {
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

  // hreflang must be the full region-qualified tag (e.g. "de-DE", from the "/de-de"
  // prefix), not the short `lang` field on each locale entry — that field is for
  // the <html lang> attribute, a different consumer with a different correctness
  // requirement (language-only is fine there; hreflang needs the region too).
  Object.keys(locales).forEach((prefix) => {
    append(prefix ? prefix.slice(1) : 'en', `${origin}${prefix}${basePath}`);
  });

  append('x-default', `${origin}${basePath}`);
};

// Phase 1: English-only content. Hreflang is suppressed until locale content
// exists — emitting alternate tags for untranslated locales is an SEO error
// (P0-23: Google expects a confirmed translation at the alternate URL, not a 404).
export default () => {};
