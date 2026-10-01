/**
 * Unit tests for the locale extractor, grounded in a real fixture (one
 * section of the live ja-jp /enterprise page, see fixtures/
 * ja-jp-enterprise-section1.json, verbatim Sanity data, not invented).
 *
 * Node-only, same pattern as tools/config-sync/*.test.js and
 * tools/eslint-rules/config-drift.test.js, not wired into the browser
 * test runner (`npm test`), since this tool never runs in a browser.
 * Run directly from the `site/` package root:
 *
 *   node tools/locale-extractor/extractor.test.js
 *
 * A thrown assertion means a case failed; no output means everything passed.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPortableText } from './transform/portable-text.js';
import { resolveVariantKeys } from './transform/variant-keys.js';
import { transformModule } from './transform/index.js';
import { renderImage, resolveImageAssetUrl } from './transform/media.js';
import { renderPage } from './render.js';
import { checkRedirectContinuity } from './check-redirect-continuity.js';
import { collectReferenceIds } from './collect-reference-ids.js';
import { resolveReferences } from './fetch.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(path.join(here, 'fixtures', 'ja-jp-enterprise-section1.json'), 'utf8'));
const [heroScreen, spacer, logoWall] = fixture.modules;
const batch2 = JSON.parse(readFileSync(path.join(here, 'fixtures', 'ja-jp-batch2.json'), 'utf8'));

// --- portable-text.js -------------------------------------------------

{
  const warnings = [];
  const out = renderPortableText(heroScreen.content.content, warnings);
  assert.equal(out[0], '<p>[[eyebrow|エンタープライズ版]]</p>', 'eyebrow style renders as [[eyebrow|...]], not a dedicated tag');
  assert.equal(out[1], '<h1>制作ワークフローを<br>安全に拡張</h1>', 'title1 style renders as h1, and a manual line break becomes <br> (a raw \\n would be collapsed by the browser)');
  assert.equal(out[2], '<p>チーム、関係者、クリエイティブアセットをすばやく安全につなぐ共同作業プラットフォームで、コンテンツ制作を加速しましょう。</p>', 'normal style renders as p');
  assert.equal(
    out[3],
    '<p>相談予約 <a href="tel:+81120693682">0120‑693‑682</a></p>',
    'consecutive CTA buttons group into one shared <p>, space-separated, matching hero.js real-content precedent. '
    + 'calendlyButton has no resolvable href in real data, so it renders as plain text (never a fabricated href) and must warn.',
  );
  assert.equal(warnings.length, 1, 'unresolved calendlyButton href must produce exactly one warning');
  assert.match(warnings[0], /Unresolved CTA href/);
}

// Empty/missing content never throws.
assert.deepEqual(renderPortableText(undefined), []);
assert.deepEqual(renderPortableText([]), []);

// Real bug found on the full ja-jp wave (module.pothole content): a block
// with no marks carries an explicit `markDefs: null`, not an omitted field,
// so a `= []` default param on renderSpan never kicks in and `.find` throws.
{
  const block = {
    _type: 'block', style: 'normal', markDefs: null, children: [{ _type: 'span', text: 'plain text', marks: [] }],
  };
  assert.deepEqual(renderPortableText([block]), ['<p>plain text</p>'], 'a block with markDefs: null must not throw');
}

// Real bug found while building module.sideBySides: a module.sideBySides
// stack item's blank "shared title" placeholder is a real, confirmed
// empty-text eyebrow block, not an absent one. The eyebrow branch
// unconditionally returned `<p>[[eyebrow|]]</p>` regardless of whether
// there was real text, unlike every other style's `text ? ... : ''` check.
{
  const emptyEyebrow = {
    _type: 'block', style: 'eyebrow', markDefs: [], children: [{ _type: 'span', text: '', marks: [] }],
  };
  assert.deepEqual(renderPortableText([emptyEyebrow]), [], 'an empty-text eyebrow block renders nothing, same as any other empty block');
}

// --- transform/modules/spacer.js (via dispatch) ------------------------

{
  const warnings = [];
  const html = transformModule(spacer, { warnings });
  assert.equal(html, '<div class="spacer m"></div>', 'sm height 64 is an exact match for the "m" keyword (base 64px)');
  assert.equal(warnings.length, 0, 'an exact size match should not warn');
}

// --- transform/modules/logo-wall.js (via dispatch) ---------------------

{
  const warnings = [];
  const html = transformModule(logoWall, { warnings });
  assert.equal(html, '<div class="logo-wall"></div>', 'useGlobalConfig=true emits an empty block, never fabricated partner names');
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /useGlobalConfig=true/);
}

// --- transform/variant-keys.js (D2 contract) ---------------------------

{
  const { dropped, metadataHtml } = resolveVariantKeys(heroScreen);
  assert.deepEqual(dropped, ['largeEnterprise', 'largeEnterpriseReturningVisitor'], 'default behavior reports what was dropped');
  assert.equal(metadataHtml, '', 'default behavior emits no Section Metadata, base content only (D2)');
}

{
  const { dropped, metadataHtml } = resolveVariantKeys(spacer);
  assert.deepEqual(dropped, [], 'a module with no variantKeys drops nothing');
  assert.equal(metadataHtml, '');
}

// --- transform/index.js dispatch -----------------------------------------

{
  const warnings = [];
  const html = transformModule({ _type: 'module.doesNotExist', _key: 'x' }, { warnings });
  assert.match(html, /UNHANDLED MODULE TYPE/, 'an unknown module type fails loud (visible HTML comment), never silently drops content');
  assert.equal(warnings.length, 1);
}

// --- render.js end-to-end on the real fixture ---------------------------

{
  const page = { sections: [fixture] };
  const { html, warnings } = renderPage(page);
  assert.match(html, /^<body>/);
  assert.match(html, /<header><\/header>/);
  assert.match(html, /<footer><\/footer>/);
  assert.match(html, /class="hero-screen"/);
  assert.match(html, /class="spacer m"/);
  assert.match(html, /class="logo-wall"/);
  // 3 real warnings expected: calendlyButton href, heroScreen media, logoWall useGlobalConfig,
  // plus 2 "dropped variantKeys" log lines from render.js itself.
  assert.ok(warnings.length >= 3, `expected at least 3 warnings, got ${warnings.length}`);
}

// --- newly implemented modules (hero, glow-reveal, cardGridNav, faq,
// carousel, pothole dual-dispatch), grounded in fixtures/ja-jp-batch2.json
// (real data, prioritized by real page-count per docs/architecture/locale.md) ----

{
  const warnings = [];
  const html = transformModule(batch2.hero, { warnings });
  assert.match(html, /class="hero"/, 'module.hero maps to the hero block, not hero-screen');
  assert.match(html, /\[\[eyebrow\|エージェンシー向けFrame\.io\]\]/);
  assert.match(html, /<h1>クライアントと<br>クリエイターと<br>アセットが、<br>ついにひとつに<\/h1>/, 'reuses the same \\n-to-<br> handling as heroScreen');
  assert.match(html, /<picture><source srcset="https:\/\/cdn\.sanity\.io\/images\/s6lu43cv\/production-i18n\/4ca5dbe0aa72a406a2f355296371bcf5bfe8a6f8-4999x5504\.png">/, 'G-4: media now resolves to a real picture, not a flagged gap');
  assert.equal(warnings.length, 0, 'a cleanly resolvable image produces no warning');
}

{
  const warnings = [];
  const html = transformModule(batch2.heroTransitionV4, { warnings });
  assert.match(html, /class="glow-reveal"/);
  assert.match(html, /<picture><source srcset="https:\/\/cdn\.sanity\.io\/images\/s6lu43cv\/production-i18n\/1f625f790d6ef0b42691cbfb1e09de73f3b45796-3840x2160\.png">/, 'G-4: this module is image-only, so resolving its media is the whole fix, not just a flagged gap anymore');
  assert.equal(warnings.length, 0, 'a cleanly resolvable image produces no warning');
}

{
  const warnings = [];
  const html = transformModule(batch2.cardGridNav, { warnings });
  assert.match(html, /class="card-grid-nav"/);
  assert.match(html, /<p>ワークフロー管理<\/p>/, 'real label text is emitted even though the link and media are unresolved');
  assert.ok(warnings.some((w) => w.includes('internal Sanity document')), 'flags the unresolved reference-based link');
  assert.ok(warnings.some((w) => w.includes('G-4')), 'flags the unresolved media');
}

{
  const warnings = [];
  const html = transformModule(batch2.faq, { warnings });
  assert.match(html, /<h3>よくある<br>質問<\/h3>/, 'the module\'s own heading is emitted as a sibling element, matching real precedent');
  assert.match(html, /class="faq"/);
  assert.match(html, /<p>月々プランと年間プランの料金はどのように異なりますか？<\/p>/, 'question text in cell 1');
  assert.match(html, /<p>月々プランに登録すると、解約するまで毎月自動的に課金されます。<\/p>/, 'answer Portable Text rendered in cell 2');
}

{
  const warnings = [];
  const html = transformModule(batch2.carousel, { warnings });
  assert.match(html, /class="carousel"/);
  assert.match(html, /<h5>Princess CruisesはFrame\.ioとAdobe Creative Cloudを使用<\/h5>/, 'title5 style renders as h5, same STYLE_TO_TAG mapping used everywhere');
  assert.match(html, /<picture><source srcset="https:\/\/cdn\.sanity\.io\/images\/s6lu43cv\/production-i18n\/aa387d9c706777b8eddf2aac8e1cee1034454ce8-1424x966\.png">/, 'G-4: the slide image now resolves to a real cell, not a flagged gap');
  assert.ok(warnings.some((w) => w.includes('block.graphic')), 'the logo, a non-style Portable Text block, is dropped via the existing generic unhandled-block path, not a crash');
  assert.ok(warnings.some((w) => w.includes('Unresolved CTA href') && w.includes('unresolved internal reference')), 'the internal-reference CTA is unresolved here (no resolvedRefs passed), reuses the existing generic warning, now with the reference id named');
}

{
  // Same transformer must handle both real Sanity types that map to the one
  // `pothole` block, confirmed real on separate pages (case-studies/xfinity
  // uses module.pothole, enterprise/video-workflows uses module.potholeV4).
  const warnings = [];
  const html = transformModule(batch2.potholeReal, { warnings });
  assert.match(html, /class="pothole"/);
  assert.match(html, /<h4>マーケティング担当者が制作プロセスに完全に関与<\/h4>/);
  assert.ok(warnings.some((w) => w.startsWith('module.pothole ')), 'warning correctly names the real _type, not a hardcoded "potholeV4" string');

  // Real potholeV4 nesting is one level deeper than pothole's own
  // (`module.media.media.image` vs `module.pothole`'s `module.image.image`,
  // see media.js's header comment), so this reconstructs the real shape
  // rather than reusing pothole's object under a renamed field.
  const potholeV4Shape = {
    ...batch2.potholeReal,
    _type: 'module.potholeV4',
    media: { _type: 'enhancedMedia', media: { _type: 'media', image: batch2.potholeReal.image.image } },
    image: undefined,
  };
  const v4Warnings = [];
  const v4Html = transformModule(potholeV4Shape, { warnings: v4Warnings });
  assert.equal(html.replace('module.pothole', 'X'), v4Html.replace('module.potholeV4', 'X'), 'both module types produce identical output given equivalent content, only the media field nesting differs');
}

// --- transform/modules/bentos.js ------------------------------------------

{
  // Real `bento.statsCard` shape (ja-jp enterprise page): no media at all,
  // just a stat-number heading and caption, cross-checked against the
  // Library's own variant-e example (`<h3>50%</h3><p>faster time to
  // market</p>`). bentos.js decorates any card div identically regardless
  // of Sanity card _type, so one transformer handles both shapes.
  const warnings = [];
  const html = transformModule(batch2.bentosStatsCard, { warnings });
  assert.match(html, /class="bentos variant-e"/);
  assert.match(html, /<h3>3\.6倍<\/h3>/, 'title2-style stat number renders as h3, matching the Library\'s real precedent exactly');
  assert.match(html, /<p>制作ワークフローを3\.6倍に加速<\/p>/, 'label-style caption renders as p, matching the Library\'s real precedent exactly');
  assert.match(html, /<p>ワークフロー管理<\/p>/, 'the leading normal-style category text, not shown in the minimal Library example, still renders as a plain p via the existing generic STYLE_TO_TAG mapping, not fabricated new markup');
}

{
  // Real finding: real content carries enum values (background
  // .mediaDisplayMode "fullWidth" without "Shadows", foreground.mediaSize
  // "large") this project's bentos.css has no CSS state for at all. These
  // must not be guessed into a config line that would render with no
  // visual effect.
  const warnings = [];
  const html = transformModule(
    { _key: 'm1', _type: 'module.bentos', bentosLayout: { name: 'variantE' }, cards: [batch2.bentosUnsupportedStates] },
    { warnings },
  );
  assert.doesNotMatch(html, /<p>bg:/, 'an unsupported background.mediaDisplayMode never emits a bg: config line');
  assert.doesNotMatch(html, /<p>size:/, 'an unsupported foreground.mediaSize never emits a size: config line');
  assert.match(html, /<picture><source srcset="https:\/\/cdn\.sanity\.io\/images\/s6lu43cv\/production-i18n\/29e73c0b95f1b741111f392a1873d422cd81760a-2001x1384\.png">/, 'the image itself still resolves via G-4, independent of the unsupported display-mode state');
  assert.ok(warnings.some((w) => w.includes('mediaDisplayMode "fullWidth"')), 'the unsupported background display mode is flagged');
  assert.ok(warnings.some((w) => w.includes('mediaSize "large"')), 'the unsupported foreground media size is flagged');
}

{
  // Real finding: 13 distinct bentosLayout.name values exist in real
  // content, but bentos.css only implements variant-m and variant-e.
  const warnings = [];
  const html = transformModule(batch2.bentosUnsupportedVariant, { warnings });
  assert.match(html, /class="bentos"/, 'no variant class for an unimplemented variant name, not a fabricated one');
  assert.doesNotMatch(html, /variant-a/);
  assert.ok(warnings.some((w) => w.includes('bentosLayout.name "variantA"') && w.includes('falls back to the default mosaic grid')), 'the unimplemented variant is flagged, not silently dropped');
}

{
  // Real finding: `bento.statsCard`'s alignment lives at `content.alignment`
  // (not `textAlignment` like a real `card`), confirmed "left" is a real
  // non-default value in live ja-jp content.
  const warnings = [];
  const html = transformModule(batch2.bentosStatsCard, { warnings });
  assert.match(html, /<p>align: left<\/p>/, 'a bento.statsCard\'s content.alignment is read as a fallback for the regular textAlignment field');
}

{
  // Real finding: `content.columns` ("8" confirmed real, vs. the "12"
  // full-span default) has no matching CSS in bentos.css at all.
  const warnings = [];
  const statsWithColumns = structuredClone(batch2.bentosStatsCard);
  statsWithColumns.cards[0].content.columns = '8';
  const html = transformModule(statsWithColumns, { warnings });
  assert.ok(warnings.some((w) => w.includes('content.columns "8"')), 'a non-default columns value is flagged, since there is no CSS to apply it');
  assert.doesNotMatch(html, /columns/, 'never emits a fabricated columns: config line, bentos.js has no OPT key for it');
}

// --- transform/modules/side-by-side.js -------------------------------------

{
  // Real finding: `sideBySides[]` is an array of independent items, each
  // its own `side-by-side` block, stacked (confirmed real on the ja-jp
  // enterprise page: 3 items, only the first has a real title).
  const warnings = [];
  const html = transformModule(batch2.sideBySidesStack, { warnings });
  const instanceCount = (html.match(/class="side-by-side/g) ?? []).length;
  assert.equal(instanceCount, 2, 'each array item becomes its own separate side-by-side block instance, not one block with multiple rows');
  assert.match(html, /<p>\[\[eyebrow\|スケーラビリティ\]\]<\/p>/, 'the first item\'s real title renders (eyebrow)');
  assert.match(html, /<h2>チームと共に成長する<\/h2>/, 'the first item\'s title2 heading renders as h2 (STYLE_TO_TAG default, side-by-side.js normalizes heading levels itself)');
  assert.match(html, /<h5>一元化されたアカウント管理<\/h5>/, 'the first item\'s content title5 heading still renders alongside the title');
  assert.doesNotMatch(html.split('class="side-by-side')[2], /<h2>|\[\[eyebrow/, 'the second item\'s blank title renders nothing, not fabricated placeholder content');
}

{
  // Real finding: a media entry can be video-only (no image field at all),
  // which this block has no rendering path for (mediaRow only looks for
  // picture/img), and multiple media entries only ever render the first.
  const warnings = [];
  transformModule(batch2.sideBySidesStack, { warnings });
  assert.ok(warnings.some((w) => w.includes('2 media entries exist') && w.includes('"9add80f1a2b6"')), 'the first item\'s 2nd image is flagged, not silently dropped');
  assert.ok(warnings.some((w) => w.includes('video-only') && w.includes('"d884131204095ecb63acdb2bbda66e33"')), 'the second item\'s video-only media is flagged, this block cannot render video at all');
}

{
  // Real finding: mediaLayout "card" has no CSS variant of its own, but its
  // real content structurally matches this block's existing touts-row
  // feature exactly (title5+button text, plus a touts.touts[] list).
  const warnings = [];
  const html = transformModule(
    { _key: 'm1', _type: 'module.sideBySides', sideBySides: [batch2.sideBySidesCardTouts] },
    { warnings },
  );
  assert.match(html, /<h2>Create your perfect workflow\.<\/h2>/, 'the big title renders');
  assert.match(html, /<a href="https:\/\/fujifilm-x\.com\/en-us\/lp\/fujifilm-x-frame-io">Download Fujifilm Firmware<\/a>/, 'a CTA button embedded in the text content renders via the existing generic button handling');
  assert.match(html, /<ul><li>.*Organize assets how you like.*<\/li><li>.*Integrations that keep work flowing.*<a href="#pricing">See the Offer<\/a>.*<\/li><\/ul>/, 'touts render as a <ul> of <li> items, including a tout\'s own CTA button, matching side-by-side.js\'s toutsRow detection (cell\'s firstElementChild must be the <ul>)');
  assert.ok(warnings.some((w) => w.includes('mediaLayout "card"') && w.includes('no matching CSS variant')), 'the card mediaLayout is flagged since it has no CSS counterpart, even though its content renders correctly via the touts path');
  assert.doesNotMatch(html, /class="side-by-side[^"]*card/, 'no fabricated "card" class is ever emitted');
}

{
  // Real finding: layout "textLeftMediaRight" maps to the media-right
  // variant (text visually leads, media follows in natural DOM order).
  const warnings = [];
  const bleedItem = { ...batch2.sideBySidesCardTouts, mediaLayout: 'bleed' };
  const html = transformModule(
    { _key: 'm2', _type: 'module.sideBySides', sideBySides: [bleedItem] },
    { warnings },
  );
  assert.match(html, /class="side-by-side media-right bleed"/, 'textLeftMediaRight -> media-right, and bleed -> bleed, both real CSS-backed states');
}

// --- transform/modules/touts.js ---------------------------------------------

{
  const warnings = [];
  const html = transformModule(batch2.toutsModule, { warnings });
  assert.match(html, /class="touts"/);
  assert.match(html, /<h6>24時間365日のサポート<\/h6><p>お問い合わせには1時間以内の応答をSLA保証。<\/p>/, 'a tout cell renders title6 as h6 (generic STYLE_TO_TAG default, no override needed here) + normal as p');
  assert.match(html, /<h6>豊富なベストプラクティス<\/h6>/, 'all 3 real items render in one row, one cell each');
  const cellCount = (html.match(/<div><h6>/g) ?? []).length;
  assert.equal(cellCount, 3, 'one row, 3 cells, matching the Library doc\'s "one row, 3-4 cells" shape');
}

{
  // Real finding: `graphicType: "icon"` flags that a tout is meant to
  // carry a leading icon, but no resolvable icon name/asset ever
  // accompanies it in real Sanity data, so no :icon: is fabricated.
  const warnings = [];
  const html = transformModule(batch2.toutsModule, { warnings });
  assert.doesNotMatch(html, /:icon/, 'never fabricates an :iconname: marker with no real icon identity to back it');
  const iconWarnings = warnings.filter((w) => w.includes('graphicType "icon"'));
  assert.equal(iconWarnings.length, 2, 'exactly the 2 real items with graphicType icon are flagged, the 3rd (no graphicType) is not');
}

// --- transform/media.js (G-4) --------------------------------------------

assert.equal(
  resolveImageAssetUrl('image-4ca5dbe0aa72a406a2f355296371bcf5bfe8a6f8-4999x5504-png'),
  'https://cdn.sanity.io/images/s6lu43cv/production-i18n/4ca5dbe0aa72a406a2f355296371bcf5bfe8a6f8-4999x5504.png',
  'resolves against production-i18n, the confirmed real asset-serving dataset, not the production-v4 content dataset this extractor queries',
);
assert.equal(resolveImageAssetUrl('not-a-real-asset-ref'), null, 'an unrecognized ref format never produces a fabricated URL');
assert.equal(resolveImageAssetUrl(undefined), null);

{
  const warnings = [];
  const html = renderImage({ alt: 'テスト', asset: { _ref: 'image-4ca5dbe0aa72a406a2f355296371bcf5bfe8a6f8-4999x5504-png' } }, { warnings });
  assert.match(html, /^<picture><source srcset="https:\/\/cdn\.sanity\.io/);
  assert.match(html, /alt="テスト"/);
  assert.equal(warnings.length, 0);
}

assert.equal(renderImage(undefined), null, 'no image field at all is silent, not a warning, there is genuinely nothing there');
assert.equal(renderImage({}), null);

{
  const warnings = [];
  const html = renderImage({
    alt: '', asset: { _ref: 'image-abc123-100x100-jpg' }, crop: { top: 0, bottom: 0, left: 0, right: 0 }, hotspot: { x: 0.5, y: 0.5 },
  }, { warnings });
  assert.match(html, /^<picture>/, 'crop/hotspot data present but unapplied still resolves the plain image, matching real precedent (no real published page routes through Cloudflare crop/gravity today)');
  assert.ok(warnings.some((w) => w.includes('crop/hotspot')), 'flags that crop/hotspot exist but are not applied, rather than silently dropping that information');
}

// --- collect-reference-ids.js + fetch.js resolveReferences (G-7) --------

{
  const page = {
    sections: [{
      modules: [
        { _type: 'module.heroScreen', content: { content: [{ _type: 'block.button', button: { reference: { _ref: 'page-a' } } }] } },
        { _type: 'module.cardGridNav', cardGridNavItems: [{ link: { reference: { _ref: 'page-b' } } }, { link: { label: 'no ref' } }] },
        { _type: 'module.hero', media: { media: { image: { asset: { _ref: 'image-should-not-be-collected-100x100-png' } } } } },
      ],
    }],
  };
  const ids = [...collectReferenceIds(page)];
  assert.deepEqual(ids.sort(), ['page-a', 'page-b'], 'collects every { reference: { _ref } } site, and only that shape, image asset refs are a different shape and must not appear here');
}

{
  // Same-locale references (page-a is already ja-jp) need no second query at
  // all, confirmed by the mock throwing if a slug-lookup query ever fires.
  const originalFetch = globalThis.fetch;
  let capturedQuery;
  globalThis.fetch = async (url) => {
    capturedQuery = new URL(url).searchParams.get('query');
    assert.doesNotMatch(capturedQuery, /slug\.current in/, 'no same-locale references present, the second (slug-lookup) query must never fire');
    return new Response(JSON.stringify({
      result: [
        { _id: 'page-a', slug: 'enterprise', language: 'ja-jp' },
        { _id: 'page-b', slug: null, language: 'ja-jp' },
      ],
    }), { status: 200 });
  };

  const resolved = await resolveReferences(['page-a', 'page-b'], 'ja-jp');
  globalThis.fetch = originalFetch;

  assert.match(capturedQuery, /_type in \['page','pageVariant'\]/, 'only resolves against real page/pageVariant documents, never an arbitrary reference target');
  assert.deepEqual(resolved.get('page-a'), { path: '/ja-jp/enterprise', crossLocale: false });
  assert.deepEqual(resolved.get('page-b'), { path: '/ja-jp', crossLocale: false }, 'a null slug (a locale root/home page) resolves to the bare locale path, not "/ja-jp/null"');
  assert.equal(resolved.get('page-c'), undefined, 'an id with no matching document simply has no entry, callers already treat that as unresolved');
}

{
  // Real finding (2026-10-01, confirmed on the live ja-jp features/
  // workflow-management page): a reference points at the EN-US canonical
  // document even from a ja-jp page. Naively using that path would send a
  // Japanese visitor to English. A same-slug ja-jp sibling exists here, so
  // the resolver must redirect to IT, not the raw en-us resolution.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const query = new URL(url).searchParams.get('query');
    if (query.includes('_id in')) {
      return new Response(JSON.stringify({ result: [{ _id: 'en-doc', slug: 'features/x', language: 'en-us' }] }), { status: 200 });
    }
    assert.match(query, /slug\.current in \$slugs/, 'looks up a same-locale sibling by slug once a cross-locale reference is found');
    return new Response(JSON.stringify({ result: [{ slug: 'features/x' }] }), { status: 200 });
  };

  const resolved = await resolveReferences(['en-doc'], 'ja-jp');
  globalThis.fetch = originalFetch;

  assert.deepEqual(resolved.get('en-doc'), { path: '/ja-jp/features/x', crossLocale: false }, 'a localized sibling exists, the resolved path stays inside the visitor\'s own locale');
}

{
  // Same scenario, but no ja-jp sibling exists for this slug, the resolver
  // has no honest choice but to fall back to the en-us path, flagged.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const query = new URL(url).searchParams.get('query');
    if (query.includes('_id in')) {
      return new Response(JSON.stringify({ result: [{ _id: 'en-only-doc', slug: 'features/y', language: 'en-us' }] }), { status: 200 });
    }
    return new Response(JSON.stringify({ result: [] }), { status: 200 });
  };

  const resolved = await resolveReferences(['en-only-doc'], 'ja-jp');
  globalThis.fetch = originalFetch;

  assert.deepEqual(resolved.get('en-only-doc'), { path: '/en-us/features/y', crossLocale: true }, 'no localized sibling exists, falls back to the real en-us path, flagged as crossLocale so callers warn rather than silently sending the visitor out of their locale');
}

{
  // Real bug found on the full ja-jp wave (customers.html's case-studies
  // references): the referenced doc's own `language` field is a literal
  // `null`, not a string, confirmed via Sanity MCP on case-studies/
  // north-face (production-v4) and verified live (frame.io/case-studies/
  // north-face -> 200, no locale prefix at all; /en-us/... of the same page
  // -> 308 redirect). `pagePath(slug, null)` must produce the bare path,
  // not "/null/...".
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const query = new URL(url).searchParams.get('query');
    if (query.includes('_id in')) {
      return new Response(JSON.stringify({ result: [{ _id: 'unlocalized-doc', slug: 'case-studies/north-face', language: null }] }), { status: 200 });
    }
    return new Response(JSON.stringify({ result: [] }), { status: 200 });
  };

  const resolved = await resolveReferences(['unlocalized-doc'], 'ja-jp');
  globalThis.fetch = originalFetch;

  assert.deepEqual(resolved.get('unlocalized-doc'), { path: '/case-studies/north-face', crossLocale: true }, 'a null-language doc resolves to the bare path (no locale prefix), not "/null/..."');
}

{
  const resolved = await resolveReferences([], 'ja-jp');
  assert.deepEqual(resolved, new Map(), 'an empty id list never makes a network call or returns anything but an empty map');
}

// --- end-to-end: a resolved reference actually becomes a working link ---

{
  const resolvedRefs = new Map([['e75dc8b9-290f-4539-ac73-8cd99fa03f24', { path: '/ja-jp/case-studies/princess-cruises', crossLocale: false }]]);
  const warnings = [];
  const html = transformModule(batch2.carousel, { warnings, resolvedRefs });
  assert.match(html, /<a href="\/ja-jp\/case-studies\/princess-cruises">事例を見る<\/a>/, 'with the reference resolved, the CTA is a real working link, not plain text');
  assert.ok(!warnings.some((w) => w.includes('Unresolved CTA href')), 'no unresolved-href warning once the reference actually resolves');
  assert.ok(!warnings.some((w) => w.includes('out of their locale')), 'no cross-locale warning when a localized sibling was found');
}

{
  const resolvedRefs = new Map([['3677ff69-565a-48fd-aaeb-b207b869cbb0', { path: '/ja-jp/features/workflow-management', crossLocale: false }]]);
  const html = transformModule(batch2.cardGridNav, { warnings: [], resolvedRefs });
  assert.match(html, /<a href="\/ja-jp\/features\/workflow-management">ワークフロー管理<\/a>/, 'card-grid-nav links resolve through the same shared map');
}

{
  // Real scenario found on the live ja-jp features/workflow-management page
  // (2026-10-01): confirms the fix actually fires end-to-end through
  // card-grid-nav, not just the resolver in isolation.
  const resolvedRefs = new Map([['3677ff69-565a-48fd-aaeb-b207b869cbb0', { path: '/en-us/features/workflow-management', crossLocale: true }]]);
  const warnings = [];
  const html = transformModule(batch2.cardGridNav, { warnings, resolvedRefs });
  assert.match(html, /<a href="\/en-us\/features\/workflow-management">ワークフロー管理<\/a>/, 'still links somewhere real rather than nothing, honest fallback not a silent failure');
  assert.ok(warnings.some((w) => w.includes('out of their locale')), 'but flags the cross-locale fallback so a reviewer catches it before it ships');
}

// --- check-redirect-continuity.js (B6b) ---------------------------------
// Mocked fetch, not a live network call, so this suite stays hermetic. The
// real live check is run manually via `--check-redirects` on the CLI, not
// as part of this test file.

{
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    if (url.includes('/ja-jp/enterprise')) return new Response(null, { status: 200 });
    if (url.includes('/ja-jp/moved-page')) {
      return new Response(null, { status: 301, headers: { location: '/ja-jp/new-home-for-this' } });
    }
    return new Response(null, { status: 404 });
  };

  const results = await checkRedirectContinuity([
    { language: 'ja-jp', slug: { current: 'enterprise' } },
    { language: 'ja-jp', slug: { current: 'moved-page' } },
    { language: 'ja-jp', slug: { current: 'gone-page' } },
  ]);

  globalThis.fetch = originalFetch;

  assert.equal(calls[0], 'https://frame.io/ja-jp/enterprise', 'builds the expected live path from locale + slug');
  assert.equal(results[0].needsB6bRow, false, 'a page that already resolves at its expected path needs no redirect row');

  assert.equal(results[1].needsB6bRow, true, 'a page Falkor already redirects elsewhere needs a B6b row');
  assert.equal(results[1].redirectedTo, '/ja-jp/new-home-for-this');

  assert.equal(results[2].needsB6bRow, true, 'a 404 at the expected path is also flagged, not silently ignored');
  assert.equal(results[2].status, 404);
}

console.log('locale-extractor: all assertions passed');
