import { HEADING_SELECTOR } from './dom.js';

// Falkor's bentoMediaLayout heuristic: a large photo (JPEG, or wide) reads as a
// full-bleed BACKGROUND; a small graphic/logo (SVG, PNG, small) reads as a
// FOREGROUND icon. Shared by bentos.js and carousel.js — both distinguish a
// photo background from a small foreground logo by the same image shape, not
// by authored column position.
export const inferMediaLayout = (img) => {
  const src = img?.getAttribute('src') ?? '';
  const w = Number.parseInt(img?.getAttribute('width'), 10) || img?.naturalWidth || 0;
  const isPhoto = /\.jpe?g($|\?)/i.test(src) || /format=(jpe?g|pjpg)/i.test(src);
  return (isPhoto || w >= 1000) ? 'background' : 'foreground';
};

// Removes an authored node, then its wrapping <p> too — but only once
// genuinely emptied (checked AFTER detaching, since an authored image is
// always its <p>'s only content). Shared by carousel.js and
// card-grid-landscape.js, both of which extract media/logo images this way.
export const detachFromRow = (node) => {
  const wrapP = node.closest('p');
  node.remove();
  if (wrapP && !wrapP.textContent.trim() && !wrapP.querySelector('img, picture')) wrapP.remove();
};

// Classifies every img in `row` into one full-bleed background (`media`) and
// at most one foreground logo, detaching every extra of either kind. Real
// content is always exactly one background photo + zero-or-one logo, but
// classify defensively: if a row is ever authored with more than one of
// either, keep the first and remove the rest rather than leaving unstyled
// stray images behind.
export const extractRowMedia = (row) => {
  let media = null;
  const logos = [];
  [...row.querySelectorAll('img')].forEach((img) => {
    const host = img.closest('picture') ?? img;
    if (inferMediaLayout(img) === 'background') {
      if (media) detachFromRow(host);
      else media = host;
    } else {
      logos.push(host);
    }
  });
  logos.slice(1).forEach(detachFromRow);
  const [logo] = logos;
  if (media) detachFromRow(media);
  if (logo) detachFromRow(logo);
  return { media, logo };
};

// Shared tout/card decoration: heading → title, body paragraphs → body,
// CTA links lifted into a single cta wrapper (first = primary, rest = secondary).
// Reused by the bentos and side-by-side blocks. Class prefix is configurable so
// each block keeps its own BEM-ish namespace while sharing the logic.
// `testidId` is a separate, optional per-instance identifier (e.g. an index)
// for callers that render a repeated list — it must not feed into `prefix`,
// which drives CSS class names that CSS/tests already key off unindexed
// (`.tout-title`, `.bento-card-title`), or every repeated item would get a
// distinct, unstyled class name instead of a shared one.
export const decorateTout = (el, prefix = 'tout', testidId = prefix) => {
  el.classList.add(prefix);

  // Author-driven icon: a STANDALONE `:icon:` (not one inside a link/button) is
  // hoisted above the title and classed. Icons inside CTA links stay put.
  const icon = [...el.querySelectorAll('.icon')].find((i) => !i.closest('a'));
  if (icon) {
    icon.classList.add(`${prefix}-icon`);
    const wrap = icon.closest('p');
    el.prepend(icon);
    if (wrap && wrap !== el && !wrap.textContent.trim() && !wrap.querySelector('a, img')) wrap.remove();
  }

  const heading = el.querySelector(HEADING_SELECTOR);
  if (heading) heading.classList.add(`${prefix}-title`);

  const paragraphs = [...el.querySelectorAll('p')];
  const ctaParas = paragraphs.filter((p) => p.querySelector('a'));
  const bodyParas = paragraphs.filter((p) => !p.querySelector('a'));

  bodyParas.forEach((p) => p.classList.add(`${prefix}-body`));

  if (!ctaParas.length) return;

  const ctaWrapper = document.createElement('div');
  ctaWrapper.classList.add(`${prefix}-cta`);
  ctaParas[0].parentNode.insertBefore(ctaWrapper, ctaParas[0]);

  ctaParas.forEach((p) => {
    [...p.querySelectorAll('a')].forEach((a) => ctaWrapper.append(a));
    p.remove();
  });

  // Defer to the framework: links already buttonized by decorateButton (from
  // authored em/strong/underline) keep that author-intended variant — and
  // already have a data-testid from decorateButton itself. A link that
  // carries an arrow icon (`:arrow:`) becomes a borderless text-link. Otherwise
  // assign positional primary/secondary to plain links.
  const roleCounts = {};
  [...ctaWrapper.querySelectorAll('a')].forEach((a, idx) => {
    if (a.classList.contains('btn')) return;
    const isArrowLink = a.querySelector('.icon-arrow');
    let role = idx === 0 ? 'primary' : 'secondary';
    if (isArrowLink) role = 'link';
    // Disambiguate a repeated role within one tout (e.g. two secondary links or
    // two arrow-links) so their data-testids don't collide. The first of each
    // role keeps the bare `-cta-<role>` id (unchanged); the 2nd+ get a `-<n>`
    // suffix. `testidId` already disambiguates across touts, not within one.
    roleCounts[role] = (roleCounts[role] ?? 0) + 1;
    const suffix = roleCounts[role] > 1 ? `-${roleCounts[role]}` : '';
    a.dataset.testid ||= `${testidId}-cta-${role}${suffix}`;
    a.classList.add('btn', `btn-${role}`);
  });
};
