// AUTHORITATIVE for the browser runtime. Verified 2026-08-20 against Falkor's real
// source of truth (tokens/languages.js) and live HTTP checks against frame.io. Real
// prefixes are full BCP47 codes (e.g. /pt-br, not /pt) — there is no Hindi locale
// and no Dutch locale.
//
// This list cannot literally share a module with workers/website/utils/locale.js
// (that file runs in the Cloudflare Worker isolate; this one ships to the browser
// with no build step) — but the two must stay content-identical. If this list ever
// changes, update workers/website/utils/locale.js's LOCALE_PREFIXES to match.
const locales = {
  '': { lang: 'en' },
  '/de-de': { lang: 'de' },
  '/es-es': { lang: 'es' },
  '/fr-fr': { lang: 'fr' },
  '/it-it': { lang: 'it' },
  '/ja-jp': { lang: 'ja' },
  '/ko-kr': { lang: 'ko' },
  '/pt-br': { lang: 'pt' },
  '/ru-ru': { lang: 'ru' },
  '/zh-cn': { lang: 'zh' },
};

export default locales;
