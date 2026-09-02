import ENV from '../env.js';

// Segment's own standard public browser snippet — no npm package, no bundler,
// matching this project's no-build-step architecture (Falkor's `@frameio/
// segment-ot` is Frame.io's internal package, not portable here). A write key
// is a public client-side identifier by design (like a GA tracking ID), not a
// secret — safe to embed directly, unlike the Clearbit key (a real secret,
// held server-side in the decision-endpoint Worker).
//
// REPLACE with the real frame.io marketing-site Segment write key before this
// leaves the spike — this placeholder will queue events into a stub that
// never actually reaches Segment's servers.
const SEGMENT_WRITE_KEY = 'REPLACE_WITH_REAL_SEGMENT_WRITE_KEY';

const METHODS = [
  'trackSubmit', 'trackClick', 'trackLink', 'trackForm', 'pageview', 'identify',
  'reset', 'group', 'track', 'ready', 'alias', 'debug', 'page', 'once', 'off',
  'on', 'addSourceMiddleware', 'addIntegrationMiddleware', 'setAnonymousId',
  'addDestinationMiddleware',
];

let loaded = false;

// Defines the queueing stub on window.analytics immediately (so nothing
// upstream has to wait), then loads the real library async — calls made
// before it arrives are queued on the stub and replayed once it's ready.
export const loadSegment = (writeKey = SEGMENT_WRITE_KEY) => {
  if (loaded || window.analytics?.invoked) return;
  // Bug-squash fix, 2026-08-31: this shipped with no environment gate at all,
  // unlike pzn.js's sibling `ENV !== 'prod'` check from the same graduation
  // batch — meaning every production visitor who granted analytics consent
  // got a live <script> injected against the placeholder write key above
  // (guaranteed rejected by Segment's CDN) and a permanently-queuing
  // window.analytics stub that never actually delivers anything. Gate this
  // the same way pzn.js gates itself, for the same reason (not ready for
  // real visitor traffic) — remove once SEGMENT_WRITE_KEY above is real.
  if (ENV === 'prod') return;
  loaded = true;

  const stub = [];
  METHODS.forEach((method) => {
    stub[method] = (...args) => {
      stub.push([method, ...args]);
      return stub;
    };
  });
  stub.invoked = true;
  window.analytics = stub;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://cdn.segment.com/analytics.js/v1/${writeKey}/analytics.min.js`;
  document.head.appendChild(script);
};
