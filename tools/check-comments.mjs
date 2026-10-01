#!/usr/bin/env node
/* eslint-disable no-console -- CLI reports violations to stderr */
/* eslint-disable no-continue -- small lexer state machine advances by state */
/* eslint-disable complexity, sonarjs/cognitive-complexity -- comment lexer state machine */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const FAIL_TARGETS = ['scripts', 'workers/website', 'tools'];
const WARN_TARGETS = ['blocks', 'styles'];
const ROOT_FILES = ['eslint.config.js'];
const EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.css']);
const BANNED = [
  { name: 'Bug-squash fix', pattern: /Bug-squash fix/i },
  { name: 'dated history', pattern: /\b20\d\d-\d\d-\d\d\b/ },
];

const posix = (file) => file.split(path.sep).join('/');

const skip = (file) => {
  const p = posix(file);
  return p.includes('/node_modules/')
    || p.startsWith('plugins/')
    || p.startsWith('scripts/vendor/')
    || p.includes('/test/')
    || p.endsWith('.test.js')
    || p.startsWith('test/')
    || p.startsWith('tools/locale-extractor/fixtures/');
};

const walk = async (dir) => {
  const entries = await readdir(path.join(ROOT, dir), { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const rel = path.join(dir, entry.name);
    if (skip(rel)) return [];
    return entry.isDirectory() ? walk(rel) : [rel];
  }));
  return files.flat();
};

const commentRanges = (source, ext) => {
  const ranges = [];
  let i = 0;
  let line = 1;
  let quote = null;
  let templateDepth = 0;
  let comment = null;
  let start = 0;
  let startLine = 1;

  const push = (end) => ranges.push({ text: source.slice(start, end), line: startLine });

  while (i < source.length) {
    const c = source[i];
    const n = source[i + 1];

    if (c === '\n') line += 1;

    if (comment === 'line') {
      if (c === '\n') {
        push(i);
        comment = null;
      }
      i += 1;
      continue;
    }

    if (comment === 'block') {
      if (c === '*' && n === '/') {
        i += 2;
        push(i);
        comment = null;
        continue;
      }
      i += 1;
      continue;
    }

    if (quote) {
      if (c === '\\') {
        i += 2;
        continue;
      }
      if (quote === '`' && c === '$' && n === '{') templateDepth += 1;
      else if (quote === '`' && c === '}' && templateDepth > 0) templateDepth -= 1;
      else if (c === quote && templateDepth === 0) quote = null;
      i += 1;
      continue;
    }

    if (c === '\'' || c === '"' || c === '`') {
      quote = c;
      i += 1;
      continue;
    }

    if (c === '/' && n === '*') {
      comment = 'block';
      start = i;
      startLine = line;
      i += 2;
      continue;
    }

    if (ext !== '.css' && c === '/' && n === '/') {
      comment = 'line';
      start = i;
      startLine = line;
      i += 2;
      continue;
    }

    i += 1;
  }

  if (comment) push(source.length);
  return ranges;
};

const targetKind = (file) => {
  const p = posix(file);
  if (ROOT_FILES.includes(p) || FAIL_TARGETS.some((dir) => p === dir || p.startsWith(`${dir}/`))) return 'fail';
  if (WARN_TARGETS.some((dir) => p === dir || p.startsWith(`${dir}/`))) return 'warn';
  return null;
};

const files = [
  ...(await Promise.all([...FAIL_TARGETS, ...WARN_TARGETS].map(walk))).flat(),
  ...ROOT_FILES,
]
  .filter((file) => EXTENSIONS.has(path.extname(file)) && !skip(file));

const results = [];

await Promise.all(files.map(async (file) => {
  const text = await readFile(path.join(ROOT, file), 'utf8');
  const kind = targetKind(file);
  for (const range of commentRanges(text, path.extname(file))) {
    if (range.text.includes('check-comments: allow')) continue;
    for (const { name, pattern } of BANNED) {
      if (pattern.test(range.text)) {
        results.push({
          file: posix(file),
          line: range.line,
          kind,
          name,
        });
      }
    }
  }
}));

results.sort((a, b) => a.file.localeCompare(b.file)
  || a.line - b.line
  || a.name.localeCompare(b.name));

const failures = results.filter((r) => r.kind === 'fail');
const warnings = results.filter((r) => r.kind === 'warn');

for (const result of results) {
  const label = result.kind === 'fail' ? 'ERROR' : 'WARN ';
  console.error(`${label} ${result.file}:${result.line} ${result.name}`);
}

if (warnings.length) {
  console.error(`check-comments: ${warnings.length} block/style warning(s); `
    + 'these are non-fatal until the block/style cleanup branch lands.');
}

if (failures.length) {
  console.error('check-comments: code comments should explain current constraints, not dated history. Use git/PRs/decisions for history.');
  process.exit(1);
}
