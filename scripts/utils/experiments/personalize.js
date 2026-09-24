// The authoring "Personalize" table (P1.3). Never rendered: it compiles,
// before the plugin runs, to the `Audience: <id>` section-metadata rows an
// author could write by hand.
// Rows: Name, Audience: <id> -> /v/... (1-3), Status (active | inactive;
// missing or empty = active, like block.js readExperimentBlock), End Date
// (required), Owner.
// - Precedence: the plugin serves the first match in the section's authored
//   row order (getAudienceConfig takes [0]; plugin-contract.test.js case 1),
//   so rules are written in CATALOG order (audiences.js). That is what gives
//   catalog precedence; the table's own row order doesn't matter.
// - A section's first table owns its audiences: raw `Audience*` rows in that
//   section's metadata are removed even if the rules are dropped, so Status
//   can't be bypassed. Later tables in the section are ignored.
// - Every table is removed; a section left with only metadata goes too
//   (guard.js removeConfigBlock) and compiles to nothing.
// - Inactive is kept only for non-prod ?audience= previews. Ended, missing
//   or invalid End Dates are dropped everywhere.
// - End Date is YYYY-MM-DD only, what the panel's date picker writes
//   (toDateInput). Anything else drops the rules: free-form Date parsing was
//   ambiguous (M/D vs D/M, UTC vs local, a serial 46022 = year 46022). It
//   runs through the end of that day, visitor-local, and may be at most
//   MAX_DAYS away, like the panel's limit.
// - Locale-prefixed /de/v/... paths are dropped (localization follow-up).
// - DOM APIs only; author text never reaches innerHTML.
import ENV from '../env.js';
import { statusOf, toClassName, VARIANT_ROOT } from './config.js';
import { cellValue } from './block.js';
import { withCampaigns } from './audiences.js';
import { findConfigBlocks, removeConfigBlock } from './guard.js';

export const MAX_RULES = 3;
export const MAX_DAYS = 180;
export const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const FIELDS = new Map([['name', 'name'], ['owner', 'owner'], ['status', 'status'], ['end-date', 'endDate']]);

const warn = (prod, table, message) => {
  // eslint-disable-next-line no-console -- author-facing diagnostics, non-prod only
  if (!prod) console.warn(`Personalize table: ${table.name || 'unnamed'}: ${message}`);
};

const isAudienceKey = (key) => key === 'audience' || key.startsWith('audience-');

// First link (several would reach the plugin as an array), else the first
// non-blank paragraph (trim() also strips &nbsp;), else the cell. Pathname
// only: the plugin fetches it on this origin whatever the host.
const toPath = (col) => {
  const raw = col.querySelector('a')?.getAttribute('href')
    ?? ([...col.querySelectorAll('p')].map((p) => p.textContent.trim()).find(Boolean)
    || col.textContent.trim());
  try {
    return new URL(raw, window.location.origin).pathname;
  } catch {
    return '';
  }
};

export const readPersonalizeTable = (block) => [...block.children].reduce((table, row) => {
  const [label, col] = row.children;
  if (!col) return table;
  const key = toClassName(label.textContent);
  if (key.startsWith('audience-')) table.rows.push({ id: key.slice('audience-'.length), path: toPath(col) });
  else if (FIELDS.has(key)) {
    const value = cellValue(col);
    if (value) table[FIELDS.get(key)] = value;
  }
  return table;
}, { name: '', owner: '', status: 'active', endDate: '', rows: [] });

// Exclusive end: local midnight after the End Date's day (DST-safe), or null.
// The round-trip rejects impossible dates (2026-02-30) that Date rolls over.
export const toEnd = (value) => {
  const [, y, m, d] = value.match(DATE_ONLY)?.map(Number) ?? [];
  const day = new Date(y, m - 1, d);
  if (day.getFullYear() !== y || day.getMonth() !== m - 1 || day.getDate() !== d) return null;
  return new Date(y, m - 1, d + 1);
};

