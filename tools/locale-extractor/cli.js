#!/usr/bin/env node
// Locale extractor CLI (docs/decisions/0017-translation-workflow.md).
// Pulls real Falkor/Sanity locale content and emits local DA-shaped HTML
// files for review, same pattern this project already used for the Library
// bootstrap (local export → human review → da_create_source upload) rather
// than writing straight to DA, a migrated page should be looked at before
// it's live, not just mechanically round-tripped.
//
// Usage:
//   node tools/locale-extractor/cli.js --locale ja-jp --slug enterprise \
//     --out dir --check-redirects
//
// Without --slug, pulls every page/pageVariant for that locale (the full
// wave, 28 pages for ja-jp per the spike). With --slug, pulls one page,
// useful for iterating on one module transformer at a time.
//
// --check-redirects (docs/architecture/locale.md): for each page, does a
// read-only HEAD request against the live Falkor path this extractor
// assumes (/{locale}/{slug}, unchanged from the Sanity slug) and reports
// anything that doesn't already resolve there as-is. See
// check-redirect-continuity.js's header comment for why this, not a
// speculative redirect map, is the real scope.
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import {
  fetchLocalePages, fetchPageBySlug, resolveReferences,
} from './fetch.js';
import { renderPage } from './render.js';
import { checkRedirectContinuity } from './check-redirect-continuity.js';
import { collectReferenceIds } from './collect-reference-ids.js';

// Flags that take a value (--locale ja-jp) vs. flags that are just a
// presence check. Declarative lookup by flag position
// instead of a manual index-walking loop, each flag is independent of the
// others, so nothing needs to track how many tokens the previous flag ate.
const VALUE_FLAGS = { '--locale': 'locale', '--slug': 'slug', '--out': 'out' };
const BOOLEAN_FLAGS = { '--check-redirects': 'checkRedirects' };
const KNOWN_FLAGS = new Set([...Object.keys(VALUE_FLAGS), ...Object.keys(BOOLEAN_FLAGS)]);

const parseArgs = (argv) => {
  const args = { out: 'tools/locale-extractor/out', checkRedirects: false };
  args.unknown = argv.filter((arg) => arg.startsWith('--') && !KNOWN_FLAGS.has(arg));
  Object.entries(VALUE_FLAGS).forEach(([flag, key]) => {
    const index = argv.indexOf(flag);
    if (index !== -1) args[key] = argv[index + 1];
  });
  Object.entries(BOOLEAN_FLAGS).forEach(([flag, key]) => {
    if (argv.includes(flag)) args[key] = true;
  });
  return args;
};

const reportRedirectContinuity = async (pages) => {
  console.log('\nChecking redirect continuity against live Falkor paths (B6b)...');
  const results = await checkRedirectContinuity(pages);
  const flagged = results.filter((r) => r.needsB6bRow || r.error);
  if (!flagged.length) {
    console.log(`All ${results.length} pages already resolve at their expected path. No B6b redirect rows needed.`);
    return;
  }
  console.log(`${flagged.length} of ${results.length} pages need attention:`);
  flagged.forEach((r) => {
    if (r.error) console.log(`  ⚠ ${r.path}: request failed (${r.error})`);
    else if (r.redirectedTo) console.log(`  ⚠ ${r.path}: Falkor already redirects this to ${r.redirectedTo} (status ${r.status})`);
    else console.log(`  ⚠ ${r.path}: unexpected status ${r.status}`);
  });
};

const run = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.unknown.length) {
    console.error(`Unknown option(s): ${args.unknown.join(', ')}`);
    process.exitCode = 1;
    return;
  }
  if (!args.locale) {
    console.error('Usage: node tools/locale-extractor/cli.js --locale <bcp47> [--slug <slug>] [--out <dir>] [--check-redirects]');
    process.exitCode = 1;
    return;
  }

  const pages = args.slug
    ? [await fetchPageBySlug(args.locale, args.slug)].filter(Boolean)
    : await fetchLocalePages(args.locale);

  if (!pages.length) {
    console.error(`No pages found for locale "${args.locale}"${args.slug ? ` / slug "${args.slug}"` : ''}.`);
    process.exitCode = 1;
    return;
  }

  if (args.checkRedirects) await reportRedirectContinuity(pages);

  // G-7: one batch resolve for every page in this run, instead of one
  // Sanity query per link, every internal-reference CTA across the whole
  // run shares the same resolved map.
  const referenceIds = [...pages.reduce((ids, page) => collectReferenceIds(page, ids), new Set())];
  const resolvedRefs = await resolveReferences(referenceIds, args.locale);

  const outDir = path.join(args.out, args.locale);
  await mkdir(outDir, { recursive: true });

  for (const page of pages) {
    const { html, warnings } = renderPage(page, { resolvedRefs });
    const slug = page.slug?.current ?? page._id;
    const file = path.join(outDir, `${slug}.html`);
    // A slug can itself contain a "/" (e.g. "features/workflow-management",
    // confirmed real on the ja-jp canary wave), which puts the output file
    // in a subdirectory outDir's own mkdir above never created.
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, html, 'utf8');
    console.log(`Wrote ${file}`);
    warnings.forEach((w) => console.warn(`  ⚠ ${w}`));
  }
};

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
