import {
  getConfig, loadArea, loadStyle, setConfig, slugifyUnique,
} from './ak.js';
import { runExperimentation } from './experiment-loader.js';
import locales from './locales.js';
import { isAuthoringPreviewAllowed } from './utils/security/preview-origin.js';

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

// EDS flattens an authored `Anchor` section-metadata row to data-anchor on the
// server. Promote it to a de-duplicated, lowercase slug id, unless the section
// already has one (from an authored `Id` row), and drop the attribute. Runs
// before ak.js decorates sections, so the id exists before lazyhash scrolls.
// Same section selector as ak.js decorateSections.
export const promoteAnchors = (area = document) => {
  const selector = area === document ? 'main > div[data-anchor]' : ':scope > div[data-anchor]';
  for (const section of area.querySelectorAll(selector)) {
    const id = !section.id && slugifyUnique(section.dataset.anchor, section.getRootNode());
    if (id) section.id = id;
    delete section.dataset.anchor;
  }
};

const decorateArea = ({ area = document }) => {
  promoteAnchors(area);

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

export const loadAuthoringPreviews = ({
  href = window.location.href,
  host = window.location.host,
  importer = null,
} = {}) => {
  if (!isAuthoringPreviewAllowed(host)) return;
  const { searchParams } = new URL(href);
  const hasPreview = searchParams.has('dapreview');
  if (hasPreview) {
    (importer ? importer('./da/da.js') : import('./da/da.js'))
      .then((mod) => mod.default(loadPage))
      .catch((ex) => getConfig().log(ex));
  }
  const hasQE = searchParams.has('quick-edit');
  if (hasQE) {
    (importer ? importer('./quick-edit/quick-edit.js') : import('./quick-edit/quick-edit.js'))
      .then((mod) => mod.default())
      .catch((ex) => getConfig().log(ex));
  }
};

loadAuthoringPreviews();
