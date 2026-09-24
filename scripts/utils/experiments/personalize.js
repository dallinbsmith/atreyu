// The authoring "Personalize" table (P1.3). Like the Experiment table
// (block.js), it is never rendered: it runs before the plugin and compiles to
// the same `Audience: <id>` section-metadata rows an author could write by
// hand, so the plugin sees nothing new.
//
// Table rows: Name, Audience: <id> -> /v/... (1 to 3), Status (active |
// inactive, default active like the Experiment table), End Date (required),
// Owner.
//
// Decisions:
// - Precedence: the plugin serves the first matching audience in the
//   section's authored row order (getResolvedAudiences keeps page order,
//   getAudienceConfig takes [0]; pinned by plugin-contract.test.js case 1).
//   Rows are therefore written in CATALOG order (audiences.js), which is what
//   gives catalog precedence. The order an author typed rows in the table
//   does not matter. Hand-written metadata keeps authored-order precedence.
// - A section's first table owns its audience config: raw `Audience*` rows
//   already in that section's metadata are removed even if the table's own
//   rules are then dropped (inactive, ended), so Status can't be bypassed by
//   leftover rows. Later tables in the same section are removed and ignored.
// - Every table is removed from the DOM, and a section left with only
//   metadata is removed too (guard.js removeConfigBlock). Such a section had
//   no content to personalize, so it compiles to nothing.
// - Inactive tables are kept only for previews: non-prod with ?audience=.
//   Ended tables and a missing or invalid End Date are dropped everywhere.
// - Built with DOM APIs only; author text never reaches innerHTML.
import ENV from '../env.js';
import { statusOf, toClassName, VARIANT_ROOT } from './config.js';
import { cellValue } from './block.js';
import { withCampaigns } from './audiences.js';
import { findConfigBlocks, removeConfigBlock } from './guard.js';

const MAX_RULES = 3;
const FIELDS = new Map([['name', 'name'], ['owner', 'owner'], ['status', 'status'], ['end-date', 'endDate']]);

const warn = (prod, message) => {
  // eslint-disable-next-line no-console -- author-facing diagnostics, non-prod only
  if (!prod) console.warn(`Personalize table: ${message}`);
};

const isAudienceKey = (key) => key === 'audience' || key.startsWith('audience-');

// First link wins (the plugin would get an array for several links and
// break); otherwise the cell text. Only the pathname is kept: the plugin
// fetches `new URL(url, origin).pathname` on this origin whatever the host.
const toPath = (col) => {
  const raw = col.querySelector('a')?.getAttribute('href') ?? col.textContent.trim();
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
  else if (FIELDS.has(key)) table[FIELDS.get(key)] = cellValue(col);
  return table;
}, { name: '', owner: '', status: 'active', endDate: '', rows: [] });

const dropReason = ({ status, endDate }, { now, preview }) => {
  const end = new Date(endDate);
  if (!endDate || Number.isNaN(end.getTime())) return 'End Date is missing or invalid';
  const state = statusOf({ status, endDate: end }, now);
  if (state === 'ended') return 'End Date has passed';
  if (state === 'inactive' && !preview) return `Status "${status}" is not active`;
  return null;
};

const campaignIds = (ids) => ids.filter((id) => id.startsWith('campaign-'));

const toRules = (table, order, prod) => {
  const seen = new Set();
  const valid = table.rows.filter(({ id, path }) => {
    const reason = (!order.includes(id) && `unknown audience "${id}"`)
      || ((!path.startsWith(VARIANT_ROOT) || path === VARIANT_ROOT) && `"${path}" is not under ${VARIANT_ROOT}`)
      || (seen.has(id) && `duplicate audience "${id}"`);
    seen.add(id);
    if (reason) warn(prod, `${table.name || 'unnamed'}: dropped row, ${reason}.`);
    return !reason;
  }).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  if (valid.length > MAX_RULES) warn(prod, `${table.name || 'unnamed'}: only the first ${MAX_RULES} audiences (catalog order) are kept.`);
  return valid.slice(0, MAX_RULES);
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
    if (section && owners.has(section)) warn(prod, `${table.name || 'unnamed'}: a section's first table wins; this one is ignored.`);
    else if (section) owners.set(section, table);
    removeConfigBlock(block);
  }
  const live = [...owners].filter(([section]) => section.isConnected);
  const tableIds = live.flatMap(([, table]) => table.rows.map(({ id }) => id));
  const order = Object.keys(withCampaigns(campaignIds(tableIds)));
  return live.flatMap(([section, table]) => {
    const reason = dropReason(table, { now, preview });
    if (reason) warn(prod, `${table.name || 'unnamed'}: rules dropped, ${reason}.`);
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
