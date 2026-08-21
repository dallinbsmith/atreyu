import { loadArea, loadStyle, setConfig } from './ak.js';
import { runExperiment } from './utils/experimentation.js';

const hostnames = ['authorkit.dev'];

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

const linkBlocks = [
  { fragment: '/fragments/' },
  { schedule: '/schedules/' },
  { youtube: 'https://www.youtube' },
];

const components = ['fragment', 'schedule'];

const decorateArea = ({ area = document }) => {
  const eagerLoad = (parent, selector) => {
    const img = parent.querySelector(selector);
    if (!img) return;
    img.removeAttribute('loading');
    img.fetchPriority = 'high';
  };

  eagerLoad(area, 'img');
};

const loadFonts = () => {
  if (sessionStorage.getItem('fonts-loaded') || !window.matchMedia('(prefers-reduced-data: no-preference)').matches) {
    loadStyle('/styles/fonts.css');
    return;
  }
  loadStyle('/styles/fonts.css').then(() => {
    sessionStorage.setItem('fonts-loaded', 'true');
  });
};

export const loadPage = async () => {
  setConfig({ hostnames, locales, linkBlocks, components, decorateArea });
  loadFonts();
  await runExperiment();
  await loadArea();
};
await loadPage();

(() => {
  const { searchParams } = new URL(window.location.href);
  const hasPreview = searchParams.has('dapreview');
  if (hasPreview) import('../tools/da/da.js').then((mod) => mod.default(loadPage));
  const hasQE = searchParams.has('quick-edit');
  if (hasQE) import('../tools/quick-edit/quick-edit.js').then((mod) => mod.default());
})();
