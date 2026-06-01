import ENV from './utils/env.js';

import { loadStyle } from './ak.js';

const loadSidekick = async () => {
  const getSk = () => document.querySelector('aem-sidekick');

  const sk = getSk() || await new Promise((resolve) => {
    document.addEventListener('sidekick-ready', () => resolve(getSk()));
  });
  if (sk) import('../tools/sidekick/sidekick.js').then((mod) => mod.default(sk));
};

(() => {
  loadStyle('/styles/lazy-styles.css');
  import('./utils/lazyhash.js');
  import('./utils/favicon.js');
  import('./utils/footer.js').then(({ default: footer }) => footer());
  import('./utils/jsonld.js').then(({ default: jsonld }) => jsonld());
  import('./utils/hreflang.js').then(({ default: hreflang }) => hreflang());

  setTimeout(() => import('./delayed.js'), 3000);

  if (ENV !== 'prod') {
    import('../tools/scheduler/scheduler.js');
    loadSidekick();
  }
})();
