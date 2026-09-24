// Promise-memoized so two concurrent callers loading the same src share one
// real load event instead of the second seeing the first's not-yet-loaded
// <script> tag and returning null immediately (see scripts.md's shared-fetch
// memoization pattern, e.g. fetch-data.js).
const pending = new Map();

export default async (src, attrs = {}) => {
  if (pending.has(src)) return pending.get(src);
  if (document.querySelector(`head > script[src="${src}"]`)) return null;
  const { promise, resolve, reject } = Promise.withResolvers();
  const script = document.createElement('script');
  script.src = src;
  for (const [key, value] of Object.entries(attrs)) script.setAttribute(key, value);
  script.addEventListener('load', resolve);
  script.addEventListener('error', reject);
  document.head.append(script);
  pending.set(src, promise);
  // Separate chain purely for the cleanup side effect — `promise` itself
  // (returned below, unaffected by this) is the one callers await/catch.
  promise.finally(() => pending.delete(src)).catch(() => {});
  return promise;
};
