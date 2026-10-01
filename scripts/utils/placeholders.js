import { getConfig } from '../ak.js';
import { fetchData } from './fetch-data.js';

// One DA Sheet per namespace: `forms.submit` reads row `submit` from
// `${prefix}/system/placeholders/forms.json`. The namespace is the text before
// the first dot; everything after it is the row key. Each sheet is fetched on
// first use and cached per URL (so per locale prefix and namespace). The legacy
// `/system/placeholders.json` is the DA Library's source only; code never reads
// it. See DA-CONTENT-STRUCTURE.md, Placeholders.
const cache = new Map();
const NAMESPACE = /^[a-z][a-z-]*$/;

export const getPlaceholders = async (ns) => {
  const { prefix } = getConfig().locale;
  const url = `${prefix}/system/placeholders/${ns}.json`;
  if (cache.has(url)) return cache.get(url);
  const json = await fetchData(url);
  const map = new Map(
    (json?.data ?? []).map(({ Key, Text }) => [Key.toLowerCase(), Text]),
  );
  // Only cache on an actual successful fetch — caching the empty map produced by
  // a transient fetchData() failure would mask every lookup for this sheet even
  // though fetchData() evicts it for a retry. A 404 (sheet absent for this
  // locale) needs no entry here: fetchData() keeps that null cached itself.
  if (json) cache.set(url, map);
  return map;
};

// `||`, not `??`: a blank author row (Text: '') must fall back too, otherwise
// icon-only buttons end up with aria-label="". No caller relies on a
// deliberately empty placeholder. A missing locale sheet or key falls back to
// the code default, never to the English sheet.
export const getPlaceholder = async (key, fallback = '') => {
  const dot = key.indexOf('.');
  const ns = key.slice(0, Math.max(dot, 0));
  const name = key.slice(dot + 1);
  if (dot < 0 || !NAMESPACE.test(ns) || !name) {
    // eslint-disable-next-line no-console -- a malformed key is a code bug
    console.warn(`getPlaceholder: "${key}" needs a "namespace.key" form with a lowercase namespace; using the fallback.`);
    return fallback;
  }
  const map = await getPlaceholders(ns);
  return map.get(name.toLowerCase()) || fallback;
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
