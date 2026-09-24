import { cellValue } from '../scripts/utils/experiments/block.js';
import { CATALOG } from '../scripts/utils/experiments/audiences.js';
import { toClassName, VARIANT_ROOT } from '../scripts/utils/experiments/config.js';
import { isSafeHref, toDateInput } from './table.js';

export const MAX_RULES = 3;
const CAMPAIGN_PATTERN = /^campaign-[a-z0-9-]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const FIELDS = [
  { label: 'Name', type: 'text' },
  { label: 'Audience', type: 'rule' },
  { label: 'Status', type: 'select' },
  { label: 'End Date', type: 'date' },
  { label: 'Owner', type: 'text' },
];

export const audienceChoices = () => CATALOG
  .filter(({ id }) => id !== 'campaign-*')
  .map(({ id, label }) => [id, label]);

const campaignId = (value) => {
  const normalized = toClassName(value);
  return normalized.startsWith('campaign-') ? normalized : '';
};

export const normalizeAudience = (value) => {
  const id = toClassName(value);
  return audienceChoices().some(([known]) => known === id) ? id : campaignId(id);
};

const isKnownAudience = (id) => (
  audienceChoices().some(([known]) => known === id) || CAMPAIGN_PATTERN.test(id)
);

const toEnd = (value) => {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const valid = date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day;
  return valid ? new Date(year, month - 1, day + 1) : null;
};

const toPath = (cell) => {
  const raw = cell.querySelector('a')?.getAttribute('href') ?? cellValue(cell);
  try {
    return new URL(raw, window.location.origin).pathname;
  } catch {
    return raw.trim();
  }
};

const readRows = (root) => {
  const block = [...root.querySelectorAll('.personalize')].find((el) => el.classList[0] === 'personalize');
  if (block) return [...block.children].filter((row) => row.children[1]);
  const table = [...root.querySelectorAll('table')]
    .find((el) => /^personalize$/i.test(el.querySelector('tr')?.textContent.trim() ?? ''));
  return table ? [...table.querySelectorAll('tr')].slice(1).filter((row) => row.children[1]) : null;
};

export const readValues = (root) => {
  const rows = readRows(root);
  if (!rows) return null;
  return rows.reduce((values, row) => {
    const [label, value] = row.children;
    const key = toClassName(label.textContent);
    if (key.startsWith('audience-')) values.rules.push({ audience: key.slice('audience-'.length), path: toPath(value) });
    else if (key === 'name') values.Name = cellValue(value);
    else if (key === 'status') values.Status = cellValue(value);
    else if (key === 'end-date') values['End Date'] = toDateInput(cellValue(value));
    else if (key === 'owner') values.Owner = cellValue(value);
    return values;
  }, { Name: '', Status: 'active', 'End Date': '', Owner: '', rules: [] });
};

export const normalizeValues = (values = {}) => ({
  Name: `${values.Name ?? ''}`.trim(),
  Status: `${values.Status ?? 'active'}`.trim() || 'active',
  'End Date': toDateInput(values['End Date'] ?? ''),
  Owner: `${values.Owner ?? ''}`.trim(),
  rules: (values.rules ?? []).map(({ audience, path }) => ({
    audience: normalizeAudience(audience),
    path: `${path ?? ''}`.trim(),
  })).filter(({ audience, path }) => audience || path),
});

export const check = (values, { now = new Date() } = {}) => {
  const v = normalizeValues(values);
  const rawEndDate = `${values['End Date'] ?? ''}`.trim();
  const issues = [];
  const add = (level, message) => issues.push({ level, message });
  if (v.rules.length < 1) add('error', 'Add at least one audience rule.');
  if (v.rules.length > MAX_RULES) add('error', `Use no more than ${MAX_RULES} audience rules.`);
  for (const { audience, path } of v.rules) {
    if (!isKnownAudience(audience)) add('error', `Unknown audience "${audience || '(blank)'}".`);
    if (!path.startsWith(VARIANT_ROOT) || path === VARIANT_ROOT) add('error', `Variant path must be under ${VARIANT_ROOT}: ${path || '(blank)'}`);
  }
  if (!rawEndDate) add('error', 'End Date is required.');
  else if (!DATE_PATTERN.test(rawEndDate)) add('error', 'End Date must use YYYY-MM-DD.');
  else {
    const end = toEnd(v['End Date']);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (!end) add('error', 'End Date is not a valid date.');
    else if (end <= today) add('error', 'End Date is in the past.');
    else if (end > new Date(today.getTime() + ((180 + 1) * MS_PER_DAY))) add('error', 'End Date must be within 180 days.');
  }
  return issues;
};

export const multiSectionWarnings = async (values, fetchText) => {
  const warnings = await Promise.all(normalizeValues(values).rules.map(async ({ path }) => {
    try {
      const html = await fetchText(path);
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return doc.querySelectorAll('main > div').length > 1
        ? { level: 'warn', message: `${path} has more than one section; the plugin swaps only the first matching section.` }
        : null;
    } catch {
      return null;
    }
  }));
  return warnings.filter(Boolean);
};

const cell = (doc, value, { link = false } = {}) => {
  const td = doc.createElement('td');
  const p = doc.createElement('p');
  if (link && isSafeHref(value)) {
    const a = doc.createElement('a');
    a.href = value;
    a.textContent = value;
    p.append(a);
  } else p.textContent = value;
  td.append(p);
  return td;
};

export const toTableHtml = (values, doc = document) => {
  const v = normalizeValues(values);
  const table = doc.createElement('table');
  const head = doc.createElement('tr');
  const title = cell(doc, 'Personalize');
  title.colSpan = 2;
  head.append(title);
  table.append(head);
  const rows = [
    ['Name', v.Name],
    ...v.rules.slice(0, MAX_RULES).map(({ audience, path }) => [`Audience: ${audience}`, path, true]),
    ['Status', v.Status],
    ['End Date', v['End Date']],
    ['Owner', v.Owner],
  ];
  for (const [label, value, link] of rows) {
    const tr = doc.createElement('tr');
    tr.append(cell(doc, label), cell(doc, value, { link }));
    table.append(tr);
  }
  return table.outerHTML;
};
