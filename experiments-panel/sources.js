import { readExperiment, matchesPattern, toClassName } from '../scripts/utils/experiments/config.js';
import { findExperimentBlocks, readExperimentBlock } from '../scripts/utils/experiments/block.js';
import { findConfigBlocks, removeConfigBlock } from '../scripts/utils/experiments/guard.js';
import { applyPersonalizeTables } from '../scripts/utils/experiments/personalize.js';
import { readValues } from './personalize-table.js';

// Bulk metadata sources, applied in this order (later wins). The dedicated
// experiments sheet needs registering in the site config's metadata sources
// (admin API) before EDS applies it; the panel reads it either way.
export const SHEETS = ['/metadata.json', '/metadata-experiments.json'];
const TIMEOUT_MS = 5000;
export const DA_ORIGIN = 'https://da.live';

const request = (url, init = {}) => fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS), ...init });

export const fetchText = async (url) => {
  const resp = await request(url);
  if (!resp.ok) throw new Error(`${resp.status} loading ${url}`);
  return resp.text();
};

export const fetchJson = async (url) => {
  try {
    const resp = await request(url);
    return resp.ok ? await resp.json() : null;
  } catch {
    return null;
  }
};

export const pathExists = async (path) => {
  try {
    return (await request(path, { method: 'HEAD' })).ok;
  } catch {
    return false;
  }
};

const headMeta = (doc) => [...doc.head.querySelectorAll('meta[name^="experiment"]')]
  .reduce((meta, { name, content }) => {
    meta[name] = meta[name] ? `${meta[name]}, ${content}` : content;
    return meta;
  }, {});

// Same order as the loader (experiment-loader.js runExperimentation):
// Experiment tables go first, so a section left with only its Personalize
// table is removed by the compiler here too. Mutates `doc`.
const compile = (doc, options) => {
  findExperimentBlocks(doc).forEach((block) => removeConfigBlock(block));
  return applyPersonalizeTables(doc, options);
};

// Section indexes (in `main > div` order, read before compiling) whose table
// a non-prod `?audience=` preview serves, from the real compiler on a fresh
// parsed copy. Preview mode only checks that `audience` is present, so any
// id works. Quiet: the panel must not log the compiler's author warnings.
const previewSections = (html) => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const sections = [...doc.querySelectorAll('main > div')];
  const plan = compile(doc, { prod: false, search: '?audience=preview', quiet: true });
  return new Set(plan.map(({ section }) => sections.indexOf(section)));
};

// Section-level config is tables only
// (docs/decisions/0012-section-personalization-tables-only.md): the page the
// panel fetches is server-rendered, so authored Section Metadata is already
// flattened to data-* (see sectionKeyIssues) and the only section-level source
// left is the Personalize table. Read each section's first table, then run the
// real compiler on this parsed copy with production rules (what a visitor is
// served) and on a second copy with preview rules (whether `?audience=`
// preview links serve anything). Mutates `doc`, so it runs last.
const readPersonalize = (doc, sections, html) => {
  const blocks = findConfigBlocks(doc.querySelector('main'), ['personalize']);
  const bySection = Map.groupBy(blocks, (block) => block.closest('main > div'));
  const tables = [...bySection].filter(([section]) => section)
    .map(([section, own]) => ({
      section, block: own[0], count: own.length, values: readValues(section),
    }));
  const inPreview = previewSections(html);
  const plan = compile(doc, { prod: true, search: '' });
  // Panel-only notes, kept out of personalize-table.js check(), which the
  // Personalize tab also uses to validate a table before insert. The inactive
  // note only when a preview really serves the table: an ended or bad End
  // Date drops it there too.
  const notesFor = ({
    section, count, values, previewable,
  }) => [
    count > 1 && `${count} Personalize tables in this section: only the first is used.`,
    values.Status === 'inactive' && previewable && 'Status is inactive: served only in `?audience=` previews.',
    !section.isConnected && 'This section holds only the Personalize table, so the compiler removes it and serves nothing.',
  ].filter(Boolean);
  return tables.map((table) => {
    const previewable = inPreview.has(sections.indexOf(table.section));
    return {
      kind: 'personalize',
      scope: `Section ${sections.indexOf(table.section) + 1}`,
      section: table.section,
      block: table.block,
      values: table.values,
      served: plan.find((entry) => entry.section === table.section)?.rules ?? [],
      previewable,
      notes: notesFor({ ...table, previewable }),
    };
  });
};

