// Audience names the experimentation plugin can resolve. Shared by
// experiment-loader.js (runtime) and the experiments panel (validation), so an
// author-typed audience that no code resolves is flagged before it silently
// stops a test from running.
export const AUDIENCES = {
  mobile: () => window.matchMedia('(width < 768px)').matches,
  desktop: () => window.matchMedia('(width >= 768px)').matches,
};

export const AUDIENCE_NAMES = Object.keys(AUDIENCES);
