import { createElement as h } from '../scripts/utils/dom.js';
import { activateTab, announce, rovingTabindex } from '../scripts/utils/a11y.js';
import {
  statusOf, validate, toClassName, VARIANT_ROOT,
} from '../scripts/utils/experiments/config.js';
import { AUDIENCE_NAMES } from '../scripts/utils/experiments/audiences.js';
import {
  SHEETS, fetchText, isPagePath, fetchJson, pathExists, readPage, readSheet, sourceOf,
  waitForDaContext,
} from './sources.js';
import renderBuild from './form.js';

const params = new URLSearchParams(window.location.search);
// Page comes from Sidekick (?referrer=), a direct link (?page=), or the DA
// editor sidebar (postMessage context, which also brings the port used to
// insert into the doc). Top-level await: nothing renders first.
const resolvePage = async () => {
  const given = params.get('referrer') ?? params.get('page');
  if (given || window.parent === window) return { url: new URL(given ?? '/', window.location.origin), port: null };
  const da = await waitForDaContext();
  return da
    ? { url: new URL(da.path, window.location.origin), port: da.port ?? null }
    : { url: null, port: null, error: 'Couldn\'t get the page from DA. Reopen the panel.' };
};
const { url: pageUrl, port: daPort, error: pageError } = await resolvePage();
const pagePath = pageUrl?.pathname ?? '/';
const view = document.querySelector('#view');
const tabs = [...document.querySelectorAll('[role="tab"]')];
let currentTab = 'page';
let renderId = 0;

const pct = (n) => (Number.isFinite(n) ? `${Math.round(n * 100) / 100}%` : 'invalid');
const day = (d) => (d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : 'open');
// An error-level issue means the plugin will not serve the test as authored.
const badge = (cfg, issues) => {
  const status = issues.some((i) => i.level === 'error') ? 'blocked' : statusOf(cfg);
  return h('span', { className: `badge ${status}` }, status);
};
const issueList = (issues) => (issues.length
  ? h('ul', { className: 'issues' }, issues.map(({ level, message }) => h('li', { className: level }, message)))
  : h('p', { className: 'ok' }, 'No problems found.'));

const servingNow = (id) => {
  try {
    const found = (window.parent.hlx?.experiments ?? []).find((e) => e.config?.id === id);
    return found?.config.run ? found.config.selectedVariant : null;
  } catch {
    return null; // parent is cross-origin: nothing to show
  }
};

const previewHref = (cfg, variant) => {
  const url = new URL(pageUrl);
  url.searchParams.set('experiment', `${cfg.id}/${variant.name}`);
  return url.href;
};

const variantTable = (cfg) => h(
  'table',
  {},
  h('thead', {}, h('tr', {}, ['Variant', 'Split', 'Page', ''].map((t) => h('th', {}, t)))),
  h('tbody', {}, cfg.variants.map((v) => h(
    'tr',
    { 'data-path': v.path },
    h('td', {}, v.label),
    h('td', {}, pct(v.split)),
    h('td', {}, h('a', { href: v.path, target: '_blank' }, v.path)),
    h('td', {}, h('a', { href: previewHref(cfg, v), target: '_blank' }, 'Preview')),
  ))),
);

const missingVariantIssues = async (cfg) => {
  const challengers = cfg.variants.slice(1);
  const exists = await Promise.all(challengers.map((v) => pathExists(v.path)));
  const found = challengers.map((v, i) => (exists[i] ? null : v.path));
  const missing = found.filter(Boolean);
  return missing.length ? [{ level: 'error', message: `Variant page not found: ${missing.join(', ')}` }] : [];
};

const testCard = async (test, rows) => {
  const { scope, cfg } = test;
  const source = sourceOf(test, rows, pagePath);
  const issues = validate(cfg, {
    audiences: AUDIENCE_NAMES,
    variantRoot: VARIANT_ROOT,
    scope: test.kind === 'section' ? 'section' : 'page',
  });
  for (const message of [source.issue, ...(test.notes ?? [])].filter(Boolean)) issues.push({ level: 'warn', message });
  issues.push(...await missingVariantIssues(cfg));
  const serving = servingNow(cfg.id);
  return h(
    'article',
    { className: 'card' },
    h('header', {}, h('h2', {}, cfg.name), badge(cfg, issues)),
    h('p', { className: 'meta' }, `${scope} | ${source.label} | id ${cfg.id}`),
    h('p', { className: 'meta' }, `Audiences: ${cfg.audiences.join(', ') || 'everyone'}`),
    h('p', { className: 'meta' }, `Dates: ${day(cfg.startDate)} to ${day(cfg.endDate)}`),
    serving ? h('p', { className: 'serving' }, `Serving in this tab: ${serving}`) : null,
    variantTable(cfg),
    issueList(issues),
  );
};

