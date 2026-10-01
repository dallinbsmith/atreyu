#!/usr/bin/env node
/* eslint-disable no-console -- CLI script; console output is the reporting mechanism */
// workers/website pins miniflare exactly (nonce.test.js runs in real workerd
// through it), and wrangler pins its own miniflare exactly too. If the two
// differ, npm installs two miniflare/workerd copies and the tests no longer
// run on the runtime wrangler deploys with. Fails when they differ.
// Run after `npm ci --prefix workers/website`. Args: worker dir, then any
// other worker dirs whose exact wrangler pin must equal the first one's.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const [dir = 'workers/website', ...siblings] = process.argv.slice(2);
const readJson = async (path) => {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (err) {
    console.error(`Cannot read ${path} (${err.code ?? err.message}). Run \`npm ci --prefix ${dir}\` first.`);
    return process.exit(1);
  }
};

const pkg = await readJson(join(dir, 'package.json'));
const wrangler = await readJson(join(dir, 'node_modules/wrangler/package.json'));
const pinned = pkg.devDependencies?.miniflare;
const wanted = wrangler.dependencies?.miniflare;

if (!pinned) {
  console.error(`${dir}/package.json has no devDependencies.miniflare. Pin it exactly to "${wanted}".`);
  process.exit(1);
}
if (pinned !== wanted) {
  console.error(`${dir}/package.json pins miniflare "${pinned}", but the installed wrangler@${wrangler.version} depends on miniflare "${wanted}". Set devDependencies.miniflare to "${wanted}" (or change wrangler), then re-lock.`);
  process.exit(1);
}
console.log(`miniflare pin ${pinned} matches wrangler@${wrangler.version}.`);

const pinnedWrangler = pkg.devDependencies?.wrangler;
const drifted = (await Promise.all(siblings.map(async (sib) => [sib, (await readJson(join(sib, 'package.json'))).devDependencies?.wrangler])))
  .filter(([, v]) => v !== pinnedWrangler);
if (drifted.length) {
  drifted.forEach(([sib, v]) => console.error(`${sib}/package.json pins wrangler "${v}", but ${dir} pins "${pinnedWrangler}". Bump them together.`));
  process.exit(1);
}
