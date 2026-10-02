// Manifesto motion is enhancement over a readable statement + image layout;
// CSS consumes --progress only after JS opts in.
import { decorateRichText } from '../../scripts/utils/richtext.js';
import { wireVideoModalLinks } from '../../scripts/utils/modal/video-modal.js';
import {
  createElement, getCells, HEADING_SELECTOR, classifyCtaParagraphs,
} from '../../scripts/utils/dom.js';
import { guardDecorate } from '../../scripts/utils/lifecycle.js';
import { shouldAnimate } from '../../scripts/utils/motion/motion.js';
import { trackScrollProgress } from '../../scripts/utils/motion/scroll.js';

export default (el, { signal } = {}) => {
  // Idempotent under DA Quick-Edit re-decoration — a second pass would
  // otherwise re-find the cells and re-wire a second click listener onto the
  // still-present Wistia link.
  if (signal?.aborted || !guardDecorate(el, 'manifesto')) return;

  // Classified by shape, not position: the pure-media cell (a picture/img
  // carrying no text) is the manifesto image; every remaining cell holds the
  // statement richtext and/or the authored "Watch the video" Wistia link.
  // Keep the image cell caption-free; a caption turns it into content and it
  // renders inline.
  const cells = getCells(el);
  const mediaCell = cells.find((c) => c.querySelector('picture, img') && !c.textContent.trim());
  const contentCells = cells.filter((c) => c !== mediaCell);

  const media = mediaCell && createElement(
    'div',
    { className: 'manifesto-media' },
    ...mediaCell.children,
  );

  const content = contentCells.length && createElement(
    'div',
    { className: 'manifesto-content' },
    ...contentCells.flatMap((c) => [...c.children]),
  );
  if (content) {
    decorateRichText(content);
    content.querySelector(HEADING_SELECTOR)?.classList.add('manifesto-heading');
    classifyCtaParagraphs(content, 'manifesto-cta');
    // Wire an authored Wistia link (if any) to open the shared accessible video
    // modal instead of navigating. No Wistia link => no-op, so a block authored
    // with just image + statement renders cleanly with no dead CTA.
    wireVideoModalLinks(content, { signal });
  }

  el.replaceChildren(...[media, content].filter(Boolean));

  if (!shouldAnimate()) return; // resting DOM is the static image + statement + CTA
  el.classList.add('is-animating');
  // Sets --progress (0..1) on el as the section scrolls; CSS fades/drifts the
  // media off it. Progress halts the moment scrolling stops (no continuous
  // motion), so no WCAG 2.2.2 pause control is required. The block signal
  // disconnects the shared scroll observer during re-decoration sweeps.
  trackScrollProgress(el, undefined, { signal });
};
