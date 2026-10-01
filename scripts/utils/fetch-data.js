const cache = new Map();
const GONE = new Set([404, 410]);

export const fetchData = async (url, options = {}) => {
  const params = new URLSearchParams();
  const { sheet, limit, offset } = options;
  [sheet].flat().filter(Boolean).forEach((s) => params.append('sheet', s));
  if (limit) params.set('limit', limit);
  if (offset) params.set('offset', offset);
  const qs = params.toString();
  const href = qs ? `${url}?${qs}` : url;
  if (cache.has(href)) return cache.get(href);
  // A null result (any failure) stays cached while in flight so concurrent
  // callers share it. Once settled, a definitive 404/410 stays cached for the
  // session (a missing sheet won't appear mid-page, and refetching it per call
  // just multiplies requests); anything transient — 5xx, other non-ok
  // statuses, network or JSON-parse errors — is evicted so a later call retries.
  const entry = fetch(href)
    .then((resp) => {
      if (resp.ok) return resp.json();
      if (!GONE.has(resp.status)) cache.delete(href);
      return null;
    })
    .catch(() => {
      cache.delete(href);
      return null;
    });
  cache.set(href, entry);
  return entry;
};
