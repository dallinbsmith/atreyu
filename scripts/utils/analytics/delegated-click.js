import { track } from './analytics.js';

// Declarative click-to-Segment bridge for CTAs with no bespoke behavior
// module (see scripts/behaviors.js for those). An element carries
// `data-track-event` — a value that must already exist in analytics.js's
// EVENTS registry, the same governance required of any other track() call
// site — and an optional `data-track-props` JSON object literal. One
// delegated listener avoids wiring bespoke tracking code per block for
// plain marketing CTAs. track() itself validates the event name; this file
// does not duplicate that check.
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-track-event]');
  if (!el) return;

  let props = {};
  if (el.dataset.trackProps) {
    try {
      props = JSON.parse(el.dataset.trackProps);
    } catch { /* malformed JSON — skip props, still fire the event */ }
  }

  const testid = el.closest('[data-testid]')?.dataset.testid;
  track(el.dataset.trackEvent, { ...props, ...(testid && { testid }) });
});
