import { createElement as h } from '../scripts/utils/dom.js';
import { statusOf, validate, toClassName } from '../scripts/utils/experiments/config.js';
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
  return { url: new URL(da?.path ?? '/', window.location.origin), port: da?.port ?? null };
};
const { url: pageUrl, port: daPort } = await resolvePage();
const pagePath = pageUrl.pathname;
const view = document.querySelector('#view');

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

const checkVariantPages = async (card, cfg) => {
  const challengers = cfg.variants.slice(1);
  const exists = await Promise.all(challengers.map((v) => pathExists(v.path)));
  const found = challengers.map((v, i) => (exists[i] ? null : v.path));
  const missing = found.filter(Boolean);
  if (!missing.length) return;
  const item = h('li', { className: 'error' }, `Variant page not found: ${missing.join(', ')}`);
  const list = card.querySelector('.issues');
  if (list) list.append(item);
  else card.querySelector('.ok')?.replaceWith(h('ul', { className: 'issues' }, item));
};

const testCard = (test, rows) => {
  const { scope, cfg } = test;
  const source = sourceOf(test, rows, pagePath);
  const issues = validate(cfg, { audiences: AUDIENCE_NAMES });
  for (const message of [source.issue, ...(test.notes ?? [])].filter(Boolean)) issues.push({ level: 'warn', message });
  const serving = servingNow(cfg.id);
  const card = h(
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
  checkVariantPages(card, cfg);
  return card;
};

const loadSheet = async (sheet) => readSheet(await fetchJson(sheet), sheet);
const loadRows = async () => (await Promise.all(SHEETS.map(loadSheet))).flat();

const renderPage = async () => {
  const [html, rows] = await Promise.all([fetchText(pagePath), loadRows()]);
  const tests = readPage(html, pagePath);
  view.replaceChildren(h('p', { className: 'path' }, pagePath), ...(tests.length
    ? tests.map((t) => testCard(t, rows))
    : [h('p', {}, 'No tests on this page.')]));
};

const renderSite = async () => {
  const rows = await loadRows();
  const ids = Map.groupBy(rows, (r) => r.cfg.id);
  const body = rows.map(({ pattern, source, cfg }) => {
    const issues = validate(cfg, { audiences: AUDIENCE_NAMES });
    const uses = ids.get(cfg.id).length;
    if (uses > 1) issues.push({ level: 'warn', message: `Test id "${cfg.id}" is used by ${uses} rows: results will be merged.` });
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
  });
  view.replaceChildren(
    h('p', { className: 'note' }, 'Whole-page tests from the metadata sheets. Section tests live in page docs: open the page view on that page.'),
    rows.length ? h('table', { className: 'site' }, h('thead', {}, h('tr', {}, ['Pages', 'Test', 'Status', 'Variants', 'Checks', 'Sheet'].map((t) => h('th', {}, t)))), h('tbody', {}, body))
      : h('p', {}, `No tests in ${SHEETS.join(' or ')}.`),
  );
};

// A page that 404s in preview can still get a new test built for it.
const renderBuildTab = async () => {
  const pageHtml = await fetchText(pagePath).catch(() => null);
  renderBuild({ view, pagePath, port: daPort, pageHtml });
};
const RENDER = { page: renderPage, site: renderSite, build: renderBuildTab };

const show = async (name) => {
  for (const tab of document.querySelectorAll('[data-tab]')) tab.setAttribute('aria-selected', `${tab.dataset.tab === name}`);
  view.replaceChildren(h('p', {}, 'Loading...'));
  try {
    await RENDER[name]();
  } catch (ex) {
    view.replaceChildren(h('p', { className: 'error' }, `Could not load: ${ex.message}`));
  }
};

document.querySelector('nav').addEventListener('click', ({ target }) => {
  const tab = target.closest('[data-tab]');
  if (tab) show(tab.dataset.tab);
});
document.querySelector('#refresh').addEventListener('click', () => show(document.querySelector('[aria-selected="true"]').dataset.tab));
const initial = toClassName(params.get('view') ?? '');
show(RENDER[initial] ? initial : 'page');
