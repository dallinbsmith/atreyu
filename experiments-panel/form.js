// "Build test" tab: a form with real dropdowns and date pickers that writes the
// Experiment table into the DA doc (sendHTML over the DA library port).
import { createElement as h } from '../scripts/utils/dom.js';
import { AUDIENCE_NAMES } from '../scripts/utils/experiments/audiences.js';
import {
  FIELDS, readValues, check, toTableHtml, normalizeChoice,
} from './table.js';
import { DA_ORIGIN } from './sources.js';

const SPLITS = [['50', 'Half to one variant'], ['33, 33', 'Two variants, a third each'], ['25, 25, 25', 'Three variants, a quarter each'], ['10', '10% to one variant'], ['20', '20% to one variant']];
const audienceChoices = AUDIENCE_NAMES.flatMap((name, i) => [
  [name, name[0].toUpperCase() + name.slice(1)],
  ...AUDIENCE_NAMES.slice(i + 1).map((other) => [`${name}, ${other}`, `${name[0].toUpperCase() + name.slice(1)}, ${other}`]),
]);
const CHOICES = {
  Audience: [['', 'Everyone'], ...audienceChoices],
  Status: [['inactive', 'Inactive (paused)'], ['active', 'Active (test runs)']],
};
const HINTS = {
  'Test Name': 'Becomes the test id. Keep it the same for the life of the test.',
  Variants: 'One page link per line, under /v/, e.g. /v/c2c-headline',
  'Variant Names': 'Optional, comma-separated, same order as Variants.',
  Split: '% of all visitors per variant; control gets the rest. Blank = even split.',
  'Start Date': 'Blank = starts now. Dates switch at 00:00 UTC.',
  'End Date': 'Blank = runs until stopped.',
};

const input = (field) => {
  const name = field.label;
  if (field.type === 'select') return h('select', { name }, CHOICES[name].map(([value, text]) => h('option', { value }, text)));
  if (field.type === 'links') return h('textarea', { name, rows: 3 });
  return h('input', { name, type: field.type, list: name === 'Split' ? 'xp-splits' : null, autocomplete: 'off' });
};

// Resolves the HTML of the author's current selection in DA, or null.
const readSelection = (port, timeoutMs = 3000) => {
  const { promise, resolve } = Promise.withResolvers();
  const onMessage = (e) => {
    if (e.origin === DA_ORIGIN && e.source === window.parent && e.data?.action === 'sendSelection') resolve(e.data.details);
  };
  const onPortMessage = (e) => (e.data?.action === 'error' ? resolve(null) : null);
  window.addEventListener('message', onMessage);
  port.addEventListener('message', onPortMessage);
  port.start();
  port.postMessage({ action: 'getSelection' });
  const timer = setTimeout(() => resolve(null), timeoutMs);
  return promise.finally(() => {
    clearTimeout(timer);
    window.removeEventListener('message', onMessage);
    port.removeEventListener('message', onPortMessage);
  });
};

export default ({ view, pagePath, port, pageHtml }) => {
  const form = h('form', { className: 'build' }, FIELDS.map((f) => h(
    'label',
    {},
    h('span', {}, f.label),
    input(f),
    HINTS[f.label] ? h('small', {}, HINTS[f.label]) : null,
  )), h('datalist', { id: 'xp-splits' }, SPLITS.map(([value, text]) => h('option', { value }, text))));
  const issues = h('ul', { className: 'issues' });
  const status = h('p', { className: 'note', role: 'status' });
  const submit = h('button', { type: 'submit', className: 'primary' }, port ? 'Insert table in doc' : 'Copy table');
  form.append(h('div', { className: 'actions' }, submit));
  const load = port ? h('button', { type: 'button', className: 'load' }, 'Load selected table') : null;
  const loadErrors = new Map();
  let sending = false;
  let pendingSelection;
  let inputVersion = 0;

  const values = () => Object.fromEntries(new FormData(form));
  const fill = (found) => {
    loadErrors.clear();
    // A blank Status runs as active in the plugin; only a brand-new test starts paused.
    const blankStatus = Object.keys(found).length ? 'active' : 'inactive';
    for (const { label, type } of FIELDS) {
      const value = found[label] || (label === 'Status' ? blankStatus : '');
      const normalized = type === 'select' ? normalizeChoice(label, value).value : value;
      form.elements[label].value = normalized;
      if (type === 'select' && normalized && form.elements[label].value !== normalized) {
        loadErrors.set(label, { level: 'error', message: `Unsupported ${label} value "${value}". Choose one of the listed options.` });
      }
    }
  };
  const refresh = () => {
    const unset = [...form.querySelectorAll('select')]
      .filter((el) => el.selectedIndex < 0 && !loadErrors.has(el.name))
      .map((el) => ({ level: 'error', message: `Choose an option for ${el.name}.` }));
    const checks = check(values(), { pagePath, audiences: AUDIENCE_NAMES });
    const found = [...loadErrors.values(), ...unset, ...checks];
    issues.replaceChildren(...found.map(({ level, message }) => h('li', { className: level }, message)));
    submit.disabled = sending || found.some((i) => i.level === 'error');
  };

  const loadSelection = async () => {
    const version = inputVersion;
    pendingSelection ??= readSelection(port).finally(() => { pendingSelection = null; });
    load.disabled = true;
    const html = await pendingSelection;
    const found = html && readValues(new DOMParser().parseFromString(html, 'text/html').body);
    status.textContent = found ? 'Loaded the selected table. Insert replaces it while it stays selected.'
      : 'No Experiment table in the selection. Select the whole table, from above its first row to below its last.';
    if (found && version === inputVersion) fill(found);
    else if (found) status.textContent = 'Loaded the selected table, but kept your edits because the form changed while loading.';
    load.disabled = false;
    refresh();
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    refresh();
    if (submit.disabled) return;
    sending = true;
    submit.disabled = true;
    const html = toTableHtml(values());
    const done = () => {
      sending = false;
      refresh();
    };
    if (port) {
      port.postMessage({ action: 'sendHTML', details: html });
      status.textContent = 'Sent to DA. Delete any older Experiment table: only the first one is used.';
      setTimeout(done, 1000);
      return;
    }
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }) })]);
      status.textContent = 'Copied. Paste it into the page doc.';
    } catch {
      status.textContent = 'Copy failed. Check browser clipboard permissions and try again.';
    } finally {
      setTimeout(done, 1000);
    }
  });
  // Enter in a text field would click Insert implicitly; only an explicit click inserts.
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement) e.preventDefault();
  });
  form.addEventListener('input', ({ target }) => {
    inputVersion += 1;
    loadErrors.delete(target.name);
    refresh();
  });

  const current = pageHtml && readValues(new DOMParser().parseFromString(pageHtml, 'text/html').body);
  fill(current ?? {});
  refresh();
  view.replaceChildren(
    h('p', { className: 'note' }, current
      ? 'Started from this page\'s previewed Experiment table.'
      : 'Fill in the test, then insert it anywhere in the page doc. It never shows on the page.'),
    load,
    form,
    issues,
    status,
  );
  load?.addEventListener('click', loadSelection);
};
