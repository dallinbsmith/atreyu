import { getVisitorId } from './visitor-id.js';

export { getVisitorId };

// Only same-origin relative paths are allowed — the fetch target must never
// be able to resolve to a third-party origin (e.g. "//evil.example" or
// "https://evil.example"). scripts/utils/analytics/pzn.js builds URLs from
// user-controlled query params and reuses this rather than letting a second,
// possibly-inconsistent copy exist.
//
// The dormant UC-01 full-page swap (`runExperiment`) that used to live here
// had no runtime caller and was deleted (fh-arch3 finding 3); the
// adobe/aem-experimentation plugin owns `experiment*` metadata now. Only the
// two helpers pzn.js imports remain.
export const isSameOriginPath = (path) => path.startsWith('/') && !path.startsWith('//');
