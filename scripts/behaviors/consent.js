import { emit } from '../utils/event-bus.js';
import { track, EVENTS } from '../utils/analytics.js';

// Consent widget: link href /widgets/consent opens the consent UI.
// Progressive enhancement — on click, prevent navigation and emit a consent event.
export default (a) => {
  if (a.dataset.behaviorBound) return;
  a.dataset.behaviorBound = '';
  a.addEventListener('click', (e) => {
    e.preventDefault();
    track(EVENTS.CONSENT_OPEN, { href: a.getAttribute('href') });
    emit('consent-open', { source: a });
  });
};
