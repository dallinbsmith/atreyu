// Vanilla port of Falkor's HeroSideBySide module — a two-column hero
// (eyebrow/title/body/CTAs next to a video or image), verified against 2
// real instances in the live Sanity dataset (features/workflow-management,
// homepage). Reuses the same video-behind-poster-picture convention as
// hero.js/hero-screen.js (scripts/utils/media.js) and the same text/media
// two-column grid idiom as the body-content side-by-side block — kept as
// its own block per the no-nested-blocks rule, not a variant of either.
import { decorateRichText } from '../../scripts/utils/richtext.js';
import { wireVideoModalLinks } from '../../scripts/utils/modal/video-modal.js';
import {
  createElement, classifyCtaParagraphs, getCells, HEADING_SELECTOR,
} from '../../scripts/utils/dom.js';
import { decorateVideoMedia } from '../../scripts/utils/media.js';

export default (el) => {
  // Idempotency guard — a second decorate() call would otherwise re-find the
  // same cells and re-wire a second click listener onto the video link.
  if (el.dataset.heroSideBySideDecorated) return;
  el.dataset.heroSideBySideDecorated = 'true';

  // Cell, not row: a picture cell with a sibling text cell must not sweep
  // that sibling into `.hero-side-by-side-media` (overflow:hidden + abs
  // picture would clip it). Same F-66 pattern as hero.js / hero-transition-v4.
  const cells = getCells(el);
  const picCell = cells.find((c) => c.querySelector('picture'));
  const extra = cells.filter((c) => c !== picCell);

  const content = createElement('div', { className: 'hero-side-by-side-content' }, ...extra);
  classifyCtaParagraphs(content, 'hero-side-by-side-cta');
  wireVideoModalLinks(content);
  const hasText = content.querySelector(`${HEADING_SELECTOR}, p`);
  const media = picCell && createElement(
    'div',
    { className: 'hero-side-by-side-media' },
    ...picCell.children,
  );
  if (media) decorateVideoMedia(media);
  else el.classList.add('no-media');
  if (!hasText) el.classList.add('no-text');

  // DOM order text→media for a11y; CSS flips visually.
  el.replaceChildren(...(hasText ? [content] : []), ...(media ? [media] : []));
  decorateRichText(el);
};
