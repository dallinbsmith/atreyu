// Project glue for adobe/aem-experimentation v2 (vendored at
// plugins/experimentation via git subtree — never hand-edit that folder).
// Owns the three things the plugin leaves to the host project:
//   1. consent: parity with the old experimentation.js/pzn.js gate — nothing
//      runs (and no storage is written) without consent.js 'personalization',
//      except author previews (?experiment= / ?audience=). A later grant takes
//      effect on the next page load, never as a mid-read content swap.
//   2. stickiness: the plugin hard-codes DEVICE randomization in sessionStorage
//      (src/index.js randomizationUnit), so a new tab or a returning visitor is
//      re-randomized. With consent, mirror its assignment key to localStorage.
//   3. measurement: emit one exposure per experiment that actually RAN into
//      the existing Segment schema (analytics.js EVENTS.EXPERIMENT). The
//      plugin's own `aem:experimentation` event also fires for experiments
//      that did not run (inactive, expired, audience/consent not met) as
//      "control", which would pollute the control arm — so read config.run.
import ENV from './utils/env.js';
import { loadArea } from './ak.js';
import { hasConsent } from './utils/analytics/consent.js';
import { track, EVENTS } from './utils/analytics/analytics.js';
import { getVisitorId } from './utils/analytics/visitor-id.js';
import { AUDIENCES } from './utils/experiments/audiences.js';
import { applyExperimentBlock } from './utils/experiments/block.js';

const ASSIGNMENTS_KEY = 'unified-decisioning-experiments';
const PREVIEW_PARAMS = ['experiment', 'audience'];

export const config = {
  prodHost: 'frame.io',
  isProd: () => ENV === 'prod',
  audiences: AUDIENCES,
  // Plugin reads `decorateFunction` (its README says `decorationFunction`,
  // which is silently ignored). Only used for fragment-level manifest swaps.
  decorateFunction: (el) => loadArea({ area: el }),
};

export const isEnabled = () => !!(
  document.head.querySelector('[name^="experiment"],[name^="campaign-"],[name^="audience-"],[property^="campaign:"],[property^="audience:"]')
  || [...document.querySelectorAll('.section-metadata div')]
    .some((d) => /Experiment|Campaign|Audience/i.test(d.textContent))
);

const copyKey = (from, to) => {
  try {
    const value = from.getItem(ASSIGNMENTS_KEY);
    if (value) to.setItem(ASSIGNMENTS_KEY, value);
  } catch { /* storage unavailable: fall back to plugin's session stickiness */ }
};

export const restoreAssignments = () => {
  if (hasConsent('personalization')) copyKey(localStorage, sessionStorage);
};

const clearAssignments = () => {
  try {
    localStorage.removeItem(ASSIGNMENTS_KEY);
    sessionStorage.removeItem(ASSIGNMENTS_KEY);
  } catch { /* storage unavailable */ }
};

export const persistAssignments = () => {
  if (hasConsent('personalization')) {
    copyKey(sessionStorage, localStorage);
    return;
  }
  clearAssignments();
};

const isPreview = () => {
  const params = new URLSearchParams(window.location.search);
  return PREVIEW_PARAMS.some((p) => params.has(p));
};

export const trackExposures = (experiments = []) => {
  if (isPreview()) return;
  const anonId = getVisitorId();
  for (const { type, config: exp } of experiments.filter((e) => e.config?.run)) {
    track(EVENTS.EXPERIMENT, {
      anonId,
      experiment: exp.id,
      variantName: exp.selectedVariant,
      variantType: exp.resolvedAudiences?.length ? 'audience-experiment' : 'a-b-split-test',
      variantId: `${exp.id}:${exp.selectedVariant}`,
      renderType: `${type}-swap`,
      audiences: exp.resolvedAudiences ?? null,
    });
  }
};

export const runExperimentation = async (doc = document) => {
  // Always, even without consent: the Experiment table must never render.
  applyExperimentBlock(doc);
  if (!isEnabled()) return null;
  if (!hasConsent('personalization') && !isPreview()) {
    clearAssignments();
    return null;
  }
  try {
    // eslint-disable-next-line import/no-relative-packages -- no bundler for bare specifiers
    const plugin = await import('../plugins/experimentation/src/index.js');
    plugin.updateUserConsent(true);
    restoreAssignments();
    // Plugin publishes results on `window.aem || window.hlx || {}`; without a
    // real global they land on a throwaway object and nothing is measurable.
    window.hlx ??= {};
    await plugin.loadEager(doc, config);
    persistAssignments();
    trackExposures((window.aem || window.hlx).experiments);
    return plugin;
  } catch (ex) {
    // eslint-disable-next-line no-console -- fail open: control content stays
    console.error('experimentation (eager) failed:', ex);
    return null;
  }
};

export const runExperimentationLazy = async (doc = document) => {
  if (ENV === 'prod') return;
  try {
    // eslint-disable-next-line import/no-relative-packages -- no bundler for bare specifiers
    const { loadLazy } = await import('../plugins/experimentation/src/index.js');
    await loadLazy(doc, config);
  } catch { /* simulation panel is an authoring aid; never break the page */ }
};
