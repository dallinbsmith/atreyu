#!/usr/bin/env node
/* eslint-disable no-console -- CLI script; console output is the reporting mechanism */
// css.md: "Every block's CSS file must wrap its entire contents in
// `@layer blocks { }` — this is enforced, not optional." That line was true
// in prose since the beginning but had zero automated enforcement until this
// script — one of 29 files had never actually done it, found only by a manual
// audit (2026-09-02). This closes the gap: a block CSS file that omits the
// wrapper now fails CI, the same way tools/eslint-rules/config-drift.js
// closes the equivalent gap for duplicated locale/env config.
//
// Deliberately a standalone Node script, not a Stylelint plugin — Stylelint's
// plugin API is built around inspecting individual rules/declarations, not
// asserting "this whole file's top-level content is wrapped in one specific
// at-rule," which is a much better fit for a plain text/brace-balance check.
//
// Manual directory walk rather than fs/promises' glob() — that's Node 22+
// only, and CI (.github/workflows/ci.yml) runs Node 20.

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const BLOCKS_DIR = 'blocks';
const OPEN = '@layer blocks {';

const findBlockCssFiles = async () => {
  const entries = await readdir(BLOCKS_DIR, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  const perDir = await Promise.all(dirs.map(async (dir) => {
    const dirPath = join(BLOCKS_DIR, dir);
    const files = await readdir(dirPath);
    return files.filter((f) => f.endsWith('.css')).map((f) => join(dirPath, f));
  }));
  return perDir.flat();
};

// Strips a single leading `/* ... */` comment (if present) before checking
// for the wrapper, so a future file-header comment above `@layer blocks {`
// doesn't false-positive.
const stripLeadingComment = (text) => {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith('/*')) return trimmed;
  const end = trimmed.indexOf('*/');
  return end === -1 ? trimmed : trimmed.slice(end + 2).trimStart();
};

// Walks braces from the opening `{` (already consumed) to find the index of
// its matching close, so we can confirm nothing but whitespace follows it —
// i.e. the @layer block wraps the ENTIRE file, not just some of it.
const findMatchingClose = (text, fromIndex) => {
  let depth = 1;
  for (let i = fromIndex; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
};

const checkFile = async (path) => {
  const raw = await readFile(path, 'utf8');
  const content = stripLeadingComment(raw);

  if (!content.startsWith(OPEN)) {
    return `does not open with '${OPEN}' (after any leading file comment)`;
  }

  const closeIndex = findMatchingClose(content, OPEN.length);
  if (closeIndex === -1) {
    return 'unbalanced braces — could not find a matching close for the @layer block';
  }

  const trailing = content.slice(closeIndex + 1).trim();
  if (trailing.length > 0) {
    return 'has real content after the @layer blocks closing brace — the wrapper must cover the whole file';
  }

  return null;
};

const files = await findBlockCssFiles();
const results = await Promise.all(files.map(async (path) => [path, await checkFile(path)]));
const failures = results.filter(([, problem]) => problem !== null);

if (failures.length > 0) {
  console.error(`${failures.length} block CSS file(s) not wrapped in '@layer blocks { }':\n`);
  failures.forEach(([path, problem]) => console.error(`  ${path} — ${problem}`));
  console.error('\nSee .claude/rules/css.md — every block CSS file must wrap its entire contents in @layer blocks { }.');
  process.exit(1);
} else {
  console.log(`All ${files.length} block CSS files are correctly wrapped in @layer blocks { }.`);
}
