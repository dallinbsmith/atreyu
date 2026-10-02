import ENV from './utils/env.js';

import { getConfig, loadStyle } from './ak.js';

const loadSidekick = async () => {
  const getSk = () => document.querySelector('aem-sidekick');

  const sk = getSk() || await new Promise((resolve) => {
    document.addEventListener('sidekick-ready', () => resolve(getSk()));
  });
  if (sk) {
    import('./sidekick/sidekick.js')
      .then((mod) => mod.default(sk))
      .catch((ex) => getConfig().log(ex));
  }
};

// DA Quick Edit can swap in fresh footer nodes after this module is cached, so
// ak.js calls this export on each document load. SEO injection stays one-shot:
// jsonld.js appends to module-scope state, so re-running it would duplicate
// JSON-LD entries instead of refreshing them.
export default async () => {
  const { log } = getConfig();
  await import('./utils/page/footer.js').then(({ default: footer }) => footer()).catch((ex) => log(ex));

  if (ENV !== 'prod') {
    // The overlay is author-only; production pages should not fetch the
    // experimentation loader after LCP when no authoring UI can use it.
    await import('./experiment-loader.js')
      .then(({ runExperimentationLazy }) => runExperimentationLazy())
      .catch((ex) => log(ex));
  }
};

(() => {
  const { log } = getConfig();

  loadStyle('/styles/lazy-styles.css');
  import('./utils/page/lazyhash.js');
  import('./utils/page/favicon.js');
  import('./utils/seo/jsonld.js').then(({ default: jsonld }) => jsonld()).catch((ex) => log(ex));
  import('./utils/seo/hreflang.js').then(({ default: hreflang }) => hreflang()).catch((ex) => log(ex));
  // No client canonical: EDS renders a self-referencing one server-side
  // (x-forwarded-host behind the Worker, or the Canonical metadata override).
  import('./utils/analytics/delegated-click.js');

  setTimeout(() => import('./delayed.js'), 3000);

  if (ENV !== 'prod') {
    import('./scheduler/scheduler.js');
    loadSidekick();
    import('./utils/analytics/testid-audit.js')
      .then(({ default: auditTestids }) => auditTestids())
      .catch((ex) => log(ex));
  }
})();
