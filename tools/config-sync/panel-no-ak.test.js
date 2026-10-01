/**
 * The experiments panel must never load scripts/ak.js (it has module-scope
 * side effects and holds the page config). That rule is why
 * experiments/config.js keeps its own toClassName. Walks every relative static
 * `import`/`export … from`, bare `import '…'` and literal `import('…')` from each
 * experiments-panel/*.js and fails with the import chain if ak.js is reached.
 * Node-only: node tools/config-sync/panel-no-ak.test.js
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PANEL = join(ROOT, 'experiments-panel');
const AK = join(ROOT, 'scripts/ak.js');
const SPEC = /(?:\b(?:import|export)\b[^'"`;]*?\bfrom\s*|\bimport\s*\(?\s*)['"](\.{1,2}\/[^'"]+)['"]/g;

const specifiers = (file) => [...readFileSync(file, 'utf8').matchAll(SPEC)]
  .map(([, spec]) => resolve(dirname(file), spec));

const parent = new Map();
const queue = readdirSync(PANEL).filter((f) => f.endsWith('.js')).map((f) => join(PANEL, f));
queue.forEach((f) => parent.set(f, null));
while (queue.length && !parent.has(AK)) {
  const file = queue.shift();
  specifiers(file).filter((dep) => !parent.has(dep)).forEach((dep) => {
    parent.set(dep, file);
    queue.push(dep);
  });
}

const chain = [];
for (let f = parent.has(AK) ? AK : null; f; f = parent.get(f)) chain.unshift(relative(ROOT, f));
assert.equal(chain.length, 0, `experiments panel reaches scripts/ak.js:\n  ${chain.join('\n  -> ')}`);
