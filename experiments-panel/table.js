// Pure helpers for the panel's "Build test" form: the Experiment table's rows,
// reading them from a doc table, and writing the table DA inserts.
import { metaName } from '../scripts/utils/experiments/block.js';
import { readExperiment, validate } from '../scripts/utils/experiments/config.js';

export const FIELDS = [
  { label: 'Test Name', type: 'text' },
  { label: 'Variants', type: 'links' },
  { label: 'Variant Names', type: 'text' },
  { label: 'Split', type: 'text' },
  { label: 'Audience', type: 'select' },
  { label: 'Start Date', type: 'date' },
  { label: 'End Date', type: 'date' },
  { label: 'Status', type: 'select' },
].map((f) => ({ ...f, meta: metaName(f.label) }));

const byMeta = new Map(FIELDS.map((f) => [f.meta, f]));

// Only same-site paths and https URLs become links; anything else stays text.
export const isSafeHref = (value) => /^\/(?![/\\])/.test(value) || /^https:\/\//i.test(value);

// Date inputs need yyyy-mm-dd; other parseable dates are normalized, the rest dropped.
export const toDateInput = (value) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : '';
};

const cellText = (cell, field) => {
  const links = [...cell.querySelectorAll('a')].map((a) => a.getAttribute('href')).filter(Boolean);
  if (links.length) return links.join(field.type === 'links' ? '\n' : ', ');
  const paragraphs = [...cell.querySelectorAll('p')].map((p) => p.textContent.trim()).filter(Boolean);
  const text = paragraphs.length ? paragraphs.join(field.type === 'links' ? '\n' : ', ') : cell.textContent.trim();
  return field.type === 'date' ? toDateInput(text) : text;
};

const headRow = (table) => table.querySelector('tr');
const isExperimentTable = (table) => /^experiment$/i.test(headRow(table)?.textContent.trim() ?? '');

// Works for the rendered block (div rows, no name row) and for DA's editor HTML
// (a table whose first row names the block). Returns { [label]: value } for
// known rows, or null when there is no Experiment table.
export const readValues = (root) => {
  const block = root.querySelector('.experiment');
  const table = block ? null : [...root.querySelectorAll('table')].find(isExperimentTable);
  if (!block && !table) return null;
  const rows = block ? [...block.children] : [...table.querySelectorAll('tr')].slice(1);
  return Object.fromEntries(rows.flatMap((row) => {
    const [key, cell] = row.children;
    const field = cell && byMeta.get(metaName(key.textContent));
    return field ? [[field.label, cellText(cell, field)]] : [];
  }));
};

export const toMeta = (values) => Object.fromEntries(FIELDS
  .map((f) => [f.meta, `${values[f.label] ?? ''}`.trim()])
  .filter(([, value]) => value)
  .map(([name, value]) => [name, value.split('\n').map((s) => s.trim()).filter(Boolean).join(', ')]));

export const check = (values, { pagePath, audiences }) => {
  const cfg = readExperiment(toMeta(values), pagePath);
  if (!cfg) return [{ level: 'error', message: 'Test Name is required.' }];
  return validate(cfg, { audiences });
};

const cell = (doc, field, value) => {
  const td = doc.createElement('td');
  const lines = `${value ?? ''}`.split('\n').map((s) => s.trim()).filter(Boolean);
  for (const line of lines.length ? lines : ['']) {
    const p = doc.createElement('p');
    if (field?.type === 'links' && isSafeHref(line)) {
      const a = doc.createElement('a');
      a.href = line;
      a.textContent = line;
      p.append(a);
    } else p.textContent = line;
    td.append(p);
  }
  return td;
};

// Every row is written, blank ones too, so authors see all controls in the doc.
export const toTableHtml = (values, doc = document) => {
  const table = doc.createElement('table');
  const head = doc.createElement('tr');
  const name = cell(doc, null, 'Experiment');
  name.colSpan = 2;
  head.append(name);
  table.append(head);
  for (const field of FIELDS) {
    const tr = doc.createElement('tr');
    tr.append(cell(doc, null, field.label), cell(doc, field, values[field.label]));
    table.append(tr);
  }
  return table.outerHTML;
};
