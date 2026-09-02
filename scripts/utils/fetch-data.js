const cache = new Map();

export const fetchData = async (url, options = {}) => {
  const params = new URLSearchParams();
  const { sheet, limit, offset } = options;
  [sheet].flat().filter(Boolean).forEach((s) => params.append('sheet', s));
  if (limit) params.set('limit', limit);
  if (offset) params.set('offset', offset);
  const qs = params.toString();
  const href = qs ? `${url}?${qs}` : url;
  if (cache.has(href)) return cache.get(href);
  const entry = fetch(href)
    .then((resp) => (resp.ok ? resp.json() : null))
    .catch(() => null);
  // Only keep a failed/null result cached long enough for concurrent callers to
  // share it — delete it once settled so a later call retries instead of being
  // stuck behind a transient failure for the rest of the session.
  entry.then((result) => { if (result === null) cache.delete(href); });
  cache.set(href, entry);
  return entry;
};
