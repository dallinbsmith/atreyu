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

// `||`, not `??`: a blank author row (Text: '') must fall back too, otherwise
// icon-only buttons end up with aria-label="". No caller relies on a
// deliberately empty placeholder.
export const getPlaceholder = async (key, fallback = '') => {
  const map = await getPlaceholders();
  return map.get(key.toLowerCase()) || fallback;
};

// Fills `{key}` tokens in a placeholder template in a single pass. Every
// occurrence is replaced; unknown keys are left intact. The replacer is a
// function, so `$&`/`$\``/`$'` in an author-supplied value are inserted
// literally (a string replacement would expand them), and a value that itself
// contains `{token}` text is never re-substituted.
export const fillPlaceholder = (tpl, vars) => tpl.replace(
  /\{(\w+)\}/g,
  (match, key) => (Object.hasOwn(vars, key) ? String(vars[key]) : match),
);
