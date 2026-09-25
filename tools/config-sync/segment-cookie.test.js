/**
 * Cross-file constant-sync check for the personalization segment cookie.
 *
 * The cookie NAME and MAX-AGE must be byte-identical between the client bundle
 * (scripts/utils/analytics/pzn.js, which WRITES/READS the cookie in the browser)
 * and the decision-endpoint Cloudflare Worker (workers/decision-endpoint/
 * handlers/cookie.js, which SETS it). They cannot share a module — pzn.js ships
 * as static client JS; the decision endpoint is a separately-deployed Worker
 * package (crossing that boundary is what `import/no-relative-packages` forbids;
 * the one sanctioned exception is locales.test.js, per B6)
 * — so the two literals are hand-synced. They have ALREADY drifted for real
 * (2026-08-28: 'pzn-spike-segment'/30-min vs 'frameio-pzn-segment'/session);
 * both files' own comments say "keep in sync by hand."
 *
 * Why this is a test, not an ESLint rule: the drift that actually happened was
 * the two *designated* files disagreeing with each other. `config-drift`'s
 * `no-duplicate-locale-list` shape (allow N designated files, flag a copy in any
 * OTHER file) can't catch that — both files are designated. Reliable cross-file
 * value EQUALITY is outside ESLint's per-file model, so this reads both files
 * directly and asserts they match. See .claude/rules/scripts.md Global State &
 * Data Flow.
 *
 * Node-only (fs). Run from the `site/` package root:
 *   node tools/config-sync/segment-cookie.test.js
 * A thrown assertion means the constants drifted; no output means they match.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const read = (rel) => readFileSync(path.join(siteRoot, rel), 'utf8');

// Capture a `<constName> = '<value>'` string assignment (const/export const).
const stringConst = (src, constName, where) => {
  const m = src.match(new RegExp(`${constName}\\s*=\\s*'([^']+)'`));
  assert.ok(m, `Could not find string constant ${constName} in ${where} — was it renamed? Update this sync test if so.`);
  return m[1];
};

// Capture a `<constName> = <arithmetic>;` numeric assignment and evaluate it.
// Evaluating (not text-comparing) so `86400` and `24 * 60 * 60` count as equal.
const numericConst = (src, constName, where) => {
  const m = src.match(new RegExp(`${constName}\\s*=\\s*([^;]+);`));
  assert.ok(m, `Could not find numeric constant ${constName} in ${where} — was it renamed? Update this sync test if so.`);
  const expr = m[1].trim();
  assert.match(
    expr,
    /^[\d\s*+()]+$/,
    `${constName} in ${where} is not a plain arithmetic expression (${expr}); this sync test only evaluates digits/*/+/parens.`,
  );
  // expr is asserted above to match /^[\d\s*+()]+$/ — digits/operators only,
  // never file or user input, so evaluating it is safe.
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${expr});`)();
};

const CLIENT = 'scripts/utils/analytics/pzn.js';
const WORKER = 'workers/decision-endpoint/handlers/cookie.js';

const client = read(CLIENT);
const worker = read(WORKER);

const clientName = stringConst(client, 'COOKIE_NAME', CLIENT);
const workerName = stringConst(worker, 'SEGMENT_COOKIE_NAME', WORKER);
assert.equal(
  clientName,
  workerName,
  `Segment cookie NAME drifted: ${CLIENT} has '${clientName}', ${WORKER} has '${workerName}'. `
  + 'These must be identical — the client reads the exact name the Worker set. Align them by value.',
);

const clientAge = numericConst(client, 'COOKIE_MAX_AGE_S', CLIENT);
const workerAge = numericConst(worker, 'SEGMENT_COOKIE_MAX_AGE_S', WORKER);
assert.equal(
  clientAge,
  workerAge,
  `Segment cookie MAX-AGE drifted: ${CLIENT} has ${clientAge}s, ${WORKER} has ${workerAge}s. `
  + 'These must be identical. Align them by value.',
);
