import { getConfig } from '../ak.js';
import { fetchData } from './fetch-data.js';

const cache = new Map();

export const getPlaceholders = async () => {
  const { locale } = getConfig();
  const { prefix } = locale;
  if (cache.has(prefix)) return cache.get(prefix);
  const json = await fetchData(`${prefix}/system/placeholders.json`);
  const map = new Map(
    (json?.data ?? []).map(({ Key, Text }) => [Key.toLowerCase(), Text]),
  );
  // Only cache on an actual successful fetch — caching the empty map produced by
  // a failed/transient fetchData() call would permanently mask every placeholder
  // lookup for this locale, even though fetchData()'s own cache allows a retry.
  if (json) cache.set(prefix, map);
  return map;
};

export const getPlaceholder = async (key, fallback = '') => {
  const map = await getPlaceholders();
  return map.get(key.toLowerCase()) ?? fallback;
};
