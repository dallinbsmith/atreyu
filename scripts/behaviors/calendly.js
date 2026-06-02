// TODO: SDK popup requires adding *.calendly.com to worker CSP
// (media/script/frame-src) — deferred. See Calendly note.
import { track } from '../utils/analytics.js';

// DELAYED behavior. Documented fallback only: open the Calendly URL in a new tab.
// The real popup widget needs the Calendly SDK, which is blocked by the current CSP.
export default (a) => {
  if (a.dataset.behaviorBound) return;
  a.dataset.behaviorBound = '';
  const params = new URL(a.href, window.location.href).searchParams;
  const url = params.get('url') ?? a.href;
  a.addEventListener('click', (e) => {
    e.preventDefault();
    track('calendly_open', { url });
    window.open(url, '_blank', 'noopener,noreferrer');
  });
};
