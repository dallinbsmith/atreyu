// G-4: resolves a Sanity image asset reference into the same plain
// cdn.sanity.io <picture> markup already used by every real page in this DA
// org (confirmed identical in features/c2c.html and the bentos.html Library
// doc, both `<source>` tags carry the same srcset, no real responsive
// variation is actually applied today, so this matches precedent exactly
// rather than inventing a "better" responsive scheme this project doesn't
// use yet).
//
// Real, confirmed finding: the asset-serving dataset is NOT the content
// dataset this extractor queries (`production-v4`). Every real published
// image on this site resolves through `production-i18n` instead, confirmed
// identical across two independent real pages. Not a guess, don't change
// this without re-confirming against a live page first.
//
// Deliberately NOT building Cloudflare trim+gravity (D10) here: no real
// published page in this DA org routes images through Cloudflare today,
// they all reference cdn.sanity.io directly. D10's crop/hotspot-to-gravity
// mapping is the target architecture for when a real media pipeline gets
// built, not what this extractor should fabricate ahead of that existing
// precedent. Crop/hotspot are accepted but intentionally unused for now,
// flagged below rather than silently dropped.
const PROJECT_ID = 's6lu43cv';
const ASSET_DATASET = 'production-i18n';

const ASSET_REF_RE = /^image-([a-f0-9]+)-(\d+)x(\d+)-(\w+)$/;

// Returns the real CDN URL for a Sanity image asset `_ref`, or null if the
// ref doesn't match the known real format (never fabricates a URL from an
// unrecognized shape).
export const resolveImageAssetUrl = (assetRef) => {
  const match = ASSET_REF_RE.exec(assetRef ?? '');
  if (!match) return null;
  const [, hash, width, height, ext] = match;
  return `https://cdn.sanity.io/images/${PROJECT_ID}/${ASSET_DATASET}/${hash}-${width}x${height}.${ext}`;
};

const escapeAttr = (s) => (s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');

// `imageField` is Sanity's real `extendedImage` shape: `{ alt, asset: {
// _ref }, crop, hotspot }`. Real field NAME for where this sits varies by
// module type (confirmed: `module.media.media.image` for hero/heroScreen/
// heroTransitionV4/cardGridNav, `module.image.image` for pothole), callers
// pass the already-unwrapped `extendedImage` object, not the whole module.
export const renderImage = (imageField, { warnings = [] } = {}) => {
  if (!imageField?.asset?._ref) return null;
  const url = resolveImageAssetUrl(imageField.asset._ref);
  if (!url) {
    warnings.push(`Image asset ref "${imageField.asset._ref}" doesn't match the known real format, not resolved.`);
    return null;
  }
  if (imageField.crop || imageField.hotspot) {
    warnings.push('Image has crop/hotspot data this extractor doesn\'t apply yet (D10 Cloudflare trim+gravity isn\'t wired up here, no real published page routes through it today either, see media.js header comment).');
  }
  const alt = escapeAttr(imageField.alt);
  return `<picture><source srcset="${url}"><source srcset="${url}" media="(min-width: 600px)"><img src="${url}" alt="${alt}" loading="lazy"></picture>`;
};
