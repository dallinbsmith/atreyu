// Pure read/validate helpers for adobe/aem-experimentation experiment config.
// Mirrors the plugin's own parsing (plugins/experimentation/src/index.js
// getExperimentConfig, v2.0.0) so the authoring panel shows what the plugin
// will actually do, including its silent split padding/truncation.
import locales from '../../locales.js';

export const ACTIVE = ['active', 'on', 'true'];
const KNOWN_STATUS = [...ACTIVE, 'inactive', 'off', 'false'];
const SECTION_IGNORED_FIELDS = new Map([
  ['start-date', 'Start Date'],
  ['end-date', 'End Date'],
  ['requires-consent', 'Requires Consent'],
  ['variant-name', 'Variant Name'],
  ['variant-names', 'Variant Names'],
  ['optimizing-target', 'Optimizing Target'],
]);

// Variant pages live here. The production Worker serves them only to the
// plugin's fetch and 404s direct visits (workers/website/handlers/variants.js,
// which has its own copy of this value); helix-query.yaml keeps them out of
// the index and sitemap.
export const VARIANT_ROOT = '/v/';

// True for '/v/x' and '/de-de/v/x', and for the bare roots '/v' and '/de-de/v'
// (the Worker serves those as variants too). One locale prefix is stripped on
// a path boundary, so '/de-dev/v/' and '/vv/' miss. Used by guard.js and
// validate(). personalize.js deliberately does NOT use it: Personalize rules
// stay English-only (PLAN D-15) and never the bare root. The Worker's own copy
// is isVariantPage in workers/website/handlers/variants.js; parity is checked
// by tools/config-sync/locales.test.js.
export const isVariantPath = (path, root = VARIANT_ROOT) => {
  const prefix = Object.keys(locales).find((p) => p && (path === p || path.startsWith(`${p}/`)));
  const localized = path.slice(prefix?.length ?? 0) || '/';
  return localized === root.slice(0, -1) || localized.startsWith(root);
};

