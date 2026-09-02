// P0-44 MEASUREMENT SPIKE — page bootstrap, not production code.
//
// Reproduces the one piece of real ak.js behavior this spike exists to interact
// with correctly: a section stays hidden (styles/styles.css: `div[data-status] {
// display: none }`, which out-specifies `.section { display: block }` only while
// `data-status` is present) until every block inside it finishes decorating
// (ak.js's decorateSections()/loadArea() `await Promise.all(section.blocks.map(
// loadBlock))` before `delete section.dataset.status`). decoratePznSlots() must
// run AFTER that reveal, and must not be folded into the awaited block-loading
// step — see the comment on decoratePznSlots in scripts/utils/analytics/pzn.js for why.
//
// Everything upstream of "section already has a .block-content > .hero shape"
// (raw table parsing, groupChildren(), etc.) is skipped — this spike starts one
// step downstream of document authoring, see test-hero.html.

import decorateHero from '../blocks/hero/hero.js';
// pzn.js graduated out of spike/ into scripts/utils/ on 2026-08-28 — this
// test harness stays here (it's dev-only tooling, not something the CDN
// needs to serve), but now imports the real, shipped module.
import { decoratePznSlots, readCookie } from '../scripts/utils/analytics/pzn.js';
import { hasConsent, setConsent, onConsentChange } from '../scripts/utils/analytics/consent.js';

// Bug-squash fix, 2026-08-28: must match pzn.js's COOKIE_NAME exactly — this
// test harness has its own copy purely to simulate a warm visit by writing
// the cookie directly, so it drifting from pzn.js's real value (as it just
// did, when pzn.js's name changed to the canonical 'frameio-pzn-segment')
// silently breaks the warm-visit test path with no error, just wrong results.
const COOKIE_NAME = 'frameio-pzn-segment';
const params = new URLSearchParams(window.location.search);

// Spike-only test conveniences — not part of the mechanism under test.
const warmSegment = params.get('warm');
if (warmSegment) document.cookie = `${COOKIE_NAME}=${warmSegment}; path=/; max-age=1800; samesite=lax`;

if (params.get('consent') === 'granted') {
  setConsent({ personalization: true, analytics: true, marketing: true });
}

document.documentElement.dataset.pznReserve = params.get('reserve') || 'none';

const section = document.querySelector('.section');
const heroBlock = section.querySelector('.hero');

(async () => {
  await decorateHero(heroBlock); // real, unmodified blocks/hero/hero.js
  delete section.dataset.status; // reveal — mirrors ak.js exactly, see comment above
  decoratePznSlots(); // fire-and-forget on the cold path; see pzn.js
})();

// --- debug panel wiring (manual QA only, not measured) ---------------------
// `?debug=0` drops the panel from the DOM entirely rather than hiding it, so a
// real LCP/CLS measurement pass isn't scoring this spike's own QA chrome (the
// panel's flex-wrapping buttons/dl elements reflow as their text content
// updates, which shows up as unrelated layout-shift entries if left in the
// DOM — found by measuring, not assumed; see the spike report).
const wireDebugPanel = (panel) => {
  const dbg = {
    consent: panel.querySelector('#dbg-consent'),
    cookie: panel.querySelector('#dbg-cookie'),
    applied: panel.querySelector('#dbg-applied'),
    config: panel.querySelector('#dbg-config'),
  };

  const refreshDebug = () => {
    dbg.consent.textContent = hasConsent('personalization');
    dbg.cookie.textContent = readCookie(COOKIE_NAME) ?? '(none)';
    dbg.applied.textContent = section.querySelector('.pzn-slot')?.dataset.pznApplied ?? '(none)';
    dbg.config.textContent = [...params.entries()].map(([k, v]) => `${k}=${v}`).join(' ') || '(defaults)';
  };

  refreshDebug();
  onConsentChange(refreshDebug);
  const watchOpts = { attributes: true, subtree: true, childList: true };
  new MutationObserver(refreshDebug).observe(section, watchOpts);

  panel.querySelector('#grant-consent').addEventListener('click', () => {
    setConsent({ personalization: true, analytics: true, marketing: true });
  });
  panel.querySelector('#revoke-consent').addEventListener('click', () => {
    setConsent({ personalization: false, analytics: false, marketing: false });
  });
  panel.querySelector('#clear-cookie').addEventListener('click', () => {
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
    window.location.reload();
  });
};

const debugPanel = document.querySelector('.pzn-debug');
if (params.get('debug') === '0') debugPanel.remove();
else wireDebugPanel(debugPanel);
