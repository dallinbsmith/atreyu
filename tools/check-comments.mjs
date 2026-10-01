#!/usr/bin/env node
/* eslint-disable no-console -- CLI reports violations to stderr */
/* eslint-disable no-continue -- small lexer state machine advances by state */
/* eslint-disable complexity, sonarjs/cognitive-complexity -- CSS comment lexer state machine */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// eslint-disable-next-line import/no-extraneous-dependencies -- uses ESLint's parser
import { parse } from 'espree';

const ROOT = process.cwd();
const FAIL_TARGETS = ['scripts', 'workers/website', 'tools'];
const WARN_TARGETS = ['blocks', 'styles'];
const ROOT_FILES = ['eslint.config.js'];
const EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.css']);
export const BANNED = [
  { name: 'Bug-squash fix', pattern: /Bug-squash fix/i },
  { name: 'dated history', pattern: /\b20\d\d-\d\d-\d\d\b/ },
  { name: 'review/plan ID', pattern: /\b(P[0-9]\.[0-9]|P0-[0-9]+|F-[0-9]{2,}|fh-arch[0-9]|D-L?[0-9]+|R-L[0-9])\b/ },
];

const posix = (file) => file.split(path.sep).join('/');

const skip = (file) => {
  const p = posix(file);
  return p.includes('/node_modules/')
    || p.startsWith('plugins/')
    || p.startsWith('scripts/vendor/')
    || p.includes('/test/')
    || /\.test\.[cm]?js$/.test(p)
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

export const jsCommentRanges = (source) => parse(source, {
  comment: true,
  ecmaVersion: 'latest',
  loc: true,
  range: true,
  sourceType: 'module',
}).comments.map((comment) => ({
  text: comment.value,
  line: comment.loc.start.line,
}));

export const cssCommentRanges = (source) => {
  const ranges = [];
  let i = 0;
  let line = 1;
  let quote = null;
  let comment = false;
  let start = 0;
  let startLine = 1;

  const push = (end) => ranges.push({ text: source.slice(start, end), line: startLine });

  while (i < source.length) {
    const c = source[i];
    const n = source[i + 1];

    if (c === '\n') line += 1;

    if (comment) {
      if (c === '*' && n === '/') {
        i += 2;
        push(i);
        comment = false;
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
      if (c === quote) quote = null;
      i += 1;
      continue;
    }

    if (c === '\'' || c === '"') {
      quote = c;
      i += 1;
      continue;
    }

    if (c === '/' && n === '*') {
      comment = true;
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

export const commentRanges = (source, ext) => (ext === '.css'
  ? cssCommentRanges(source)
  : jsCommentRanges(source));

const targetKind = (file) => {
  const p = posix(file);
  if (ROOT_FILES.includes(p) || FAIL_TARGETS.some((dir) => p === dir || p.startsWith(`${dir}/`))) return 'fail';
  if (WARN_TARGETS.some((dir) => p === dir || p.startsWith(`${dir}/`))) return 'warn';
  return null;
};

export const checkCommentText = (range, file, kind) => {
  if (range.text.includes('check-comments: allow')) return [];
  return BANNED
    .filter(({ pattern }) => pattern.test(range.text))
    .map(({ name }) => ({ file: posix(file), line: range.line, kind, name }));
};

export const checkSource = (source, file, kind = 'fail') => commentRanges(source, path.extname(file))
  .flatMap((range) => checkCommentText(range, file, kind));

export const checkFiles = async (files) => {
  const nested = await Promise.all(files.map(async (file) => {
    const text = await readFile(path.join(ROOT, file), 'utf8');
    return checkSource(text, file, targetKind(file));
  }));
  return nested.flat().sort((a, b) => a.file.localeCompare(b.file)
    || a.line - b.line
    || a.name.localeCompare(b.name));
};

const scopedFiles = async () => [
  ...(await Promise.all([...FAIL_TARGETS, ...WARN_TARGETS].map(walk))).flat(),
  ...ROOT_FILES,
]
  .filter((file) => EXTENSIONS.has(path.extname(file)) && !skip(file));

export const run = async () => {
  const results = await checkFiles(await scopedFiles());
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
    return 1;
  }
  return 0;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await run();
}
