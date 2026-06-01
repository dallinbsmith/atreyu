import { getConfig } from '../ak.js';
import { fetchData } from './fetch-data.js';

const cache = new Map();

export const getPlaceholders = async () => {
  const { locale } = getConfig();
  const { prefix } = locale;
  if (cache.has(prefix)) return cache.get(prefix);
  const json = await fetchData(`${prefix}/placeholders.json`);
  const map = new Map(
    (json?.data ?? []).map(({ Key, Value }) => [Key.toLowerCase(), Value]),
  );
  cache.set(prefix, map);
  return map;
};

export const getPlaceholder = async (key, fallback = '') => {
  const map = await getPlaceholders();
  return map.get(key.toLowerCase()) ?? fallback;
};
