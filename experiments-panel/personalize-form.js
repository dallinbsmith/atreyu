import { createElement as h } from '../scripts/utils/dom.js';
import { readSelection, sendHtml } from './da-port.js';
import { fetchText } from './sources.js';
import {
  FIELDS,
  MAX_RULES,
  audienceChoices,
  check,
  multiSectionWarnings,
  normalizeValues,
  readValues,
  toTableHtml,
} from './personalize-table.js';

const HINTS = {
  Name: 'Label for authors and analytics. Keep it stable for this personalization.',
  Audience: 'Choose a catalog audience or type campaign-<name>.',
  'End Date': 'Required. Runs through the end of this local day, max 180 days out.',
  Owner: 'Team or person responsible for cleanup.',
};

const input = (field, index = 0) => {
  if (field.type === 'select') {
    return h('select', { name: field.label }, [
      h('option', { value: 'active' }, 'Active'),
      h('option', { value: 'inactive' }, 'Inactive'),
    ]);
  }
  if (field.type === 'rule') {
    const audience = h('input', {
      name: `audience-${index}`, list: 'personalize-audiences', placeholder: 'mobile', autocomplete: 'off',
    });
    return h(
      'div',
      { className: 'rule' },
      audience,
      h('input', { name: `path-${index}`, placeholder: '/v/mobile-hero', autocomplete: 'off' }),
    );
  }
  return h('input', { name: field.label, type: field.type, autocomplete: 'off' });
};

const values = (form) => {
  const data = new FormData(form);
  return {
    Name: data.get('Name'),
    Status: data.get('Status'),
    'End Date': data.get('End Date'),
    Owner: data.get('Owner'),
    rules: Array.from({ length: MAX_RULES }, (_, i) => ({
      audience: data.get(`audience-${i}`),
      path: data.get(`path-${i}`),
    })),
  };
};

const fill = (form, source = {}) => {
  const v = normalizeValues(source);
  for (const name of ['Name', 'Status', 'End Date', 'Owner']) form.elements[name].value = v[name] ?? '';
  v.rules.forEach((rule, i) => {
    form.elements[`audience-${i}`].value = rule.audience;
    form.elements[`path-${i}`].value = rule.path;
  });
};

export default ({ view, port, pageHtml }) => {
  const fieldControl = (field) => h(
    'label',
    {},
    h('span', {}, field.label),
    input(field),
    HINTS[field.label] ? h('small', {}, HINTS[field.label]) : null,
  );
  const ruleControl = (field, i) => h(
    'label',
    {},
    h('span', {}, `Audience rule ${i + 1}`),
    input(field, i),
    i === 0 ? h('small', {}, HINTS.Audience) : null,
  );
  const form = h(
    'form',
    { className: 'build personalize-build' },
    FIELDS.flatMap((field) => (field.type === 'rule'
      ? Array.from({ length: MAX_RULES }, (_, i) => ruleControl(field, i))
      : [fieldControl(field)])),
    h(
      'datalist',
      { id: 'personalize-audiences' },
      audienceChoices().map(([value, label]) => h('option', { value }, label)),
    ),
  );
  const issues = h('ul', { className: 'issues' });
  const status = h('p', { className: 'note', role: 'status' });
  const submit = h('button', { type: 'submit', className: 'primary' }, port ? 'Insert table in doc' : 'Copy table');
  const load = port ? h('button', { type: 'button', className: 'load' }, 'Load selected table') : null;
  form.append(h('div', { className: 'actions' }, submit));
  let sending = false;
  let refreshId = 0;

  const refresh = async () => {
    refreshId += 1;
    const id = refreshId;
    const current = values(form);
    const found = [...check(current), ...await multiSectionWarnings(current, fetchText)];
    if (id !== refreshId) return;
    issues.replaceChildren(...found.map(({ level, message }) => h('li', { className: level }, message)));
    submit.disabled = sending || found.some((i) => i.level === 'error');
  };

  const loadSelection = async () => {
    const html = await readSelection(port);
    const found = html && readValues(new DOMParser().parseFromString(html, 'text/html').body);
    status.textContent = found ? 'Loaded the selected Personalize table.' : 'No Personalize table in the selection.';
    if (found) fill(form, found);
    refresh();
  };

  form.addEventListener('input', refresh);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await refresh();
    if (submit.disabled) return;
    sending = true;
    submit.disabled = true;
    const html = toTableHtml(values(form));
    const done = () => {
      sending = false;
      refresh();
    };
    if (port) {
      sendHtml(port, html);
      status.textContent = 'Sent to DA. Keep one Personalize table per section.';
      setTimeout(done, 1000);
      return;
    }
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }) })]);
      status.textContent = 'Copied. Paste it into the section you want to personalize.';
    } catch {
      status.textContent = 'Copy failed. Check browser clipboard permissions and try again.';
    } finally {
      setTimeout(done, 1000);
    }
  });

  const current = pageHtml && readValues(new DOMParser().parseFromString(pageHtml, 'text/html').body);
  fill(form, current ?? { Status: 'inactive' });
  refresh();
  view.replaceChildren(
    h('p', { className: 'note' }, current ? 'Started from this page\'s Personalize table.' : 'Create 1–3 audience rules, then insert the table into the target section.'),
    load,
    form,
    issues,
    status,
  );
  load?.addEventListener('click', loadSelection);
};
