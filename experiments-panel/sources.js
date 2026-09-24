import { readExperiment, matchesPattern, toClassName } from '../scripts/utils/experiments/config.js';
import { cellValue, findExperimentBlocks, readExperimentBlock } from '../scripts/utils/experiments/block.js';

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
  const sections = [...doc.querySelectorAll('main > div')];
  for (const sm of doc.querySelectorAll('main .section-metadata')) {
    const rows = [...sm.children].filter((row) => row.children[1])
      .map((row) => [row.children[0].textContent.trim(), cellValue(row.children[1], { join: '\n' })]);
    const cfg = readExperiment(Object.fromEntries(rows), pagePath, { scope: 'section' });
    if (cfg) tests.push({ kind: 'section', scope: `Section ${sections.indexOf(sm.parentElement) + 1}`, cfg });
  }
  return tests;
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
  if (test.kind === 'section') return { label: 'Section metadata (page doc)' };
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
