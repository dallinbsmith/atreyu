import ENV from './utils/env.js';

import { loadStyle } from './ak.js';

const loadSidekick = async () => {
  const getSk = () => document.querySelector('aem-sidekick');

  const sk = getSk() || await new Promise((resolve) => {
    document.addEventListener('sidekick-ready', () => resolve(getSk()));
  });
  if (sk) import('./sidekick/sidekick.js').then((mod) => mod.default(sk));
};

(() => {
  loadStyle('/styles/lazy-styles.css');
  import('./utils/lazyhash.js');
  import('./utils/favicon.js');
  import('./utils/footer.js').then(({ default: footer }) => footer());
  import('./utils/seo/jsonld.js').then(({ default: jsonld }) => jsonld());
  import('./utils/seo/hreflang.js').then(({ default: hreflang }) => hreflang());
  import('./utils/seo/canonical.js').then(({ default: canonical }) => canonical());
  import('./utils/analytics/delegated-click.js');

  setTimeout(() => import('./delayed.js'), 3000);

  if (ENV !== 'prod') {
    import('./scheduler/scheduler.js');
    loadSidekick();
    import('./utils/analytics/testid-audit.js').then(({ default: auditTestids }) => auditTestids());

    // P0-44 personalization, graduated out of site/spike/ on 2026-08-28.
    // Gated to non-production environments deliberately, not as a placeholder:
    // the decision endpoint it calls is still mocked/undeployed, the real
    // Segment write key isn't in place yet, and no real page has `data-pzn`
    // metadata authored — none of that is ready for real visitor traffic.
    // This fires here (not postlcp.js) because loadArea() only imports this
    // file after every section has decorated and revealed, not just the
    // first — confirmed directly against ak.js, see the comment on
    // decoratePznSlots in scripts/utils/analytics/pzn.js.
    import('./utils/analytics/pzn.js').then(({ decoratePznSlots }) => decoratePznSlots());
  }
})();
