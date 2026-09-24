import { cellValue } from '../scripts/utils/experiments/block.js';
import { CATALOG } from '../scripts/utils/experiments/audiences.js';
import { toClassName, VARIANT_ROOT } from '../scripts/utils/experiments/config.js';
import {
  MAX_DAYS, MAX_RULES, toEnd,
} from '../scripts/utils/experiments/personalize.js';
import { isSafeHref, normalizeChoice, toDateInput } from './table.js';

export { MAX_RULES };

const CAMPAIGN_PATTERN = /^campaign-[a-z0-9-]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

const normalizeStatus = (value) => normalizeChoice('Status', value).value || 'active';

const normalizedPath = (path) => {
  try {
    return new URL(path, window.location.origin).pathname;
  } catch {
    return `${path ?? ''}`.trim();
  }
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
    else if (key === 'status') values.Status = normalizeStatus(cellValue(value));
    else if (key === 'end-date') values['End Date'] = cellValue(value);
    else if (key === 'owner') values.Owner = cellValue(value);
    return values;
  }, { Name: '', Status: 'active', 'End Date': '', Owner: '', rules: [] });
};

export const normalizeValues = (values = {}) => ({
  Name: `${values.Name ?? ''}`.trim(),
  Status: normalizeStatus(values.Status),
  'End Date': toDateInput(values['End Date'] ?? ''),
  Owner: `${values.Owner ?? ''}`.trim(),
  rules: (values.rules ?? []).map(({ audience, path }) => ({
    audience: normalizeAudience(audience),
    path: `${path ?? ''}`.trim(),
  })).filter(({ audience, path }) => audience || path),
});

const ruleIssues = (rules, rawRules) => {
  const issues = [];
  const seen = new Set();
  for (const [i, { audience, path }] of rules.entries()) {
    const normalized = normalizedPath(path);
    const rawAudience = `${rawRules[i]?.audience ?? audience}`.trim();
    if (!isKnownAudience(audience)) issues.push({ level: 'error', message: `Unknown audience "${rawAudience}".` });
    else if (seen.has(audience)) issues.push({ level: 'error', message: `Duplicate audience "${audience}".` });
    else seen.add(audience);
    if (!normalized.startsWith(VARIANT_ROOT) || normalized === VARIANT_ROOT) {
      issues.push({ level: 'error', message: `Variant path must be under ${VARIANT_ROOT}: ${path || '(blank)'}` });
    }
  }
  return issues;
};

const dateIssues = (rawEndDate, endDate, now) => {
  if (!rawEndDate) return [{ level: 'error', message: 'End Date is required.' }];
  if (!DATE_PATTERN.test(rawEndDate)) return [{ level: 'error', message: 'End Date must use YYYY-MM-DD.' }];
  const end = toEnd(endDate);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!end) return [{ level: 'error', message: 'End Date is not a valid date.' }];
  if (end <= today) return [{ level: 'error', message: 'End Date is in the past.' }];
  const latest = new Date(today.getFullYear(), today.getMonth(), today.getDate() + MAX_DAYS + 1);
  if (end <= latest) return [];
  return [{ level: 'error', message: `End Date must be within ${MAX_DAYS} days.` }];
};

export const check = (values, { now = new Date() } = {}) => {
  const v = normalizeValues(values);
  const rawEndDate = `${values['End Date'] ?? ''}`.trim();
  const rawRules = values.rules ?? [];
  const issues = [];
  const add = (level, message) => issues.push({ level, message });
  if (v.rules.length < 1) add('error', 'Add at least one audience rule.');
  if (v.rules.length > MAX_RULES) add('warn', `Only the first ${MAX_RULES} audience rules are kept.`);
  return [...issues, ...ruleIssues(v.rules, rawRules), ...dateIssues(rawEndDate, v['End Date'], now)];
};

export const multiSectionWarnings = async (values, fetchText) => {
  const warnings = await Promise.all(normalizeValues(values).rules.map(async ({ path }) => {
    const normalized = normalizedPath(path);
    if (!normalized.startsWith(VARIANT_ROOT) || normalized === VARIANT_ROOT) return null;
    try {
      const html = await fetchText(normalized);
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return doc.querySelectorAll('main > div').length > 1
        ? { level: 'warn', message: `${normalized} has more than one section; the plugin swaps only the first matching section.` }
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
