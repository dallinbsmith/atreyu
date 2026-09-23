// "Build test" tab: a form with real dropdowns and date pickers that writes the
// Experiment table into the DA doc (sendHTML over the DA library port).
import { createElement as h } from '../scripts/utils/dom.js';
import { AUDIENCE_NAMES } from '../scripts/utils/experiments/audiences.js';
import { FIELDS, readValues, check, toTableHtml } from './table.js';
import { DA_ORIGIN } from './sources.js';

const SPLITS = [['50', 'Half to one variant'], ['33, 33', 'Two variants, a third each'], ['25, 25, 25', 'Three variants, a quarter each'], ['10', '10% to one variant'], ['20', '20% to one variant']];
const CHOICES = {
  Audience: [['', 'Everyone'], ...AUDIENCE_NAMES.map((a) => [a, a[0].toUpperCase() + a.slice(1)])],
  Status: [['inactive', 'Inactive (paused)'], ['active', 'Active (test runs)']],
};
const HINTS = {
  'Test Name': 'Becomes the test id. Keep it the same for the life of the test.',
  Variants: 'One page link per line, e.g. /experiments/c2c-headline',
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
    if (e.origin === DA_ORIGIN && e.data?.action === 'sendSelection') resolve(e.data.details);
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
  const submit = h('button', { type: 'button', className: 'primary' }, port ? 'Insert table in doc' : 'Copy table');

  const values = () => Object.fromEntries(FIELDS.map(({ label }) => [
    label, form.elements[label].value,
  ]));
  const fill = (found) => {
    for (const { label } of FIELDS) {
      form.elements[label].value = found[label] ?? (label === 'Status' ? 'inactive' : '');
    }
  };
  const refresh = () => {
    const found = check(values(), { pagePath, audiences: AUDIENCE_NAMES });
    issues.replaceChildren(...found.map(({ level, message }) => h('li', { className: level }, message)));
    submit.disabled = found.some((i) => i.level === 'error');
  };

  const loadSelection = async () => {
    const html = await readSelection(port);
    const found = html && readValues(new DOMParser().parseFromString(html, 'text/html').body);
    status.textContent = found ? 'Loaded the selected table. Insert replaces it while it stays selected.'
      : 'No Experiment table in the selection. Select the whole table, from above its first row to below its last.';
    if (found) fill(found);
    refresh();
  };

  submit.addEventListener('click', async () => {
    const html = toTableHtml(values());
    if (port) {
      port.postMessage({ action: 'sendHTML', details: html });
      status.textContent = 'Inserted. Delete any older Experiment table: only the first one is used.';
      return;
    }
    await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }) })]);
    status.textContent = 'Copied. Paste it into the page doc.';
  });
  form.addEventListener('input', refresh);

  const current = pageHtml && readValues(new DOMParser().parseFromString(pageHtml, 'text/html').body);
  fill(current ?? {});
  refresh();
  view.replaceChildren(
    h('p', { className: 'note' }, current
      ? 'Started from this page\'s previewed Experiment table.'
      : 'Fill in the test, then insert it anywhere in the page doc. It never shows on the page.'),
    port ? h('button', { type: 'button', className: 'load' }, 'Load selected table') : null,
    form,
    issues,
    h('div', { className: 'actions' }, submit),
    status,
  );
  view.querySelector('.load')?.addEventListener('click', loadSelection);
};
