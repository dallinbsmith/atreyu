import { track, EVENTS } from '../utils/analytics/analytics.js';

// Consent widget: link href /widgets/consent opens the consent UI.
// Progressive enhancement — on click, prevent navigation and record the intent.
// When the consent-management UI is built, it should dispatch/subscribe via
// consent.js's `atreyu:consent` CustomEvent idiom (see .claude/rules/scripts.md
// Global State & Data Flow) — do NOT reintroduce a separate event-bus for it.
export default (a) => {
  if (a.dataset.behaviorBound) return;
  a.dataset.behaviorBound = '';
  a.addEventListener('click', (e) => {
    e.preventDefault();
    track(EVENTS.CONSENT_OPEN, { href: a.getAttribute('href') });
  });
};
