// Vanilla port of Falkor's Manifesto module (organisms/modules/Manifesto).
// Content model (Sanity module.manifesto): one required image + a large
// bodyXL statement rich-text lockup + a "Watch the video" CTA that links to a
// Wistia video. Falkor's fullscreen-player choreography (wheel-to-dismiss +
// GSAP scale-to-fullscreen + scroll-lock + nav hiding) is deliberately NOT
// ported: the CTA is an authored Wistia link wired via the shared
// wireVideoModalLinks util, which already gives an accessible modal (focus
// trap, Escape, backdrop close, announce). Cells are classified by content
// shape (F-66), never position: the pure-media cell is the image, every other
// cell is the statement/CTA. Authoring note: keep the image cell caption-free
// — a caption gives that cell text, so the classifier treats it as content and
// it renders inline instead of as the full-bleed background (put captions in
// the statement cell; same media-cell contract as media-with-text). Motion is
// a faithful, minimal mapping of Falkor's useScrollProgress fade — shared
// trackScrollProgress(el) sets --progress
// (0..1) and CSS drifts/fades the media off it (compositor-only). No-op under
// reduced motion / save-data — CSS's var(--progress, 0) fallback leaves a
// static, readable resting DOM (image + statement + CTA).
import { decorateRichText } from '../../scripts/utils/richtext.js';
import { wireVideoModalLinks } from '../../scripts/utils/modal/video-modal.js';
import {
  createElement, getCells, HEADING_SELECTOR, classifyCtaParagraphs,
} from '../../scripts/utils/dom.js';
import { guardDecorate } from '../../scripts/utils/lifecycle.js';
import { shouldAnimate } from '../../scripts/utils/motion/motion.js';
import { trackScrollProgress } from '../../scripts/utils/motion/scroll.js';

export default (el) => {
  // Idempotent under DA Quick-Edit re-decoration — a second pass would
  // otherwise re-find the cells and re-wire a second click listener onto the
  // still-present Wistia link.
  if (!guardDecorate(el, 'manifesto')) return;

  // Classified by shape, not position: the pure-media cell (a picture/img
  // carrying no text) is the manifesto image; every remaining cell holds the
  // statement richtext and/or the authored "Watch the video" Wistia link.
  // Requiring the media cell to be text-free keeps a statement that references
  // an inline mark from being misread as the image.
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
    wireVideoModalLinks(content);
  }

  el.replaceChildren(...[media, content].filter(Boolean));

  if (!shouldAnimate()) return; // resting DOM is the static image + statement + CTA
  el.classList.add('is-animating');
  // Sets --progress (0..1) on el as the section scrolls; CSS fades/drifts the
  // media off it. Progress halts the moment scrolling stops (no continuous
  // motion), so no WCAG 2.2.2 pause control is required. The disposer is
  // intentionally discarded — same page-lifetime trade-off documented in
  // chiclet-constellation.js / pothole.js (scroll.js owns the observer; a DA
  // node swap leaks a bounded, author-only observer, never a prod concern).
  trackScrollProgress(el);
};