export const readPage = (html, pagePath) => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const tests = [];
  const page = readExperiment(headMeta(doc), pagePath);
  // Mirrors applyExperimentBlock: a table that names a test replaces all other
  // whole-page experiment metadata (page metadata and sheets alike).
  const [table, ...extra] = findExperimentBlocks(doc);
  const tableMeta = table && Object.fromEntries(readExperimentBlock(table));
  const fromTable = tableMeta && readExperiment(tableMeta, pagePath);
  if (fromTable) {
    const notes = [];
    if (page) notes.push(`Replaces test "${page.id}" from page metadata or a sheet: the Experiment table wins.`);
    if (extra.length) notes.push(`${extra.length + 1} Experiment tables on this page: only the first is used.`);
    tests.push({ kind: 'page', scope: 'Whole page', cfg: fromTable, from: 'table', notes });
  } else if (page) tests.push({ kind: 'page', scope: 'Whole page', cfg: page });
  return [...tests, ...readPersonalize(doc, [...doc.querySelectorAll('main > div')], html)];
};

// Section-metadata keys the experimentation plugin owns. EDS flattens them on
// the server to data-* on the section, where they look like plugin output
// (data-experiment, data-variant, data-audience, data-audiences) and the
// plugin never reads them: under the tables-only rule they do nothing. Keep
// in step with the rule in docs/authoring/section-metadata.md ("Keys you must not use
// in Section Metadata").
const PLUGIN_ATTR = /^data-(experiment|variant|audiences?|campaign)($|[-:])/;

export const sectionKeyIssues = (html) => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return [...doc.querySelectorAll('main > div')].flatMap((section, i) => [...section.attributes]
    .filter(({ name }) => PLUGIN_ATTR.test(name))
    .map(({ name }) => `Section ${i + 1}: section metadata key "${name.slice(5)}" does nothing on this site and can be mistaken for plugin output. Use a Personalize table for a section, or an Experiment table for the whole page.`));
};

export const readSheet = (json, source) => (json?.data ?? []).flatMap((row) => {
  const entries = Object.entries(row);
  const pattern = entries.find(([key]) => toClassName(key) === 'url')?.[1];
  if (!pattern) return [];
  const cfg = readExperiment(Object.fromEntries(entries.filter(([key]) => toClassName(key) !== 'url')), pattern);
  return cfg ? [{ kind: 'sheet', pattern, source, cfg }] : [];
});

// Sheet URL cells are free text: only link plain same-origin paths (no
// patterns, protocol-relative, backslash, or scheme URLs such as javascript:).
export const isPagePath = (value) => /^\/(?![/\\])[^*\\:]*$/.test(value);

// Page metadata beats bulk metadata, and later sheet rows beat earlier ones.
export const sourceOf = (test, rows, pagePath) => {
  if (test.from === 'table') return { label: 'Experiment table (page doc)' };
  const expected = rows.findLast((r) => matchesPattern(r.pattern, pagePath));
  if (!expected) return { label: 'Page metadata (page doc)' };
  if (expected.cfg.id === test.cfg.id) return { label: `Sheet ${expected.source} (${expected.pattern})` };
  return {
    label: 'Page metadata (page doc)',
    issue: `Overrides sheet row "${expected.cfg.id}" (${expected.source}, ${expected.pattern}): the page doc wins, so the sheet row is ignored here.`,
  };
};

// DA library plugin handshake (adobe/da-live blocks/edit/da-library and
// blocks/canvas/ew-panel-extensions): about 750ms after load DA posts
// { ready, context: { org, repo, path } } to the iframe, with a MessagePort
// for sendHTML/getSelection. The IMS token in the same message is ignored.
// DA doc paths carry no extension, and an `index` doc serves its folder.
export const pathFromDaContext = (context) => {
  const path = context?.path;
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return null;
  return path.replace(/(^|\/)index$/, '$1') || '/';
};

// Resolves { path, port } from DA, or null when DA never says hello.
export const waitForDaContext = (timeoutMs = 3000) => {
  const { promise, resolve } = Promise.withResolvers();
  const onMessage = (e) => {
    if (e.origin !== DA_ORIGIN || e.source !== window.parent || !e.data?.ready) return;
    const path = pathFromDaContext(e.data.context);
    if (path) resolve({ path, port: e.ports?.[0] ?? null });
  };
  window.addEventListener('message', onMessage);
  const timer = setTimeout(() => resolve(null), timeoutMs);
  return promise.finally(() => {
    clearTimeout(timer);
    window.removeEventListener('message', onMessage);
  });
};
