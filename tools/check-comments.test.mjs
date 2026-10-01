import assert from 'node:assert/strict';
import { checkSource } from './check-comments.mjs';

/* eslint-disable no-console -- Node smoke test reports success */

const names = (source, file) => checkSource(source, file).map(({ name }) => name);

assert.deepEqual(
  names('const re = /"/g;\n// 2026-01-01 narrative\n', 'scripts/example.js'),
  ['dated history'],
);

assert.deepEqual(
  names("/^https?:\\/\\//; const d = '2026-01-01';\n", 'scripts/example.js'),
  [],
);

assert.deepEqual(
  names(".x { background: url(https://x//y); content: '/* */'; }\n", 'styles/example.css'),
  [],
);

assert.deepEqual(
  names('// P0-44 cleanup note\n// F-76 routing\n// fh-arch6 review\n', 'scripts/example.js'),
  ['review/plan ID', 'review/plan ID', 'review/plan ID'],
);

assert.deepEqual(
  names('// 2026-01-01 check-comments: allow\n', 'scripts/example.js'),
  [],
);

console.log('check-comments tests passed.');
