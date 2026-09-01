// P0-44 MEASUREMENT SPIKE — local dev server only. Not the real decision endpoint
// (that's a thin Cloudflare Worker per master §11.6/§7.8, holding the real Clearbit
// key) — this is a static-file server plus a mock `/spike/api/decision` route with
// a deliberately injectable, configurable artificial latency, so the real P0-44
// client mechanism (scripts/utils/pzn.js) can be measured across a round-trip sweep
// (50/150/300/600/1200ms) without any real Clearbit key or Worker existing yet.
//
// Serves the whole repo root statically (not just spike/) so the test page can use
// the project's real relative ESM imports (e.g. `../scripts/utils/consent.js`)
// unmodified — no bundler, matching the project's "no build step" rule.
//
// Run: node spike/server.mjs
// Then open: http://localhost:8892/spike/test-hero.html

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url)); // repo root (site/)
const SPIKE_DIR = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PZN_SPIKE_PORT ?? 8892);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const delay = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

const sendJson = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
};

// Mock decision endpoint. Query params (all optional):
//   latencyMs — artificial server-side delay before responding (the sweep dial)
//   fail      — respond 500 instead of a decision, to exercise the error-path
//               fail-open; a large latencyMs alone (bigger than pzn.js's
//               `pznTimeout`) already exercises the timeout-path fail-open
//               without needing a separate "hang" flag
//   segment   — pin the returned segment (default: "enterprise")
const handleDecision = async (url, res) => {
  const latencyMs = Number(url.searchParams.get('latencyMs') ?? 0);
  if (latencyMs > 0) await delay(latencyMs);

  if (url.searchParams.get('fail') === 'true') {
    sendJson(res, 500, { error: 'spike: forced decision failure' });
    return;
  }

  sendJson(res, 200, { segment: url.searchParams.get('segment') || 'enterprise' });
};

// Mocks the real published P0-45 sheet (created for real in DA at
// /system/personalization/variants.json, per the system/ content convention
// — see the spike report for the live editUrl/previewUrl). DA's preview
// pipeline needs a manual Send → Preview
// step before that URL is fetchable (a known platform gotcha, not specific to
// this spike — see ref_deploy_mechanics), so this route serves a fixture with
// the identical `{ total, offset, limit, data }` published shape, keeping the
// Playwright loop fast and independent of network/publish state. Query params:
//   variantsLatency — artificial delay, same purpose as the decision route's
//   variantsFail     — respond 500, to exercise the sheet-fetch fail-open path
//   variantsMalformed — append one deliberately broken row (non-numeric
//                        weight, missing selector) to exercise per-row
//                        fail-open without breaking well-formed rows
const handleVariants = async (url, res) => {
  const latencyMs = Number(url.searchParams.get('variantsLatency') ?? 0);
  if (latencyMs > 0) await delay(latencyMs);

  if (url.searchParams.get('variantsFail') === 'true') {
    sendJson(res, 500, { error: 'spike: forced variants-sheet failure' });
    return;
  }

  const fixture = JSON.parse(await readFile(join(SPIKE_DIR, 'variants.fixture.json'), 'utf8'));
  if (url.searchParams.get('variantsMalformed') === 'true') {
    fixture.data.push({
      placement: 'hero-cta', segment: 'enterprise', type: 'cta', selector: '', fragment: '', label: 'Broken Row', href: '/broken', weight: 'not-a-number',
    });
    fixture.total = fixture.data.length;
  }
  sendJson(res, 200, fixture);
};

const serveStatic = async (pathname, res) => {
  const routed = pathname === '/' || pathname === '/spike' || pathname === '/spike/'
    ? '/spike/test-hero.html'
    : pathname;
  const safePath = normalize(routed).replace(/^(\.\.[/\\])+/, '');
  const filePath = join(ROOT, safePath);
  try {
    const info = await stat(filePath);
    if (info.isDirectory()) throw new Error('not a file');
    const body = await readFile(filePath);
    res.writeHead(200, { 'content-type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end(`spike server: not found: ${pathname}`);
  }
};

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === '/spike/api/decision') {
    await handleDecision(url, res);
    return;
  }
  if (url.pathname === '/system/personalization/variants.json') {
    await handleVariants(url, res);
    return;
  }
  await serveStatic(url.pathname, res);
}).listen(PORT, () => {
  // eslint-disable-next-line no-console -- dev-server startup message
  console.log(`pzn spike server: http://localhost:${PORT}/spike/test-hero.html`);
});
