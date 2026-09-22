import ENV from './utils/env.js';

import { getConfig, loadStyle } from './ak.js';
import { runExperiment } from './utils/analytics/experimentation.js';

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
// (DA Quick Edit's loadPage() -> loadArea() re-run) WITHOUT re-executing any
// top-level code; ES modules evaluate their top-level body exactly once per
// specifier, ever. Footer and pzn.js's `data-pzn` slots both live on DOM
// nodes that get wholesale-replaced by Quick Edit's `document.body.innerHTML`
// swap (see scripts.md's Block Lifecycle notes) and need to re-decorate
// against the fresh, undecorated nodes — exactly like header already does via
// postlcp.js's real, re-invokable default export. Pulled out into a real
// default export here so ak.js's loadArea() can call it the same way on every
// run, not just the first. SEO injection (jsonld.js/hreflang.js/canonical.js)
// deliberately stays in the one-shot IIFE below: jsonld.js's module-scope
// `graph` array only ever appends (see jsonld.js), so re-running it here
// would duplicate JSON-LD entries rather than refresh them — a separate,
// pre-existing gap, not something to paper over as a side effect of this fix.
export default async () => {
  const { log } = getConfig();
  await import('./utils/page/footer.js').then(({ default: footer }) => footer()).catch((ex) => log(ex));

  // UC-02 (ref_uc02_shared_fragment_scoped_testing memory): a page opted into
  // a chrome-scoped experiment via `experiment-selector` metadata runs here,
  // the 'late' phase, after header/footer actually exist — runExperiment()
  // itself no-ops immediately if this page's experiment is main-scoped
  // (UC-01) instead, which already ran in scripts.js's early phase.
  try {
    await runExperiment('late');
  } catch (ex) {
    log(ex);
  }

  // P0-44 personalization, graduated out of site/spike/ on 2026-08-28. Gated
  // to non-production environments deliberately, not as a placeholder: the
  // decision endpoint it calls is still mocked/undeployed, the real Segment
  // write key isn't in place yet, and no real page has `data-pzn` metadata
  // authored — none of that is ready for real visitor traffic.
  if (ENV !== 'prod') {
    import('./utils/analytics/pzn.js')
      .then(({ decoratePznSlots }) => decoratePznSlots())
      .catch((ex) => log(ex));

    // ADR-003: dev-only mutual-exclusivity check between the late-phase
    // `experiment-selector` chrome swap (run just above) and pzn.js's slots.
    // Runs here, not in the one-shot IIFE below, because it must resolve
    // selectors against the DOM only after footer + the late experiment exist.
    import('./utils/analytics/pzn-audit.js')
      .then(({ auditExperimentCollision }) => auditExperimentCollision())
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
  import('./utils/seo/canonical.js').then(({ default: canonical }) => canonical()).catch((ex) => log(ex));
  import('./utils/analytics/delegated-click.js');

  setTimeout(() => import('./delayed.js'), 3000);

  if (ENV !== 'prod') {
    import('./scheduler/scheduler.js');
    loadSidekick();
    import('./utils/analytics/testid-audit.js')
      .then(({ default: auditTestids }) => auditTestids())
      .catch((ex) => log(ex));

    // Personalization collision audit — reuses pzn.js's memoized loadVariants()
    // (populated by decoratePznSlots in the exported default above), so it adds
    // no fetch. Warns when two variant rows share a placement+segment but target
    // different selectors (a silently dead element), never on an intentional
    // same-selector weighted split.
    import('./utils/analytics/pzn-audit.js')
      .then(({ default: auditPzn }) => auditPzn())
      .catch((ex) => log(ex));
  }
})();
