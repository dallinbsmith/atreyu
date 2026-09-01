// Segment cookie shape. Not specified by P0-44's text (which only says "sets
// a segment cookie") — this name/shape is this file's own proposal, flagged
// explicitly since a separate fork is building the client-side runtime that
// must read the same name back out of document.cookie:
//
//   frameio-pzn-segment=<enterprise|default>; Path=/; SameSite=Lax[; Secure]
//
// Deliberately NOT HttpOnly: P0-44's warm-visit path requires the client
// runtime to read the segment straight from document.cookie for a synchronous
// render with no network wait — an HttpOnly cookie would make that
// impossible. That tradeoff (any same-origin script can read/spoof a coarse
// segment label) is exactly the kind of thing to flag for aem-security-engineer
// rather than assume is fine.
//
// Bug-squash fix, 2026-08-28: the two forks HAD landed on different cookie
// names AND lifetimes — this file was a session cookie (no Max-Age, "not
// battle-tested," see the older comment above), scripts/utils/pzn.js separately used
// 'pzn-spike-segment' with a 30-min max-age. Neither matched P0-44's actual
// documented decision (24 hours). Both files now use this file's name and a
// 24-hour Max-Age as the canonical values. Can't share via a real import
// across the client-bundle/Worker deploy boundary; keep these two literals
// in sync by hand if either changes.
export const SEGMENT_COOKIE_NAME = 'frameio-pzn-segment';
export const SEGMENT_COOKIE_MAX_AGE_S = 24 * 60 * 60;

export const buildSegmentCookieHeader = ({ segment, secure }) => [
  `${SEGMENT_COOKIE_NAME}=${segment}`,
  'Path=/',
  `Max-Age=${SEGMENT_COOKIE_MAX_AGE_S}`,
  'SameSite=Lax',
  secure ? 'Secure' : null,
].filter(Boolean).join('; ');