export const toClassName = (name) => (typeof name === 'string'
  ? name.toLowerCase().replace(/[^0-9a-z]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  : '');

export const toList = (value) => {
  if (Array.isArray(value)) return value.map((v) => `${v}`.trim()).filter(Boolean);
  return value ? `${value}`.split(/[,\n]/).map((s) => s.trim()).filter(Boolean) : [];
};

const toCamel = (key) => toClassName(key).replace(/-([a-z])/g, (g) => g[1].toUpperCase());

const toProps = (meta) => Object.entries(meta).reduce((props, [rawKey, value]) => {
  const key = toClassName(rawKey);
  if (key === 'experiment') props.value = value;
  else if (key.startsWith('experiment-')) props[toCamel(key.slice('experiment-'.length))] = value;
  return props;
}, {});

const sectionIgnoredFields = (meta) => [...new Set(Object.keys(meta)
  .map((rawKey) => toClassName(rawKey))
  .filter((key) => key.startsWith('experiment-'))
  .map((key) => key.slice('experiment-'.length))
  .filter((key) => SECTION_IGNORED_FIELDS.has(key))
  .map((key) => SECTION_IGNORED_FIELDS.get(key)))];

const toPath = (page, pagePath) => {
  try {
    return new URL(page, `https://placeholder${pagePath}`).pathname;
  } catch {
    return page;
  }
};

const toDate = (value) => (value ? new Date(value) : null);

// `meta` maps raw metadata keys ("Experiment Variants", "experiment-variants")
// to values (string or string[]).
export const readExperiment = (meta, pagePath = '/', { scope = 'page' } = {}) => {
  const props = toProps(meta);
  const id = toClassName(Array.isArray(props.value) ? props.value[0] : props.value);
  if (!id) return null;
  const rawPages = props.variants ?? props.url;
  const instant = Number(rawPages);
  const pages = Number.isNaN(instant) || !rawPages
    ? toList(rawPages).map((p) => toPath(p, pagePath))
    : Array(instant).fill(pagePath);
  const splits = toList(props.split).map((s) => Number.parseFloat(s));
  const shares = props.split
    ? pages.map((_, i) => splits[i] ?? 0)
    : pages.map(() => 100 / (pages.length + 1));
  const ignoredAtSection = scope === 'section' ? sectionIgnoredFields(meta) : [];
  const labels = (scope === 'section' ? [props.name] : [props.name, props.variantNames, props.variantName])
    .map(toList)
    .find((l) => l.length) ?? [];
  const challengers = pages.map((path, i) => ({
    name: `challenger-${i + 1}`, label: labels[i] ?? `Challenger ${i + 1}`, path, split: shares[i],
  }));
  const taken = challengers.reduce((sum, v) => sum + (Number.isFinite(v.split) ? v.split : 0), 0);
  return {
    id,
    name: `${Array.isArray(props.value) ? props.value[0] : props.value}`.trim(),
    label: props.label || `Experiment ${props.value}`,
    status: props.status || 'active',
    audiences: toList(props.audiences ?? props.audience).map(toClassName),
    startDate: scope === 'section' ? null : toDate(props.startDate),
    endDate: scope === 'section' ? null : toDate(props.endDate),
    variants: [{ name: 'control', label: 'Control', path: pagePath, split: 100 - taken }, ...challengers],
    splitCount: props.split ? splits.length : null,
    ignoredAtSection,
  };
};

export const statusOf = (cfg, now = Date.now()) => {
  if (!ACTIVE.includes(toClassName(cfg.status))) return 'inactive';
  if (cfg.startDate && cfg.startDate > now) return 'scheduled';
  if (cfg.endDate && cfg.endDate <= now) return 'ended';
  return 'running';
};

const splitIssues = (cfg, add) => {
  const [control, ...challengers] = cfg.variants;
  if (cfg.splitCount !== null && cfg.splitCount < challengers.length) {
    add('warn', `${cfg.splitCount} split value(s) for ${challengers.length} variant(s): the plugin gives the rest 0%.`);
  }
  if (cfg.splitCount !== null && cfg.splitCount > challengers.length) {
    add('warn', `${cfg.splitCount} split values for ${challengers.length} variant(s): extras are ignored.`);
  }
  if (challengers.some((v) => !Number.isFinite(v.split) || v.split < 0)) add('error', 'Split values must be numbers of 0 or more.');
  if (control.split < 0) add('error', 'Splits add up to more than 100%.');
};

export const validate = (cfg, { audiences = [], variantRoot, scope = 'page' } = {}) => {
  const issues = [];
  const add = (level, message) => issues.push({ level, message });
  const [control, ...challengers] = cfg.variants;
  const ignoredAtSection = scope === 'section' ? [...(cfg.ignoredAtSection ?? [])].sort() : [];
  for (const field of ignoredAtSection) {
    add('warn', `${field} is ignored by plugin at section scope.`);
  }
  if (!challengers.length) add('error', 'No variants: set Experiment Variants.');
  splitIssues(cfg, add);
  if (challengers.some((v) => v.path === control.path)) add('warn', 'A variant points at the control page itself.');
  const exposed = challengers
    .filter((v) => variantRoot && v.path !== control.path && !isVariantPath(v.path, variantRoot));
  if (exposed.length) {
    add('warn', `Variant page outside ${variantRoot}: visitors and search engines can open it directly. Move it under ${variantRoot}: ${exposed.map((v) => v.path).join(', ')}`);
  }
  if (!KNOWN_STATUS.includes(toClassName(cfg.status))) add('warn', `Unknown status "${cfg.status}": the experiment will not run.`);
  for (const [name, date] of [['Start Date', cfg.startDate], ['End Date', cfg.endDate]]) {
    if (date && Number.isNaN(date.getTime())) add('error', `${name} is not a valid date.`);
  }
  if (cfg.startDate && cfg.endDate && cfg.startDate >= cfg.endDate) add('error', 'Start Date is not before End Date.');
  const unknown = cfg.audiences.filter((a) => !audiences.includes(a));
  if (unknown.length) add('error', `Unknown audience(s) ${unknown.join(', ')}: the experiment never runs.`);
  return issues;
};

// Bulk metadata URL patterns: `**` any depth, `*` within one path segment.
export const matchesPattern = (pattern, path) => {
  const source = pattern.trim().split('**')
    .map((part) => part.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*'))
    .join('.*');
  return new RegExp(`^${source}$`).test(path);
};
