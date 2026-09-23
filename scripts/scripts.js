import {
  getConfig, loadArea, loadStyle, setConfig,
} from './ak.js';
import { runExperimentation } from './experiment-loader.js';
import locales from './locales.js';

// frame.io is the canonical production host (ARCHITECTURE-DECISIONS.md); www.frame.io
// permanently redirects to it. Deliberately excludes blog/app/accounts.frame.io and
// other real subdomains — those are separate platforms (DA-CONTENT-STRUCTURE.md) and
// must stay absolute links, not get relativized as if they were this site.
const hostnames = ['frame.io'];

const linkBlocks = [
  { fragment: '/system/fragments/' },
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
  loadStyle('/styles/fonts.css')
    .then(() => sessionStorage.setItem('fonts-loaded', 'true'))
    .catch((ex) => getConfig().log(ex));
};

export const loadPage = async () => {
  setConfig({ hostnames, locales, linkBlocks, components, decorateArea });
  loadFonts();
  await runExperimentation();
  await loadArea();
};
await loadPage();

(() => {
  const { searchParams } = new URL(window.location.href);
  const hasPreview = searchParams.has('dapreview');
  if (hasPreview) {
    import('./da/da.js')
      .then((mod) => mod.default(loadPage))
      .catch((ex) => getConfig().log(ex));
  }
  const hasQE = searchParams.has('quick-edit');
  if (hasQE) {
    import('./quick-edit/quick-edit.js')
      .then((mod) => mod.default())
      .catch((ex) => getConfig().log(ex));
  }
})();
