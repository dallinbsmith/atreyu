// Media (image or video) stacked above text content. Mobile-only alignment
// (left/right) bleeds the media wider than the container toward one edge,
// matching Falkor's real MediaWithText.module.css behavior — becomes plain
// full-width at 768px+. Video composition mirrors standalone-media.js
// (decorateVideoMedia + wireVideoModalLinks). Falkor's real GSAP scroll-
// parallax path is dead code in production today (needsParallax is
// hardcoded false in MediaWithText.tsx) and isn't ported.
import { decorateRichText } from '../../scripts/utils/richtext.js';
import { decorateVideoMedia } from '../../scripts/utils/media/video.js';
import { wireVideoModalLinks } from '../../scripts/utils/modal/video-modal.js';
import {
  createElement, getCells, HEADING_SELECTOR, parseGlassborderDecoration,
} from '../../scripts/utils/dom.js';
import { guardDecorate } from '../../scripts/utils/lifecycle.js';

export default (el) => {
  if (!guardDecorate(el, 'mediaWithText')) return;

  parseGlassborderDecoration(el);

  // Classified by shape (F-66), not position — and unlike standalone-media.js
  // (one content cell, nothing else to compete with it), this block merges
  // MULTIPLE text cells, so a text cell carrying an inline image (a badge, a
  // small inline diagram) could otherwise be misread as "the" media cell.
  // Requiring the media cell to be pure media (no other text) disambiguates
  // without falling back to a positional check.
  const cells = getCells(el);
  const mediaCell = cells.find((c) => c.querySelector('picture, img') && !c.textContent.trim());
  const textCells = cells.filter((c) => c !== mediaCell);

  const text = createElement(
    'div',
    { className: 'media-with-text-text' },
    ...textCells.flatMap((c) => [...c.children]),
  );
  decorateRichText(text);
  text.querySelector(HEADING_SELECTOR)?.classList.add('media-with-text-heading');

  const media = createElement('div', { className: 'media-with-text-media' }, ...(mediaCell?.children ?? []));
  decorateVideoMedia(media);
  wireVideoModalLinks(media);

  el.replaceChildren(media, text);
};