const dropReason = ({ status, endDate }, { now, preview }) => {
  const end = toEnd(endDate);
  if (!end) return `End Date "${endDate}" must be YYYY-MM-DD`;
  const today = new Date(now);
  if (end > new Date(today.getFullYear(), today.getMonth(), today.getDate() + MAX_DAYS + 1)) {
    return `End Date is more than ${MAX_DAYS} days away`;
  }
  const state = statusOf({ status, endDate: end }, now);
  if (state === 'ended') return 'End Date has passed';
  if (state === 'inactive' && !preview) return `Status "${status}" is not active`;
  return null;
};

export const campaignIds = (ids) => ids.filter((id) => id.startsWith('campaign-'));

export const resolveTableRules = (table, order = Object.keys(withCampaigns(
  campaignIds(table.rows.map(({ id }) => id)),
))) => {
  const seen = new Set();
  const warnings = [];
  // Only valid rows count as seen: a broken row can't block its correction.
  const valid = table.rows.filter(({ id, path }) => {
    const reason = (!order.includes(id) && `unknown audience "${id}"`)
      || ((!path.startsWith(VARIANT_ROOT) || path === VARIANT_ROOT) && `"${path}" is not under ${VARIANT_ROOT}`)
      || (seen.has(id) && `duplicate audience "${id}"`);
    if (!reason) seen.add(id);
    if (reason) warnings.push(`dropped row, ${reason}.`);
    return !reason;
  }).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  if (valid.length > MAX_RULES) warnings.push(`only the first ${MAX_RULES} audiences (catalog order) are kept.`);
  return { rules: valid.slice(0, MAX_RULES), warnings };
};

const toRules = (table, order, prod) => {
  const { rules, warnings } = resolveTableRules(table, order);
  for (const message of warnings) warn(prod, table, message);
  return rules;
};

const metadataOf = (section) => {
  const existing = section.querySelector(':scope > .section-metadata');
  if (existing) return existing;
  const meta = document.createElement('div');
  meta.className = 'section-metadata';
  section.append(meta);
  return meta;
};

const audienceRow = ({ id, path }) => {
  const row = document.createElement('div');
  const key = document.createElement('div');
  const value = document.createElement('div');
  const link = document.createElement('a');
  key.textContent = `Audience: ${id}`;
  link.href = path;
  link.textContent = path;
  value.append(link);
  row.append(key, value);
  return row;
};

const writeRules = (section, rules) => {
  const existing = section.querySelector(':scope > .section-metadata');
  for (const row of [...(existing?.children ?? [])]) {
    if (isAudienceKey(toClassName(row.children[0]?.textContent))) row.remove();
  }
  if (rules.length) metadataOf(section).append(...rules.map(audienceRow));
};

// Returns the plan `{ section, name, owner, rules: [{ id, path }] }[]` of the
// tables that compiled to at least one rule (consumed by P5 events).
export const applyPersonalizeTables = (doc = document, {
  prod = ENV === 'prod',
  now = Date.now(),
  search = window.location.search,
} = {}) => {
  const preview = !prod && new URLSearchParams(search).has('audience');
  const owners = new Map();
  for (const block of findConfigBlocks(doc.querySelector('main'), ['personalize'])) {
    const section = block.closest('main > div');
    const table = readPersonalizeTable(block);
    if (section && owners.has(section)) warn(prod, table, 'a later table in this section is ignored.');
    else if (section) owners.set(section, table);
    removeConfigBlock(block);
  }
  const live = [...owners].filter(([section]) => section.isConnected);
  const tableIds = live.flatMap(([, table]) => table.rows.map(({ id }) => id));
  const order = Object.keys(withCampaigns(campaignIds(tableIds)));
  return live.flatMap(([section, table]) => {
    const reason = dropReason(table, { now, preview });
    if (reason) warn(prod, table, `rules dropped, ${reason}.`);
    const rules = reason ? [] : toRules(table, order, prod);
    writeRules(section, rules);
    return rules.length ? [{ section, name: table.name, owner: table.owner, rules }] : [];
  });
};

// A fresh audience map per call, with the plan's campaign audiences
// materialized at the catalog's campaign slot.
export const planAudiences = (plan = []) => withCampaigns(
  campaignIds(plan.flatMap(({ rules }) => rules.map(({ id }) => id))),
);
