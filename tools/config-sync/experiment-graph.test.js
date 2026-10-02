/**
 * Eager static graphs must not reach experimentation. Signal-bearing pages
 * dynamic-import it; plain pages keep those bytes out of scripts.js/lazy.js.
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ENTRIES = ['scripts/scripts.js', 'scripts/ak.js', 'scripts/lazy.js'];
const FORBIDDEN = [
  join(ROOT, 'scripts/experiment-loader.js'),
  join(ROOT, 'plugins/experimentation'),
];
const STATIC_IMPORT = /(?:\b(?:import|export)\b[^'"`;]*?\bfrom\s*|\bimport\s*)['"](\.{1,2}\/[^'"]+)['"]/g;

const candidates = (specifier, importer) => {
  const raw = resolve(dirname(importer), specifier);
  return [raw, `${raw}.js`, join(raw, 'index.js')];
};

const resolveStatic = (specifier, importer) => candidates(specifier, importer).find(existsSync);

const staticDeps = (file) => [...readFileSync(file, 'utf8').matchAll(STATIC_IMPORT)]
  .map(([, specifier]) => resolveStatic(specifier, file))
  .filter(Boolean);

const isForbidden = (file) => FORBIDDEN.some((forbidden) => (
  file === forbidden || file.startsWith(`${forbidden}/`)
));

for (const entry of ENTRIES.map((file) => join(ROOT, file))) {
  const parent = new Map([[entry, null]]);
  const queue = [entry];
  let found = null;
  while (queue.length && !found) {
    const file = queue.shift();
    for (const dep of staticDeps(file)) {
      if (!parent.has(dep)) {
        parent.set(dep, file);
        if (isForbidden(dep)) {
          found = dep;
          break;
        }
        queue.push(dep);
      }
    }
  }

  const chain = [];
  for (let file = found; file; file = parent.get(file)) chain.unshift(relative(ROOT, file));
  assert.equal(
    found,
    null,
    `${relative(ROOT, entry)} static graph reaches experimentation:\n  ${chain.join('\n  -> ')}`,
  );
}
