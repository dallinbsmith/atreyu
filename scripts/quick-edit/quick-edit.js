import { loadPage } from '../scripts.js';
import { resolvePreviewOrigin } from '../utils/preview-origin.js';

const importMap = {
  imports: {
    'da-lit': 'https://da.live/deps/lit/dist/index.js',
    'da-y-wrapper': 'https://da.live/deps/da-y-wrapper/dist/index.js',
  },
};

const addImportmap = () => {
  const importmapEl = document.createElement('script');
  importmapEl.type = 'importmap';
  importmapEl.textContent = JSON.stringify(importMap);
  document.head.appendChild(importmapEl);
};

// creates sidekick payload when loading QE from query param
const generateSidekickPayload = () => {
  let { hostname } = window.location;
  if (hostname === 'localhost') {
    hostname = document.querySelector('meta[property="hlx:proxyUrl"]').content;
  }
  const parts = hostname.split('.')[0].split('--');
  const [, repo, owner] = parts;

  return {
    detail: {
      config: { mountpoint: `https://content.da.live/${owner}/${repo}/` },
      location: { pathname: window.location.pathname },
    },
  };
};

const init = async (payload) => {
  const { search } = window.location;
  const ref = new URLSearchParams(search).get('quick-edit');
  const origin = resolvePreviewOrigin(ref, {
    onOrigin: 'https://da.live',
    localOrigin: 'http://localhost:6456',
    branchHost: 'da-nx--adobe.aem.live',
    treatEmptyAsOn: true,
  });
  if (!origin) return;
  addImportmap();
  const { default: loadQuickEdit } = await import(`${origin}/nx/public/plugins/quick-edit/quick-edit.js`);
  loadQuickEdit(payload || generateSidekickPayload(), loadPage);
};

export default init;
