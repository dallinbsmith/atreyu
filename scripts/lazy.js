import ENV from './utils/env.js';

import { getConfig, loadStyle } from './ak.js';
import { runExperimentationLazy } from './experiment-loader.js';

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

// Bug-squash fix, 2026-09-18: this used to live in the one-shot IIFE below,
// which only ever runs once per page load — ak.js's `import('./lazy.js')`
// call re-resolves the already-cached module on every later loadArea() call
// (DA Quick Edit's loadPage() -> loadArea() re-run) without re-executing any
// top-level code. Footer decoration must run against fresh, undecorated nodes
// after Quick Edit swaps `document.body.innerHTML`, so ak.js calls this real
// default export on every loadArea() run. SEO injection (jsonld.js/hreflang.js)
// deliberately stays in the one-shot IIFE below: jsonld.js's module-scope
// `graph` array only ever appends (see jsonld.js), so re-running it here
// would duplicate JSON-LD entries rather than refresh them.
export default async () => {
  const { log } = getConfig();
  await import('./utils/page/footer.js').then(({ default: footer }) => footer()).catch((ex) => log(ex));

  // adobe/aem-experimentation v2 owns `experiment*` metadata (our own
  // experimentation.js swap was removed).
  // This call only loads its preview/simulation panel (never in prod).
  // Header, footer and nav are not personalized by policy (foundation
  // hardening A2 = iii). Not enforced: the plugin's `experiment-manifest`
  // fragment path can still target them and gets only loadArea(), not the
  // blocks' own decoration.
  await runExperimentationLazy();
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
