import { createElement as h } from '../scripts/utils/dom.js';
import { readSelection, sendHtml } from './da-port.js';
import { fetchText } from './sources.js';
import {
  FIELDS,
  MAX_DAYS,
  MAX_RULES,
  audienceChoices,
  check,
  compileTableRules,
  multiSectionWarnings,
  normalizeValues,
  normalizedPath,
  readValues,
  toTableHtml,
  unsupportedStatus,
  VARIANT_ROOT,
} from './personalize-table.js';

const HINTS = {
  Name: 'Label for authors and analytics. Keep it stable for this personalization.',
  Audience: 'Choose a catalog audience or type campaign-<name>.',
  'End Date': `Required. Runs through the end of this local day, max ${MAX_DAYS} days out.`,
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
  const kept = compileTableRules(source).rules
    .map(({ id, path }) => ({ audience: id, path }));
  const v = normalizeValues({ ...source, rules: kept });
  form.elements.Name.value = v.Name ?? '';
  form.elements.Status.value = v.Status ?? 'inactive';
  form.elements['End Date'].value = /^\d{4}-\d{2}-\d{2}$/.test(`${source['End Date'] ?? ''}`.trim())
    ? v['End Date'] : '';
  form.elements.Owner.value = v.Owner ?? '';
  for (let i = 0; i < MAX_RULES; i += 1) {
    form.elements[`audience-${i}`].value = v.rules[i]?.audience ?? '';
    form.elements[`path-${i}`].value = v.rules[i]?.path ?? '';
  }
};

const warning = (message, fields = []) => ({ level: 'warn', message, fields });

const loadWarningsFor = (source = {}) => {
  const warnings = [];
  const status = unsupportedStatus(source.StatusRaw ?? source.Status);
  if (status) warnings.push(warning(`Loaded table is inactive: Unsupported Status '${status}', treated as inactive.`, ['Status']));
  const date = check(source).find(({ message }) => message.startsWith('End Date'));
  if (date) warnings.push(warning(`Loaded table is inactive: ${date.message}`, ['End Date']));
  const compiled = compileTableRules(source);
  warnings.push(...compiled.warnings.map((message) => warning(
    message
      .replace(/^dropped row/, 'row dropped')
      .replace(/^only the first .*/, `Only the first ${MAX_RULES} audience rules are kept.`),
    Array.from({ length: MAX_RULES }, (_, i) => [`audience-${i}`, `path-${i}`]).flat(),
  )));
  return warnings;
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
  let inputVersion = 0;
  let pendingSelection;
  let loadErrors = [];
  let pathWarnings = [];
  const pathCache = new Map();
  let doneTimer;
  const clearDone = () => {
    if (doneTimer) clearTimeout(doneTimer);
    doneTimer = null;
  };

  const visible = (found) => found.map(({ level, message }) => ({ level, message }));
  const renderIssues = (found) => {
    issues.replaceChildren(...visible(found).map(({ level, message }) => h('li', { className: level }, message)));
    submit.disabled = sending || found.some((i) => i.level === 'error');
  };
  const refresh = () => renderIssues([...loadErrors, ...check(values(form)), ...pathWarnings]);
  const checkPaths = async () => {
    // Deliberately stricter than config.js isVariantPath: English-only, never the bare root.
    const isPersonalizeVariantPath = (path) => path.startsWith(VARIANT_ROOT)
      && path !== VARIANT_ROOT;
    const current = values(form);
    const paths = normalizeValues(current).rules
      .map(({ path }) => normalizedPath(path))
      .filter(isPersonalizeVariantPath);
    const key = paths.join('\n');
    const warnings = await Promise.all(paths.map((path) => {
      if (!pathCache.has(path)) {
        const pending = multiSectionWarnings({ rules: [{ path }] }, fetchText)
          .then((found) => {
            if (found.length) pathCache.set(path, Promise.resolve(found));
            else pathCache.delete(path);
            return found;
          }, (ex) => {
            pathCache.delete(path);
            throw ex;
          });
        pathCache.set(path, pending);
      }
      return pathCache.get(path);
    }));
    const latest = normalizeValues(values(form)).rules
      .map(({ path }) => normalizedPath(path))
      .filter(isPersonalizeVariantPath)
      .join('\n');
    if (key === latest) {
      pathWarnings = warnings.flat();
      refresh();
    }
  };

  const loadSelection = async () => {
    const version = inputVersion;
    loadErrors = [];
    pathWarnings = [];
    load.disabled = true;
    let html = null;
    try {
      pendingSelection ??= Promise.resolve().then(() => readSelection(port))
        .finally(() => { pendingSelection = null; });
      html = await pendingSelection;
    } catch {
      status.textContent = 'Could not read selection. Try selecting it again.';
    }
    const found = html && readValues(new DOMParser().parseFromString(html, 'text/html').body);
    if (found && version === inputVersion) {
      loadErrors = loadWarningsFor(found);
      fill(form, found);
      status.textContent = 'Loaded the selected Personalize table.';
      checkPaths();
    } else if (found) status.textContent = 'Loaded the selected table, but kept your edits because the form changed while loading.';
    else status.textContent = 'No Personalize table in the selection.';
    load.disabled = false;
    refresh();
  };

  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement) e.preventDefault();
  });
  form.addEventListener('input', ({ target }) => {
    inputVersion += 1;
    loadErrors = loadErrors.filter(({ fields = [] }) => !fields.includes(target.name));
    if (target.name?.startsWith('path-')) pathWarnings = [];
    refresh();
  });
  form.addEventListener('change', ({ target }) => {
    if (target.name?.startsWith('path-')) checkPaths();
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const snapshot = values(form);
    const found = [...loadErrors, ...check(snapshot)];
    renderIssues([...found, ...pathWarnings]);
    if (found.some((i) => i.level === 'error')) return;
    sending = true;
    submit.disabled = true;
    const html = toTableHtml(snapshot);
    const done = () => {
      if (!form.isConnected) return;
      sending = false;
      refresh();
    };
    if (port) {
      sendHtml(port, html);
      status.textContent = 'Sent to DA. Keep one Personalize table per section.';
      clearDone();
      doneTimer = setTimeout(done, 1000);
      return;
    }
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }) })]);
      status.textContent = 'Copied. Paste it into the section you want to personalize.';
    } catch {
      status.textContent = 'Copy failed. Check browser clipboard permissions and try again.';
    } finally {
      clearDone();
      doneTimer = setTimeout(done, 1000);
    }
  });

  const current = pageHtml && readValues(new DOMParser().parseFromString(pageHtml, 'text/html').body);
  loadErrors = current ? loadWarningsFor(current) : [];
  fill(form, current ?? { Status: 'inactive' });
  refresh();
  checkPaths();
  view.replaceChildren(
    h('p', { className: 'note' }, current ? 'Started from this page\'s Personalize table.' : 'Create 1–3 audience rules, then insert the table into the target section.'),
    load,
    form,
    issues,
    status,
  );
  load?.addEventListener('click', loadSelection);
};
