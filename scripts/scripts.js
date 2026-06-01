import { loadArea, loadStyle, setConfig } from './ak.js';
import { runExperiment } from './utils/experimentation.js';

const hostnames = ['authorkit.dev'];

const locales = {
  '': { lang: 'en' },
  '/de': { lang: 'de' },
  '/es': { lang: 'es' },
  '/fr': { lang: 'fr' },
  '/hi': { lang: 'hi' },
  '/ja': { lang: 'ja' },
  '/zh': { lang: 'zh' },
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
