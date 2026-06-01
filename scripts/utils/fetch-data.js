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
  cache.set(href, entry);
  return entry;
};
