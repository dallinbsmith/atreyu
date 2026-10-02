// Segment's own standard public browser snippet — no npm package, no bundler,
// matching this project's no-build-step architecture (Falkor's `@frameio/
// segment-ot` is Frame.io's internal package, not portable here). A write key
// is a public client-side identifier by design (like a GA tracking ID), not a
// secret — safe to embed directly.
//
// REPLACE with the real frame.io marketing-site Segment write key. Until then,
// the placeholder is treated as unconfigured and Segment stays off on every tier.
const SEGMENT_WRITE_KEY = 'REPLACE_WITH_REAL_SEGMENT_WRITE_KEY';
const PLACEHOLDER_WRITE_KEYS = new Set(['', 'REPLACE_WITH_REAL_SEGMENT_WRITE_KEY']);

const METHODS = [
  'trackSubmit', 'trackClick', 'trackLink', 'trackForm', 'pageview', 'identify',
  'reset', 'group', 'track', 'ready', 'alias', 'debug', 'page', 'once', 'off',
  'on', 'addSourceMiddleware', 'addIntegrationMiddleware', 'setAnonymousId',
  'addDestinationMiddleware',
];

let loaded = false;

export const isRealSegmentWriteKey = (writeKey = SEGMENT_WRITE_KEY) => (
  !PLACEHOLDER_WRITE_KEYS.has(writeKey?.trim?.() ?? '')
);

// Defines the queueing stub on window.analytics immediately (so nothing
// upstream has to wait), then loads the real library async — calls made
// before it arrives are queued on the stub and replayed once it's ready.
export const loadSegment = (writeKey = SEGMENT_WRITE_KEY) => {
  if (loaded || window.analytics?.invoked) return;
  if (!isRealSegmentWriteKey(writeKey)) return;
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