const loadSheet = async (sheet) => readSheet(await fetchJson(sheet), sheet);
const loadRows = async () => (await Promise.all(SHEETS.map(loadSheet))).flat();

const renderPage = async () => {
  if (pageError) return [h('p', { className: 'error' }, pageError)];
  const [html, rows] = await Promise.all([fetchText(pagePath), loadRows()]);
  const tests = readPage(html, pagePath);
  return [h('p', { className: 'path' }, pagePath), ...(tests.length
    ? await Promise.all(tests.map((t) => testCard(t, rows)))
    : [h('p', {}, 'No tests on this page.')])];
};

const renderSite = async () => {
  const rows = await loadRows();
  const ids = Map.groupBy(rows, (r) => r.cfg.id);
  const body = await Promise.all(rows.map(async ({ pattern, source, cfg }) => {
    const issues = validate(cfg, { audiences: AUDIENCE_NAMES, variantRoot: VARIANT_ROOT });
    const uses = ids.get(cfg.id).length;
    if (uses > 1) issues.push({ level: 'warn', message: `Test id "${cfg.id}" is used by ${uses} rows: results will be merged.` });
    issues.push(...await missingVariantIssues(cfg));
    return h(
      'tr',
      {},
      h('td', {}, isPagePath(pattern) ? h('a', { href: pattern, target: '_blank' }, pattern) : pattern),
      h('td', {}, cfg.name),
      h('td', {}, badge(cfg, issues)),
      h('td', {}, cfg.variants.map((v) => `${v.label} ${pct(v.split)}`).join(', ')),
      h('td', {}, issueList(issues)),
      h('td', {}, source),
    );
  }));
  return [
    h('p', { className: 'note' }, 'Whole-page tests from the metadata sheets. Section tests live in page docs: open the page view on that page.'),
    rows.length ? h('table', { className: 'site' }, h('thead', {}, h('tr', {}, ['Pages', 'Test', 'Status', 'Variants', 'Checks', 'Sheet'].map((t) => h('th', {}, t)))), h('tbody', {}, body))
      : h('p', {}, `No tests in ${SHEETS.join(' or ')}.`),
  ];
};

// A page that 404s in preview can still get a new test built for it.
const renderBuildTab = async () => {
  if (pageError) return [h('p', { className: 'error' }, pageError)];
  const pageHtml = await fetchText(pagePath).catch(() => null);
  const scratch = h('div');
  renderBuild({ view: scratch, pagePath, port: daPort, pageHtml });
  return [...scratch.childNodes];
};
const RENDER = { page: renderPage, site: renderSite, build: renderBuildTab };

const show = async (name) => {
  renderId += 1;
  const id = renderId;
  currentTab = name;
  activateTab(tabs, [], tabs.findIndex((tab) => tab.dataset.tab === name));
  view.setAttribute('aria-labelledby', `tab-${name}`);
  view.replaceChildren(h('p', {}, 'Loading...'));
  try {
    const nodes = await RENDER[name]();
    if (id === renderId) {
      view.replaceChildren(...nodes);
      announce(`${tabs.find((tab) => tab.dataset.tab === name)?.textContent ?? name} loaded`);
    }
  } catch (ex) {
    if (id === renderId) view.replaceChildren(h('p', { className: 'error' }, `Could not load: ${ex.message}`));
  }
};

const nav = document.querySelector('nav');
rovingTabindex(nav, tabs);
nav.addEventListener('click', ({ target }) => {
  const tab = target.closest('[data-tab]');
  if (tab) show(tab.dataset.tab);
});
document.querySelector('#refresh').addEventListener('click', () => show(currentTab));
const initial = toClassName(params.get('view') ?? '');
show(RENDER[initial] ? initial : 'page');
